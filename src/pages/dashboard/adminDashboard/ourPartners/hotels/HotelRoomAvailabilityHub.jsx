import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  Tooltip,
  Chip,
} from "@mui/material";
import { SearchIcon } from "@icons";
import { EventAvailableIcon } from "@icons";
import { LocationOn } from "@icons";
import { HotelIcon } from "@icons";
import { CheckCircleOutlineIcon } from "@icons";
import { PauseCircleOutlineIcon } from "@icons";
import { HourglassEmptyIcon } from "@icons";
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";
import PageHeading from "../../../../../components/PageHeading";
import LoadingContent from "../../../../../components/LoadingContent";
import { isHotelPending } from "../../../../../utils/bookingStatus";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../../firebase/firebase.config";

const hotelDisplayName = (hotel) =>
  hotel?.hotelInformation?.hotelName ||
  hotel?.hotelName ||
  hotel?.hotel?.hotelName ||
  "Unnamed Hotel";

const hotelAddress = (hotel) =>
  hotel?.hotelInformation?.address ||
  hotel?.address ||
  hotel?.hotel?.address ||
  "—";

const hotelPhone = (hotel) =>
  hotel?.hotelInformation?.phoneNumber ||
  hotel?.phoneNumber ||
  hotel?.hotel?.phoneNumber ||
  "—";

/** Collect possible hotel identity strings for matching bookings. */
const hotelIdentitySet = (hotel) => {
  const ids = [
    hotel?.uid,
    hotel?.id,
    hotel?.hotelUid,
    hotel?.hotel?.hotelUid,
    hotel?.hotel?.uid,
  ]
    .filter((v) => v != null && String(v).trim() !== "")
    .map((v) => String(v));
  return new Set(ids);
};

const bookingBelongsToHotel = (booking, hotelIds) => {
  if (!hotelIds || hotelIds.size === 0) return false;
  const candidates = [
    booking?.hotelUid,
    booking?.hotelId,
    booking?.hotel?.hotelUid,
    booking?.hotel?.uid,
    booking?.hotelUID,
  ]
    .filter((v) => v != null && String(v).trim() !== "")
    .map((v) => String(v));
  return candidates.some((id) => hotelIds.has(id));
};

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

const StatCard = ({ title, value, subtitle, icon: Icon, tone = "primary" }) => {
  const tones = {
    primary: {
      wrap: "from-primary-500 to-primary-600 text-white",
      muted: "text-primary-100",
      icon: "bg-white/20 text-white",
    },
    success: {
      wrap: "from-success-500 to-success-600 text-white",
      muted: "text-success-100",
      icon: "bg-white/20 text-white",
    },
    warning: {
      wrap: "from-warning-500 to-warning-600 text-white",
      muted: "text-warning-100",
      icon: "bg-white/20 text-white",
    },
    danger: {
      wrap: "from-danger-500 to-danger-600 text-white",
      muted: "text-danger-100",
      icon: "bg-white/20 text-white",
    },
    slate: {
      wrap: "from-slate-600 to-slate-800 text-white",
      muted: "text-slate-200",
      icon: "bg-white/20 text-white",
    },
  };
  const t = tones[tone] || tones.primary;

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-gradient-to-br p-5 shadow-lg ${t.wrap}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-sm font-medium mb-1 ${t.muted}`}>{title}</p>
          <p className="text-3xl font-bold tabular-nums leading-tight">{value}</p>
          {subtitle ? (
            <p className={`mt-1 text-xs ${t.muted}`}>{subtitle}</p>
          ) : null}
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${t.icon}`}
        >
          <Icon sx={{ fontSize: 22 }} />
        </div>
      </div>
    </div>
  );
};

/**
 * Hotel Related → Room Availability hub with main statistics.
 */
const HotelRoomAvailabilityHub = () => {
  const navigate = useNavigate();
  const { hotels, roomBookings, loadingPartnerData } =
    useContext(PartnerContext);
  const [search, setSearch] = useState("");
  const [availabilityConfigs, setAvailabilityConfigs] = useState({});

  useEffect(() => {
    let active = true;
    const loadConfigs = async () => {
      const entries = await Promise.all(
        (hotels || []).map(async (hotel) => {
          const uid = hotel.uid || hotel.id || hotel.hotelUid || hotel.hotel?.hotelUid;
          if (!uid) return null;
          try {
            const snap = await getDoc(
              doc(db, "HotelDB", String(uid), "availability", "config")
            );
            return [String(uid), snap.exists() ? snap.data() : null];
          } catch (error) {
            console.warn("[RoomAvailabilityHub] config read failed", uid, error);
            return [String(uid), null];
          }
        })
      );
      if (active) {
        setAvailabilityConfigs(Object.fromEntries(entries.filter(Boolean)));
      }
    };
    loadConfigs();
    return () => {
      active = false;
    };
  }, [hotels]);

  const list = useMemo(() => {
    const rows = (hotels || []).map((h) => {
      const uid = h.uid || h.id || h.hotelUid || h.hotel?.hotelUid;
      const hotelIds = hotelIdentitySet(h);
      const storedCfg = availabilityConfigs[String(uid)];
      const inlineCfg = h.availabilityConfig || h.hotel?.availabilityConfig;
      const cfg = storedCfg || inlineCfg || {};
      const configured = Boolean(storedCfg || inlineCfg);
      const autoOn = configured && cfg.autoBookingEnabled !== false;

      const pendingCount = (roomBookings || []).filter(
        (b) => bookingBelongsToHotel(b, hotelIds) && isHotelPending(b)
      ).length;

      return {
        ...h,
        uid,
        displayName: hotelDisplayName(h),
        address: hotelAddress(h),
        phone: hotelPhone(h),
        autoOn,
        configured,
        pendingCount,
      };
    });

    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (h) =>
        h.displayName.toLowerCase().includes(q) ||
        String(h.address).toLowerCase().includes(q) ||
        String(h.phone).toLowerCase().includes(q)
    );
  }, [hotels, roomBookings, search, availabilityConfigs]);

  const mainStats = useMemo(() => {
    const allHotels = hotels || [];
    const bookings = roomBookings || [];

    let autoOn = 0;
    let autoOff = 0;

    allHotels.forEach((h) => {
      const uid = h.uid || h.id || h.hotelUid || h.hotel?.hotelUid;
      const storedCfg = availabilityConfigs[String(uid)];
      const inlineCfg = h.availabilityConfig || h.hotel?.availabilityConfig;
      const cfg = storedCfg || inlineCfg || {};
      if ((storedCfg || inlineCfg) && cfg.autoBookingEnabled !== false) autoOn += 1;
      else autoOff += 1;
    });

    // Same pending definition as Room Bookings page / sidebar badge
    const pending = bookings.filter(isHotelPending).length;

    return {
      hotels: allHotels.length,
      autoOn,
      autoOff,
      pending,
    };
  }, [hotels, roomBookings, availabilityConfigs]);

  useEffect(() => {
    document.title = "Room Availability | Thaiseva Admin";
  }, []);

  if (loadingPartnerData && (!hotels || hotels.length === 0)) {
    return <LoadingContent />;
  }

  return (
    <div className="animate-fade-in pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <PageHeading
          text="Room Availability"
          subtitle="Inventory calendar, auto-booking, and temporary extra/block ranges. Room types are managed when adding or editing a hotel."
          icon="🛏️"
          className="mb-4"
        />
        <Button
          variant="outlined"
          startIcon={<HotelIcon />}
          onClick={() => navigate("/dashboard/hotels")}
          sx={btnOutlineSx}
        >
          All Hotels
        </Button>
      </div>

      {/* Main statistics — Sold today removed; Pending only when count > 0 */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 ${
          mainStats.pending > 0 ? "lg:grid-cols-3" : "lg:grid-cols-2"
        } gap-4 mb-6`}
      >
        <StatCard
          title="Hotels"
          value={mainStats.hotels}
          subtitle="Total properties"
          icon={HotelIcon}
          tone="primary"
        />
        <StatCard
          title="Auto-book ON"
          value={mainStats.autoOn}
          subtitle={`${mainStats.autoOff} hotel(s) OFF`}
          icon={CheckCircleOutlineIcon}
          tone="success"
        />
        {mainStats.pending > 0 ? (
          <StatCard
            title="Pending bookings"
            value={mainStats.pending}
            subtitle="Awaiting action"
            icon={HourglassEmptyIcon}
            tone="warning"
          />
        ) : null}
      </div>

      {/* Search */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm mb-6">
        <TextField
          fullWidth
          size="small"
          placeholder="Search hotels by name, address, or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "var(--primary-500)" }} />
              </InputAdornment>
            ),
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: "12px",
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: "var(--primary-500)",
              },
            },
          }}
        />
      </div>

      {/* Hotel cards */}
      {list.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center text-neutral-500 shadow-sm">
          <EventAvailableIcon
            sx={{ fontSize: 48, color: "var(--primary-300, #93c5fd)", mb: 1 }}
          />
          <p className="text-lg font-medium text-neutral-700">No hotels found</p>
          <p className="mt-1 text-sm text-neutral-500">
            Add hotels under Hotel Related → Hotels, then manage availability
            here.
          </p>
        </div>
      ) : (
        <Grid container spacing={2.5}>
          {list.map((hotel) => (
            <Grid item xs={12} sm={6} lg={4} key={hotel.uid}>
              <Card
                sx={{
                  height: "100%",
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
                  transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "0 8px 24px rgba(37, 99, 235, 0.12)",
                    borderColor: "var(--primary-300, #93c5fd)",
                  },
                }}
              >
                <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Typography
                        variant="h6"
                        fontWeight={700}
                        noWrap
                        title={hotel.displayName}
                        sx={{
                          fontSize: "1.05rem",
                          color: "var(--main-headings-color)",
                        }}
                      >
                        {hotel.displayName}
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          color: "text.secondary",
                          mt: 0.5,
                        }}
                      >
                        <LocationOn
                          sx={{ fontSize: 16, color: "var(--primary-500)" }}
                        />
                        <Typography variant="body2" noWrap>
                          {hotel.address}
                        </Typography>
                      </Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.5 }}
                      >
                        {hotel.phone}
                      </Typography>
                    </div>
                    <Tooltip title="Manage availability">
                      <IconButton
                        onClick={() =>
                          navigate(
                            `/dashboard/hotel-room-availability/${hotel.uid}`
                          )
                        }
                        sx={{
                          bgcolor: "var(--primary-50)",
                          color: "var(--primary-600)",
                          "&:hover": { bgcolor: "var(--primary-100)" },
                        }}
                      >
                        <EventAvailableIcon />
                      </IconButton>
                    </Tooltip>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Chip
                      size="small"
                      icon={
                        hotel.autoOn ? (
                          <CheckCircleOutlineIcon />
                        ) : (
                          <PauseCircleOutlineIcon />
                        )
                      }
                      label={
                        !hotel.configured
                          ? "Setup required"
                          : hotel.autoOn
                            ? "Auto-book ON"
                            : "Auto-book OFF"
                      }
                      color={hotel.autoOn ? "success" : "default"}
                      variant={hotel.autoOn ? "filled" : "outlined"}
                      sx={{ fontWeight: 600, fontSize: "0.7rem" }}
                    />
                  </div>

                  {hotel.pendingCount > 0 ? (
                    <div className="mt-3">
                      <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-center">
                        <p className="text-[10px] font-semibold uppercase text-amber-800/80">
                          Pending
                        </p>
                        <p className="text-lg font-bold text-amber-900 tabular-nums">
                          {hotel.pendingCount}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<EventAvailableIcon />}
                    onClick={() =>
                      navigate(
                        `/dashboard/hotel-room-availability/${hotel.uid}`
                      )
                    }
                    sx={{ ...btnPrimarySx, mt: 2 }}
                  >
                    Manage availability
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </div>
  );
};

export default HotelRoomAvailabilityHub;
