import CloseIcon from "@mui/icons-material/Close";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DoneRoundedIcon from "@mui/icons-material/DoneRounded";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FilterListIcon from "@mui/icons-material/FilterList";
import RefreshIcon from "@mui/icons-material/Refresh";
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
  TextField,
  Typography,
  Divider,
  Chip,
  Tabs,
  Tab,
  Stepper,
  Step,
  StepLabel,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup
} from "@mui/material";
import { MdEdit, MdDelete, MdVisibility, MdInfo } from "react-icons/md";
import { ViewList, ViewModule } from "@mui/icons-material";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import LoadingContent from "../../../../../components/LoadingContent";
import PageHeading from "../../../../../components/PageHeading";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import { useNotifications } from "../../../../../contextAPIs/NotificationsProvider";
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";
import {
  travelBookingCollection,
  travelServicesDetailsCollection,
} from "../../../../../firebase/firebase.config";
import {
  fetchBookings,
  fetchBookingsTotalPages,
} from "../../../../../services/Bookings";
import {
  updateHourlyEarnings,
  updateMonthlyEarnings,
} from "../../../../../services/Earning";
import {
  calculateDiscountPrice,
  formatPhoneNumber,
  getDateAndTime,
} from "../../../../../utils/utils";

const TravelBookings = () => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const { travelBookings } = useContext(PartnerContext);
  const { CreateNewNotificationToUser } = useNotifications();
  const [matchedBookings, setMatchedBookings] = useState([]);
  const [error, setError] = useState({ for: "", text: "" });
  const [loading, setLoading] = useState(false);
  const [openPackageDetailsModal, setOpenPackageDetailsModal] = useState(false);
  const [openBookingDetailsModal, setOpenBookingDetailsModal] = useState(false);
  const [bookingDetails, setBookingDetails] = useState({
    Provider: { name: "", phone: "" },
    // Driver: { name: "", phone: "" },
    // vehicleDetails: { vehicle: "", vehicleNumber: "" },
  });
  const [packageDetails, setPackageDetails] = useState({});
  const [refetch, setRefetch] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isRealTime, setIsRealTime] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [viewMode, setViewMode] = useState('list');

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setPage(0);
  };
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [lastDocs, setLastDocs] = useState([]);

  const handleDateRangeSubmit = (event) => {
    event.preventDefault();
    if (endDate == "") {
      alert("Please select both start and end!!");
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
        "Sightseeing Bookings"
      );
      fetchBookings(
        setMatchedBookings,
        setLoading,
        "Sightseeing Bookings",
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

  // Bookings table header
  let columns = [
    { property: "guestName", label: "Guest Name", width: "15%" },
    { property: "phone", label: "Phone", width: "15%" },
    { property: "packageTitle", label: "Travel Details", width: "15%" },
    { property: "orderedAt", label: "Booking time", width: "18%" },
    { property: "price", label: "Price", width: "11%" },
    { property: "status", label: "Status", width: "11%" },
    { property: "action", label: "Action", width: "15%" },
  ];

  // creating single row
  function createData(
    guestName,
    phone,
    packageTitle,
    orderedAt,
    price,
    status,
    orderId,
    packageId,
    fullData
  ) {
    return {
      guestName,
      phone,
      packageTitle,
      orderedAt,
      price,
      status,
      orderId,
      packageId,
      fullData
    };
  }

  // calling createData function with partner's data
  const rows = (bookings) => {
    return bookings?.map((booking) => {
      // Handle both data structures (Old vs New)
      const guestName = booking?.guestDetails?.name?.replace("not_present", "").trim() || booking?.fullName || "N/A";
      const phone = booking?.guestDetails?.phoneNumber || booking?.phone || "N/A";
      const title = booking?.title || booking?.packageName || "Unknown Package";
      const orderTime = booking?.orderedAt || booking?.timestamp;
      const priceVal = booking?.price || booking?.totalAmount || 0;
      // Status might be missing in new data, default to "Not Reviewed"
      const statusVal = booking?.status || "Not Reviewed";

      return createData(
        guestName,
        phone,
        title,
        orderTime,
        priceVal,
        statusVal,
        booking.id || booking.orderId,
        booking.dataid || booking.packageId,
        booking
      );
    });
  };

  // setting booking details to the state
  const handleViewBookingDetails = async (id) => {
    // console.log(id);
    const snapshot = await getDoc(doc(travelBookingCollection, id));
    if (snapshot.exists()) {
      const existingData = snapshot.data();
      setBookingDetails({ ...bookingDetails, ...existingData, id: snapshot.id });
      setOpenBookingDetailsModal(true);
    }
  };

  // setting package details to the state
  const handleViewPackageDetails = async (id) => {
    const snapshot = await getDoc(doc(travelServicesDetailsCollection, id));
    if (snapshot.exists()) {
      const existingData = snapshot.data();
      setPackageDetails(existingData);
      setOpenPackageDetailsModal(true);
    }
  };

  // delete canceled booking
  // delete/reject booking
  const handleDelete = async (id, bookingData = null) => {
    if (confirm("Do you want to reject this booking?")) {
      await updateDoc(doc(travelBookingCollection, id), {
        status: "Canceled",
      }).then(async () => {
        alert("Booking rejected!.");
        setBookingDetails({
          Provider: { name: "", phone: "" },
        });

        const dataToUse = bookingData || bookingDetails;
        const gName = dataToUse?.guestDetails?.name || dataToUse?.fullName;
        const bTitle = dataToUse?.title || dataToUse?.packageName;
        const uId = dataToUse?.userId || dataToUse?.uId;

        if (uId) {
          await CreateNewNotificationToUser(
            "Sightseeing booking rejected!",
            `Hey ${gName}! sorry your sightseeing booking for ${bTitle} is rejected!`,
            uId
          );
        }
      });
    }
  };

  const handleConfirmBooking = async (id, bookingData) => {
    if (confirm("Do you want to confirm this booking immediately?")) {
      await updateDoc(doc(travelBookingCollection, id), {
        status: "Accepted",
        isBookingConfirmed: true
      }).then(async () => {
        alert("Booking confirmed successfully!");

        const priceVal = bookingData?.price || bookingData?.totalAmount;
        if (priceVal) {
          await updateHourlyEarnings(priceVal, "Sightseeing");
          await updateMonthlyEarnings(priceVal, "Sightseeing");
        }

        const gName = bookingData?.guestDetails?.name || bookingData?.fullName;
        const bTitle = bookingData?.title || bookingData?.packageName;
        const uId = bookingData?.userId || bookingData?.uId;

        if (uId) {
          await CreateNewNotificationToUser(
            "Sightseeing booking confirmed!",
            `Hey ${gName}! your sightseeing booking for ${bTitle} is confirmed!`,
            uId
          );
        }
      });
    }
  };

  const handleReview = async (id) => {
    if (!bookingDetails.adminReview?.trim()) {
      alert("Please add a review note before marking as reviewed.");
      return;
    }

    if (confirm("Mark this booking as 'Review In Progress'?")) {
      await updateDoc(doc(travelBookingCollection, id), {
        status: "In Progress",
        adminReview: bookingDetails.adminReview
      }).then(() => {
        alert("Booking status set to In Progress!");
        setOpenBookingDetailsModal(false);
        setBookingDetails({
          Provider: { name: "", phone: "" },
          adminReview: "",
          // Driver: { name: "", phone: "" },
          // vehicleDetails: { vehicle: "", vehicleNumber: "" },
        });
      });
    }
  };

  const handleAccept = async (id) => {
    // console.log(id);
    setError({ for: "", text: "" });
    // Validation removed as per request to 'accept as it comes'
    // if (bookingDetails.Provider.name.trim().length < 1) { ... }
    if (confirm("Do you want to proceed with confirming this booking?")) {
      await updateDoc(doc(travelBookingCollection, id), {
        ...bookingDetails,
        status: "Accepted",
      }).then(async () => {
        alert("Booking confirmed successfully!.");
        setOpenBookingDetailsModal(false);
        setBookingDetails({
          Provider: { name: "", phone: "" },
          adminReview: "",
          // Driver: { name: "", phone: "" },
          // vehicleDetails: { vehicle: "", vehicleNumber: "" },
        });
        const priceVal = bookingDetails?.price || bookingDetails?.totalAmount;
        await updateHourlyEarnings(priceVal, "Sightseeing");
        await updateHourlyEarnings(
          priceVal,
          "Sightseeing",
          bookingDetails?.Provider?.phone
        );
        await updateMonthlyEarnings(priceVal, "Sightseeing");
        await updateMonthlyEarnings(
          priceVal,
          "Sightseeing",
          bookingDetails?.Provider?.phone
        );
        const gName = bookingDetails?.guestDetails?.name || bookingDetails?.fullName;
        const bTitle = bookingDetails?.title || bookingDetails?.packageName;

        await CreateNewNotificationToUser(
          "Sightseeing booking confirm!",
          `Hey ${gName}! your sightseeing booking for ${bTitle} is confirmed!`,
          bookingDetails?.userId || bookingDetails?.uId
        );
      });
    }
  };

  // custom text field for common data
  const textField = (label, value, is12) => {
    return (
      <Grid item xs={12} sm={label === "Description" || is12 ? 12 : 6}>
        <Box
          sx={{
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            bgcolor: 'background.paper',
            height: '100%',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: 'primary.light',
              boxShadow: 1
            }
          }}
        >
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block', letterSpacing: '0.05em' }}>
            {label.toUpperCase()}
          </Typography>
          <Typography variant="body1" color="text.primary" fontWeight={500}>
            {label.includes("Price") && "฿"}
            {value}
            {label.includes("Period") && " days"}
            {label === "Discount" && "%"}
          </Typography>
        </Box>
      </Grid>
    );
  };

  const headingTextField = (label, icon) => {
    return (
      <Grid item xs={12}>
        <Box sx={{ mt: 3, mb: 2, pb: 1, borderBottom: '1px dashed', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" color="primary.main" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {icon && <span>{icon}</span>}
            {label}
          </Typography>
        </Box>
      </Grid>
    );
  };

  return (
    <div className="animate-fade-in">
      <PageHeading
        text="Sightseeing Bookings"
        subtitle="Manage tour bookings and reservations"
        icon="🎫"
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div
          onClick={() => setTabValue(0)}
          className="bg-gradient-to-br from-warning-500 to-warning-600 rounded-xl p-6 text-white shadow-lg cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl active:scale-95"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-warning-100 text-sm font-medium mb-1">
                Review (Pending)
              </p>
              <p className="text-3xl font-bold">
                {
                  (isRealTime ? travelBookings : matchedBookings).filter(
                    (b) => {
                      const s = (b.status || "Not Reviewed").toLowerCase();
                      return ["not reviewed", "pending", "in progress", "reviewed"].includes(s);
                    }
                  ).length
                }
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">⏳</span>
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
                Done (Accepted)
              </p>
              <p className="text-3xl font-bold">
                {
                  (isRealTime ? travelBookings : matchedBookings).filter(
                    (b) => {
                      const s = (b.status || "").toLowerCase();
                      return ["accepted", "confirmed", "done"].includes(s);
                    }
                  ).length
                }
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">✅</span>
            </div>
          </div>
        </div>

        <div
          onClick={() => setTabValue(2)}
          className="bg-gradient-to-br from-danger-500 to-danger-600 rounded-xl p-6 text-white shadow-lg cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl active:scale-95"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-danger-100 text-sm font-medium mb-1">
                Reject (Canceled)
              </p>
              <p className="text-3xl font-bold">
                {
                  (isRealTime ? travelBookings : matchedBookings).filter(
                    (b) => {
                      const s = (b.status || "").toLowerCase();
                      return ["canceled", "cancelled", "rejected"].includes(s);
                    }
                  ).length
                }
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">❌</span>
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

      {/* Tabs */}
      {viewMode === 'list' && (
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="bookingTabs">
            <Tab label="Pending" />
            <Tab label="Done" />
            <Tab label="Rejected" />
            <Tab label="Next 7 Days" />
          </Tabs>
        </Box>
      )}

      {viewMode === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full min-h-[500px] pb-6">
          {/* Pending Column */}
          <div className="bg-white rounded-xl shadow-lg border border-neutral-200 flex flex-col h-full bg-gradient-to-b from-white to-neutral-50 overflow-hidden">
            <div className="p-4 border-b border-warning-100 bg-warning-50 flex justify-between items-center sticky top-0 z-10">
              <h3 className="font-bold text-neutral-700 flex items-center gap-2"><span className="text-warning-500 text-xl">⏳</span> Pending / Review</h3>
              <span className="bg-warning-100 text-warning-700 px-2 py-0.5 rounded-full text-sm font-bold shadow-sm">
                {(isRealTime ? travelBookings : matchedBookings).filter(b => ["not reviewed", "pending", "in progress", "reviewed"].includes((b.status || "").toLowerCase())).length}
              </span>
            </div>
            <div className="p-4 flex-grow overflow-y-auto space-y-4 custom-scrollbar">
              {(isRealTime ? travelBookings : matchedBookings)
                .filter(b => ["not reviewed", "pending", "in progress", "reviewed"].includes((b.status || "").toLowerCase()))
                .map((row, i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-semibold text-neutral-800">{row.tripName}</span>
                      <Chip label={row.status || "Pending"} size="small" color="warning" variant="outlined" />
                    </div>
                    <div className="text-sm text-neutral-600 space-y-1 mb-4">
                      <p>👤 {row.customerName}</p>
                      <p>📅 {getDateAndTime(row.orderedAt || row.timestamp)}</p>
                      <p>💰 ฿{row.totalPrice && row.totalPrice.toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2 border-t pt-3 mt-2">
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => isRealTime && handleDelete(row.orderId)}
                        startIcon={<CloseRoundedIcon />}
                        fullWidth
                        sx={{ textTransform: 'none' }}
                      >
                        Reject
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        onClick={() => isRealTime && handleViewBookingDetails(row.orderId)}
                        startIcon={<DoneRoundedIcon />}
                        fullWidth
                        sx={{ textTransform: 'none' }}
                      >
                        Process
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Done Column */}
          <div className="bg-white rounded-xl shadow-lg border border-neutral-200 flex flex-col h-full bg-gradient-to-b from-white to-neutral-50 overflow-hidden">
            <div className="p-4 border-b border-success-100 bg-success-50 flex justify-between items-center sticky top-0 z-10">
              <h3 className="font-bold text-neutral-700 flex items-center gap-2"><span className="text-success-500 text-xl">✅</span> Done / Accepted</h3>
              <span className="bg-success-100 text-success-700 px-2 py-0.5 rounded-full text-sm font-bold shadow-sm">
                {(isRealTime ? travelBookings : matchedBookings).filter(b => ["accepted", "confirmed", "done"].includes((b.status || "").toLowerCase())).length}
              </span>
            </div>
            <div className="p-4 flex-grow overflow-y-auto space-y-4 custom-scrollbar">
              {(isRealTime ? travelBookings : matchedBookings)
                .filter(b => ["accepted", "confirmed", "done"].includes((b.status || "").toLowerCase()))
                .map((row, i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-semibold text-neutral-800">{row.tripName}</span>
                      <Chip label="Accepted" size="small" color="success" />
                    </div>
                    <div className="text-sm text-neutral-600 space-y-1">
                      <p>👤 {row.customerName}</p>
                      <p>📅 {getDateAndTime(row.orderedAt || row.timestamp)}</p>
                      <p>💰 ฿{row.totalPrice}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Rejected Column */}
          <div className="bg-white rounded-xl shadow-lg border border-neutral-200 flex flex-col h-full bg-gradient-to-b from-white to-neutral-50 overflow-hidden">
            <div className="p-4 border-b border-danger-100 bg-danger-50 flex justify-between items-center sticky top-0 z-10">
              <h3 className="font-bold text-neutral-700 flex items-center gap-2"><span className="text-danger-500 text-xl">❌</span> Rejected</h3>
              <span className="bg-danger-100 text-danger-700 px-2 py-0.5 rounded-full text-sm font-bold shadow-sm">
                {(isRealTime ? travelBookings : matchedBookings).filter(b => ["canceled", "cancelled", "rejected"].includes((b.status || "").toLowerCase())).length}
              </span>
            </div>
            <div className="p-4 flex-grow overflow-y-auto space-y-4 custom-scrollbar">
              {(isRealTime ? travelBookings : matchedBookings)
                .filter(b => ["canceled", "cancelled", "rejected"].includes((b.status || "").toLowerCase()))
                .map((row, i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow opacity-75 hover:opacity-100">
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-semibold text-neutral-800">{row.tripName}</span>
                      <Chip label={row.status} size="small" color="error" variant="outlined" />
                    </div>
                    <div className="text-sm text-neutral-600 space-y-1">
                      <p>👤 {row.customerName}</p>
                      <p>📅 {getDateAndTime(row.orderedAt || row.timestamp)}</p>
                      <p>💰 ฿{row.totalPrice}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
          {loading ? (
            <LoadingContent />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                    <tr>
                      {columns?.map((column) => (
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
                    {(() => {
                      const allBookings = isRealTime ? travelBookings : matchedBookings;
                      const filteredBookings = allBookings.filter((b) => {
                        const status = b.status || "Not Reviewed";
                        const lowerStatus = status.toLowerCase();

                        if (tabValue === 0) return ["not reviewed", "pending", "in progress", "reviewed"].includes(lowerStatus);
                        if (tabValue === 1) return ["accepted", "confirmed", "done"].includes(lowerStatus);
                        if (tabValue === 2) return ["canceled", "cancelled", "rejected"].includes(lowerStatus);
                        if (tabValue === 3) {
                          // Next 7 Days logic: Active bookings only
                          if (["canceled", "cancelled", "rejected"].includes(lowerStatus)) return false;

                          const puTime = b.pickUpTime || b.arrivalDate;
                          if (!puTime) return false;

                          let date;
                          if (puTime.seconds) {
                            date = new Date(puTime.seconds * 1000);
                          } else {
                            date = new Date(puTime);
                          }

                          if (isNaN(date.getTime())) return false;

                          const now = new Date();
                          now.setHours(0, 0, 0, 0);
                          const next7 = new Date(now);
                          next7.setDate(now.getDate() + 7);
                          next7.setHours(23, 59, 59, 999);

                          return date >= now && date <= next7;
                        }
                        return false;
                      });

                      if (filteredBookings.length === 0) {
                        return (
                          <tr>
                            <td colSpan={10} className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center justify-center gap-3">
                                <span className="text-6xl opacity-50">📅</span>
                                <p className="text-neutral-500 font-medium">
                                  No {tabValue === 0 ? "Not Reviewed" : tabValue === 1 ? "In Progress" : tabValue === 2 ? "Done" : tabValue === 3 ? "Upcoming (Next 7 Days)" : "Rejected"} Sightseeing Bookings Found
                                </p>
                                <p className="text-neutral-400 text-sm">
                                  Bookings will appear here when available
                                </p>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return rows(filteredBookings)?.map((row, i) => {
                        const date = (row["orderedAt"] || row["timestamp"])
                          ? new Date(
                            (row["orderedAt"]?.seconds || row["timestamp"]?.seconds || 0) * 1000 +
                            (row["orderedAt"]?.nanoseconds || row["timestamp"]?.nanoseconds || 0) / 1000000
                          )
                          : new Date();

                        return (
                          <tr
                            key={i}
                            className="hover:bg-primary-50 transition-colors duration-200"
                          >
                            {columns.map((column) => {
                              const value = row[column.property];

                              return (
                                <td
                                  key={column.property}
                                  className="px-6 py-4 text-center"
                                >
                                  {value === "Pending" ||
                                    value === "Accepted" ||
                                    value === "Canceled" ||
                                    value === "In Progress" ||
                                    value === "Reviewed" ||
                                    value === "Not Reviewed" ||
                                    value === "Confirmed" ||
                                    value === "Rejected" ? (
                                    <span
                                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${(value === "Pending" || value === "Not Reviewed" || value === "In Progress" || value === "Reviewed")
                                        ? "bg-warning-100 text-warning-700 border border-warning-300"
                                        : (value === "Accepted" || value === "Confirmed" || value === "Done")
                                          ? "bg-success-100 text-success-700 border border-success-300"
                                          : "bg-danger-100 text-danger-700 border border-danger-300"
                                        }`}
                                    >
                                      {(value === "Accepted" || value === "Confirmed" || value === "Done") && "✓ "}
                                      {(value === "Pending" || value === "Not Reviewed" || value === "In Progress" || value === "Reviewed") && "⏳ "}
                                      {(value === "Canceled" || value === "Rejected") && "✗ "}
                                      {value === "Not Reviewed" ? "Pending" : value === "Confirmed" ? "Accepted" : value}
                                    </span>
                                  ) : column.property === "orderedAt" ? (
                                    <span className="text-neutral-600">
                                      {getDateAndTime(date)}
                                    </span>
                                  ) : column.property === "roomNumbers" ? (
                                    <div className="flex items-center justify-center flex-wrap gap-1">
                                      {value?.map((item, idx) => (
                                        <span
                                          key={idx}
                                          className="bg-primary-500 text-white px-2 py-1 rounded text-xs font-medium"
                                        >
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  ) : column.property === "action" ? (
                                    <div className="flex gap-2 justify-center items-center">
                                      {/* View Booking Details (Eye) */}
                                      <Tooltip title="View Booking Details">
                                        <IconButton
                                          onClick={() => isRealTime && handleViewBookingDetails(row.orderId)}
                                          disabled={!isRealTime}
                                          sx={{
                                            color: '#3b82f6',
                                            '&:hover': { bgcolor: '#eff6ff' },
                                            '&.Mui-disabled': { opacity: 0.5 },
                                            transition: 'all 0.2s'
                                          }}
                                        >
                                          <MdVisibility size={20} />
                                        </IconButton>
                                      </Tooltip>

                                      {/* View Package Info (Info) */}
                                      {row.packageId && (
                                        <Tooltip title="View Package Details">
                                          <IconButton
                                            onClick={() => handleViewPackageDetails(row.packageId)}
                                            sx={{
                                              color: '#9333ea',
                                              '&:hover': { bgcolor: '#f3e8ff' },
                                              transition: 'all 0.2s'
                                            }}
                                          >
                                            <MdInfo size={20} />
                                          </IconButton>
                                        </Tooltip>
                                      )}

                                      {/* Pending Actions: Accept/Reject */}
                                      {(row.status === "Not Reviewed" || row.status === "Pending" || row.status === "In Progress" || row.status === "Reviewed" || !row.status) && (
                                        <>
                                          <Tooltip title="Accept Booking">
                                            <button
                                              onClick={() => isRealTime && handleConfirmBooking(row.orderId, row.fullData)}
                                              className="p-1.5 rounded-full bg-success-500 text-white hover:bg-success-600 hover:scale-110 transition-all duration-200 shadow-sm disabled:opacity-50"
                                              disabled={!isRealTime}
                                            >
                                              <DoneRoundedIcon sx={{ fontSize: 18 }} />
                                            </button>
                                          </Tooltip>
                                          <Tooltip title="Reject Booking">
                                            <button
                                              onClick={() => isRealTime && handleDelete(row.orderId, row.fullData)}
                                              className="p-1.5 rounded-full bg-danger-500 text-white hover:bg-danger-600 hover:scale-110 transition-all duration-200 shadow-sm disabled:opacity-50"
                                              disabled={!isRealTime}
                                            >
                                              <CloseRoundedIcon sx={{ fontSize: 18 }} />
                                            </button>
                                          </Tooltip>
                                        </>
                                      )}

                                      {/* Delete/Cancel for other statuses */}
                                      {(row.status === "Accepted" || row.status === "Confirmed" || row.status === "Done") && (
                                        <Tooltip title="Reject Booking">
                                          <IconButton
                                            onClick={() => isRealTime && handleDelete(row.orderId, row.fullData)}
                                            sx={{
                                              color: '#ef4444',
                                              '&:hover': { bgcolor: '#fef2f2' },
                                              transition: 'all 0.2s'
                                            }}
                                            disabled={!isRealTime}
                                          >
                                            <MdDelete size={20} />
                                          </IconButton>
                                        </Tooltip>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-neutral-700 font-medium">
                                      {value}
                                    </span>
                                  )}
                                </td>
                              );
                            })
                            }
                          </tr>
                        );
                      })
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
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
            </>
          )}
        </div>
      )}

      {/* View Booking details and confirm booking modal */}
      <Dialog
        open={openBookingDetailsModal}
        onClose={() => {
          setOpenBookingDetailsModal(false);
          setBookingDetails({
            Provider: { name: "", phone: "" },
            // Driver: { name: "", phone: "" },
            // vehicleDetails: { vehicle: "", vehicleNumber: "" },
          });
          setError({ for: "", text: "" });
        }}
        aria-labelledby="responsive-dialog-title"
        fullWidth
        maxWidth="md"
      >
        <Box>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            <div className="flex items-center gap-2">
              <span>{bookingDetails.title} Booking</span>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${bookingDetails?.status === "Accepted"
                  ? "bg-success-100 text-success-700"
                  : bookingDetails?.status === "Canceled" || bookingDetails?.status === "Rejected"
                    ? "bg-danger-100 text-danger-700"
                    : "bg-warning-100 text-warning-700"
                  }`}
              >
                {bookingDetails?.status === "Accepted" ? "Done" : (bookingDetails?.status === "Canceled" || bookingDetails?.status === "Rejected" ? "Rejected" : "Pending")}
              </span>
            </div>
          </DialogTitle>
          <IconButton
            aria-label="close"
            onClick={() => {
              setOpenBookingDetailsModal(false);
              setBookingDetails({
                Provider: { name: "", phone: "" },
                // Driver: { name: "", phone: "" },
                // vehicleDetails: { vehicle: "", vehicleNumber: "" },
                adminReview: "",
              });
              setError({ for: "", text: "" });
            }}
            sx={{
              position: "absolute",
              right: 0,
              top: 0,
              color: "gray",
            }}
          >
            <CloseIcon />
          </IconButton>

          {/* modal body */}
          <DialogContent dividers sx={{ p: { xs: 2, md: 2 } }}>
            {/* Status Stepper */}
            <Box sx={{ width: '100%', mb: 4, mt: 2 }}>
              <Stepper
                activeStep={
                  (bookingDetails?.status === 'Accepted' || bookingDetails?.status === 'Canceled' || bookingDetails?.status === 'Rejected') ? 1 : 0
                }
                alternativeLabel
              >
                {['Booking Received', 'Booking Confirmed'].map((label, index) => {
                  const isFailed = (bookingDetails?.status === 'Canceled' || bookingDetails?.status === 'Rejected') && index === 1;
                  const isCompleted = bookingDetails?.status === 'Accepted' && index === 1;

                  return (
                    <Step key={label}>
                      <StepLabel error={isFailed}>
                        {isFailed ? "Booking Rejected" : isCompleted ? "Booking Confirmed" : label}
                      </StepLabel>
                    </Step>
                  );
                })}
              </Stepper>
            </Box>

            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              {/* Container for Layout */}
              <Grid container spacing={4}>
                {/* Left Column: Customer & Trip Details */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 3, border: '1px solid', borderColor: 'grey.200', borderRadius: 4, height: '100%', bgcolor: '#f8fafc', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                    <Typography variant="h6" fontWeight={700} color="primary.main" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span className="text-2xl">👤</span> Customer & Trip Info
                    </Typography>
                    <Grid container spacing={3}>
                      {textField("Guest Name", (bookingDetails?.guestDetails?.name?.replace("not_present", "").trim()) || bookingDetails?.fullName, true)}
                      {textField("Guest Phone", bookingDetails?.guestDetails?.phoneNumber || bookingDetails?.phone, true)}
                      {textField("Email", bookingDetails?.guestDetails?.email || bookingDetails?.email, true)}
                      {textField("Price", bookingDetails?.price || bookingDetails?.totalAmount, true)}
                      {textField("Number of Guests", bookingDetails?.noOfPassengers || bookingDetails?.adults + (bookingDetails?.children || 0), true)}
                    </Grid>
                  </Box>
                </Grid>

                {/* Right Column: Schedule & Provider Details */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 3, border: '1px solid', borderColor: 'grey.200', borderRadius: 4, height: '100%', bgcolor: '#fdf4ff', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                    <Typography variant="h6" fontWeight={700} color="secondary.main" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span className="text-2xl">📅</span> Schedule & Provider
                    </Typography>
                    <Grid container spacing={3}>
                      {textField("Pick Up Date", (bookingDetails?.pickUpTime || bookingDetails?.arrivalDate) ? new Date(bookingDetails.pickUpTime ? bookingDetails.pickUpTime.seconds * 1000 : bookingDetails.arrivalDate).toLocaleDateString() : "No date", true)}
                      {textField("Pick Up Time", bookingDetails?.pickUpTime ? new Date(bookingDetails.pickUpTime.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "N/A", true)}

                      <Grid item xs={12}>
                        <Box sx={{ mt: 2, p: 2, bgcolor: 'white', borderRadius: 3, border: '1px dashed', borderColor: 'secondary.light' }}>
                          <Typography variant="subtitle2" color="secondary" fontWeight={600} gutterBottom sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.75rem' }}>
                            Assign Provider
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={12}>
                              <TextField
                                label="Provider Name"
                                size="medium"
                                placeholder="Enter provider name"
                                value={bookingDetails?.Provider?.name}
                                onChange={(e) => setBookingDetails(p => ({ ...p, Provider: { ...p.Provider, name: e.target.value } }))}
                                fullWidth
                                InputProps={{
                                  startAdornment: <span className="mr-2 text-gray-400">🚕</span>,
                                }}
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <TextField
                                label="Provider Phone"
                                size="medium"
                                placeholder="Enter provider phone"
                                value={bookingDetails?.Provider?.phone}
                                onChange={(e) => setBookingDetails(p => ({ ...p, Provider: { ...p.Provider, phone: formatPhoneNumber(e.target.value) } }))}
                                fullWidth
                                InputProps={{
                                  startAdornment: <span className="mr-2 text-gray-400">📞</span>,
                                }}
                              />
                            </Grid>
                          </Grid>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              </Grid>

              {/* Driver Details */}
              {/* {headingTextField("Driver Details")} */}

              {/* <Grid item xs={12} sm={6}>
                <TextField
                  label="Driver Name"
                  type="text"
                  placeholder=""
                  defaultValue={bookingDetails?.Driver?.name}
                  autoComplete="off"
                  autoCorrect="off"
                  helperText={
                    error?.for === "driverName" && (
                      <span className="text-red-500">{error.text}</span>
                    )
                  }
                  onChange={(e) =>
                    setBookingDetails((p) => ({
                      ...p,
                      Driver: { ...p.Driver, name: e.target.value },
                    }))
                  }
                  fullWidth
                />
              </Grid> */}

              {/* <Grid item xs={12} sm={6}>
                <TextField
                  label="Driver Phone"
                  type="text"
                  placeholder=""
                  defaultValue={bookingDetails?.Driver?.phone}
                  helperText={
                    error?.for === "driverPhone" && (
                      <span className="text-red-500">{error.text}</span>
                    )
                  }
                  onChange={(e) =>
                    setBookingDetails((p) => ({
                      ...p,
                      Driver: { ...p.Driver, phone: e.target.value },
                    }))
                  }
                  fullWidth
                />
              </Grid> */}

              {/* Vehicle Details */}
              {/* {headingTextField("Vehicle Details")} */}

              {/* <Grid item xs={12} sm={6}>
                <TextField
                  label="Vehicle Name"
                  type="text"
                  placeholder=""
                  defaultValue={bookingDetails?.vehicleDetails?.vehicle}
                  helperText={
                    error?.for === "vehicle" && (
                      <span className="text-red-500">{error.text}</span>
                    )
                  }
                  onChange={(e) =>
                    setBookingDetails((p) => ({
                      ...p,
                      vehicleDetails: {
                        ...p.vehicleDetails,
                        vehicle: e.target.value,
                      },
                    }))
                  }
                  fullWidth
                />
              </Grid> */}

              {/* <Grid item xs={12} sm={6}>
                <TextField
                  label="Vehicle Number"
                  type="text"
                  placeholder=""
                  defaultValue={bookingDetails?.vehicleDetails?.vehicleNumber}
                  helperText={
                    error?.for === "vehicleNumber" && (
                      <span className="text-red-500">{error.text}</span>
                    )
                  }
                  onChange={(e) =>
                    setBookingDetails((p) => ({
                      ...p,
                      vehicleDetails: {
                        ...p.vehicleDetails,
                        vehicleNumber: e.target.value,
                      },
                    }))
                  }
                  fullWidth
                />
              </Grid> */}

              {/* Progress Stepper used to indicate status workflow */}


              {/* Admin Review Section - Blue Themed */}
              <Grid item xs={12}>
                <Box sx={{
                  p: 3,
                  border: '1px solid',
                  borderColor: 'primary.main',
                  borderRadius: 2,
                  bgcolor: 'primary.50',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div className="absolute top-0 right-0 p-2 opacity-10">
                    <span className="text-6xl">📝</span>
                  </div>
                  <Typography variant="h6" color="primary.main" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>📝</span> Admin Review
                  </Typography>

                  {(bookingDetails?.status === "Accepted" || !isRealTime) ? (
                    <Typography variant="body1" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                      {bookingDetails?.adminReview ? `"${bookingDetails.adminReview}"` : "No review notes provided."}
                    </Typography>
                  ) : (
                    <TextField
                      label="Add Review Note"
                      multiline
                      rows={3}
                      value={bookingDetails?.adminReview || ""}
                      onChange={(e) => setBookingDetails(prev => ({ ...prev, adminReview: e.target.value }))}
                      fullWidth
                      placeholder="Enter your observations or required actions..."
                      variant="outlined"
                      sx={{ bgcolor: 'white' }}
                    />
                  )}
                </Box>
              </Grid>

              {/* Action Buttons */}
              <Grid item xs={12} sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {isRealTime && bookingDetails?.status !== "Accepted" && bookingDetails?.status !== "Canceled" && (
                  <>
                    <button
                      onClick={() => handleAccept(bookingDetails.id || bookingDetails.orderId)}
                      className="bg-success-500 hover:bg-success-600 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-md flex items-center gap-2"
                    >
                      <span>✅</span> Accept & Confirm
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to reject this booking?")) {
                          handleDelete(bookingDetails.id || bookingDetails.orderId);
                          setOpenBookingDetailsModal(false);
                        }
                      }}
                      className="bg-danger-500 hover:bg-danger-600 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-md flex items-center gap-2"
                    >
                      <span>❌</span> Reject
                    </button>
                  </>
                )}

                {isRealTime && bookingDetails?.status === "Accepted" && (
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to reject this confirmed booking?")) {
                        handleDelete(bookingDetails.id || bookingDetails.orderId);
                        setOpenBookingDetailsModal(false);
                      }
                    }}
                    className="bg-danger-500 hover:bg-danger-600 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-md flex items-center gap-2"
                  >
                    <span>❌</span> Reject
                  </button>
                )}
              </Grid>
            </Grid>
          </DialogContent>
        </Box>
      </Dialog>

      {/* view package details modal */}
      <Dialog
        open={openPackageDetailsModal}
        onClose={() => setOpenPackageDetailsModal(false)}
        aria-labelledby="responsive-dialog-title"
      >
        <Box sx={{ lg: { width: "800" } }}>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            Package : {packageDetails?.title}
          </DialogTitle>
          <IconButton
            aria-label="close"
            onClick={() => setOpenPackageDetailsModal(false)}
            sx={{
              position: "absolute",
              right: 0,
              top: 0,
              color: "gray",
            }}
          >
            <CloseIcon />
          </IconButton>

          {/* modal body */}
          <DialogContent dividers sx={{ p: { xs: 2, md: 2 } }}>
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              {/* Cover Photo */}
              <Grid item xs={12} sm={6}>
                {packageDetails && (
                  <img
                    src={packageDetails?.coverPhoto}
                    alt=""
                    className="h-44 w-full mx-auto rounded "
                  />
                )}
              </Grid>
              <Grid item xs={12} sm={6}>
                {textField("Package Name", packageDetails?.title, true)}

                {textField("Location", packageDetails?.location, true)}

                {/* Price */}
                {textField("Price", packageDetails?.price, true)}

                {/* Discount */}
                {textField("Discount", packageDetails?.discount, true)}

                {/* Discount Price*/}
                {textField(
                  "Discount Price",
                  calculateDiscountPrice(
                    packageDetails?.price,
                    packageDetails?.discount
                  ),
                  true
                )}
                {/* Number Of Guests */}
                {/* {textField(
                  "Number Of Guests",
                  // packageDetails?.numberOfGuests,
                  packageDetails?.NumberOfPassengers,
                  true
                )} */}

                {/* Period */}
                {textField("Period", packageDetails?.period, true)}
              </Grid>
            </Grid>
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              {/* Description */}
              {textField("Description", packageDetails?.description)}

              {/* Add Amenities */}
              {packageDetails?.amenities?.length > 0 && (
                <Grid item xs={12}>
                  <Box sx={{ mt: 2, mb: 1, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle1" color="primary" fontWeight="bold">Amenities</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, my: 1 }}>
                    {packageDetails?.amenities?.map((amenity, i) => (
                      <Chip key={i} label={amenity} size="small" />
                    ))}
                  </Box>
                </Grid>
              )}

              {packageDetails?.hotels?.length > 0 && (
                <Grid item xs={12}>
                  <Box sx={{ mt: 2, mb: 1, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle1" color="primary" fontWeight="bold">Hotels</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, my: 1 }}>
                    {packageDetails?.hotels?.map((hotel, i) => (
                      <Chip
                        key={i}
                        label={typeof hotel === "object" ? hotel.hotelName : hotel}
                        size="small"
                        color="secondary"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Grid>
              )}

              {packageDetails?.places?.length > 0 && (
                <Grid item xs={12}>
                  <Box sx={{ mt: 2, mb: 1, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle1" color="primary" fontWeight="bold">Places</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, my: 1 }}>
                    {packageDetails?.places?.map((place, i) => (
                      <Chip key={i} label={place} size="small" />
                    ))}
                  </Box>
                </Grid>
              )}

              {packageDetails?.included?.length > 0 && (
                <Grid item xs={12}>
                  <Box sx={{ mt: 2, mb: 1, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle1" color="primary" fontWeight="bold">Includes</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, my: 1 }}>
                    {packageDetails?.included?.map((include, i) => (
                      <Chip key={i} label={include} size="small" color="success" variant="outlined" />
                    ))}
                  </Box>
                </Grid>
              )}

              {/* Pictures */}
              <Grid item xs={12}>
                <Box sx={{ mt: 2, mb: 1, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle1" color="primary" fontWeight="bold">Room Pictures</Typography>
                </Box>
                <div className="flex items-center justify-center">
                  <div className="grid sm:grid-cols-3 grid-cols-1 items-center justify-center gap-2 my-2">
                    {packageDetails?.pictures?.map((picture, i) => (
                      <div key={i}>
                        <img
                          src={picture}
                          alt=""
                          className="h-36 sm:w-44 w-full rounded"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              type="submit"
              autoFocus
              sx={{
                bgcolor: "var(--button-bg-color)",
                color: "white",
                hover: "none",
              }}
              className="add-new-btn"
              onClick={() => setOpenPackageDetailsModal(false)}
            >
              Close
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </div >
  );
};

export default TravelBookings;
