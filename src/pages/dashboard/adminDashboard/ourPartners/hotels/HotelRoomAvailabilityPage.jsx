import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { ArrowBackIcon } from "@icons";
import { ArrowBackIosNewIcon } from "@icons";
import { ArrowForwardIosIcon } from "@icons";
import { AddIcon } from "@icons";
import { BlockIcon } from "@icons";
import { RefreshIcon } from "@icons";
import { CalendarMonthIcon } from "@icons";
import { SettingsIcon } from "@icons";
import { MeetingRoomIcon } from "@icons";
import { EventBusyIcon } from "@icons";
import { WarningAmberIcon } from "@icons";
import { LayersIcon } from "@icons";
import { ExpandMoreIcon } from "@icons";
import { ExpandLessIcon } from "@icons";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import {
  db,
  hotelsCollection,
} from "../../../../../firebase/firebase.config";
import PageHeading from "../../../../../components/PageHeading";
import LoadingContent from "../../../../../components/LoadingContent";
import {
  getHotelAvailabilityCalendar,
  setBookableWindow,
  setTotalRooms,
  addExtraRooms,
  blockRooms,
  endAvailabilityAdjustment,
  availabilityColour,
  colourClasses,
} from "../../../../../services/HotelAvailability";
import {
  successNotification,
  deleteNotification,
} from "../../../../../utils/utils";

const toYmd = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toYmd(d);
};

/** First / last calendar day of month containing ymd. */
const monthBounds = (ymd) => {
  const d = new Date(`${ymd || toYmd(new Date())}T12:00:00`);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: toYmd(start), end: toYmd(end), year: d.getFullYear(), month: d.getMonth() };
};

const shiftMonth = (ymd, deltaMonths) => {
  const d = new Date(`${ymd || toYmd(new Date())}T12:00:00`);
  d.setMonth(d.getMonth() + deltaMonths);
  return monthBounds(toYmd(d));
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_OPTIONS = [
  { value: 0, label: "January" },
  { value: 1, label: "February" },
  { value: 2, label: "March" },
  { value: 3, label: "April" },
  { value: 4, label: "May" },
  { value: 5, label: "June" },
  { value: 6, label: "July" },
  { value: 7, label: "August" },
  { value: 8, label: "September" },
  { value: 9, label: "October" },
  { value: 10, label: "November" },
  { value: 11, label: "December" },
];

/** Year list for jump filter (past 3 years → next 5 years). */
const buildYearOptions = (centerYear = new Date().getFullYear()) => {
  const years = [];
  for (let y = centerYear - 3; y <= centerYear + 5; y += 1) {
    years.push(y);
  }
  return years;
};

const STAY_BAR_COLORS = [
  "bg-primary-600 border-primary-700",
  "bg-primary-500 border-primary-600",
  "bg-violet-500 border-violet-600",
  "bg-teal-600 border-teal-700",
  "bg-amber-500 border-amber-600",
  "bg-rose-500 border-rose-600",
  "bg-emerald-600 border-emerald-700",
  "bg-slate-600 border-slate-700",
];

const btnPrimarySx = {
  textTransform: "none",
  borderRadius: "10px",
  fontWeight: 600,
  boxShadow: "none",
  bgcolor: "var(--primary-600)",
  "&:hover": { bgcolor: "var(--primary-700)", boxShadow: "none" },
};

const btnOutlineSx = {
  textTransform: "none",
  borderRadius: "10px",
  fontWeight: 600,
  borderColor: "var(--primary-200, #bfdbfe)",
  color: "var(--primary-700)",
  "&:hover": {
    borderColor: "var(--primary-500)",
    bgcolor: "var(--primary-50)",
  },
};

const roomLabel = (room) =>
  room?.roomName || room?.packageName || room?.name || room?.id || "Room";

const roomQty = (room) => {
  const raw = room?.totalRooms ?? room?.quantity ?? room?.numberOfRooms;
  if (raw === undefined || raw === null || raw === "") {
    return 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Build month grid cells (null = padding outside month). */
const buildMonthGrid = (year, month, nightsByDate) => {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPad = first.getDay(); // 0 = Sunday
  const cells = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const ymd = toYmd(new Date(year, month, day));
    cells.push({
      date: ymd,
      day,
      night: nightsByDate.get(ymd) || null,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

/**
 * Position a stay bar on the timeline for nights in [rangeStart, rangeEnd].
 * Stay occupies [checkIn, checkOut) — bar ends at last occupied night.
 */
const stayBarLayout = (booking, nights) => {
  if (!nights?.length) return null;
  const rangeStart = nights[0].date;
  const rangeEnd = nights[nights.length - 1].date;
  const checkIn = booking.checkIn;
  const checkOut = booking.checkOut;
  if (!checkIn || !checkOut || checkIn === "—" || checkOut === "—") return null;

  // Last night of stay is day before checkout
  const lastNight = addDays(checkOut, -1);
  if (!lastNight || lastNight < checkIn) return null;

  // Clip to visible range
  const barStart = checkIn < rangeStart ? rangeStart : checkIn;
  const barEnd = lastNight > rangeEnd ? rangeEnd : lastNight;
  if (barStart > rangeEnd || barEnd < rangeStart || barStart > barEnd) {
    return null;
  }

  const startIdx = nights.findIndex((n) => n.date === barStart);
  const endIdx = nights.findIndex((n) => n.date === barEnd);
  if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) return null;

  const total = nights.length;
  const leftPct = (startIdx / total) * 100;
  const widthPct = ((endIdx - startIdx + 1) / total) * 100;

  return {
    leftPct,
    widthPct,
    barStart,
    barEnd,
    clipped: barStart !== checkIn || barEnd !== lastNight,
  };
};

/**
 * Availability only — room types come from Add/Edit Hotel (HotelDB/.../rooms).
 * No room-type create/edit UI here.
 */
const HotelRoomAvailabilityPage = () => {
  const { hotelId } = useParams();
  const navigate = useNavigate();

  const backToList = () => navigate("/dashboard/hotel-room-availability");

  const initialMonth = monthBounds(toYmd(new Date()));

  const [loading, setLoading] = useState(true);
  const [hotel, setHotel] = useState(null);
  const [roomTypes, setRoomTypes] = useState([]);
  const [roomId, setRoomId] = useState("");
  // Default: full current month so future stays (and overlaps) are visible by range
  const [startDate, setStartDate] = useState(initialMonth.start);
  const [endDate, setEndDate] = useState(initialMonth.end);
  const [nights, setNights] = useState([]);
  const [bookingsInRange, setBookingsInRange] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedStayId, setSelectedStayId] = useState(null);
  const [adjustments, setAdjustments] = useState([]);
  const [availabilityConfig, setAvailabilityConfig] = useState({
    bookingOpenFrom: "",
    bookingOpenTo: "",
    notifyOnFull: true,
    notifyOnFreed: true,
    autoBookingEnabled: false,
    configured: false,
    defaultRoomInventory: 5, // starting value for newly created room types only
  });
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const [showDetailTable, setShowDetailTable] = useState(false);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustType, setAdjustType] = useState("extra");
  /** qtyByRoomId: { [roomTypeId]: number } — multi-type extras/blocks in one range */
  const [adjustForm, setAdjustForm] = useState({
    startDate: toYmd(new Date()),
    endDate: addDays(toYmd(new Date()), 7),
    qtyByRoomId: {},
    reason: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  /** Settings tab: which type to edit default stock for */
  const [settingsTypeId, setSettingsTypeId] = useState("");
  const [settingsQtyDraft, setSettingsQtyDraft] = useState("5");

  const hotelName = useMemo(() => {
    if (!hotel) return "Hotel";
    return (
      hotel.hotelInformation?.hotelName ||
      hotel.hotelName ||
      hotel.hotel?.hotelName ||
      "Hotel"
    );
  }, [hotel]);

  const selectedRoom = useMemo(
    () => roomTypes.find((r) => r.id === roomId) || null,
    [roomTypes, roomId]
  );

  /** Stats for selected room type + date range */
  const rangeStats = useMemo(() => {
    const def = availabilityConfig.defaultRoomInventory || 5;
    const inventory = selectedRoom ? roomQty(selectedRoom, def) : 0;
    const totalRoomTypes = roomTypes.length;
    const totalInventoryAll = roomTypes.reduce(
      (s, r) => s + roomQty(r, def),
      0
    );
    const activeAdj = adjustments.length;

    if (!nights.length) {
      return {
        inventory,
        totalRoomTypes,
        totalInventoryAll,
        activeAdj,
        almostFullDays: 0,
        fullDays: 0,
        avgRemaining: 0,
        peakBooked: 0,
        occupancyPct: 0,
      };
    }

    let almostFullDays = 0;
    let fullDays = 0;
    let sumRemaining = 0;
    let peakBooked = 0;

    nights.forEach((n) => {
      const colour = availabilityColour(n);
      if (colour === "red" || colour === "grey") fullDays += 1;
      else if (colour === "orange") almostFullDays += 1;
      sumRemaining += Number(n.remaining) || 0;
      peakBooked = Math.max(peakBooked, Number(n.reserved) || 0);
    });

    const avgRemaining =
      nights.length > 0 ? Math.round(sumRemaining / nights.length) : 0;
    const capacityPerDay = inventory || 1;
    const avgBooked =
      nights.reduce((s, n) => s + (Number(n.reserved) || 0), 0) /
      nights.length;
    const occupancyPct = Math.min(
      100,
      Math.round((avgBooked / capacityPerDay) * 100)
    );

    return {
      inventory,
      totalRoomTypes,
      totalInventoryAll,
      activeAdj,
      almostFullDays,
      fullDays,
      avgRemaining,
      peakBooked,
      occupancyPct,
    };
  }, [
    nights,
    adjustments,
    roomTypes,
    selectedRoom,
    availabilityConfig.defaultRoomInventory,
  ]);

  const nightsByDate = useMemo(() => {
    const map = new Map();
    (nights || []).forEach((n) => map.set(n.date, n));
    return map;
  }, [nights]);

  /** Month grid for the month of startDate (primary navigation unit). */
  const monthMeta = useMemo(() => monthBounds(startDate), [startDate]);

  const monthGridCells = useMemo(
    () => buildMonthGrid(monthMeta.year, monthMeta.month, nightsByDate),
    [monthMeta.year, monthMeta.month, nightsByDate]
  );

  const stayRows = useMemo(() => {
    return (bookingsInRange || [])
      .map((b, i) => {
        const layout = stayBarLayout(b, nights);
        if (!layout) return null;
        return {
          booking: b,
          layout,
          colorClass: STAY_BAR_COLORS[i % STAY_BAR_COLORS.length],
        };
      })
      .filter(Boolean);
  }, [bookingsInRange, nights]);

  const selectedNight = useMemo(
    () => (selectedDay ? nightsByDate.get(selectedDay) || null : null),
    [selectedDay, nightsByDate]
  );

  const goToMonth = useCallback((ymdOrDelta) => {
    const bounds =
      typeof ymdOrDelta === "number"
        ? shiftMonth(startDate, ymdOrDelta)
        : monthBounds(ymdOrDelta);
    setStartDate(bounds.start);
    setEndDate(bounds.end);
    setSelectedDay(null);
    setSelectedStayId(null);
  }, [startDate]);

  /** Jump to any month of any year (full calendar month range). */
  const goToYearMonth = useCallback((year, monthIndex) => {
    const y = Number(year);
    const m = Number(monthIndex);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 0 || m > 11) return;
    const start = toYmd(new Date(y, m, 1));
    const end = toYmd(new Date(y, m + 1, 0));
    setStartDate(start);
    setEndDate(end);
    setSelectedDay(null);
    setSelectedStayId(null);
  }, []);

  const yearOptions = useMemo(() => {
    const base = buildYearOptions();
    const current = monthMeta.year;
    if (!base.includes(current)) {
      return [...base, current].sort((a, b) => a - b);
    }
    return base;
  }, [monthMeta.year]);

  useEffect(() => {
    if (!hotelId) return;
    let unsubRooms = () => {};

    const load = async () => {
      setLoading(true);
      try {
        // Load hotel first — config must not block hotel resolution (permission
        // errors on availability/config previously surfaced as "Hotel not found").
        const snap = await getDoc(doc(hotelsCollection, hotelId));
        if (!snap.exists()) {
          setHotel(null);
          return;
        }
        const data = { ...snap.data(), uid: snap.id };
        setHotel(data);

        let cfg =
          data.availabilityConfig || data.hotel?.availabilityConfig || {};
        let configured = Boolean(
          data.availabilityConfig || data.hotel?.availabilityConfig
        );
        try {
          const configSnap = await getDoc(
            doc(db, "HotelDB", String(hotelId), "availability", "config")
          );
          if (configSnap.exists()) {
            cfg = configSnap.data() || cfg;
            configured = true;
          }
        } catch (configErr) {
          console.warn(
            "[HotelRoomAvailability] config read failed; using hotel defaults",
            configErr
          );
        }
        setAvailabilityConfig({
          bookingOpenFrom: cfg.bookingOpenFrom || "",
          bookingOpenTo: cfg.bookingOpenTo || "",
          notifyOnFull: cfg.notifyOnFull !== false,
          notifyOnFreed: cfg.notifyOnFreed !== false,
          autoBookingEnabled: configured && cfg.autoBookingEnabled !== false,
          configured,
          defaultRoomInventory: Number(cfg.defaultRoomInventory) || 5,
        });
      } catch (err) {
        console.error("[HotelRoomAvailability] hotel load failed", err);
        setHotel(null);
      } finally {
        setLoading(false);
      }
    };

    load();

    // Room types from Add Hotel flow only
    unsubRooms = onSnapshot(
      collection(db, "HotelDB", String(hotelId), "rooms"),
      (result) => {
        // Always string ids — numeric room ids break Firestore paths
        const list = result.docs.map((d) => ({
          id: String(d.id),
          ...d.data(),
        }));
        setRoomTypes(list);
        setRoomId((prev) => {
          const prevStr = prev != null && prev !== "" ? String(prev) : "";
          if (prevStr && list.some((r) => r.id === prevStr)) return prevStr;
          return list[0]?.id || "";
        });
      },
      (err) => {
        console.error(err);
        setRoomTypes([]);
      }
    );

    return () => unsubRooms();
  }, [hotelId]);

  // Settings tab: keep type picker in sync with room list / calendar selection
  useEffect(() => {
    if (!roomTypes.length) {
      setSettingsTypeId("");
      setSettingsQtyDraft("5");
      return;
    }
    setSettingsTypeId((prev) => {
      if (prev && roomTypes.some((r) => r.id === prev)) return prev;
      if (roomId && roomTypes.some((r) => r.id === roomId)) return roomId;
      return roomTypes[0].id;
    });
  }, [roomTypes, roomId]);

  useEffect(() => {
    if (!settingsTypeId) return;
    const room = roomTypes.find((r) => r.id === settingsTypeId);
    if (!room) return;
    setSettingsQtyDraft(
      String(roomQty(room, availabilityConfig.defaultRoomInventory || 5))
    );
  }, [
    settingsTypeId,
    roomTypes,
    availabilityConfig.defaultRoomInventory,
  ]);

  const refreshCalendar = useCallback(async () => {
    if (!hotelId || !roomId || !startDate || !endDate) return;
    setCalendarLoading(true);
    try {
      const data = await getHotelAvailabilityCalendar({
        hotelUid: String(hotelId),
        packageId: String(roomId),
        startDate: String(startDate),
        endDate: String(endDate),
      });
      setNights(data.nights || []);
      setBookingsInRange(data.bookingsInRange || []);
      setSelectedDay(null);
      setSelectedStayId(null);
      setAdjustments(data.adjustments || []);
      if (data.availabilityConfig) {
        setAvailabilityConfig((prev) => ({
          ...prev,
          bookingOpenFrom: data.availabilityConfig.bookingOpenFrom || "",
          bookingOpenTo: data.availabilityConfig.bookingOpenTo || "",
          notifyOnFull: data.availabilityConfig.notifyOnFull !== false,
          notifyOnFreed: data.availabilityConfig.notifyOnFreed !== false,
          autoBookingEnabled:
            data.availabilityConfig.autoBookingEnabled !== false,
          configured: data.availabilityConfig.configured !== false,
          defaultRoomInventory:
            Number(data.availabilityConfig.defaultRoomInventory) || 5,
        }));
      }
    } catch (e) {
      console.error("[RoomAvailability] calendar load failed", e);
      const msg =
        typeof e?.message === "string"
          ? e.message
          : typeof e === "string"
            ? e
            : "Failed to load availability calendar.";
      deleteNotification(msg);
      setNights([]);
      setBookingsInRange([]);
      setSelectedDay(null);
      setSelectedStayId(null);
      setAdjustments([]);
    } finally {
      setCalendarLoading(false);
    }
  }, [hotelId, roomId, startDate, endDate]);

  useEffect(() => {
    refreshCalendar();
  }, [refreshCalendar]);

  const handleSaveWindow = async () => {
    setSaving(true);
    try {
      await setBookableWindow(hotelId, {
        bookingOpenFrom: availabilityConfig.bookingOpenFrom || null,
        bookingOpenTo: availabilityConfig.bookingOpenTo || null,
        notifyOnFull: availabilityConfig.notifyOnFull,
        notifyOnFreed: availabilityConfig.notifyOnFreed,
        autoBookingEnabled: availabilityConfig.autoBookingEnabled !== false,
        defaultRoomInventory:
          Number(availabilityConfig.defaultRoomInventory) || 5,
      });
      setAvailabilityConfig((current) => ({
        ...current,
        configured: true,
      }));
      await refreshCalendar();
      successNotification("Hotel availability settings saved.");
    } catch (e) {
      console.error(e);
      deleteNotification(e?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  /** Settings: set explicit sellable stock for a chosen room type. */
  const handleSaveTypeDefault = async () => {
    if (!hotelId || !settingsTypeId) {
      deleteNotification("Choose a room type.");
      return;
    }
    const n = parseInt(settingsQtyDraft, 10);
    if (!Number.isFinite(n) || n < 1) {
      deleteNotification("Enter the actual sellable room count (at least 1).");
      return;
    }
    setSaving(true);
    try {
      await setTotalRooms(hotelId, settingsTypeId, n);
      const name =
        roomLabel(roomTypes.find((r) => r.id === settingsTypeId)) || "Room type";
      successNotification(`${name}: inventory set to ${n} room(s).`);
      await refreshCalendar();
    } catch (e) {
      console.error(e);
      deleteNotification(e?.message || "Failed to save room inventory.");
    } finally {
      setSaving(false);
    }
  };

  const openAdjust = (type) => {
    if (!roomTypes.length) {
      deleteNotification("Add room types on the hotel first.");
      return;
    }
    setAdjustType(type);
    // Pre-fill the currently selected type with 1; others start empty (skipped)
    const qtyByRoomId = {};
    roomTypes.forEach((r) => {
      qtyByRoomId[r.id] = r.id === roomId ? 1 : "";
    });
    setAdjustForm({
      startDate,
      endDate,
      qtyByRoomId,
      reason: type === "blocked" ? "Maintenance" : "Extra inventory",
      note: "",
    });
    setAdjustOpen(true);
  };

  const setAdjustQty = (typeId, value) => {
    setAdjustForm((p) => ({
      ...p,
      qtyByRoomId: {
        ...p.qtyByRoomId,
        [typeId]: value,
      },
    }));
  };

  const handleSubmitAdjust = async () => {
    if (!hotelId) return;
    if (!adjustForm.startDate || !adjustForm.endDate) {
      deleteNotification("Start and end dates are required.");
      return;
    }
    if (adjustForm.startDate > adjustForm.endDate) {
      deleteNotification("Start date must be on or before end date.");
      return;
    }

    const rows = roomTypes
      .map((r) => {
        const raw = adjustForm.qtyByRoomId?.[r.id];
        const qty = Math.floor(Number(raw));
        return {
          room: r,
          packageId: r.id,
          quantity: Number.isFinite(qty) && qty > 0 ? qty : 0,
        };
      })
      .filter((row) => row.quantity > 0);

    if (rows.length === 0) {
      deleteNotification(
        "Enter how many rooms to add for at least one room type (e.g. Type A = 3, Type B = 2)."
      );
      return;
    }

    setSaving(true);
    try {
      const results = [];
      for (const row of rows) {
        const payload = {
          hotelUid: hotelId,
          packageId: row.packageId,
          startDate: adjustForm.startDate,
          endDate: adjustForm.endDate,
          delta: row.quantity,
          quantity: row.quantity,
          reason: adjustForm.reason,
          note: adjustForm.note,
          roomTypeName: roomLabel(row.room),
        };
        if (adjustType === "extra") {
          await addExtraRooms(payload);
        } else {
          await blockRooms(payload);
        }
        results.push(`${roomLabel(row.room)}: ${row.quantity}`);
      }

      const verb = adjustType === "extra" ? "Extra rooms added" : "Rooms blocked";
      successNotification(
        `${verb} for ${adjustForm.startDate} → ${adjustForm.endDate}: ${results.join("; ")}`
      );
      setAdjustOpen(false);
      await refreshCalendar();
    } catch (e) {
      console.error(e);
      deleteNotification(
        e?.message || e?.details || "Could not apply availability change."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEndAdjustment = async (id) => {
    if (!confirm("End this temporary availability change?")) return;
    try {
      await endAvailabilityAdjustment(hotelId, id);
      successNotification("Adjustment ended.");
      await refreshCalendar();
    } catch (e) {
      deleteNotification(e?.message || "Failed to end adjustment.");
    }
  };

  if (loading) return <LoadingContent />;

  if (!hotel) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3">
        <Typography variant="h5">Hotel not found</Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={backToList}>
          Back to Room Availability
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 pb-10">
      <div className="flex flex-wrap items-start gap-4">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={backToList}
          variant="outlined"
          sx={{ ...btnOutlineSx, mt: 1 }}
        >
          Back
        </Button>
        <div className="flex-1 min-w-[220px]">
          <PageHeading
            text="Room Availability"
            subtitle={`${hotelName} · Auto-book ${
              availabilityConfig.autoBookingEnabled !== false ? "ON" : "OFF"
            }`}
            icon="🛏️"
            className="mb-2"
          />
        </div>
        <Button
          variant="outlined"
          onClick={() => navigate(`/dashboard/hotels/edit/${hotelId}`)}
          sx={{ ...btnOutlineSx, mt: 1 }}
        >
          Edit hotel / room types
        </Button>
      </div>

      {/* Main statistics for this hotel / selected type */}
      <div>
        <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Main statistics
          </h2>
          <span className="text-xs text-neutral-500">
            {selectedRoom
              ? roomLabel(selectedRoom)
              : "Select a room type"}{" "}
            · {startDate} → {endDate}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 p-4 shadow-lg text-white transition-transform duration-200 hover:scale-[1.02]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-primary-100">
                Room types
              </p>
              <div className="bg-white/20 p-1.5 rounded-lg flex items-center justify-center">
                <LayersIcon sx={{ fontSize: 18, color: "white" }} />
              </div>
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums text-white">
              {rangeStats.totalRoomTypes}
            </p>
            <p className="text-[11px] text-primary-100/80">
              {rangeStats.totalInventoryAll} total inventory
            </p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-success-500 to-success-600 p-4 shadow-lg text-white transition-transform duration-200 hover:scale-[1.02]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-success-100">
                This type stock
              </p>
              <div className="bg-white/20 p-1.5 rounded-lg flex items-center justify-center">
                <MeetingRoomIcon
                  sx={{ fontSize: 18, color: "white" }}
                />
              </div>
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums text-white">
              {rangeStats.inventory}
            </p>
            <p className="text-[11px] text-success-100/80">Normal quantity</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-warning-500 to-warning-600 p-4 shadow-lg text-white transition-transform duration-200 hover:scale-[1.02]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-warning-100">
                Almost full
              </p>
              <div className="bg-white/20 p-1.5 rounded-lg flex items-center justify-center">
                <WarningAmberIcon sx={{ fontSize: 18, color: "white" }} />
              </div>
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums text-white">
              {rangeStats.almostFullDays}
            </p>
            <p className="text-[11px] text-warning-100/80">nights low stock</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-danger-500 to-danger-600 p-4 shadow-lg text-white transition-transform duration-200 hover:scale-[1.02]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-danger-100">
                Full / blocked
              </p>
              <div className="bg-white/20 p-1.5 rounded-lg flex items-center justify-center">
                <EventBusyIcon sx={{ fontSize: 18, color: "white" }} />
              </div>
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums text-white">
              {rangeStats.fullDays}
            </p>
            <p className="text-[11px] text-danger-100/80">nights sold out</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-secondary-500 to-secondary-600 p-4 shadow-lg text-white transition-transform duration-200 hover:scale-[1.02]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-secondary-100">
                Avg free / peak
              </p>
              <div className="bg-white/20 p-1.5 rounded-lg flex items-center justify-center">
                <CalendarMonthIcon
                  sx={{ fontSize: 18, color: "white" }}
                />
              </div>
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums text-white">
              {rangeStats.avgRemaining}
              <span className="text-base font-semibold text-white/80">
                {" "}
                / {rangeStats.peakBooked}
              </span>
            </p>
            <p className="text-[11px] text-secondary-100/80">
              ~{rangeStats.occupancyPct}% occ. · {rangeStats.activeAdj} temp
              changes
            </p>
          </div>
        </div>
      </div>

      {roomTypes.length === 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm px-4 py-3">
          This hotel has no room types yet. Add room types (with inventory
          quantity) when you{" "}
          <button
            type="button"
            className="underline font-semibold"
            onClick={() => navigate(`/dashboard/hotels/edit/${hotelId}`)}
          >
            edit the hotel
          </button>
          . Do not re-create rooms here.
        </div>
      )}

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 1,
          minHeight: 44,
          "& .MuiTab-root": {
            textTransform: "none",
            fontWeight: 600,
            minHeight: 44,
          },
          "& .Mui-selected": { color: "var(--primary-700) !important" },
          "& .MuiTabs-indicator": { backgroundColor: "var(--primary-600)" },
        }}
      >
        <Tab
          icon={<CalendarMonthIcon />}
          iconPosition="start"
          label="Calendar"
        />
        <Tab
          icon={<SettingsIcon />}
          iconPosition="start"
          label="Window & temporary changes"
        />
      </Tabs>

      {tab === 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <FormControl size="small" sx={{ minWidth: 220, flex: "1 1 200px" }}>
              <InputLabel id="calendar-room-type-label">Room type</InputLabel>
              <Select
                labelId="calendar-room-type-label"
                label="Room type"
                value={roomId || ""}
                onChange={(e) => setRoomId(String(e.target.value))}
                sx={{ borderRadius: "10px" }}
              >
                {roomTypes.length === 0 && (
                  <MenuItem value="" disabled>
                    No room types — edit hotel
                  </MenuItem>
                )}
                {roomTypes.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {roomLabel(r)}
                    {` · ${roomQty(r, availabilityConfig.defaultRoomInventory || 5)} rooms`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              disabled={!roomTypes.length}
              onClick={() => openAdjust("extra")}
              sx={btnPrimarySx}
            >
              Add rooms (date range)
            </Button>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<BlockIcon />}
              disabled={!roomTypes.length}
              onClick={() => openAdjust("blocked")}
              sx={{
                textTransform: "none",
                borderRadius: "10px",
                fontWeight: 600,
              }}
            >
              Block rooms (date range)
            </Button>
            <Tooltip title="Refresh">
              <span>
                <IconButton
                  onClick={refreshCalendar}
                  disabled={calendarLoading}
                  sx={{
                    color: "var(--primary-600)",
                    border: "1px solid",
                    borderColor: "var(--primary-100)",
                    borderRadius: "10px",
                  }}
                >
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`px-2 py-1 rounded border ${colourClasses.green}`}>
              Available
            </span>
            <span className={`px-2 py-1 rounded border ${colourClasses.orange}`}>
              Almost full
            </span>
            <span className={`px-2 py-1 rounded border ${colourClasses.red}`}>
              Full
            </span>
            <span className={`px-2 py-1 rounded border ${colourClasses.blue}`}>
              Extra active
            </span>
            <span className={`px-2 py-1 rounded border ${colourClasses.grey}`}>
              Blocked / none
            </span>
            <span className="px-2 py-1 rounded border bg-primary-50 text-primary-800 border-primary-200">
              Bars = stay ranges · overlap stacks rooms
            </span>
          </div>

          {calendarLoading ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-10">
              <LoadingContent />
            </div>
          ) : !roomId ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center text-neutral-500">
              Select a room type from this hotel.
            </div>
          ) : (
            <>
              {/* Month navigator + heat calendar + day detail */}
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                <div className="xl:col-span-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-neutral-800">
                        Month calendar
                      </h3>
                      <p className="text-xs text-neutral-500">
                        Remaining rooms per night after overlapping stays
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <IconButton
                        size="small"
                        onClick={() => goToMonth(-1)}
                        aria-label="Previous month"
                      >
                        <ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                      <FormControl size="small" sx={{ minWidth: 130 }}>
                        <Select
                          value={monthMeta.month}
                          displayEmpty
                          onChange={(e) =>
                            goToYearMonth(monthMeta.year, Number(e.target.value))
                          }
                          sx={{
                            fontWeight: 600,
                            fontSize: 13,
                            borderRadius: "10px",
                          }}
                        >
                          {MONTH_OPTIONS.map((m) => (
                            <MenuItem key={m.value} value={m.value}>
                              {m.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl size="small" sx={{ minWidth: 88 }}>
                        <Select
                          value={monthMeta.year}
                          onChange={(e) =>
                            goToYearMonth(
                              Number(e.target.value),
                              monthMeta.month
                            )
                          }
                          sx={{
                            fontWeight: 600,
                            fontSize: 13,
                            borderRadius: "10px",
                          }}
                        >
                          {yearOptions.map((y) => (
                            <MenuItem key={y} value={y}>
                              {y}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <IconButton
                        size="small"
                        onClick={() => goToMonth(1)}
                        aria-label="Next month"
                      >
                        <ArrowForwardIosIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    {WEEKDAYS.map((d) => (
                      <div key={d} className="py-1">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {monthGridCells.map((cell, idx) => {
                      if (!cell) {
                        return (
                          <div
                            key={`pad-${idx}`}
                            className="min-h-[4.25rem] rounded-lg bg-neutral-50/60"
                          />
                        );
                      }
                      const night = cell.night;
                      const colour = night
                        ? availabilityColour(night)
                        : "grey";
                      const isSel = selectedDay === cell.date;
                      const inLoadedRange =
                        cell.date >= startDate && cell.date <= endDate;
                      return (
                        <button
                          key={cell.date}
                          type="button"
                          disabled={!night}
                          onClick={() =>
                            setSelectedDay(isSel ? null : cell.date)
                          }
                          className={`min-h-[4.25rem] rounded-lg border p-1.5 text-left transition ${
                            isSel
                              ? "ring-2 ring-primary-400 border-primary-300"
                              : "border-transparent hover:border-primary-200"
                          } ${
                            night
                              ? colourClasses[colour]
                              : "bg-neutral-50 text-neutral-300"
                          } ${!inLoadedRange ? "opacity-50" : ""}`}
                          title={
                            night
                              ? `${cell.date}: ${night.remaining} free · ${night.booked || 0} booked · ${night.held || 0} on hold`
                              : cell.date
                          }
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-xs font-bold tabular-nums">
                              {cell.day}
                            </span>
                            {night && night.reserved > 0 ? (
                              <span className="text-[9px] font-semibold uppercase opacity-80">
                                busy
                              </span>
                            ) : null}
                          </div>
                          {night ? (
                            <>
                              <p className="mt-1 text-lg font-bold tabular-nums leading-none">
                                {night.remaining}
                              </p>
                              <p className="mt-0.5 text-[10px] opacity-80">
                                free · {night.booked || 0} booked · {night.held || 0} held
                              </p>
                            </>
                          ) : (
                            <p className="mt-2 text-[10px] opacity-60">—</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs text-neutral-500">
                    Number in each cell = rooms still free that night. Overlapping
                    stays add up (e.g. 1–10 and 4–8 both count on nights 4–7).
                  </p>
                </div>

                {/* Selected night detail */}
                <div className="xl:col-span-2 rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
                  <div className="border-b border-primary-100 bg-gradient-to-r from-primary-50 to-white px-4 py-3">
                    <h3 className="text-sm font-bold text-neutral-800">
                      Night detail
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {selectedDay
                        ? selectedDay
                        : "Click a day on the calendar"}
                    </p>
                  </div>
                  <div className="max-h-[28rem] overflow-y-auto p-4">
                    {!selectedDay || !selectedNight ? (
                      <p className="text-sm text-neutral-500">
                        Select a night to see every stay covering that date
                        (ranges that overlap).
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-xl bg-neutral-50 px-3 py-2">
                            <p className="text-[10px] uppercase text-neutral-500">
                              Normal
                            </p>
                            <p className="font-bold tabular-nums">
                              {selectedNight.base}
                            </p>
                          </div>
                          <div className="rounded-xl bg-primary-50 border border-primary-100 px-3 py-2">
                            <p className="text-[10px] uppercase text-primary-600">
                              Extra
                            </p>
                            <p className="font-bold tabular-nums text-primary-800">
                              {selectedNight.extra}
                            </p>
                          </div>
                          <div className="rounded-xl bg-neutral-100 px-3 py-2">
                            <p className="text-[10px] uppercase text-neutral-500">
                              Blocked
                            </p>
                            <p className="font-bold tabular-nums">
                              {selectedNight.blocked}
                            </p>
                          </div>
                          <div className="rounded-xl bg-primary-50 border border-primary-100 px-3 py-2">
                            <p className="text-[10px] uppercase text-primary-700">
                              Booked
                            </p>
                            <p className="font-bold tabular-nums text-primary-900">
                              {selectedNight.booked || 0}
                            </p>
                          </div>
                          <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
                            <p className="text-[10px] uppercase text-amber-700">
                              On hold
                            </p>
                            <p className="font-bold tabular-nums text-amber-900">
                              {selectedNight.held || 0}
                            </p>
                          </div>
                        </div>
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                          <p className="text-[10px] uppercase text-emerald-700">
                            Remaining
                          </p>
                          <p className="text-2xl font-bold tabular-nums text-emerald-900">
                            {selectedNight.remaining}
                          </p>
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                            Stays covering this night
                          </p>
                          {(selectedNight.bookings || []).length === 0 ? (
                            <p className="text-sm text-neutral-500">
                              No accepted stays on this night.
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {selectedNight.bookings.map((b) => (
                                <li
                                  key={`${selectedDay}-${b.id}`}
                                  className="rounded-xl border border-primary-100 bg-white px-3 py-2 text-xs shadow-sm"
                                >
                                  <p className="font-semibold text-neutral-900">
                                    {b.guest}
                                  </p>
                                  <p className="mt-0.5 text-neutral-600">
                                    <span className="font-medium text-primary-700">
                                      {b.checkIn} → {b.checkOut}
                                    </span>
                                    {" · "}
                                    {b.rooms} room(s)
                                  </p>
                                  {b.phone ? (
                                    <p className="text-neutral-500">{b.phone}</p>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                            Active checkout holds
                          </p>
                          {(selectedNight.holds || []).length === 0 ? (
                            <p className="text-sm text-neutral-500">
                              No active holds on this night.
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {selectedNight.holds.map((hold) => (
                                <li
                                  key={`${selectedDay}-${hold.id}`}
                                  className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs"
                                >
                                  <p className="font-semibold text-amber-900">
                                    {hold.rooms} room(s) held
                                  </p>
                                  <p className="text-amber-800">
                                    {hold.checkIn} → {hold.checkOut}
                                  </p>
                                  {hold.holdUntil && (
                                    <p className="text-amber-700">
                                      Expires {new Date(hold.holdUntil).toLocaleString()}
                                    </p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stay timeline — range bars with visible overlaps */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-800">
                      Stay ranges (timeline)
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Each bar is one booking from check-in → check-out. Overlapping
                      bars share nights and stack room counts.{" "}
                      <span className="font-medium text-neutral-700">
                        {startDate} → {endDate}
                      </span>
                    </p>
                  </div>
                  <span className="rounded-full bg-primary-50 border border-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-700">
                    {stayRows.length} stay(s)
                  </span>
                </div>

                {nights.length === 0 ? (
                  <p className="py-8 text-center text-sm text-neutral-500">
                    No nights in range. Adjust dates and refresh.
                  </p>
                ) : stayRows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-neutral-500">
                    No accepted stays overlapping this range for this room type.
                  </p>
                ) : (
                  <div className="space-y-3 overflow-x-auto">
                    {/* Date axis ticks */}
                    <div className="relative ml-0 min-w-[640px] border-b border-neutral-100 pb-1 pl-[8.5rem] sm:pl-40">
                      <div className="relative h-5">
                        {nights
                          .filter((_, i) => {
                            if (nights.length <= 14) return true;
                            if (nights.length <= 45) return i % 3 === 0 || i === nights.length - 1;
                            return i % 7 === 0 || i === nights.length - 1;
                          })
                          .map((n) => {
                            const idx = nights.findIndex((x) => x.date === n.date);
                            const left = ((idx + 0.5) / nights.length) * 100;
                            return (
                              <span
                                key={n.date}
                                className="absolute top-0 -translate-x-1/2 text-[9px] tabular-nums text-neutral-400"
                                style={{ left: `${left}%` }}
                              >
                                {n.date.slice(5)}
                              </span>
                            );
                          })}
                      </div>
                    </div>

                    {/* Occupancy strip under axis */}
                    <div className="min-w-[640px] pl-[8.5rem] sm:pl-40">
                      <div className="flex h-7 w-full overflow-hidden rounded-md border border-neutral-100">
                        {nights.map((n) => {
                          const colour = availabilityColour(n);
                          return (
                            <button
                              key={`strip-${n.date}`}
                              type="button"
                              title={`${n.date}: ${n.remaining} free / ${n.reserved} booked`}
                              onClick={() =>
                                setSelectedDay(
                                  selectedDay === n.date ? null : n.date
                                )
                              }
                              className={`min-w-0 flex-1 border-r border-white/40 text-[9px] font-bold tabular-nums leading-7 ${colourClasses[colour]} ${
                                selectedDay === n.date
                                  ? "ring-2 ring-inset ring-primary-500"
                                  : ""
                              }`}
                            >
                              {nights.length <= 45 ? n.remaining : ""}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1 text-[10px] text-neutral-400">
                        Strip = free rooms each night (click a night)
                      </p>
                    </div>

                    <div className="min-w-[640px] space-y-1.5">
                      {stayRows.map(({ booking: b, layout, colorClass }) => {
                        const stayKey = b.id || `${b.guest}-${b.checkIn}`;
                        const isSel = selectedStayId === stayKey;
                        return (
                          <div
                            key={stayKey}
                            className="flex items-center gap-2"
                          >
                            <div className="w-[8.5rem] shrink-0 sm:w-40">
                              <p className="truncate text-xs font-semibold text-neutral-800">
                                {b.guest}
                              </p>
                              <p className="truncate text-[10px] text-neutral-500">
                                {b.rooms} room(s)
                              </p>
                            </div>
                            <div className="relative h-9 flex-1 rounded-md bg-neutral-50">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStayId(isSel ? null : stayKey);
                                  setSelectedDay(b.checkIn);
                                }}
                                className={`absolute top-1 bottom-1 flex items-center overflow-hidden rounded-md border px-2 text-left text-white shadow-sm transition hover:brightness-110 ${colorClass} ${
                                  isSel ? "ring-2 ring-offset-1 ring-primary-400" : ""
                                }`}
                                style={{
                                  left: `${layout.leftPct}%`,
                                  width: `${Math.max(layout.widthPct, 1.5)}%`,
                                }}
                                title={`${b.guest}: ${b.checkIn} → ${b.checkOut} · ${b.rooms} room(s)`}
                              >
                                <span className="truncate text-[10px] font-semibold leading-tight">
                                  {b.checkIn.slice(5)}→{b.checkOut.slice(5)}
                                  {layout.clipped ? " …" : ""}
                                </span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {selectedStayId ? (
                      <div className="rounded-xl border border-primary-100 bg-primary-50/70 px-3 py-2 text-xs text-neutral-700">
                        {(() => {
                          const row = stayRows.find(
                            (r) =>
                              (r.booking.id ||
                                `${r.booking.guest}-${r.booking.checkIn}`) ===
                              selectedStayId
                          );
                          if (!row) return null;
                          const b = row.booking;
                          return (
                            <p>
                              <span className="font-semibold">{b.guest}</span>
                              {" · "}
                              {b.checkIn} → {b.checkOut}
                              {" · "}
                              {b.rooms} room(s)
                              {b.phone ? ` · ${b.phone}` : ""}
                              {" · "}
                              Status: {b.status}
                            </p>
                          );
                        })()}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Stays list (range-centric) */}
              <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
                  <h3 className="text-sm font-bold text-neutral-800">
                    All stays in range
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Accepted bookings as check-in → check-out (not day-by-day)
                  </p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {bookingsInRange.length === 0 ? (
                    <div className="p-6 text-center text-sm text-neutral-500">
                      No stays in this range
                    </div>
                  ) : (
                    <ul className="divide-y divide-neutral-100">
                      {bookingsInRange.map((b) => (
                        <li
                          key={b.id || `${b.guest}-${b.checkIn}`}
                          className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-neutral-50"
                        >
                          <div>
                            <p className="font-medium text-neutral-900">
                              {b.guest}
                            </p>
                            <p className="text-xs text-neutral-500">
                              <span className="font-semibold text-primary-700">
                                {b.checkIn} → {b.checkOut}
                              </span>
                              {" · "}
                              {b.rooms} room(s)
                              {b.phone ? ` · ${b.phone}` : ""}
                            </p>
                          </div>
                          <Chip
                            size="small"
                            label={b.status || "Accepted"}
                            sx={{ height: 22, fontSize: 11 }}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Optional night-by-night numbers */}
              <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowDetailTable((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-50"
                >
                  <div>
                    <h3 className="text-sm font-bold text-neutral-800">
                      Night-by-night table
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Optional detail: normal / extra / blocked / booked / remaining
                    </p>
                  </div>
                  {showDetailTable ? (
                    <ExpandLessIcon className="text-neutral-400" />
                  ) : (
                    <ExpandMoreIcon className="text-neutral-400" />
                  )}
                </button>
                {showDetailTable && (
                  <div className="overflow-x-auto border-t border-neutral-100">
                    {nights.length === 0 ? (
                      <p className="p-6 text-center text-sm text-neutral-500">
                        No nights in range.
                      </p>
                    ) : (
                      <table className="min-w-full text-sm">
                        <thead className="bg-neutral-50 text-neutral-600 uppercase text-xs sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left">Date</th>
                            <th className="px-3 py-3 text-center">Normal</th>
                            <th className="px-3 py-3 text-center">Extra</th>
                            <th className="px-3 py-3 text-center">Blocked</th>
                            <th className="px-3 py-3 text-center">On hold</th>
                            <th className="px-3 py-3 text-center">Booked</th>
                            <th className="px-3 py-3 text-center">Unclassified</th>
                            <th className="px-3 py-3 text-center">Remaining</th>
                            <th className="px-3 py-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {nights.map((night) => {
                            const colour = availabilityColour(night);
                            const isSel = selectedDay === night.date;
                            return (
                              <tr
                                key={night.date}
                                onClick={() =>
                                  setSelectedDay(isSel ? null : night.date)
                                }
                                className={`cursor-pointer transition-colors ${
                                  isSel
                                    ? "bg-primary-50 ring-1 ring-inset ring-primary-200"
                                    : "hover:bg-neutral-50"
                                }`}
                              >
                                <td className="px-4 py-2.5 font-medium text-neutral-800">
                                  {night.date}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {night.base}
                                </td>
                                <td className="px-3 py-2.5 text-center text-primary-700">
                                  {night.extra}
                                </td>
                                <td className="px-3 py-2.5 text-center text-neutral-500">
                                  {night.blocked}
                                </td>
                                <td className="px-3 py-2.5 text-center font-semibold text-amber-700">
                                  {night.held || 0}
                                </td>
                                <td className="px-3 py-2.5 text-center font-semibold text-primary-700">
                                  {night.booked || 0}
                                </td>
                                <td className="px-3 py-2.5 text-center text-neutral-500">
                                  {night.untracked || 0}
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold">
                                  {night.remaining}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <span
                                    className={`inline-block min-w-[5.5rem] px-2 py-1 rounded-full border text-xs font-semibold ${colourClasses[colour]}`}
                                  >
                                    {colour === "green" && "Available"}
                                    {colour === "orange" && "Almost full"}
                                    {colour === "red" && "Full"}
                                    {colour === "blue" && "Extra"}
                                    {colour === "grey" && "Blocked"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg text-neutral-800">
              Auto booking & window
            </h3>
            <p className="text-sm text-neutral-500">
              Auto-booking starts only after these settings are explicitly saved
              and every sellable room type has a room quantity.
            </p>
            {!availabilityConfig.configured && (
              <Alert severity="warning">
                Setup is incomplete. Automatic booking is safely disabled until
                you save these settings.
              </Alert>
            )}
            <FormControlLabel
              control={
                <Switch
                  checked={availabilityConfig.autoBookingEnabled !== false}
                  onChange={(e) =>
                    setAvailabilityConfig((p) => ({
                      ...p,
                      autoBookingEnabled: e.target.checked,
                    }))
                  }
                  color="success"
                />
              }
              label={
                availabilityConfig.autoBookingEnabled !== false
                  ? "Auto booking enabled"
                  : "Auto booking disabled — bookings stay pending"
              }
            />
            <div className="border-t border-neutral-100 pt-4 space-y-3">
              <h4 className="font-medium text-neutral-800">Bookable date window</h4>
              <p className="text-sm text-neutral-500">
                Leave empty for no date limit.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  type="date"
                  label="Open from"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={availabilityConfig.bookingOpenFrom || ""}
                  onChange={(e) =>
                    setAvailabilityConfig((p) => ({
                      ...p,
                      bookingOpenFrom: e.target.value,
                    }))
                  }
                />
                <TextField
                  type="date"
                  label="Open to"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={availabilityConfig.bookingOpenTo || ""}
                  onChange={(e) =>
                    setAvailabilityConfig((p) => ({
                      ...p,
                      bookingOpenTo: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <FormControlLabel
              control={
                <Switch
                  checked={availabilityConfig.notifyOnFull}
                  onChange={(e) =>
                    setAvailabilityConfig((p) => ({
                      ...p,
                      notifyOnFull: e.target.checked,
                    }))
                  }
                />
              }
              label="Notify when nights become full"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={availabilityConfig.notifyOnFreed}
                  onChange={(e) =>
                    setAvailabilityConfig((p) => ({
                      ...p,
                      notifyOnFreed: e.target.checked,
                    }))
                  }
                />
              }
              label="Notify when capacity is restored"
            />
            <Button
              variant="contained"
              disabled={saving}
              onClick={handleSaveWindow}
              sx={btnPrimarySx}
            >
              Save auto-booking & window settings
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg text-neutral-800">
              Sellable rooms by type
            </h3>
            <p className="text-sm text-neutral-500">
              Choose a room type, set how many rooms are available by default for
              that type, then save. Example: Deluxe = 5, Suite = 3.
            </p>

            {!roomTypes.length ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                No room types yet. Add them when editing the hotel.
              </p>
            ) : (
              <>
                <FormControl fullWidth size="small">
                  <InputLabel id="settings-room-type-label">
                    Choose room type
                  </InputLabel>
                  <Select
                    labelId="settings-room-type-label"
                    label="Choose room type"
                    value={settingsTypeId || ""}
                    onChange={(e) => setSettingsTypeId(String(e.target.value))}
                    sx={{ borderRadius: "10px" }}
                  >
                    {roomTypes.map((r) => (
                      <MenuItem key={r.id} value={r.id}>
                        {roomLabel(r)}
                        {` · current ${roomQty(
                          r,
                          availabilityConfig.defaultRoomInventory || 5
                        )} rooms`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="Total sellable rooms for this type"
                  size="small"
                  type="number"
                  fullWidth
                  inputProps={{ min: 1, step: 1 }}
                  value={settingsQtyDraft}
                  onChange={(e) => setSettingsQtyDraft(e.target.value)}
                  helperText="Normal sellable stock (before extras / blocks)"
                />

                <Button
                  variant="contained"
                  disabled={saving || !settingsTypeId}
                  onClick={handleSaveTypeDefault}
                  sx={btnPrimarySx}
                >
                  Save default for this type
                </Button>

                <div className="border-t border-neutral-100 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
                    All room types
                  </p>
                  <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-100 overflow-hidden">
                    {roomTypes.map((r) => {
                      const stock = roomQty(
                        r,
                        availabilityConfig.defaultRoomInventory || 5
                      );
                      const active = r.id === settingsTypeId;
                      return (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => setSettingsTypeId(r.id)}
                            className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition ${
                              active
                                ? "bg-primary-50"
                                : "bg-white hover:bg-neutral-50"
                            }`}
                          >
                            <span className="font-medium text-neutral-800 truncate">
                              {roomLabel(r)}
                            </span>
                            <span className="tabular-nums font-semibold text-primary-700">
                              {stock} rooms
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-3 lg:col-span-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold text-lg text-neutral-800">
                Active temporary changes
              </h3>
              <div className="flex gap-2">
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => openAdjust("extra")}
                  disabled={!roomTypes.length}
                >
                  Add rooms
                </Button>
                <Button
                  size="small"
                  color="warning"
                  startIcon={<BlockIcon />}
                  onClick={() => openAdjust("blocked")}
                  disabled={!roomTypes.length}
                >
                  Block
                </Button>
              </div>
            </div>
            {adjustments.length === 0 ? (
              <p className="text-sm text-neutral-500 py-4">
                No active extra or blocked ranges for this room type.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Change</th>
                      <th className="px-3 py-2 text-left">Room type</th>
                      <th className="px-3 py-2 text-left">Dates</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-left">Reason</th>
                      <th className="px-3 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {adjustments.map((adj) => (
                      <tr key={adj.id}>
                        <td className="px-3 py-2">
                          <Chip
                            size="small"
                            label={adj.type}
                            color={adj.type === "extra" ? "info" : "default"}
                          />
                        </td>
                        <td className="px-3 py-2 text-neutral-800 font-medium">
                          {(() => {
                            if (adj.roomTypeName) return adj.roomTypeName;
                            const rt = roomTypes.find(
                              (r) => r.id === adj.packageId
                            );
                            return rt
                              ? roomLabel(rt)
                              : adj.packageId || "—";
                          })()}
                        </td>
                        <td className="px-3 py-2">
                          {adj.startDate} → {adj.endDate}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold">
                          {adj.delta}
                        </td>
                        <td className="px-3 py-2 text-neutral-600">
                          {adj.reason || "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Button
                            size="small"
                            color="error"
                            onClick={() => handleEndAdjustment(adj.id)}
                            sx={{ textTransform: "none" }}
                          >
                            End
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog
        open={adjustOpen}
        onClose={() => !saving && setAdjustOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {adjustType === "extra"
            ? "Add extra rooms (by type)"
            : "Block rooms (by type)"}
        </DialogTitle>
        <DialogContent className="space-y-3 !pt-2">
          <Typography variant="body2" color="text.secondary">
            {adjustType === "extra"
              ? "Pick a date range, then set how many extra rooms to add for each room type. Example: Type A = 3 and Type B = 2 for the same dates — saved together."
              : "Pick a date range, then set how many rooms to block for each room type (same dates, multiple types)."}
          </Typography>
          <Box className="grid grid-cols-2 gap-3 mt-2">
            <TextField
              type="date"
              label="Start"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={adjustForm.startDate}
              onChange={(e) =>
                setAdjustForm((p) => ({ ...p, startDate: e.target.value }))
              }
            />
            <TextField
              type="date"
              label="End"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={adjustForm.endDate}
              onChange={(e) =>
                setAdjustForm((p) => ({ ...p, endDate: e.target.value }))
              }
            />
          </Box>

          <div className="rounded-xl border border-neutral-200 overflow-hidden">
            <div className="bg-neutral-50 px-3 py-2 border-b border-neutral-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                Room types available at this hotel
              </p>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Enter qty only for types you want to change. Leave blank or 0 to
                skip. Normal stock is the base inventory for that type.
              </p>
            </div>
            {roomTypes.length === 0 ? (
              <p className="px-3 py-4 text-sm text-neutral-500">
                No room types on this hotel.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100 max-h-72 overflow-y-auto">
                {roomTypes.map((r) => {
                  const stock = roomQty(
                    r,
                    availabilityConfig.defaultRoomInventory || 5
                  );
                  const isViewing = r.id === roomId;
                  const qtyVal = adjustForm.qtyByRoomId?.[r.id] ?? "";
                  const qtyNum = Math.floor(Number(qtyVal));
                  const included =
                    Number.isFinite(qtyNum) && qtyNum > 0;
                  return (
                    <li
                      key={r.id}
                      className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${
                        included ? "bg-primary-50/70" : "bg-white"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-neutral-900 truncate">
                            {roomLabel(r)}
                          </p>
                          {isViewing ? (
                            <Chip
                              size="small"
                              label="Viewing"
                              color="primary"
                              variant="outlined"
                              sx={{ height: 20, fontSize: 10 }}
                            />
                          ) : null}
                          {included ? (
                            <Chip
                              size="small"
                              label={
                                adjustType === "extra"
                                  ? `+${qtyNum}`
                                  : `−${qtyNum}`
                              }
                              color={
                                adjustType === "extra" ? "success" : "warning"
                              }
                              sx={{ height: 20, fontSize: 10 }}
                            />
                          ) : null}
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          Normal stock:{" "}
                          <span className="font-medium text-neutral-700">
                            {stock}
                          </span>
                          {" · ID: "}
                          <span className="font-mono text-[10px]">{r.id}</span>
                        </p>
                      </div>
                      <TextField
                        size="small"
                        type="number"
                        label={
                          adjustType === "extra"
                            ? "Extra rooms"
                            : "Rooms to block"
                        }
                        placeholder="0"
                        inputProps={{ min: 0, step: 1 }}
                        value={qtyVal}
                        onChange={(e) => setAdjustQty(r.id, e.target.value)}
                        sx={{ width: 140 }}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {(() => {
            const summary = roomTypes
              .map((r) => {
                const q = Math.floor(Number(adjustForm.qtyByRoomId?.[r.id]));
                if (!Number.isFinite(q) || q <= 0) return null;
                return `${roomLabel(r)}: ${q}`;
              })
              .filter(Boolean);
            if (summary.length === 0) return null;
            return (
              <div className="rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-xs text-primary-900">
                <span className="font-semibold">Will apply: </span>
                {summary.join(" · ")}
                {" · "}
                {adjustForm.startDate} → {adjustForm.endDate}
              </div>
            );
          })()}

          <TextField
            fullWidth
            size="small"
            label="Reason"
            value={adjustForm.reason}
            onChange={(e) =>
              setAdjustForm((p) => ({ ...p, reason: e.target.value }))
            }
          />
          <TextField
            fullWidth
            size="small"
            label="Note (optional)"
            multiline
            minRows={2}
            value={adjustForm.note}
            onChange={(e) =>
              setAdjustForm((p) => ({ ...p, note: e.target.value }))
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitAdjust}
            disabled={saving || !roomTypes.length}
            color={adjustType === "blocked" ? "warning" : "primary"}
            sx={
              adjustType === "blocked"
                ? { textTransform: "none", borderRadius: "10px", fontWeight: 600 }
                : btnPrimarySx
            }
          >
            {saving
              ? "Saving…"
              : adjustType === "extra"
                ? "Add extras"
                : "Block rooms"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default HotelRoomAvailabilityPage;
