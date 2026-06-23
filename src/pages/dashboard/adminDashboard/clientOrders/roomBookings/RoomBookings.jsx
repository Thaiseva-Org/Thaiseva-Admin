import { useContext, useMemo } from "react";
import { useState } from "react";
import { useEffect } from "react";
import { MdVisibility, MdInfo } from "react-icons/md";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TablePagination,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import CloseIcon from "@mui/icons-material/Close";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FilterListIcon from "@mui/icons-material/FilterList";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckIcon from "@mui/icons-material/Check";
import ClearIcon from "@mui/icons-material/Clear";
import DoneRoundedIcon from "@mui/icons-material/DoneRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import HotelIcon from "@mui/icons-material/Hotel";
import PersonIcon from "@mui/icons-material/Person";
import PaymentsIcon from "@mui/icons-material/Payments";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import PublicIcon from "@mui/icons-material/Public";

import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import NumbersIcon from "@mui/icons-material/Numbers";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import BedroomParentIcon from "@mui/icons-material/BedroomParent";
import { ViewList, CalendarMonth, Search, Circle, CheckCircle, FileDownload as FileDownloadIcon, RemoveRedEye as RemoveRedEyeIcon } from "@mui/icons-material";
import { Tooltip, Select, MenuItem, FormControl, InputLabel, CircularProgress, AppBar, Toolbar } from "@mui/material";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { logo } from "../../../../../assets";
import { ensureInvoiceIdForBooking } from "../../../../../services/invoiceService";

import { deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import {
  askingForDelete,
  calculateDiscountPrice,
  deleteNotification,
  getDate,
  getDateAndTime,
  successNotification,
} from "../../../../../utils/utils";
import ViewDetailsIcon from "../../../../../components/ViewDetailsIcon";
import {
  roomBookingCollection,
  hotelPackageDetails,
} from "../../../../../firebase/firebase.config";
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";
import PageHeading from "../../../../../components/PageHeading";
import LoadingContent from "../../../../../components/LoadingContent";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import {
  fetchBookings,
  fetchBookingsTotalPages,
} from "../../../../../services/Bookings";
import {
  updateHourlyEarnings,
  updateMonthlyEarnings,
} from "../../../../../services/Earning";
import { useNotifications } from "../../../../../contextAPIs/NotificationsProvider";
import { getBookingSpecialNotes } from "../../../../../utils/bookingNotes";

const RoomBookings = () => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const { roomBookings, hotels, contactInfo } = useContext(PartnerContext);
  const [matchedBookings, setMatchedBookings] = useState([]);
  const [processingInvoiceId, setProcessingInvoiceId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [openPackageDetailsModal, setOpenPackageDetailsModal] = useState(false);
  const [openBookingDetailsModal, setOpenBookingDetailsModal] = useState(false);
  const [bookingDetails, setBookingDetails] = useState({});
  const [packageDetails, setPackageDetails] = useState({});
  const [loading, setLoading] = useState(false);
  const [refetch, setRefetch] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isRealTime, setIsRealTime] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [lastDocs, setLastDocs] = useState([]);
  const [tabValue, setTabValue] = useState(0);

  const [selectedBookings, setSelectedBookings] = useState([]);
  const { CreateNewNotificationToUser } = useNotifications();

  // New States for requested features
  const [viewMode, setViewMode] = useState("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [calendarHotel, setCalendarHotel] = useState("All");
  const [calendarDate, setCalendarDate] = useState(new Date().toISOString().split('T')[0]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setPage(0);
  };

  const generatePdfBlob = async (row) => {
    try {
      const doc = new jsPDF();
      const raw = row.rawData || {};
      const category = "Room Bookings";

      const COLORS = {
        primary: [30, 58, 138],
        darkBg: [15, 23, 42],
        slate800: [30, 41, 59],
        slate600: [71, 85, 105],
        slate500: [100, 116, 139],
        slate100: [241, 245, 249],
        emerald: [16, 185, 129],
      };

      const drawBrandHeader = (title) => {
        doc.setFillColor(...COLORS.primary);
        doc.rect(0, 0, 210, 45, 'F');
        try {
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(14, 8, 50, 24, 2, 2, 'F');
          doc.addImage(logo, 'JPEG', 15, 9, 48, 22);
        } catch (e) {
          doc.setFontSize(10); doc.setTextColor(255, 255, 255); doc.text("THAISEVA", 15, 20);
        }
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(title.toUpperCase(), 196, 18, { align: "right" });
        const status = raw.status || "Pending";
        const isSuccess = status.toLowerCase() === 'accepted' || status.toLowerCase() === 'confirmed';
        doc.setFillColor(...(isSuccess ? COLORS.emerald : [200, 200, 200]));
        doc.roundedRect(176, 25, 20, 6, 2, 2, 'F');
        doc.setFontSize(8);
        doc.text(status.toUpperCase(), 186, 29, { align: "center" });
      };

      const drawSectionTitle = (text, y) => {
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.primary);
        doc.setFont("helvetica", "bold");
        doc.text(text.toUpperCase(), 14, y);
        doc.setDrawColor(...COLORS.slate100);
        doc.line(14, y + 2, 196, y + 2);
      };

      const drawField = (label, value, x, y) => {
        if (!value || value === "-" || value === "0" || value === "") return;
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.slate500);
        doc.setFont("helvetica", "normal");
        doc.text(label, x, y);
        doc.setTextColor(...COLORS.slate800);
        doc.setFont("helvetica", "bold");
        doc.text(String(value), x, y + 5);
      };

      drawBrandHeader("Hotel Confirmation");
      let y = 60;
      drawSectionTitle("Reservation Details", y);
      y += 10;
      const displayId = row.customerInvoiceId || raw.bookingId || row.bookingId || row.id;
      drawField("Booking ID", displayId, 14, y);
      drawField("Booked On", row.orderedAt ? new Date(row.orderedAt.seconds ? row.orderedAt.seconds * 1000 : row.orderedAt).toLocaleDateString() : "-", 60, y);
      drawField("Hotel Name", row.hotelName, 110, y);

      y += 20;
      drawSectionTitle("Guest Information", y);
      y += 10;
      drawField("Primary Guest", row.name, 14, y);
      drawField("Contact", row.phone, 60, y);
      if (row.nationality) drawField("Nationality", row.nationality, 160, y);

      y += 20;
      drawSectionTitle("Stay Details", y);
      y += 10;
      drawField("Check-In", row.checkIn, 14, y);
      drawField("Check-Out", row.checkOut, 60, y);
      if (row.nights) drawField("Duration", `${row.nights} Night(s)`, 110, y);
      drawField("Guests", `${row.adults || 0} Adults, ${row.children || 0} Children`, 160, y);

      y += 20;
      drawSectionTitle("Room Allocation", y);
      y += 10;
      const rooms = raw.roomDetails || [{ roomName: row.roomName || "Standard Room", count: row.noOfRooms || 1 }];
      autoTable(doc, {
        startY: y,
        head: [['Room Type', 'Qty', 'Assigned Rooms']],
        body: rooms.map(r => [r.roomName, r.count || 1, row.roomNumbers || "On Arrival"]),
        theme: 'grid',
        headStyles: { fillColor: COLORS.slate100, textColor: COLORS.slate600, fontSize: 8 },
        styles: { fontSize: 9, textColor: COLORS.slate800 }
      });

      return doc.output('blob');
    } catch (error) {
      console.error("Error generating PDF:", error);
      throw error;
    }
  };

  const handlePreviewInvoice = async (row) => {
    if (processingInvoiceId) return;
    setProcessingInvoiceId(row.bookingId || row.id);
    try {
      const updatedRow = await ensureInvoiceIdForBooking("Room Bookings", row.bookingId || row.id, row.rawData);
      const rowWithInvoice = { ...row, customerInvoiceId: updatedRow.customerInvoiceId };
      const blob = await generatePdfBlob(rowWithInvoice);
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
      setPreviewOpen(true);
    } catch (error) {
      console.error("Error previewing PDF:", error);
      alert("Failed to preview invoice.");
    } finally {
      setProcessingInvoiceId(null);
    }
  };

  const handleDownloadInvoice = async (row) => {
    if (processingInvoiceId) return;
    setProcessingInvoiceId(row.bookingId || row.id);
    try {
      const updatedRow = await ensureInvoiceIdForBooking("Room Bookings", row.bookingId || row.id, row.rawData);
      const rowWithInvoice = { ...row, customerInvoiceId: updatedRow.customerInvoiceId };
      const blob = await generatePdfBlob(rowWithInvoice);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice_${updatedRow.customerInvoiceId || row.bookingId || row.id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      alert("Failed to download invoice.");
    } finally {
      setProcessingInvoiceId(null);
    }
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl);
      setPreviewPdfUrl(null);
    }
  };

  const handleDateRangeSubmit = (event) => {
    event.preventDefault();
    if (endDate === "") {
      alert("Please select both start and end!!");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      alert("Start Date cannot be after End Date!!");
      return;
    }
    setPage(0);
    setLastDocs([]);
    setRefetch((p) => !p);
    setIsRealTime(false);
  };

  useEffect(() => {
    if (!isRealTime && (isAdmin || isSubAdmin)) {
      fetchBookingsTotalPages(
        setTotalPages,
        startDate,
        endDate,
        "Room Bookings"
      );
      fetchBookings(
        setMatchedBookings,
        setLoading,
        "Room Bookings",
        startDate,
        endDate,
        lastDocs,
        setLastDocs,
        rowsPerPage,
        page
      );
    }
  }, [isAdmin, isSubAdmin, page, rowsPerPage, isRealTime, refetch]);

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  /* Removed duplicate handleChangeRowsPerPage */

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Bulk Action Handlers
  const handleSelectAll = (event, currentRows) => {
    if (event.target.checked) {
      const newSelected = currentRows.map((n) => n.bookingId || n.id);
      setSelectedBookings(newSelected);
    } else {
      setSelectedBookings([]);
    }
  };

  const handleSelectOne = (event, id) => {
    const selectedIndex = selectedBookings.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedBookings, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedBookings.slice(1));
    } else if (selectedIndex === selectedBookings.length - 1) {
      newSelected = newSelected.concat(selectedBookings.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selectedBookings.slice(0, selectedIndex),
        selectedBookings.slice(selectedIndex + 1),
      );
    }
    setSelectedBookings(newSelected);
  };

  const handleBulkApprove = async () => {
    if (!confirm(`Are you sure you want to approve ${selectedBookings.length} bookings?`)) return;

    // Process only Pending bookings from selection
    const rawData = isRealTime ? roomBookings : matchedBookings;
    const targets = rawData.filter((b) => {
      const status = normalizeBookingStatus(b);
      return selectedBookings.includes(b.bookingId || b.id) && status === "Pending";
    });

    setLoading(true);
    let count = 0;
    for (const booking of targets) {
      const success = await confirmBookingInternal(booking);
      if (success) count++;
    }
    setLoading(false);
    setSelectedBookings([]);
    successNotification(`Successfully approved ${count} bookings.`);
  };

  const handleBulkDecline = async () => {
    if (!confirm(`Are you sure you want to decline ${selectedBookings.length} bookings?`)) return;

    const rawData = isRealTime ? roomBookings : matchedBookings;
    const targets = rawData.filter(b => selectedBookings.includes(b.bookingId || b.id));

    setLoading(true);
    for (const booking of targets) {
      await updateDoc(doc(roomBookingCollection, booking.bookingId || booking.id), {
        status: "Canceled",
        bookingStatus: "CANCELED",
        isBookingConfirmed: false,
      });
    }
    setLoading(false);
    setSelectedBookings([]);
    deleteNotification(`Declined ${targets.length} bookings.`);
  };

  const confirmBookingInternal = async (booking) => {
    const updatedDoc = {
      status: "Accepted",
      bookingStatus: "ACCEPTED",
      isBookingConfirmed: true,
    };

    try {
      await updateDoc(doc(roomBookingCollection, booking.bookingId || booking.id), updatedDoc);

      const amount = Number(booking.amountTHB || booking.amount || 0);
      if (amount > 0 && (booking.hotelUid || booking.hotelId)) {
        const hotelId = booking.hotelUid || booking.hotelId;
        // Intentionally fire-and-forget these to speed up
        await updateHourlyEarnings(amount, "Hotels");
        await updateHourlyEarnings(amount, "Hotels", hotelId);
        await updateMonthlyEarnings(amount, "Hotels");
        await updateMonthlyEarnings(amount, "Hotels", hotelId);
      }

      if (booking.userId) {
        CreateNewNotificationToUser(
          "Room booking confirmed!",
          `Your room booking at ${booking.hotelName || 'the hotel'} has been automatically confirmed!`,
          booking.userId
        );
      }
      return true;
    } catch (e) {
      console.error("[ManualConfirm] Confirm failed", e);
      return false;
    }
  };

  let columns = [
    { property: "hotelName", label: "Hotel", width: "15%" },
    { property: "name", label: "Guest Name", width: "17%" },
    { property: "phone", label: "Phone", width: "10%" },
    { property: "noOfRooms", label: "Rooms", width: "5%" },
    { property: "checkIn", label: "Check in", width: "14%" },
    { property: "amount", label: "Amount", width: "10%" },
    { property: "userInvoice", label: "Invoice", width: "12%" },
    { property: "action", label: "Action", width: "10%" },
  ];

  const normalizeBookingStatus = (booking = {}) => {
    const rawStatus = booking.bookingStatus || booking.status || "";
    const upper = String(rawStatus).toUpperCase();

    if (
      upper === "PENDING" ||
      upper === "AWAITING_PAYMENT" ||
      upper === "PENDING_VERIFICATION" ||
      upper === "PAYMENT_PENDING"
    ) {
      return "Pending";
    }
    if (upper === "ACCEPTED" || upper === "CONFIRMED") return "Accepted";
    if (upper === "CANCELED" || upper === "CANCELLED" || upper === "REJECTED" || upper === "DENIED") return "Canceled";

    return booking.status || rawStatus || "Pending";
  };

  // creating single row
  function createData(booking) {
    const checkInRaw = booking.checkInDate || booking.checkIn;
    const checkOutRaw = booking.checkOutDate || booking.checkOut;
    const orderedAtRaw = booking.createdAt || booking.orderedAt;

    const checkInDate = checkInRaw?.seconds
      ? new Date(checkInRaw.seconds * 1000 + checkInRaw.nanoseconds / 1000000)
      : new Date(checkInRaw);

    const checkOutDate = checkOutRaw?.seconds
      ? new Date(checkOutRaw.seconds * 1000 + checkOutRaw.nanoseconds / 1000000)
      : new Date(checkOutRaw);

    return {
      ...booking,
      isBookingConfirmed: booking.isBookingConfirmed,
      isPaymentDone: booking.isPaymentDone,
      hotelName: (() => {
        const primary = booking.hotelName || "";
        const nested = booking.hotel?.hotelName || "";
        const fallback = typeof booking.hotel === 'string' ? booking.hotel : "";

        // If primary is generic "Hotel", use nested or fallback
        if (primary.toLowerCase() === "hotel" || !primary) {
          return nested || fallback || primary || "N/A";
        }
        return primary;
      })(),
      name: booking.fullName || booking.guestDetails?.name || booking.name || "N/A",
      phone: booking.guestPhone || booking.phone || booking.guestDetails?.phone || "N/A",
      email: booking.guestEmail || booking.email || booking.guestDetails?.email || "N/A",
      noOfRooms: booking.rooms || booking.noOfRooms,
      checkIn: getDate(checkInDate),
      checkOut: getDate(checkOutDate),
      amount: booking.amountTHB || booking.amount,
      orderedAt: orderedAtRaw,
      roomNumbers: booking.roomNumbers,
      status: normalizeBookingStatus(booking),
      packageId: booking.packageId,
      bookingId: booking.id || booking.bookingId,
      managerPhone: booking.managerPhone,
      hotelUid: booking.hotelUid,
      userId: booking.userId,
      // New fields mapping
      adults: booking.adults !== undefined ? booking.adults : (booking.guestDetails?.adults || 0),
      children: booking.children !== undefined ? booking.children : (booking.guestDetails?.children || 0),
      nationality: booking.nationality || "N/A",
      nights: booking.nights,
      roomName: booking.roomName,
      specialNotes: getBookingSpecialNotes(booking),
      paymentMethod: booking.paymentMethod,
      currency: booking.currency,
      amountINR: booking.amountINR,
      amountTHB: booking.amountTHB,
      rawData: booking, // Keep original data for PDF generation
    };
  }

  // calling createData function with partner's data
  const rows = (bookings) => {
    // 1. Filter by Search Query
    const filtered = bookings?.filter((b) => {
      const search = searchQuery.toLowerCase();
      const guestName = (b.fullName || b.guestDetails?.name || "").toLowerCase();
      const hotel = (b.hotelName || "").toLowerCase();
      const id = (b.id || b.bookingId || "").toLowerCase();

      return guestName.includes(search) || hotel.includes(search) || id.includes(search);
    });

    // 2. Map to Data Objects
    return filtered?.map((booking) => {
      return createData(booking);
    });
  };

  const sourceBookings = isRealTime ? roomBookings : matchedBookings;

  const bookingStats = useMemo(() => {
    const visibleBookings = rows(sourceBookings) || [];

    return {
      total: visibleBookings.length,
      accepted: visibleBookings.filter((booking) => booking.status === "Accepted").length,
      pending: visibleBookings.filter((booking) => booking.status === "Pending").length,
      declined: visibleBookings.filter((booking) => booking.status === "Canceled").length,
    };
  }, [sourceBookings, searchQuery]);

  // Status Timeline Component
  const BookingTimeline = ({ booking }) => {
    const getTimelineDate = (value) => {
      if (!value) return "";
      const date = value.seconds
        ? new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000)
        : new Date(value);

      return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
    };

    const steps = [
      { label: "Booked", date: getTimelineDate(booking.orderedAt || booking.createdAt), completed: true },
      { label: "Confirmed", date: "", completed: booking.status === "Accepted" || booking.bookingStatus === "ACCEPTED" },
      { label: "Check-In", date: booking.checkIn, completed: new Date() >= new Date(booking.checkIn) && booking.status === "Accepted" },
      { label: "Check-Out", date: booking.checkOut, completed: new Date() >= new Date(booking.checkOut) && booking.status === "Accepted" },
    ];

    return (
      <div className="w-full py-6">
        <div className="flex items-center justify-between relative">
          {/* Connecting Line */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-neutral-200 -z-0"></div>
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-success-500 -z-0 transition-all duration-500"
            style={{ width: `${(steps.filter(s => s.completed).length - 1) / (steps.length - 1) * 100}%` }}></div>

          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center relative z-10 bg-white px-2">
              {step.completed ? (
                <CheckCircle className="text-success-500 text-3xl bg-white rounded-full" />
              ) : (
                <Circle className="text-neutral-300 text-3xl bg-white rounded-full" />
              )}
              <span className={`text-xs font-bold mt-2 ${step.completed ? 'text-neutral-800' : 'text-neutral-400'}`}>{step.label}</span>
              {step.date && <span className="text-[10px] text-neutral-500 font-medium">{step.date}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Calendar/Gantt View Implementation
  const CalendarView = ({ bookings }) => {
    const uniqueHotels = [...new Set(bookings.map(b => b.hotelName))].sort();

    // Filter by selected hotel
    const calendarBookings = calendarHotel === "All"
      ? bookings
      : bookings.filter(b => b.hotelName === calendarHotel);

    // Timeline Settings
    const baseDate = new Date(calendarDate);
    const daysToShow = 14;
    const dates = Array.from({ length: daysToShow }, (_, i) => {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      return d;
    });

    return (
      <div className="bg-white rounded-xl shadow-lg border border-neutral-200 p-4">
        {/* Controls */}
        <div className="flex gap-4 mb-6 items-center flex-wrap">
          <FormControl size="small" className="min-w-[200px]">
            <InputLabel>Filter Hotel</InputLabel>
            <Select
              value={calendarHotel}
              label="Filter Hotel"
              onChange={(e) => setCalendarHotel(e.target.value)}
            >
              <MenuItem value="All">All Hotels</MenuItem>
              {uniqueHotels.map(h => <MenuItem key={h} value={h}>{h}</MenuItem>)}
            </Select>
          </FormControl>

          <input
            type="date"
            value={calendarDate}
            onChange={(e) => setCalendarDate(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
          />
        </div>

        {/* Gantt Chart */}
        <div className="overflow-x-auto border border-neutral-200 rounded-lg relative">
          <div className="min-w-[1000px]">
            {/* Header Dates */}
            <div className="flex border-b border-neutral-200 bg-neutral-50 sticky top-0 z-10">
              <div className="w-48 p-3 font-bold text-neutral-600 sticky left-0 bg-neutral-50 border-r border-neutral-200 z-20">Hotel / Room</div>
              {dates.map(date => (
                <div key={date.toString()} className="flex-1 min-w-[60px] p-2 text-center border-r border-neutral-100 last:border-0">
                  <div className="text-xs font-bold text-neutral-700">{date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}</div>
                  <div className="text-[10px] text-neutral-400">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                </div>
              ))}
            </div>

            {/* Rows */}
            {calendarBookings.length === 0 ? (
              <div className="p-8 text-center text-neutral-400">No bookings found for this view</div>
            ) : (
              calendarBookings.map((booking, idx) => {
                // Calculate Bar Position and Width
                const checkIn = booking.checkInDate?.seconds ? new Date(booking.checkInDate.seconds * 1000) : new Date(booking.checkIn);
                const checkOut = booking.checkOutDate?.seconds ? new Date(booking.checkOutDate.seconds * 1000) : new Date(booking.checkOut);

                // Normalize time
                checkIn.setHours(0, 0, 0, 0);
                checkOut.setHours(0, 0, 0, 0);
                baseDate.setHours(0, 0, 0, 0);

                const endDate = new Date(baseDate);
                endDate.setDate(baseDate.getDate() + daysToShow);

                // Check if visible
                if (checkOut <= baseDate || checkIn >= endDate) return null;

                // Calculate styles
                const startDiff = Math.max(0, (checkIn - baseDate) / (1000 * 60 * 60 * 24));
                const duration = Math.min(daysToShow - startDiff, (checkOut - Math.max(baseDate, checkIn)) / (1000 * 60 * 60 * 24));
                const widthPercent = (duration / daysToShow) * 100;
                const leftPercent = (startDiff / daysToShow) * 100;

                // Skip if invalid
                if (widthPercent <= 0) return null;

                return (
                  <div key={idx} className="flex border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                    <div className="w-48 p-3 text-sm font-medium text-neutral-700 sticky left-0 bg-white border-r border-neutral-200 z-10 truncate" title={booking.hotelName}>
                      {booking.hotelName} <br />
                      <span className="text-xs text-neutral-400 font-normal">{booking.guestDetails?.name || booking.fullName}</span>
                    </div>
                    <div className="flex-1 relative h-16">
                      {/* Grid Lines */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {dates.map((_, i) => <div key={i} className="flex-1 border-r border-neutral-50 h-full"></div>)}
                      </div>

                      {/* Booking Bar */}
                      <div
                        onClick={() => handleViewBookingDetails(booking.bookingId || booking.id)}
                        className={`absolute h-10 top-3 rounded-md shadow-sm cursor-pointer hover:brightness-95 flex items-center px-2 text-xs text-white font-medium overflow-hidden whitespace-nowrap transition-all
                            ${booking.status === 'Accepted' ? 'bg-success-500' : booking.status === 'Pending' ? 'bg-warning-500' : 'bg-neutral-400'}
                          `}
                        style={{
                          width: `${widthPercent - 1}%`, // -1 for gap
                          left: `${leftPercent}%`
                        }}
                        title={`${booking.guestDetails?.name} (${booking.noOfRooms} rms)`}
                      >
                        {booking.guestDetails?.name || "Guest"}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleConfirmBooking = async (booking) => {
    if (confirm("Are you sure you want to accept this booking?")) {


      await confirmBookingInternal(booking).then(() => {
        successNotification("Booking is confirmed and Processed!");
      });
    }
  };

  const handleCancelBooking = async (booking) => {
    if (confirm("Are you sure to decline this booking?")) {
      const updatedDoc = {
        status: "Canceled",
        bookingStatus: "CANCELED",
        isBookingConfirmed: false,
      };

      await updateDoc(
        doc(roomBookingCollection, booking.bookingId),
        updatedDoc
      ).then(() => {
        deleteNotification("Booking is declined!");
      });
    }
  };

  // setting booking details to the state
  const handleViewBookingDetails = async (id) => {
    const sourceBookings = isRealTime ? roomBookings : matchedBookings;
    const bookings = rows(sourceBookings).filter((item) => item.bookingId === id);
    setBookingDetails(bookings[0]);
    setOpenBookingDetailsModal(true);
  };

  // setting package details to the state
  const handleViewPackageDetails = async (id) => {
    const snapshot = await getDoc(doc(hotelPackageDetails, id));
    if (snapshot.exists()) {
      const existingData = snapshot.data();
      setPackageDetails(existingData);
      setOpenPackageDetailsModal(true);
    }
  };

  // delete canceled booking
  const handleDelete = (id) => {
    askingForDelete().then(async (result) => {
      if (result.isConfirmed) {
        await deleteDoc(doc(roomBookingCollection, id)).then(() => {
          deleteNotification("The booking is deleted successfully.");
        });
      }
    });
  };

  // Custom detail item renderer with improved styling
  const renderDetailItem = (label, value, icon, isFullWidth = false, colorClass = "text-primary-600 bg-primary-50") => {
    return (
      <Grid item xs={12} sm={isFullWidth ? 12 : 6}>
        <div className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-neutral-50 transition-all duration-200 border border-transparent hover:border-neutral-200 group">
          <div className={`mt-0.5 p-2 rounded-lg ${colorClass} group-hover:scale-110 transition-transform duration-200 shadow-sm`}>
            {icon}
          </div>
          <div>
            <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-neutral-900 font-medium text-[15px] leading-snug">{value}</p>
          </div>
        </div>
      </Grid>
    );
  };

  // Legacy text field for Package Details modal
  const textField = (label, value, is12) => {
    return (
      <Grid item xs={12} sm={label === "Description" || is12 ? 12 : 6}>
        <div className="flex gap-2">
          <p>
            <span className="font-bold">{label}: </span>
            {label.includes("Price") && "฿"}
            {value}
            {label === "Discount" && "%"}
          </p>
        </div>
      </Grid>
    );
  };

  return (
    <div className="animate-fade-in">
      <PageHeading
        text="Room Bookings"
        subtitle="View and manage all hotel room reservations"
        icon="📅"
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium mb-1">
                Total Bookings
              </p>
              <p className="text-3xl font-bold">{bookingStats.total}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">📅</span>
            </div>
          </div>
        </div>

        <div
          onClick={() => setTabValue(1)}
          className="bg-gradient-to-br from-success-500 to-success-600 rounded-xl p-6 text-white shadow-lg cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl active:scale-95"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-success-100 text-sm font-medium mb-1">
                Accepted
              </p>
              <p className="text-3xl font-bold">{bookingStats.accepted}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">✅</span>
            </div>
          </div>
        </div>

        <div
          onClick={() => setTabValue(0)}
          className="bg-gradient-to-br from-warning-500 to-warning-600 rounded-xl p-6 text-white shadow-lg cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl active:scale-95"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-warning-100 text-sm font-medium mb-1">
                Pending
              </p>
              <p className="text-3xl font-bold">{bookingStats.pending}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">⏳</span>
            </div>
          </div>
        </div>
      </div>

      {/* View Toggle & Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-neutral-200 shadow-sm">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-neutral-500 hover:bg-neutral-50'}`}
          >
            <ViewList className="mr-2 !text-lg" /> List View
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'calendar' ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-neutral-500 hover:bg-neutral-50'}`}
          >
            <CalendarMonth className="mr-2 !text-lg" /> Calendar View
          </button>
        </div>

        <div className="relative w-full md:w-auto md:min-w-[300px]">
          <input
            type="text"
            placeholder="Search guest, hotel, ID..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 !text-xl" />
        </div>
      </div>

      {/* Date Filter Section (Only show in List mode for now, or both) */}
      <div className="bg-white rounded-xl shadow-lg border border-neutral-200 p-5 mb-6 hover:shadow-xl transition-shadow duration-300">
        <div className="flex justify-between items-center gap-4 flex-wrap">
          <h3 className="text-lg font-semibold text-primary-700 flex items-center gap-2">
            <FilterListIcon className="text-primary-600" /> Filter by Date Range
          </h3>
          <form
            onSubmit={(e) => {
              handleDateRangeSubmit(e);
            }}
            className="flex items-end gap-3 flex-wrap"
          >
            <fieldset className="px-4 pb-2.5 border border-neutral-300 rounded-lg hover:border-primary-400 focus-within:border-primary-500 transition-colors duration-200">
              <legend className="px-2 text-sm font-medium text-neutral-600">
                <CalendarMonthIcon sx={{ fontSize: 16, marginRight: '4px' }} /> Start Date
              </legend>
              <input
                type="date"
                className="date-input w-[8rem] outline-none bg-transparent text-neutral-700"
                placeholder="Select date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                }}
                max={new Date().toISOString().split("T")[0]}
              />
            </fieldset>
            <span className="text-neutral-400 font-medium pb-2.5 text-sm">to</span>
            <fieldset className="px-4 pb-2.5 border border-neutral-300 rounded-lg hover:border-primary-400 focus-within:border-primary-500 transition-colors duration-200">
              <legend className="px-2 text-sm font-medium text-neutral-600">
                <CalendarMonthIcon sx={{ fontSize: 16, marginRight: '4px' }} /> End Date
              </legend>
              <input
                type="date"
                className="date-input w-[8rem] outline-none bg-transparent text-neutral-700"
                placeholder="Select date"
                value={endDate}
                onChange={(event) => {
                  if (startDate == "") {
                    alert("Please Select Start Date First!!");
                    return;
                  }
                  setEndDate(event.target.value);
                }}
                min={startDate}
                max={new Date().toISOString().split("T")[0]}
              />
            </fieldset>

            <button
              type="submit"
              className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 active:scale-95"
            >
              <FilterListIcon sx={{ fontSize: 18 }} />
              Apply Filter
            </button>

            <button
              type="button"
              className="bg-gradient-to-r from-neutral-100 to-neutral-200 hover:from-neutral-200 hover:to-neutral-300 text-neutral-700 px-5 py-2.5 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 border border-neutral-300 active:scale-95"
              onClick={() => {
                setIsRealTime(true), setStartDate(""), setEndDate("");
              }}
            >
              <RefreshIcon sx={{ fontSize: 18 }} />
              Show Realtime
            </button>
          </form>
        </div>
      </div>

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="booking status tabs">
          <Tab label="Pending" />
          <Tab label="Accepted" />
          <Tab label="Declined" />
          <Tab label="Next 7 Days" />
        </Tabs>
      </Box>

      {/* Content Area */}
      {
        viewMode === 'calendar' ? (
          <CalendarView bookings={rows(isRealTime ? roomBookings : matchedBookings)} />
        ) : (
          /* Modern Table Container */
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden relative">
            {/* Bulk Action Bar */}
            {selectedBookings.length > 0 && (
              <div className="absolute top-0 left-0 w-full bg-primary-50 p-2 z-20 flex items-center justify-between border-b border-primary-100 animate-fade-in">
                <div className="flex items-center gap-4 pl-4">
                  <span className="font-bold text-primary-800">{selectedBookings.length} Selected</span>
                </div>
                <div className="flex gap-2 pr-4">
                  {tabValue === 0 && (
                    <button
                      onClick={handleBulkApprove}
                      className="bg-success-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-success-700 transition-colors shadow-sm"
                    >
                      Approve Selected
                    </button>
                  )}
                  {(tabValue === 0 || tabValue === 1) && (
                    <button
                      onClick={handleBulkDecline}
                      className="bg-danger-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-danger-700 transition-colors shadow-sm"
                    >
                      {tabValue === 1 ? "Cancel Selected" : "Decline Selected"}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              {loading ? (
                <LoadingContent variant="skeleton" />
              ) : (
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                    <tr>
                      <th className="px-4 py-4 w-[50px]">
                        {tabValue !== 2 && (
                          <input
                            type="checkbox"
                            className="rounded border-white/30 text-primary-600 focus:ring-white/50 w-4 h-4 cursor-pointer"
                            onChange={(e) => {
                              // Get current visible rows
                              const currentRows = rows(isRealTime ? roomBookings : matchedBookings).filter((row) => {
                                if (tabValue === 0) return row.status === "Pending";
                                if (tabValue === 1) return row.status === "Accepted";
                                if (tabValue === 2) return row.status === "Canceled" || row.status === "Denied";
                                // .. other filters
                                return true;
                              });
                              handleSelectAll(e, currentRows);
                            }}
                            checked={selectedBookings.length > 0 && selectedBookings.length === rows(isRealTime ? roomBookings : matchedBookings).filter((row) => {
                              if (tabValue === 0) return row.status === "Pending";
                              if (tabValue === 1) return row.status === "Accepted";
                              if (tabValue === 2) return row.status === "Canceled" || row.status === "Denied";
                              if (tabValue === 3) {
                                const rawDate = row.checkInDate || row.checkIn;
                                if (!rawDate) return false;
                                let dateObj;
                                if (rawDate.seconds) dateObj = new Date(rawDate.seconds * 1000);
                                else dateObj = new Date(rawDate);

                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const next7 = new Date(today);
                                next7.setDate(today.getDate() + 7);
                                next7.setHours(23, 59, 59, 999);

                                return dateObj >= today && dateObj <= next7 && row.status !== 'Canceled' && row.status !== 'Denied';
                              }
                              return true;
                            }).length}
                          />
                        )}
                      </th>
                      {columns.map((column) => (
                        <th
                          key={column.property}
                          className="px-6 py-4 text-center text-sm font-semibold uppercase tracking-wider"
                          style={{ width: column.width }}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {rows(isRealTime ? roomBookings : matchedBookings)
                      .filter((row) => {
                        if (tabValue === 0) return row.status === "Pending";
                        if (tabValue === 1) return row.status === "Accepted";
                        if (tabValue === 2) return row.status === "Canceled" || row.status === "Denied";
                        if (tabValue === 3) {
                          const rawDate = row.checkInDate || row.checkIn;
                          if (!rawDate) return false;
                          let dateObj;
                          if (rawDate.seconds) dateObj = new Date(rawDate.seconds * 1000);
                          else dateObj = new Date(rawDate);

                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const next7 = new Date(today);
                          next7.setDate(today.getDate() + 7);
                          next7.setHours(23, 59, 59, 999);

                          return dateObj >= today && dateObj <= next7 && row.status !== 'Canceled' && row.status !== 'Denied';
                        }
                        return true;
                      })
                      .slice(isRealTime ? page * rowsPerPage : 0, isRealTime ? page * rowsPerPage + parseInt(rowsPerPage, 10) : undefined)
                      .map(
                        (row, i) => {
                          const isSelected = selectedBookings.indexOf(row.bookingId || row.id) !== -1;
                          return (
                            <tr
                              key={i}
                              className={`hover:bg-primary-50 transition-colors duration-200 ${isSelected ? 'bg-primary-50' : ''}`}
                            >
                              <td className="px-4 py-4 text-center">
                                {tabValue !== 2 && (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(event) => handleSelectOne(event, row.bookingId || row.id)}
                                    className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer"
                                  />
                                )}
                              </td>
                              {columns.map((column) => {
                                const value = row[column.property];

                                let dateDisplay = "N/A";
                                if (column.property === "orderedAt" && row["orderedAt"]) {
                                  const orderedAt = row["orderedAt"];
                                  const dateObj = orderedAt?.seconds
                                    ? new Date(orderedAt.seconds * 1000 + orderedAt.nanoseconds / 1000000)
                                    : new Date(orderedAt);
                                  dateDisplay = getDateAndTime(dateObj);
                                }

                                return (
                                  <td
                                    key={column.property}
                                    className="px-6 py-4 text-center"
                                  >
                                    {column.property === "orderedAt" ? (
                                      <span className="text-sm text-neutral-600">
                                        {dateDisplay}
                                      </span>
                                    ) : column.property === "roomNumbers" ? (
                                      <div className="flex items-center justify-center flex-wrap gap-1">
                                        {(value && value.length > 0) ? value.map((item, i) => (
                                          <span
                                            key={i}
                                            className="bg-primary-100 text-primary-700 font-semibold py-1 px-2 rounded-lg text-xs border border-primary-200"
                                          >
                                            {item}
                                          </span>
                                        )) : (
                                          <span className="text-neutral-400 text-xs">-</span>
                                        )}
                                      </div>
                                    ) : column.property === "userInvoice" ? (
                                      <div className="flex justify-center items-center gap-1">
                                        <Tooltip title="Preview Invoice">
                                          <IconButton
                                            size="small"
                                            onClick={() => handlePreviewInvoice(row)}
                                            disabled={processingInvoiceId === (row.bookingId || row.id)}
                                            sx={{ color: '#3b82f6', bgcolor: '#eff6ff', '&:hover': { bgcolor: '#dbeafe' } }}
                                          >
                                            {processingInvoiceId === (row.bookingId || row.id) ? (
                                              <CircularProgress size={16} color="inherit" />
                                            ) : (
                                              <RemoveRedEyeIcon fontSize="small" />
                                            )}
                                          </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Download Invoice">
                                          <IconButton
                                            size="small"
                                            onClick={() => handleDownloadInvoice(row)}
                                            disabled={processingInvoiceId === (row.bookingId || row.id)}
                                            sx={{ color: '#10b981', bgcolor: '#ecfdf5', '&:hover': { bgcolor: '#d1fae5' } }}
                                          >
                                            {processingInvoiceId === (row.bookingId || row.id) ? (
                                              <CircularProgress size={16} color="inherit" />
                                            ) : (
                                              <FileDownloadIcon fontSize="small" />
                                            )}
                                          </IconButton>
                                        </Tooltip>
                                      </div>
                                    ) : column.property === "action" ? (
                                      <div className="flex gap-2 justify-center items-center">
                                        {row["status"] === 3 && (
                                          <button
                                            onClick={() => handleDelete(row.id)}
                                            className="p-2 bg-danger-100 hover:bg-danger-200 text-danger-700 rounded-lg transition-colors"
                                            title="Delete booking"
                                          >
                                            <DeleteForeverIcon />
                                          </button>
                                        )}

                                        <button
                                          onClick={() => handleViewBookingDetails(row.bookingId)}
                                          className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                                          title="View Booking Details"
                                        >
                                          <MdVisibility size={20} />
                                        </button>

                                        {row.packageId && (
                                          <button
                                            onClick={() => handleViewPackageDetails(row.packageId)}
                                            className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors"
                                            title="View Package Details"
                                          >
                                            <MdInfo size={20} />
                                          </button>
                                        )}

                                        {row.status === "Pending" && (
                                          <>
                                            <button
                                              onClick={() => handleConfirmBooking(row)}
                                              className="p-2 rounded-full bg-success-500 text-white hover:bg-success-600 hover:scale-110 transition-all duration-200"
                                              title="Accept Booking"
                                            >
                                              <DoneRoundedIcon className="scale-90" />
                                            </button>
                                            <button
                                              onClick={() => handleCancelBooking(row)}
                                              className="p-2 rounded-full bg-danger-500 text-white hover:bg-danger-600 hover:scale-110 transition-all duration-200"
                                              title="Decline Booking"
                                            >
                                              <CloseRoundedIcon className="scale-90" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    ) : column.property === "amount" ? (
                                      <span className="font-semibold text-success-600">
                                        ฿{value}
                                      </span>
                                    ) : column.property === "noOfRooms" ? (
                                      <span className="inline-flex items-center justify-center w-10 h-10 bg-primary-100 text-primary-700 rounded-full font-semibold">
                                        {value}
                                      </span>
                                    ) : (
                                      <span className="text-sm text-neutral-700">
                                        {value}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        }
                      )}
                    {(isRealTime ? roomBookings : matchedBookings).length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-6 py-12">
                          <div className="flex flex-col items-center justify-center text-neutral-400">
                            <span className="text-6xl mb-4">📅</span>
                            <p className="text-lg font-medium text-neutral-500">
                              No Room Bookings Found
                            </p>
                            <p className="text-sm text-neutral-400 mt-2">
                              There are no bookings available for the selected
                              period.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modern Pagination */}
            <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-4">
              <TablePagination
                rowsPerPageOptions={[10, 25, 100]}
                component="div"
                count={isRealTime ?
                  rows(roomBookings).filter((row) => {
                    if (tabValue === 0) return row.status === "Pending";
                    if (tabValue === 1) return row.status === "Accepted";
                    if (tabValue === 2) return row.status === "Canceled" || row.status === "Denied";
                    if (tabValue === 3) {
                      const rawDate = row.checkInDate || row.checkIn;
                      if (!rawDate) return false;
                      let dateObj;
                      if (rawDate.seconds) dateObj = new Date(rawDate.seconds * 1000);
                      else dateObj = new Date(rawDate);

                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const next7 = new Date(today);
                      next7.setDate(today.getDate() + 7);
                      next7.setHours(23, 59, 59, 999);

                      return dateObj >= today && dateObj <= next7 && row.status !== 'Canceled' && row.status !== 'Denied';
                    }
                    return true;
                  }).length
                  : totalPages}
                rowsPerPage={parseInt(rowsPerPage, 10)}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                sx={{
                  "& .MuiTablePagination-toolbar": {
                    color: "var(--text-primary)",
                  },
                  "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows":
                  {
                    margin: 0,
                    fontWeight: 500,
                  },
                  "& .MuiTablePagination-select": {
                    borderRadius: "8px",
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    padding: "4px 8px",
                  },
                  "& .MuiTablePagination-actions button": {
                    borderRadius: "8px",
                    "&:hover": {
                      backgroundColor: "var(--primary-bg-light)",
                    },
                  },
                }}
              />
            </div>
          </div>
        )
      }

      {/* View Booking details and confirm booking modal */}
      <Dialog
        open={openBookingDetailsModal}
        onClose={() => setOpenBookingDetailsModal(false)}
        aria-labelledby="responsive-dialog-title"
        maxWidth="lg"
        fullWidth
        PaperProps={{
          style: { borderRadius: 24, padding: 0, backgroundColor: '#F8FAFC' }
        }}
      >
        <DialogTitle sx={{ m: 0, p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #fff 0%, #f1f5f9 100%)', borderBottom: '1px solid #e2e8f0' }} id="customized-dialog-title">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-white rounded-xl shadow-sm text-primary-600 border border-neutral-100">
              <HotelIcon />
            </div>
            <div>
              <span className="block font-extrabold text-xl text-slate-800 tracking-tight">Booking Details</span>
              <span className="block text-xs font-medium text-slate-500 mt-0.5">ID: {bookingDetails?.bookingId}</span>
            </div>
          </div>
          <span className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-sm border ${bookingDetails?.status === "Accepted" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
            bookingDetails?.status === "Pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
              "bg-rose-50 text-rose-700 border-rose-200"
            }`}>
            {bookingDetails?.status === "Accepted" && <span className="mr-1.5">✓</span>}
            {bookingDetails?.status}
          </span>
        </DialogTitle>
        <IconButton
          aria-label="close"
          onClick={() => setOpenBookingDetailsModal(false)}
          sx={{
            position: "absolute",
            right: 16,
            top: 16,
            color: "neutral.400",
            '&:hover': { color: 'neutral.600', bgcolor: 'neutral.100' }
          }}
        >
          <CloseIcon />
        </IconButton>

        {/* modal body */}
        <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>

          {/* Status Timeline */}
          <div className="mb-6 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <h4 className="font-bold text-slate-700 mb-2 text-sm uppercase tracking-wider">Booking Status</h4>
            <BookingTimeline booking={bookingDetails} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Stay Info */}
            <div className="bg-white p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-50">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <BedroomParentIcon fontSize="small" />
                </div>
                <h3 className="font-bold text-base text-slate-800">Stay Information</h3>
              </div>
              <Grid container spacing={1}>
                {renderDetailItem("Hotel Name", bookingDetails?.hotelName || "N/A", <HotelIcon fontSize="small" />, false, "text-blue-600 bg-blue-50")}
                {renderDetailItem("Room Type", bookingDetails?.roomName || "N/A", <MeetingRoomIcon fontSize="small" />, false, "text-blue-600 bg-blue-50")}
                {renderDetailItem("Rooms", bookingDetails?.noOfRooms || "N/A", <BedroomParentIcon fontSize="small" />, false, "text-blue-600 bg-blue-50")}
                {renderDetailItem("Nights", bookingDetails?.nights || "N/A", <NumbersIcon fontSize="small" />, false, "text-blue-600 bg-blue-50")}
                {renderDetailItem("Check In", bookingDetails?.checkIn || "N/A", <CalendarMonthIcon fontSize="small" />, false, "text-blue-600 bg-blue-50")}
                {renderDetailItem("Check Out", bookingDetails?.checkOut || "N/A", <CalendarMonthIcon fontSize="small" />, false, "text-blue-600 bg-blue-50")}
              </Grid>
            </div>

            {/* Guest Info */}
            <div className="bg-white p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-50">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <PersonIcon fontSize="small" />
                </div>
                <h3 className="font-bold text-base text-slate-800">Guest Information</h3>
              </div>
              <Grid container spacing={1}>
                {renderDetailItem("Guest Name", bookingDetails?.name || "N/A", <PersonIcon fontSize="small" />, false, "text-purple-600 bg-purple-50")}
                {renderDetailItem("Phone", bookingDetails?.phone || "N/A", <PhoneIcon fontSize="small" />, false, "text-purple-600 bg-purple-50")}
                {renderDetailItem("Email", bookingDetails?.email || "N/A", <EmailIcon fontSize="small" />, false, "text-purple-600 bg-purple-50")}
                {renderDetailItem("Nationality", bookingDetails?.nationality || "N/A", <PublicIcon fontSize="small" />, false, "text-purple-600 bg-purple-50")}
                {renderDetailItem("Guests", `${bookingDetails?.adults || 0} Adults, ${bookingDetails?.children || 0} Children`, <PersonIcon fontSize="small" />, true, "text-purple-600 bg-purple-50")}
                {bookingDetails?.specialNotes && renderDetailItem("Special Notes", bookingDetails.specialNotes, <MdInfo fontSize="small" />, true, "text-purple-600 bg-purple-50")}
              </Grid>
            </div>

            {/* Payment Info */}
            <div className="bg-white p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-50">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <PaymentsIcon fontSize="small" />
                </div>
                <h3 className="font-bold text-base text-slate-800">Payment Details</h3>
              </div>
              <Grid container spacing={1}>
                {renderDetailItem("Amount (THB)", `฿${bookingDetails?.amountTHB || bookingDetails?.amount || 0}`, <AttachMoneyIcon fontSize="small" />, false, "text-emerald-600 bg-emerald-50")}
                {bookingDetails?.amountINR && renderDetailItem("Amount (INR)", `₹${bookingDetails?.amountINR}`, <AttachMoneyIcon fontSize="small" />, false, "text-emerald-600 bg-emerald-50")}
                {renderDetailItem("Payment Method", bookingDetails?.paymentMethod || "N/A", <CreditCardIcon fontSize="small" />, false, "text-emerald-600 bg-emerald-50")}
                <Grid item xs={12} sm={6}>
                  <div className="flex items-start gap-2 p-2.5 rounded-xl hover:bg-neutral-50 transition-all duration-200 border border-transparent hover:border-neutral-200 group">
                    <div className="text-emerald-600 mt-0.5 p-2 bg-emerald-50 rounded-lg group-hover:scale-110 transition-transform duration-200 shadow-sm">
                      <DoneRoundedIcon fontSize="small" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-0.5">Payment Status</p>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold mt-0.5 ${bookingDetails?.isPaymentDone ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20" : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20"}`}>
                        {bookingDetails?.isPaymentDone ? "PAID" : "UNPAID"}
                      </span>
                    </div>
                  </div>
                </Grid>
              </Grid>
            </div>

            {/* Admin Info */}
            {(bookingDetails?.managerPhone || (bookingDetails?.roomNumbers && bookingDetails.roomNumbers.length > 0)) && (
              <div className="bg-white p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-50">
                  <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                    <HotelIcon fontSize="small" />
                  </div>
                  <h3 className="font-bold text-base text-slate-800">Administrative</h3>
                </div>
                <Grid container spacing={1}>
                  {renderDetailItem("Manager's Number", bookingDetails?.managerPhone, <PhoneIcon fontSize="small" />, false, "text-orange-600 bg-orange-50")}
                  {bookingDetails?.roomNumbers && bookingDetails.roomNumbers.length > 0 && (
                    <Grid item xs={12}>
                      <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="text-orange-600 mt-0.5 p-2 bg-white rounded-lg shadow-sm">
                          <MeetingRoomIcon fontSize="small" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Booked Rooms</p>
                          <div className="flex flex-wrap gap-2">
                            {bookingDetails.roomNumbers.map((item, i) => (
                              <span key={i} className="bg-white text-slate-700 font-bold py-1.5 px-3 rounded-lg border border-slate-200 shadow-sm text-xs">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Grid>
                  )}
                </Grid>
              </div>
            )}
          </div>
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: '1px solid #e5e5e5', bgcolor: 'white' }}>
          <Button
            variant="outlined"
            onClick={() => setOpenBookingDetailsModal(false)}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 600,
              color: 'neutral.600',
              borderColor: 'neutral.300',
              px: 3,
              '&:hover': {
                borderColor: 'neutral.400',
                bgcolor: 'neutral.50',
                color: 'neutral.800'
              }
            }}
          >
            Close Details
          </Button>
        </DialogActions>
      </Dialog>

      {/* view package details modal */}
      <Dialog
        open={openPackageDetailsModal}
        onClose={() => setOpenPackageDetailsModal(false)}
        aria-labelledby="responsive-dialog-title"
        maxWidth="md"
        fullWidth
        PaperProps={{
          style: { borderRadius: 24, padding: 0, backgroundColor: '#F8FAFC' }
        }}
      >
        <DialogTitle sx={{ m: 0, p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #fff 0%, #f1f5f9 100%)', borderBottom: '1px solid #e2e8f0' }} id="customized-dialog-title">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-white rounded-xl shadow-sm text-purple-600 border border-neutral-100">
              <BedroomParentIcon />
            </div>
            <div>
              <span className="block font-extrabold text-xl text-slate-800 tracking-tight">Package Details</span>
              <span className="block text-xs font-medium text-slate-500 mt-0.5">{packageDetails?.packageName}</span>
            </div>
          </div>
          <IconButton
            aria-label="close"
            onClick={() => setOpenPackageDetailsModal(false)}
            sx={{
              color: "neutral.400",
              '&:hover': { color: 'neutral.600', bgcolor: 'neutral.100' }
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        {/* modal body */}
        <DialogContent sx={{ p: 3 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cover Photo */}
            <div className="md:col-span-2">
              {packageDetails?.coverPhoto && (
                <img
                  src={packageDetails.coverPhoto}
                  alt="Cover"
                  className="w-full h-48 object-cover rounded-2xl shadow-sm border border-slate-100"
                />
              )}
            </div>

            {/* Basic Info */}
            <div className="bg-white p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 h-full flex flex-col md:col-span-2">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-50">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <MdInfo fontSize="small" />
                </div>
                <h3 className="font-bold text-base text-slate-800">Package Information</h3>
              </div>
              <Grid container spacing={1}>
                {renderDetailItem("Package Name", packageDetails?.packageName || "N/A", <MeetingRoomIcon fontSize="small" />, false, "text-indigo-600 bg-indigo-50")}
                {renderDetailItem("Hotel Name", packageDetails?.name || "N/A", <HotelIcon fontSize="small" />, false, "text-indigo-600 bg-indigo-50")}
                {renderDetailItem("Phone", packageDetails?.phoneNumber || "N/A", <PhoneIcon fontSize="small" />, false, "text-indigo-600 bg-indigo-50")}
                {renderDetailItem("Guests", packageDetails?.numberOfGuests || "N/A", <PersonIcon fontSize="small" />, false, "text-indigo-600 bg-indigo-50")}
                {renderDetailItem("Price", `฿${packageDetails?.price || 0}`, <AttachMoneyIcon fontSize="small" />, false, "text-indigo-600 bg-indigo-50")}
                {packageDetails?.discount > 0 && renderDetailItem("Discount", `${packageDetails?.discount}%`, <AttachMoneyIcon fontSize="small" />, false, "text-indigo-600 bg-indigo-50")}
                {packageDetails?.discount > 0 && renderDetailItem("Price After Discount", `฿${calculateDiscountPrice(packageDetails?.price, packageDetails?.discount)}`, <AttachMoneyIcon fontSize="small" />, false, "text-emerald-600 bg-emerald-50")}
              </Grid>
            </div>

            {/* Description */}
            <div className="bg-white p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 md:col-span-2">
              <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider mb-2">Description</h3>
              <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">{packageDetails?.description || "No description available."}</p>
            </div>

            {/* Amenities */}
            {packageDetails?.amenities && packageDetails.amenities.length > 0 && (
              <div className="bg-white p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 md:col-span-2">
                <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider mb-3">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {packageDetails.amenities.map((amenity, i) => (
                    <span key={i} className="bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200">
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Gallery */}
            {packageDetails?.pictures && packageDetails.pictures.length > 0 && (
              <div className="bg-white p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 md:col-span-2">
                <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider mb-3">Room Pictures</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {packageDetails.pictures.map((picture, i) => (
                    <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-100">
                      <img
                        src={picture?.url}
                        alt={picture?.label}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <p className="text-white text-xs truncate text-center">{picture?.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: '1px solid #e5e5e5', bgcolor: 'white' }}>
          <Button
            variant="outlined"
            onClick={() => setOpenPackageDetailsModal(false)}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 600,
              color: 'neutral.600',
              borderColor: 'neutral.300',
              px: 3,
              '&:hover': {
                borderColor: 'neutral.400',
                bgcolor: 'neutral.50',
                color: 'neutral.800'
              }
            }}
          >
            Close Package Details
          </Button>
        </DialogActions>
      </Dialog>
      {/* PDF Preview Dialog */}
      <Dialog
        open={previewOpen}
        onClose={handleClosePreview}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { height: '90vh', borderRadius: 4 }
        }}
      >
        <AppBar sx={{ position: 'relative', bgcolor: '#1e3a8a' }}>
          <Toolbar>
            <Typography sx={{ ml: 2, flex: 1, fontWeight: 700 }} variant="h6" component="div">
              Invoice Preview
            </Typography>
            <IconButton edge="start" color="inherit" onClick={handleClosePreview} aria-label="close">
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
        <DialogContent sx={{ p: 0, overflow: 'hidden', bgcolor: '#525659' }}>
          {previewPdfUrl ? (
            <iframe
              src={previewPdfUrl}
              width="100%"
              height="100%"
              style={{ border: 'none' }}
              title="PDF Preview"
            />
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'white' }}>
              <CircularProgress color="inherit" />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: 'white' }}>
          <Button onClick={handleClosePreview} variant="outlined" sx={{ borderRadius: 2 }}>
            Close
          </Button>
          <Button
            variant="contained"
            startIcon={<FileDownloadIcon />}
            onClick={() => {
              const link = document.createElement('a');
              link.href = previewPdfUrl;
              link.download = `Invoice_Preview.pdf`;
              link.click();
            }}
            sx={{ borderRadius: 2, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          >
            Download PDF
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default RoomBookings;
