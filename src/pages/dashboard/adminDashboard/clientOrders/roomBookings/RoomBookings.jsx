import { useContext } from "react";
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

const RoomBookings = () => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const { roomBookings, hotels } = useContext(PartnerContext);
  const [matchedBookings, setMatchedBookings] = useState([]);
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
  const { CreateNewNotificationToUser } = useNotifications();

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setPage(0);
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

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(event.target.value);
    setPage(0);
  };

  // useEffect(() => {
  //   const sortedBookings = roomBookings;
  //   setMatchedBookings(sortedBookings);
  // }, [roomBookings]);

  // Helper to check availability
  const checkAvailability = (hotelId, checkInDate, checkOutDate) => {
    let hotel = hotels.find(h => h.id === hotelId || h.uid === hotelId);

    // PERMISSIVE FALLBACK: If hotel not found, mock a 'default' hotel to allow booking to proceed (assuming capacity exists)
    if (!hotel) {
      console.warn(`[AutoConfirm] Hotel ${hotelId} not found in context. Using default fallback capacity.`);
      hotel = { totalRooms: 30, hotelName: "Unknown Hotel" };
    }

    // Robust Capacity Lookup - Fallback to 30 if not set
    let totalCapacity = Number(
      hotel.totalRooms ||
      hotel.hotel?.totalRooms ||
      hotel.hotelInformation?.totalRooms ||
      hotel.hotelDetails?.totalRooms ||
      0
    );

    if (totalCapacity === 0) {
      console.warn(`[AutoConfirm] Capacity is 0. Defaulting to 30.`);
      totalCapacity = 30; // Fallback
    }

    console.log(`[AutoConfirm] Checking Capacity for Hotel: ${hotel.hotelName || hotel.hotel?.hotelName || hotelId}. Capacity: ${totalCapacity}`);

    // Calculate Occupied Rooms during the requested period
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const occupied = roomBookings.reduce((acc, b) => {
      // Logic: Count bookings that are EFFECTIVELY occupying a room.
      // This includes 'Accepted' bookings AND 'Pending' bookings that have already RESERVED a slot (Stage 1).
      if ((b.hotelUid === hotelId || b.hotelId === hotelId) &&
        (b.status === 'Accepted' || b.bookingStatus === 'ACCEPTED' || b.isBookingConfirmed === true)) {

        const bStartRaw = b.checkInDate || b.checkIn;
        const bEndRaw = b.checkOutDate || b.checkOut;

        if (bStartRaw && bEndRaw) {
          const bStart = bStartRaw.seconds ? new Date(bStartRaw.seconds * 1000) : new Date(bStartRaw);
          const bEnd = bEndRaw.seconds ? new Date(bEndRaw.seconds * 1000) : new Date(bEndRaw);
          bStart.setHours(0, 0, 0, 0);
          bEnd.setHours(0, 0, 0, 0);

          // Check Overlap: (StartA < EndB) and (EndA > StartB)
          if (start < bEnd && end > bStart) {
            return acc + Number(b.rooms || b.noOfRooms || 0);
          }
        }
      }
      return acc;
    }, 0);

    return totalCapacity - occupied;
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
        updateHourlyEarnings(amount, "Hotels");
        updateHourlyEarnings(amount, "Hotels", hotelId);
        updateMonthlyEarnings(amount, "Hotels");
        updateMonthlyEarnings(amount, "Hotels", hotelId);
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
      console.error("[AutoConfirm] Confirm failed", e);
      return false;
    }
  };

  // Auto-Confirm Effect
  useEffect(() => {
    // We removed the !isRealTime check to ensure this runs in background always
    // if (!isRealTime) return;

    const processAutoConfirm = async () => {
      const pending = roomBookings.filter(b => b.status === "Pending" || b.bookingStatus === "PENDING" || b.status === "Not Reviewed");

      if (pending.length === 0) return;

      console.log(`[AutoConfirm] Found ${pending.length} pending bookings.`);

      for (const booking of pending) {
        // Prepare dates
        const checkInRaw = booking.checkInDate || booking.checkIn;
        const checkOutRaw = booking.checkOutDate || booking.checkOut;

        if (!checkInRaw || !checkOutRaw) {
          // console.warn(`[AutoConfirm] Invalid dates for booking ${booking.id}`);
          continue;
        }

        const checkIn = checkInRaw.seconds ? new Date(checkInRaw.seconds * 1000) : new Date(checkInRaw);
        const checkOut = checkOutRaw.seconds ? new Date(checkOutRaw.seconds * 1000) : new Date(checkOutRaw);

        const hotelId = booking.hotelUid || booking.hotelId;
        const requestedRooms = Number(booking.rooms || booking.noOfRooms || 0);

        if (hotelId && requestedRooms > 0) {

          // STAGE 1: Check Availability & Reserve Slot (isBookingConfirmed = true)
          // We do this if it's not yet confirmed.
          if (!booking.isBookingConfirmed) {
            const available = checkAvailability(hotelId, checkIn, checkOut);

            if (available >= requestedRooms) {
              console.log(`[AutoConfirm] Rooms Available (${available} >= ${requestedRooms}). Reserving slot for ${booking.id}...`);
              try {
                // Update Doc
                await updateDoc(doc(roomBookingCollection, booking.bookingId || booking.id), {
                  isBookingConfirmed: true
                });
                console.log("Slot Reserved Success");
              } catch (err) {
                console.error("[AutoConfirm] Error reserving slot:", err);
              }
            } else {
              console.log(`[AutoConfirm] Not enough rooms for ${booking.id} at Hotel ${hotelId}. Avail: ${available}, Req: ${requestedRooms}`);
            }
          }

          // STAGE 2: Finalize Booking (Pending -> Accepted)
          // Only if slot is confirmed (We are ignoring payment check as per new requirement)
          if (booking.isBookingConfirmed && booking.status !== 'Accepted') {
            console.log(`[AutoConfirm] Finalizing booking ${booking.id} (Payment Check Skipped)`);
            await confirmBookingInternal(booking);
          }
        }
      }
    };

    processAutoConfirm();

  }, [roomBookings, hotels, isRealTime]);

  let columns = [
    { property: "hotelName", label: "Hotel", width: "15%" },
    { property: "name", label: "Guest Name", width: "17%" },
    { property: "phone", label: "Phone", width: "10%" },
    { property: "noOfRooms", label: "Rooms", width: "5%" },
    { property: "checkIn", label: "Check in", width: "14%" },
    { property: "orderedAt", label: "Booking time	", width: "14%" },
    { property: "amount", label: "Amount", width: "10%" },
    { property: "status", label: "Status", width: "5%" },
    { property: "action", label: "Action", width: "10%" },
  ];

  // creating single row
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

    // Normalize Status
    let status = booking.status;
    const rawStatus = booking.bookingStatus || booking.status;
    if (typeof rawStatus === 'string') {
      const upper = rawStatus.toUpperCase();
      if (upper === 'PENDING') status = 'Pending';
      else if (upper === 'ACCEPTED' || upper === 'CONFIRMED') status = 'Accepted';
      else if (upper === 'CANCELED' || upper === 'CANCELLED' || upper === 'REJECTED' || upper === 'DENIED') status = 'Canceled';
      else status = rawStatus; // Fallback
    }

    return {
      ...booking,
      isBookingConfirmed: booking.isBookingConfirmed,
      isPaymentDone: booking.isPaymentDone,
      hotelName: booking.hotelName,
      name: booking.fullName || booking.guestDetails?.name || "N/A",
      phone: booking.phone || booking.guestDetails?.phone || "N/A",
      email: booking.email || booking.guestDetails?.email || "N/A",
      noOfRooms: booking.rooms || booking.noOfRooms,
      checkIn: getDate(checkInDate),
      checkOut: getDate(checkOutDate),
      amount: booking.amountTHB || booking.amount,
      orderedAt: orderedAtRaw,
      roomNumbers: booking.roomNumbers,
      status: status,
      packageId: booking.packageId,
      bookingId: booking.id || booking.bookingId,
      managerPhone: booking.managerPhone,
      hotelUid: booking.hotelUid,
      userId: booking.userId,
      // New fields mapping
      adults: booking.adults,
      children: booking.children,
      nationality: booking.nationality,
      nights: booking.nights,
      roomName: booking.roomName,
      paymentMethod: booking.paymentMethod,
      currency: booking.currency,
      amountINR: booking.amountINR,
      amountTHB: booking.amountTHB,
    };
  }

  // calling createData function with partner's data
  const rows = (bookings) => {
    return bookings?.map((booking) => {
      return createData(booking);
    });
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
    const bookings = rows(roomBookings).filter((item) => item.bookingId === id);
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
              <p className="text-3xl font-bold">
                {(isRealTime ? roomBookings : matchedBookings).length}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">📅</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-success-500 to-success-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-success-100 text-sm font-medium mb-1">
                Accepted
              </p>
              <p className="text-3xl font-bold">
                {
                  (isRealTime ? roomBookings : matchedBookings).filter(
                    (b) => b.status === "Accepted"
                  ).length
                }
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">✅</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-warning-500 to-warning-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-warning-100 text-sm font-medium mb-1">
                Pending
              </p>
              <p className="text-3xl font-bold">
                {
                  (isRealTime ? roomBookings : matchedBookings).filter(
                    (b) => b.status === "Pending"
                  ).length
                }
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">⏳</span>
            </div>
          </div>
        </div>
      </div>

      {/* Date Filter Section */}
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
        </Tabs>
      </Box>

      {/* Modern Table Container */}
      <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <LoadingContent variant="skeleton" />
          ) : (
            <table className="w-full">
              <thead className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                <tr>
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
                    return true;
                  })
                  .map(
                    (row, i) => {
                      return (
                        <tr
                          key={i}
                          className="hover:bg-primary-50 transition-colors duration-200"
                        >
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
                                {column.property === "status" ? (
                                  <span
                                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${value === "Pending" || value === "PENDING"
                                      ? "bg-warning-100 text-warning-700 border border-warning-300"
                                      : value === "Accepted" || value === "ACCEPTED"
                                        ? "bg-success-100 text-success-700 border border-success-300"
                                        : "bg-danger-100 text-danger-700 border border-danger-300"
                                      }`}
                                  >
                                    {(value === "Accepted" || value === "ACCEPTED") && "✓ "}
                                    {(value === "Pending" || value === "PENDING") && "⏳ "}
                                    {(value === "Canceled" || value === "CANCELED" || value === "REJECTED") && "✗ "}
                                    {value}
                                  </span>
                                ) : column.property === "orderedAt" ? (
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
        {!isRealTime && (
          <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-4">
            <TablePagination
              rowsPerPageOptions={[10, 25, 100]}
              component="div"
              count={totalPages}
              rowsPerPage={rowsPerPage}
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
        )}
      </div>

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
    </div >
  );
};

export default RoomBookings;
