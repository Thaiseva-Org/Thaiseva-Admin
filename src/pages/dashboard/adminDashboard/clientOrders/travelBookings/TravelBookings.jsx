import CloseIcon from "@mui/icons-material/Close";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DoneRoundedIcon from "@mui/icons-material/DoneRounded";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FilterListIcon from "@mui/icons-material/FilterList";
import RefreshIcon from "@mui/icons-material/Refresh";
import PersonIcon from "@mui/icons-material/Person";
import PaymentsIcon from "@mui/icons-material/Payments";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import LuggageIcon from "@mui/icons-material/Luggage";
import TourIcon from "@mui/icons-material/Tour";
import DirectionsBusIcon from "@mui/icons-material/DirectionsBus";
import LocationOnIcon from "@mui/icons-material/LocationOn";
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
  Chip,
  Tabs,
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import { MdDelete, MdVisibility, MdInfo } from "react-icons/md";
import {
  ViewList,
  CalendarMonth,
  Search,
  Circle,
  CheckCircle,
  VerifiedUser as VerifiedUserIcon,
} from "@mui/icons-material";
import PaymentStatusBadge from "../../../../../components/bookings/PaymentStatusBadge";
import {
  VerifyPaymentIconButton,
  VerifyPaymentModalButton,
} from "../../../../../components/bookings/VerifyPaymentButton";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useContext, useEffect, useMemo, useState } from "react";
import LoadingContent from "../../../../../components/LoadingContent";
import PageHeading from "../../../../../components/PageHeading";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import { useNotifications } from "../../../../../contextAPIs/NotificationsProvider";
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";
import {
  db,
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
  deleteNotification,
  formatPhoneNumber,
  getDate,
  getDateAndTime,
  successNotification,
} from "../../../../../utils/utils";
import {
  getBookingPickupRequest,
  getBookingSpecialNotes,
} from "../../../../../utils/bookingNotes";
import {
  canConfirmSightseeing,
  getSightseeingPaymentMethod,
  getSightseeingPaymentStatusInfo,
  getSightseeingStatusLabel,
  isOnsiteSightseeingPayment,
  isPaymentVerified,
  isSightseeingAccepted,
  isSightseeingCanceled,
  isSightseeingOnsiteQueue,
  isSightseeingPending,
  isSightseeingPendingReview,
  isSightseeingRevenueEligible,
  isThaiQrSightseeingPayment,
  needsSightseeingPaymentVerification,
  requiresDeferredSightseeingPaymentVerification,
} from "../../../../../utils/bookingStatus";
import { backfillCreatedAt, toDate } from "../../../../../utils/bookingTimestamps";

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
  const [viewMode, setViewMode] = useState("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBookings, setSelectedBookings] = useState([]);
  const [verifyingPaymentId, setVerifyingPaymentId] = useState(null);
  const [openCapacityModal, setOpenCapacityModal] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(20);
  const [savingDailyLimit, setSavingDailyLimit] = useState(false);
  const [calendarPackage, setCalendarPackage] = useState("All");
  const [calendarDate, setCalendarDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const sourceBookings = isRealTime ? travelBookings : matchedBookings;

  const fetchDailyLimit = async () => {
    try {
      const settingsSnap = await getDoc(doc(db, "settings", "sightseeingConfig"));
      if (settingsSnap.exists()) {
        setDailyLimit(settingsSnap.data().globalDailyLimit || 20);
      }
    } catch (error) {
      console.error("Error loading daily sightseeing limit:", error);
    }
  };

  useEffect(() => {
    fetchDailyLimit();
  }, []);

  useEffect(() => {
    if (openCapacityModal) {
      fetchDailyLimit();
    }
  }, [openCapacityModal]);

  const handleSaveDailyLimit = async (nextLimit) => {
    const parsedLimit = Number(nextLimit);
    if (!parsedLimit || parsedLimit < 1) return;

    setSavingDailyLimit(true);
    try {
      await setDoc(
        doc(db, "settings", "sightseeingConfig"),
        {
          globalDailyLimit: parsedLimit,
          updatedAt: new Date(),
        },
        { merge: true }
      );
      setDailyLimit(parsedLimit);
    } catch (error) {
      console.error("Error saving daily limit:", error);
      alert("Failed to save daily limit.");
    } finally {
      setSavingDailyLimit(false);
    }
  };

  const isNext7DaysBooking = (booking) => {
    if (isSightseeingCanceled(booking)) return false;

    const serviceDate = toDate(booking.pickUpTime || booking.arrivalDate);
    if (!serviceDate) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next7 = new Date(today);
    next7.setDate(today.getDate() + 7);
    next7.setHours(23, 59, 59, 999);

    return serviceDate >= today && serviceDate <= next7;
  };

  const filterByTab = (row, tab) => {
    const booking = row.rawData || row;
    if (tab === 0) return isSightseeingPendingReview(booking);
    if (tab === 1) return isSightseeingOnsiteQueue(booking);
    if (tab === 2) return isSightseeingRevenueEligible(booking);
    if (tab === 3) return isSightseeingCanceled(booking);
    if (tab === 4) return isNext7DaysBooking(booking);
    return true;
  };

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
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const columns = [
    { property: "packageTitle", label: "Package", width: "16%" },
    { property: "guestName", label: "Guest", width: "14%" },
    { property: "phone", label: "Phone", width: "11%" },
    { property: "tourDate", label: "Tour Date", width: "12%" },
    { property: "orderedAt", label: "Booked On", width: "14%" },
    { property: "amount", label: "Amount", width: "10%" },
    { property: "paymentStatus", label: "Payment", width: "11%" },
    { property: "action", label: "Action", width: "12%" },
  ];

  function createData(booking) {
    const guestName =
      booking?.fullName ||
      booking?.guestDetails?.name?.replace("not_present", "").trim() ||
      booking?.name ||
      "N/A";
    const serviceDate = toDate(booking.pickUpTime || booking.arrivalDate);

    return {
      ...booking,
      guestName,
      name: guestName,
      phone:
        booking?.guestPhone ||
        booking?.guestDetails?.phoneNumber ||
        booking?.phone ||
        "N/A",
      email:
        booking?.guestEmail ||
        booking?.email ||
        booking?.guestDetails?.email ||
        "N/A",
      packageTitle: booking?.title || booking?.packageName || "Unknown Package",
      tourDate: serviceDate ? getDate(serviceDate) : "N/A",
      amount: booking?.price || booking?.totalAmount || 0,
      orderedAt: backfillCreatedAt(booking),
      statusLabel: getSightseeingStatusLabel(booking),
      bookingId: booking.id || booking.orderId,
      packageId: booking.dataid || booking.packageId,
      paymentMethod: getSightseeingPaymentMethod(booking) || "ONSITE",
      passengers:
        booking?.noOfPassengers ||
        (booking?.adults || 0) + (booking?.children || 0) ||
        "N/A",
      specialNotes: getBookingSpecialNotes(booking),
      pickupRequest: getBookingPickupRequest(booking),
      rawData: booking,
    };
  }

  const rows = (bookings) => {
    const search = searchQuery.toLowerCase();
    return bookings
      ?.filter((booking) => {
        if (!search) return true;
        const guestName = (
          booking?.fullName ||
          booking?.guestDetails?.name ||
          ""
        )
          .replace("not_present", "")
          .trim()
          .toLowerCase();
        const packageTitle = (
          booking?.title ||
          booking?.packageName ||
          ""
        ).toLowerCase();
        const phone = String(
          booking?.guestPhone ||
            booking?.guestDetails?.phoneNumber ||
            booking?.phone ||
            ""
        ).toLowerCase();
        const bookingId = String(booking?.id || booking?.orderId || "").toLowerCase();

        return (
          guestName.includes(search) ||
          packageTitle.includes(search) ||
          phone.includes(search) ||
          bookingId.includes(search)
        );
      })
      ?.map((booking) => createData(booking));
  };

  const bookingStats = useMemo(() => {
    const visibleBookings = rows(sourceBookings) || [];
    return {
      total: visibleBookings.length,
      pending: visibleBookings.filter((row) =>
        isSightseeingPendingReview(row.rawData)
      ).length,
      onsite: visibleBookings.filter((row) =>
        isSightseeingOnsiteQueue(row.rawData)
      ).length,
      paidAccepted: visibleBookings.filter((row) =>
        isSightseeingRevenueEligible(row.rawData)
      ).length,
    };
  }, [sourceBookings, searchQuery]);

  const handleSelectAll = (event, currentRows) => {
    if (event.target.checked) {
      setSelectedBookings(currentRows.map((row) => row.bookingId));
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
        selectedBookings.slice(selectedIndex + 1)
      );
    }
    setSelectedBookings(newSelected);
  };

  const buildSightseeingAcceptUpdate = (bookingData, extra = {}) => {
    const payload = {
      status: "Accepted",
      isBookingConfirmed: true,
      ...extra,
    };

    const isThaiQr = isThaiQrSightseeingPayment(bookingData);
    if (requiresDeferredSightseeingPaymentVerification(bookingData)) {
      payload.paymentVerificationStatus =
        bookingData.paymentVerificationStatus || "UNVERIFIED";
      payload.paymentVerificationNote =
        bookingData.paymentVerificationNote ||
        (isThaiQr
          ? "Accepted for Thai QR payment. Awaiting admin verification."
          : "Accepted for onsite payment. Awaiting admin verification.");
      payload.paymentMethod =
        getSightseeingPaymentMethod(bookingData) ||
        (isThaiQr ? "THAI_QR" : "ONSITE");
    } else if (isPaymentVerified(bookingData)) {
      payload.paymentVerificationStatus = "VERIFIED";
      payload.isPaymentDone = true;
    }

    return payload;
  };

  const handleBulkApprove = async () => {
    if (!confirm(`Approve ${selectedBookings.length} selected bookings?`)) return;

    const targets = rows(sourceBookings).filter(
      (row) =>
        selectedBookings.includes(row.bookingId) &&
        (isSightseeingPendingReview(row.rawData) ||
          (isSightseeingPending(row.rawData) &&
            (isOnsiteSightseeingPayment(row.rawData) ||
              isThaiQrSightseeingPayment(row.rawData))))
    );

    setLoading(true);
    let count = 0;
    for (const row of targets) {
      if (canConfirmSightseeing(row.rawData)) {
        await updateDoc(
          doc(travelBookingCollection, row.bookingId),
          buildSightseeingAcceptUpdate(row.rawData)
        );
        if (isPaymentVerified(row.rawData)) {
          await recordSightseeingEarnings(row.bookingId, row.rawData);
        }
        count++;
      }
    }
    setLoading(false);
    setSelectedBookings([]);
    successNotification(`Successfully approved ${count} bookings.`);
  };

  const handleBulkDecline = async () => {
    if (!confirm(`Decline ${selectedBookings.length} selected bookings?`)) return;

    const targets = rows(sourceBookings).filter((row) =>
      selectedBookings.includes(row.bookingId)
    );

    setLoading(true);
    for (const row of targets) {
      await updateDoc(doc(travelBookingCollection, row.bookingId), {
        status: "Canceled",
      });
    }
    setLoading(false);
    setSelectedBookings([]);
    deleteNotification(`Declined ${targets.length} bookings.`);
  };

  const handleViewBookingDetails = (id) => {
    const booking = rows(sourceBookings).find((item) => item.bookingId === id);
    if (booking) {
      setBookingDetails({
        ...booking,
        Provider: booking.Provider || { name: "", phone: "" },
      });
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

  const recordSightseeingEarnings = async (id, bookingData) => {
    if (bookingData?.earningsRecorded) return;

    const priceVal = bookingData?.price || bookingData?.totalAmount;
    if (!priceVal) return;

    await updateHourlyEarnings(priceVal, "Sightseeing");
    const providerPhone = bookingData?.Provider?.phone;
    if (providerPhone) {
      await updateHourlyEarnings(priceVal, "Sightseeing", providerPhone);
    }
    await updateMonthlyEarnings(priceVal, "Sightseeing");
    if (providerPhone) {
      await updateMonthlyEarnings(priceVal, "Sightseeing", providerPhone);
    }

    await updateDoc(doc(travelBookingCollection, id), {
      earningsRecorded: true,
    });
  };

  const handleConfirmBooking = async (id, bookingData) => {
    if (!canConfirmSightseeing(bookingData)) {
      alert("Only pending bookings can be confirmed.");
      return;
    }

    if (confirm("Do you want to confirm this booking immediately?")) {
      await updateDoc(
        doc(travelBookingCollection, id),
        buildSightseeingAcceptUpdate(bookingData)
      ).then(async () => {
        alert("Booking confirmed successfully!");

        if (isPaymentVerified(bookingData)) {
          await recordSightseeingEarnings(id, bookingData);
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

  const handleUpdateProvider = async (id) => {
    if (confirm("Do you want to update provider details?")) {
      await updateDoc(doc(travelBookingCollection, id), {
        Provider: bookingDetails.Provider
      }).then(() => {
        alert("Provider details updated successfully!");
        setOpenBookingDetailsModal(false);
      });
    }
  };

  const handleAccept = async (id) => {
    setError({ for: "", text: "" });

    if (!canConfirmSightseeing(bookingDetails)) {
      alert("Only pending bookings can be confirmed.");
      return;
    }

    if (confirm("Do you want to proceed with confirming this booking?")) {
      await updateDoc(
        doc(travelBookingCollection, id),
        buildSightseeingAcceptUpdate(bookingDetails, {
          Provider: bookingDetails.Provider,
          adminReview: bookingDetails.adminReview || "",
        })
      ).then(async () => {
        alert("Booking confirmed successfully!.");
        setOpenBookingDetailsModal(false);
        setBookingDetails({
          Provider: { name: "", phone: "" },
          adminReview: "",
        });
        if (isPaymentVerified(bookingDetails)) {
          await recordSightseeingEarnings(id, bookingDetails);
        }
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

  const handleVerifyPayment = async (id, bookingData) => {
    if (!confirm("Mark this sightseeing payment as verified?")) return;

    setVerifyingPaymentId(id);

    try {
      const existingConfirmation = bookingData.paymentConfirmation;
      const updateData = {
        paymentVerificationStatus: "VERIFIED",
        paymentVerificationNote: "Verified by admin",
        isPaymentDone: true,
        paymentVerifiedAt: new Date(),
      };

      if (existingConfirmation && typeof existingConfirmation === "object") {
        updateData.paymentConfirmation = {
          ...existingConfirmation,
          status: "paid",
        };
      }

      await updateDoc(doc(travelBookingCollection, id), updateData);
      await recordSightseeingEarnings(id, bookingData);

      setBookingDetails((prev) => ({
        ...prev,
        paymentVerificationStatus: "VERIFIED",
        isPaymentDone: true,
        earningsRecorded: true,
      }));

      successNotification("Payment verified successfully!");

      const gName = bookingData?.guestDetails?.name || bookingData?.fullName;
      const bTitle = bookingData?.title || bookingData?.packageName;
      const uId = bookingData?.userId || bookingData?.uId;

      if (uId) {
        await CreateNewNotificationToUser(
          "Sightseeing payment verified!",
          `Hey ${gName}! your payment for ${bTitle} has been verified.`,
          uId
        );
      }
    } catch (error) {
      console.error("Error verifying sightseeing payment:", error);
      alert("Failed to verify payment.");
    } finally {
      setVerifyingPaymentId(null);
    }
  };

  const renderDetailItem = (
    label,
    value,
    icon,
    isFullWidth = false,
    colorClass = "text-primary-600 bg-primary-50"
  ) => (
    <Grid item xs={12} sm={isFullWidth ? 12 : 6}>
      <div className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-neutral-50 transition-all duration-200 border border-transparent hover:border-neutral-200 group">
        <div
          className={`mt-0.5 p-2 rounded-lg ${colorClass} group-hover:scale-110 transition-transform duration-200 shadow-sm`}
        >
          {icon}
        </div>
        <div>
          <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-0.5">
            {label}
          </p>
          <p className="text-neutral-900 font-medium text-[15px] leading-snug">
            {value}
          </p>
        </div>
      </div>
    </Grid>
  );

  const BookingTimeline = ({ booking }) => {
    const getTimelineDate = (value) => {
      const date = toDate(value);
      return date ? date.toLocaleDateString() : "";
    };

    const confirmed =
      isSightseeingAccepted(booking.rawData || booking) ||
      booking.isBookingConfirmed;
    const paid = isSightseeingRevenueEligible(booking.rawData || booking);
    const serviceDate = toDate(
      booking.pickUpTime || booking.arrivalDate || booking.tourDate
    );

    const steps = [
      {
        label: "Booked",
        date: getTimelineDate(booking.orderedAt),
        completed: true,
      },
      {
        label: "Confirmed",
        date: "",
        completed: confirmed,
      },
      {
        label: "Payment",
        date: "",
        completed: paid,
      },
      {
        label: "Tour Day",
        date: serviceDate ? getDate(serviceDate) : "",
        completed:
          serviceDate &&
          new Date() >= serviceDate &&
          confirmed,
      },
    ];

    return (
      <div className="w-full py-6">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-neutral-200 -z-0" />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-success-500 -z-0 transition-all duration-500"
            style={{
              width: `${
                ((steps.filter((s) => s.completed).length - 1) /
                  (steps.length - 1)) *
                100
              }%`,
            }}
          />
          {steps.map((step, index) => (
            <div
              key={index}
              className="flex flex-col items-center relative z-10 bg-white px-2"
            >
              {step.completed ? (
                <CheckCircle className="text-success-500 text-3xl bg-white rounded-full" />
              ) : (
                <Circle className="text-neutral-300 text-3xl bg-white rounded-full" />
              )}
              <span
                className={`text-xs font-bold mt-2 ${
                  step.completed ? "text-neutral-800" : "text-neutral-400"
                }`}
              >
                {step.label}
              </span>
              {step.date && (
                <span className="text-[10px] text-neutral-500 font-medium">
                  {step.date}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const CalendarView = ({ bookings }) => {
    const uniquePackages = [
      ...new Set(bookings.map((b) => b.packageTitle)),
    ].sort();
    const calendarBookings =
      calendarPackage === "All"
        ? bookings
        : bookings.filter((b) => b.packageTitle === calendarPackage);

    const baseDate = new Date(calendarDate);
    const daysToShow = 14;
    const dates = Array.from({ length: daysToShow }, (_, i) => {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      return d;
    });

    return (
      <div className="bg-white rounded-xl shadow-lg border border-neutral-200 p-4">
        <div className="flex gap-4 mb-6 items-center flex-wrap">
          <FormControl size="small" className="min-w-[220px]">
            <InputLabel>Filter Package</InputLabel>
            <Select
              value={calendarPackage}
              label="Filter Package"
              onChange={(e) => setCalendarPackage(e.target.value)}
            >
              <MenuItem value="All">All Packages</MenuItem>
              {uniquePackages.map((pkg) => (
                <MenuItem key={pkg} value={pkg}>
                  {pkg}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <input
            type="date"
            value={calendarDate}
            onChange={(e) => setCalendarDate(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse">
            <thead>
              <tr>
                <th className="p-3 text-left text-xs font-bold text-neutral-500 uppercase border-b">
                  Package
                </th>
                {dates.map((date) => (
                  <th
                    key={date.toISOString()}
                    className="p-2 text-center text-[10px] font-bold text-neutral-500 border-b min-w-[72px]"
                  >
                    {date.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {uniquePackages
                .filter(
                  (pkg) => calendarPackage === "All" || pkg === calendarPackage
                )
                .map((pkg) => (
                  <tr key={pkg} className="border-b border-neutral-100">
                    <td className="p-3 text-sm font-semibold text-neutral-800 sticky left-0 bg-white">
                      {pkg}
                    </td>
                    {dates.map((date) => {
                      const dateKey = date.toISOString().split("T")[0];
                      const dayBookings = calendarBookings.filter((b) => {
                        const tourDate = toDate(
                          b.rawData?.pickUpTime || b.rawData?.arrivalDate
                        );
                        if (!tourDate) return false;
                        return (
                          tourDate.toISOString().split("T")[0] === dateKey &&
                          b.packageTitle === pkg &&
                          !isSightseeingCanceled(b.rawData)
                        );
                      });

                      return (
                        <td key={dateKey} className="p-1 text-center align-top">
                          {dayBookings.map((b) => (
                            <div
                              key={b.bookingId}
                              onClick={() => handleViewBookingDetails(b.bookingId)}
                              className={`text-[10px] px-1.5 py-1 mb-1 rounded cursor-pointer font-medium ${
                                isSightseeingRevenueEligible(b.rawData)
                                  ? "bg-emerald-100 text-emerald-800"
                                  : isSightseeingOnsiteQueue(b.rawData)
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {b.guestName?.split(" ")[0] || "Guest"}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const packageTextField = (label, value, is12) => (
    <Grid item xs={12} sm={label === "Description" || is12 ? 12 : 6}>
      <div className="flex gap-2">
        <p>
          <span className="font-bold">{label}: </span>
          {label.includes("Price") && "฿"}
          {value}
          {label.includes("Period") && " days"}
          {label === "Discount" && "%"}
        </p>
      </div>
    </Grid>
  );

  return (
    <div className="animate-fade-in">
      <PageHeading
        text="Sightseeing Bookings"
        subtitle="Manage tour bookings and reservations"
        icon="🎫"
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium mb-1">
                Total Bookings
              </p>
              <p className="text-3xl font-bold">{bookingStats.total}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">🎫</span>
            </div>
          </div>
        </div>

        <div
          onClick={() => setTabValue(0)}
          className="bg-gradient-to-br from-warning-500 to-warning-600 rounded-xl p-6 text-white shadow-lg cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl active:scale-95"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-warning-100 text-sm font-medium mb-1">Pending</p>
              <p className="text-3xl font-bold">{bookingStats.pending}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">⏳</span>
            </div>
          </div>
        </div>

        <div
          onClick={() => setTabValue(1)}
          className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl active:scale-95"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium mb-1">Onsite</p>
              <p className="text-3xl font-bold">{bookingStats.onsite}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">💳</span>
            </div>
          </div>
        </div>

        <div
          onClick={() => setTabValue(2)}
          className="bg-gradient-to-br from-success-500 to-success-600 rounded-xl p-6 text-white shadow-lg cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl active:scale-95"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-success-100 text-sm font-medium mb-1">
                Paid & Accepted
              </p>
              <p className="text-3xl font-bold">{bookingStats.paidAccepted}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">✅</span>
            </div>
          </div>
        </div>
      </div>

      {/* View Toggle & Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-neutral-200 shadow-sm">
          <button
            onClick={() => setViewMode("list")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center ${
              viewMode === "list"
                ? "bg-primary-50 text-primary-700 shadow-sm"
                : "text-neutral-500 hover:bg-neutral-50"
            }`}
          >
            <ViewList className="mr-2 !text-lg" /> List View
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center ${
              viewMode === "calendar"
                ? "bg-primary-50 text-primary-700 shadow-sm"
                : "text-neutral-500 hover:bg-neutral-50"
            }`}
          >
            <CalendarMonth className="mr-2 !text-lg" /> Calendar View
          </button>
        </div>

        <div className="relative w-full md:w-auto md:min-w-[300px]">
          <input
            type="text"
            placeholder="Search guest, package, phone, ID..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 !text-xl" />
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

            <button
              type="button"
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 active:scale-95"
              onClick={() => setOpenCapacityModal(true)}
            >
              📊 Daily Capacity
            </button>
          </form>
        </div>
      </div>

      <Dialog
        open={openCapacityModal}
        onClose={() => setOpenCapacityModal(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            backgroundImage: 'none',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }
        }}
      >
        <DialogTitle sx={{
          borderBottom: '1px solid #e5e7eb',
          pb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: '#f9fafb'
        }}>
          <span className="font-bold text-xl text-gray-800 flex items-center gap-2">
            📊 Daily Booking Capacity
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
              <span className="text-sm font-medium text-gray-600">Daily Limit:</span>
              <input
                type="number"
                min="1"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                onBlur={(e) => handleSaveDailyLimit(e.target.value)}
                disabled={savingDailyLimit}
                className="w-16 text-center text-sm font-bold border-b-2 border-primary-500 focus:outline-none disabled:opacity-60"
              />
              {savingDailyLimit && (
                <span className="text-xs text-gray-500">Saving...</span>
              )}
            </div>
            <IconButton onClick={() => setOpenCapacityModal(false)} size="small" className="hover:bg-gray-200 transition-colors">
              <CloseRoundedIcon />
            </IconButton>
          </div>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-4 font-semibold text-gray-600 border-b">Date</th>
                  <th className="p-4 font-semibold text-gray-600 border-b text-center">Total Bookings</th>
                  <th className="p-4 font-semibold text-gray-600 border-b text-center">Confirmed</th>
                  <th className="p-4 font-semibold text-gray-600 border-b text-center">Pending</th>
                  <th className="p-4 font-semibold text-gray-600 border-b text-center">Load</th>
                  <th className="p-4 font-semibold text-gray-600 border-b text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(() => {
                  // aggregation logic
                  const dailyCounts = {};

                  (rows(sourceBookings) || []).forEach((b) => {
                    const dateObj = toDate(
                      b.rawData?.pickUpTime ||
                        b.rawData?.arrivalDate ||
                        b.pickUpTime ||
                        b.arrivalDate ||
                        backfillCreatedAt(b.rawData || b)
                    );
                    if (!dateObj) return;

                    const dateKey = dateObj.toISOString().split("T")[0];

                    if (!dailyCounts[dateKey]) {
                      dailyCounts[dateKey] = { total: 0, confirmed: 0, pending: 0 };
                    }

                    if (isSightseeingCanceled(b.rawData)) return;

                    dailyCounts[dateKey].total++;

                    if (
                      isSightseeingRevenueEligible(b.rawData) ||
                      isSightseeingOnsiteQueue(b.rawData)
                    ) {
                      dailyCounts[dateKey].confirmed++;
                    } else {
                      dailyCounts[dateKey].pending++;
                    }
                  });

                  // Convert to array and sort
                  const sortedDays = Object.keys(dailyCounts).sort().map(date => {
                    const today = new Date().toISOString().split('T')[0];
                    if (date < today) return null; // Optional: Hide past days
                    return { date, ...dailyCounts[date] };
                  }).filter(Boolean);

                  if (sortedDays.length === 0) {
                    return (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-400">
                          No upcoming bookings found.
                        </td>
                      </tr>
                    );
                  }

                  return sortedDays.map((day, idx) => {
                    const limit = dailyLimit;
                    const usagePercent = (day.total / limit) * 100;

                    let statusColor = "bg-green-100 text-green-700 border-green-200";
                    let statusText = "Open";

                    if (day.total >= limit) {
                      statusColor = "bg-red-100 text-red-700 border-red-200";
                      statusText = "Auto-Stop";
                    } else if (day.total >= limit * 0.8) {
                      statusColor = "bg-orange-100 text-orange-800 border-orange-200";
                      statusText = "Busy";
                    }

                    return (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-medium text-gray-800">
                          {new Date(day.date).toDateString()}
                        </td>
                        <td className="p-4 text-center font-bold text-gray-700">{day.total}</td>
                        <td className="p-4 text-center text-green-600 bg-green-50/50">{day.confirmed}</td>
                        <td className="p-4 text-center text-orange-600 bg-orange-50/50">{day.pending}</td>
                        <td className="p-4 text-center">
                          <div className="w-24 h-2 bg-gray-200 rounded-full mx-auto overflow-hidden">
                            <div
                              className={`h-full rounded-full ${day.total >= limit ? 'bg-red-500' : usagePercent > 70 ? 'bg-orange-400' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(usagePercent, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500 font-medium">{Math.min(Math.round(usagePercent), 100)}%</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColor}`}>
                            {statusText}
                          </span>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #e5e7eb', p: 2, bgcolor: '#f9fafb' }}>
          <Button onClick={() => setOpenCapacityModal(false)} variant="contained" sx={{ textTransform: 'none', borderRadius: '8px' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="booking status tabs">
          <Tab label="Pending" />
          <Tab label="Onsite" />
          <Tab label="Paid & Accepted" />
          <Tab label="Declined" />
          <Tab label="Next 7 Days" />
        </Tabs>
      </Box>

      {viewMode === "calendar" ? (
        <CalendarView bookings={rows(sourceBookings) || []} />
      ) : (
        <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden relative">
          {selectedBookings.length > 0 && (
            <div className="absolute top-0 left-0 w-full bg-primary-50 p-2 z-20 flex items-center justify-between border-b border-primary-100 animate-fade-in">
              <div className="flex items-center gap-4 pl-4">
                <span className="font-bold text-primary-800">
                  {selectedBookings.length} Selected
                </span>
              </div>
              <div className="flex gap-2 pr-4">
                {(tabValue === 0 || tabValue === 1) && (
                  <button
                    onClick={handleBulkApprove}
                    className="bg-success-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-success-700 transition-colors shadow-sm"
                  >
                    Approve Selected
                  </button>
                )}
                {(tabValue === 0 || tabValue === 1 || tabValue === 2) && (
                  <button
                    onClick={handleBulkDecline}
                    className="bg-danger-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-danger-700 transition-colors shadow-sm"
                  >
                    {tabValue === 0 ? "Decline Selected" : "Cancel Selected"}
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
                      {tabValue !== 3 && (
                        <input
                          type="checkbox"
                          className="rounded border-white/30 text-primary-600 focus:ring-white/50 w-4 h-4 cursor-pointer"
                          onChange={(e) => {
                            const currentRows = (rows(sourceBookings) || []).filter(
                              (row) => filterByTab(row, tabValue)
                            );
                            handleSelectAll(e, currentRows);
                          }}
                          checked={
                            selectedBookings.length > 0 &&
                            selectedBookings.length ===
                              (rows(sourceBookings) || []).filter((row) =>
                                filterByTab(row, tabValue)
                              ).length
                          }
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
                  {(rows(sourceBookings) || [])
                    .filter((row) => filterByTab(row, tabValue))
                    .slice(
                      page * rowsPerPage,
                      page * rowsPerPage + parseInt(rowsPerPage, 10)
                    )
                    .map((row, i) => {
                      const isSelected =
                        selectedBookings.indexOf(row.bookingId) !== -1;

                      return (
                        <tr
                          key={i}
                          className={`hover:bg-primary-50 transition-colors duration-200 ${
                            isSelected ? "bg-primary-50" : ""
                          }`}
                        >
                          <td className="px-4 py-4 text-center">
                            {tabValue !== 3 && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(event) =>
                                  handleSelectOne(event, row.bookingId)
                                }
                                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer"
                              />
                            )}
                          </td>
                          {columns.map((column) => {
                            const value = row[column.property];
                            let dateDisplay = "N/A";
                            if (column.property === "orderedAt" && row.orderedAt) {
                              const orderedAt = row.orderedAt;
                              const dateObj = orderedAt?.seconds
                                ? new Date(
                                    orderedAt.seconds * 1000 +
                                      (orderedAt.nanoseconds || 0) / 1000000
                                  )
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
                                ) : column.property === "paymentStatus" ? (
                                  <PaymentStatusBadge
                                    statusInfo={getSightseeingPaymentStatusInfo(
                                      row.rawData
                                    )}
                                  />
                                ) : column.property === "action" ? (
                                  <div className="flex gap-2 justify-center items-center">
                                    <button
                                      onClick={() =>
                                        handleViewBookingDetails(row.bookingId)
                                      }
                                      className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                                      title="View Booking Details"
                                    >
                                      <MdVisibility size={20} />
                                    </button>

                                    {row.packageId && (
                                      <button
                                        onClick={() =>
                                          handleViewPackageDetails(row.packageId)
                                        }
                                        className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors"
                                        title="View Package Details"
                                      >
                                        <MdInfo size={20} />
                                      </button>
                                    )}

                                    {(isSightseeingPendingReview(row.rawData) ||
                                      (isSightseeingPending(row.rawData) &&
                                        (isOnsiteSightseeingPayment(
                                          row.rawData
                                        ) ||
                                          isThaiQrSightseeingPayment(
                                            row.rawData
                                          )))) && (
                                      <>
                                        <button
                                          onClick={() =>
                                            handleConfirmBooking(
                                              row.bookingId,
                                              row.rawData
                                            )
                                          }
                                          className="p-2 rounded-full bg-success-500 text-white hover:bg-success-600 hover:scale-110 transition-all duration-200"
                                          title={
                                            isThaiQrSightseeingPayment(row.rawData)
                                              ? "Accept Thai QR Booking"
                                              : isOnsiteSightseeingPayment(row.rawData)
                                                ? "Accept Onsite Booking"
                                                : "Approve Request"
                                          }
                                        >
                                          <DoneRoundedIcon className="scale-90" />
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleDelete(
                                              row.bookingId,
                                              row.rawData
                                            )
                                          }
                                          className="p-2 rounded-full bg-danger-500 text-white hover:bg-danger-600 hover:scale-110 transition-all duration-200"
                                          title="Decline Booking"
                                        >
                                          <CloseRoundedIcon className="scale-90" />
                                        </button>
                                      </>
                                    )}

                                    {needsSightseeingPaymentVerification(
                                      row.rawData
                                    ) &&
                                      (isAdmin || isSubAdmin) && (
                                        <VerifyPaymentIconButton
                                          onClick={() =>
                                            handleVerifyPayment(
                                              row.bookingId,
                                              row.rawData
                                            )
                                          }
                                          loading={
                                            verifyingPaymentId === row.bookingId
                                          }
                                        />
                                      )}
                                  </div>
                                ) : column.property === "amount" ? (
                                  <span className="font-semibold text-success-600">
                                    ฿{Number(value || 0).toLocaleString()}
                                  </span>
                                ) : column.property === "packageTitle" ? (
                                  <div className="text-sm">
                                    <p className="font-semibold text-neutral-800">
                                      {value}
                                    </p>
                                    {row.autoAccepted && (
                                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold">
                                        Auto
                                      </span>
                                    )}
                                  </div>
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
                    })}
                  {(rows(sourceBookings) || []).filter((row) =>
                    filterByTab(row, tabValue)
                  ).length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-12">
                        <div className="flex flex-col items-center justify-center text-neutral-400">
                          <span className="text-6xl mb-4">🎫</span>
                          <p className="text-lg font-medium text-neutral-500">
                            No Sightseeing Bookings Found
                          </p>
                          <p className="text-sm text-neutral-400 mt-2">
                            There are no bookings for the selected filter.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-4">
            <TablePagination
              rowsPerPageOptions={[10, 25, 100]}
              component="div"
              count={
                (rows(sourceBookings) || []).filter((row) =>
                  filterByTab(row, tabValue)
                ).length
              }
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
      )}


      {/* View Booking details modal */}
      <Dialog
        open={openBookingDetailsModal}
        onClose={() => setOpenBookingDetailsModal(false)}
        aria-labelledby="responsive-dialog-title"
        maxWidth="lg"
        fullWidth
        PaperProps={{
          style: { borderRadius: 24, padding: 0, backgroundColor: "#F8FAFC" },
        }}
      >
        <DialogTitle
          sx={{
            m: 0,
            p: 3,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "linear-gradient(135deg, #fff 0%, #f1f5f9 100%)",
            borderBottom: "1px solid #e2e8f0",
          }}
          id="customized-dialog-title"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-white rounded-xl shadow-sm text-primary-600 border border-neutral-100">
              <TourIcon />
            </div>
            <div>
              <span className="block font-extrabold text-xl text-slate-800 tracking-tight">
                Booking Details
              </span>
              <span className="block text-xs font-medium text-slate-500 mt-0.5">
                ID: {bookingDetails?.bookingId || bookingDetails?.id}
              </span>
            </div>
          </div>
          <span
            className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-sm border ${
              isSightseeingRevenueEligible(bookingDetails.rawData || bookingDetails)
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : isSightseeingCanceled(bookingDetails.rawData || bookingDetails)
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : isSightseeingOnsiteQueue(bookingDetails.rawData || bookingDetails)
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-orange-50 text-orange-700 border-orange-200"
            }`}
          >
            {getSightseeingStatusLabel(bookingDetails.rawData || bookingDetails)}
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
            "&:hover": { color: "neutral.600", bgcolor: "neutral.100" },
          }}
        >
          <CloseIcon />
        </IconButton>

        <DialogContent sx={{ p: 3, bgcolor: "#f8fafc" }}>
          <div className="mb-6 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <h4 className="font-bold text-slate-700 mb-2 text-sm uppercase tracking-wider">
              Booking Status
            </h4>
            <BookingTimeline booking={bookingDetails} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-50">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <LuggageIcon fontSize="small" />
                </div>
                <h3 className="font-bold text-base text-slate-800">Tour Information</h3>
              </div>
              <Grid container spacing={1}>
                {renderDetailItem(
                  "Package",
                  bookingDetails?.packageTitle ||
                    bookingDetails?.title ||
                    bookingDetails?.packageName ||
                    "N/A",
                  <TourIcon fontSize="small" />,
                  false,
                  "text-blue-600 bg-blue-50"
                )}
                {renderDetailItem(
                  "Tour Date",
                  bookingDetails?.tourDate || "N/A",
                  <CalendarMonthIcon fontSize="small" />,
                  false,
                  "text-blue-600 bg-blue-50"
                )}
                {renderDetailItem(
                  "Pick Up Time",
                  (() => {
                    const pickUp = toDate(bookingDetails?.pickUpTime);
                    return pickUp
                      ? pickUp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "N/A";
                  })(),
                  <CalendarMonthIcon fontSize="small" />,
                  false,
                  "text-blue-600 bg-blue-50"
                )}
                {renderDetailItem(
                  "Pickup Request",
                  bookingDetails?.pickupRequest ||
                    getBookingPickupRequest(
                      bookingDetails.rawData || bookingDetails
                    ) ||
                    "N/A",
                  <LocationOnIcon fontSize="small" />,
                  true,
                  "text-blue-600 bg-blue-50"
                )}
                {renderDetailItem(
                  "Passengers",
                  bookingDetails?.passengers || "N/A",
                  <PersonIcon fontSize="small" />,
                  false,
                  "text-blue-600 bg-blue-50"
                )}
              </Grid>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-50">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <PersonIcon fontSize="small" />
                </div>
                <h3 className="font-bold text-base text-slate-800">Guest Information</h3>
              </div>
              <Grid container spacing={1}>
                {renderDetailItem(
                  "Guest Name",
                  bookingDetails?.guestName || bookingDetails?.name || "N/A",
                  <PersonIcon fontSize="small" />,
                  false,
                  "text-purple-600 bg-purple-50"
                )}
                {renderDetailItem(
                  "Phone",
                  bookingDetails?.phone || "N/A",
                  <PhoneIcon fontSize="small" />,
                  false,
                  "text-purple-600 bg-purple-50"
                )}
                {renderDetailItem(
                  "Email",
                  bookingDetails?.email || "N/A",
                  <EmailIcon fontSize="small" />,
                  false,
                  "text-purple-600 bg-purple-50"
                )}
                {bookingDetails?.specialNotes &&
                  renderDetailItem(
                    "Special Notes",
                    bookingDetails.specialNotes,
                    <MdInfo fontSize="small" />,
                    true,
                    "text-purple-600 bg-purple-50"
                  )}
              </Grid>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-50">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <PaymentsIcon fontSize="small" />
                </div>
                <h3 className="font-bold text-base text-slate-800">Payment Details</h3>
              </div>
              <Grid container spacing={1}>
                {renderDetailItem(
                  "Amount (THB)",
                  `฿${Number(bookingDetails?.amount || 0).toLocaleString()}`,
                  <AttachMoneyIcon fontSize="small" />,
                  false,
                  "text-emerald-600 bg-emerald-50"
                )}
                {renderDetailItem(
                  "Payment Method",
                  bookingDetails?.paymentMethod || "ONSITE",
                  <CreditCardIcon fontSize="small" />,
                  false,
                  "text-emerald-600 bg-emerald-50"
                )}
                <Grid item xs={12} sm={6}>
                  <div className="flex items-start gap-2 p-2.5 rounded-xl hover:bg-neutral-50 transition-all duration-200 border border-transparent hover:border-neutral-200 group">
                    <div className="text-emerald-600 mt-0.5 p-2 bg-emerald-50 rounded-lg group-hover:scale-110 transition-transform duration-200 shadow-sm">
                      <VerifiedUserIcon fontSize="small" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-0.5">
                        Payment Status
                      </p>
                      <PaymentStatusBadge
                        statusInfo={getSightseeingPaymentStatusInfo(
                          bookingDetails.rawData || bookingDetails
                        )}
                        className="mt-0.5"
                      />
                    </div>
                  </div>
                </Grid>
              </Grid>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-50">
                <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                  <DirectionsBusIcon fontSize="small" />
                </div>
                <h3 className="font-bold text-base text-slate-800">Provider Assignment</h3>
              </div>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Provider Name"
                    size="small"
                    value={bookingDetails?.Provider?.name || ""}
                    onChange={(e) =>
                      setBookingDetails((p) => ({
                        ...p,
                        Provider: { ...p.Provider, name: e.target.value },
                      }))
                    }
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Provider Phone"
                    size="small"
                    value={bookingDetails?.Provider?.phone || ""}
                    onChange={(e) =>
                      setBookingDetails((p) => ({
                        ...p,
                        Provider: {
                          ...p.Provider,
                          phone: formatPhoneNumber(e.target.value),
                        },
                      }))
                    }
                    fullWidth
                  />
                </Grid>
                {(isSightseeingPendingReview(bookingDetails.rawData || bookingDetails) ||
                  (isSightseeingPending(bookingDetails.rawData || bookingDetails) &&
                    (isOnsiteSightseeingPayment(
                      bookingDetails.rawData || bookingDetails
                    ) ||
                      isThaiQrSightseeingPayment(
                        bookingDetails.rawData || bookingDetails
                      )))) && (
                  <Grid item xs={12}>
                    <TextField
                      label="Admin Review Note"
                      multiline
                      rows={3}
                      value={bookingDetails?.adminReview || ""}
                      onChange={(e) =>
                        setBookingDetails((prev) => ({
                          ...prev,
                          adminReview: e.target.value,
                        }))
                      }
                      fullWidth
                      placeholder="Add review notes before accepting..."
                    />
                  </Grid>
                )}
              </Grid>
            </div>
          </div>
        </DialogContent>

        <DialogActions sx={{ p: 3, borderTop: "1px solid #e5e5e5", bgcolor: "white", gap: 1, flexWrap: "wrap" }}>
          {isRealTime &&
            (isSightseeingPendingReview(bookingDetails.rawData || bookingDetails) ||
              (isSightseeingPending(bookingDetails.rawData || bookingDetails) &&
                (isOnsiteSightseeingPayment(
                  bookingDetails.rawData || bookingDetails
                ) ||
                  isThaiQrSightseeingPayment(
                    bookingDetails.rawData || bookingDetails
                  )))) && (
              <>
                <Button
                  variant="contained"
                  onClick={() =>
                    handleAccept(bookingDetails.bookingId || bookingDetails.id)
                  }
                  sx={{
                    borderRadius: "10px",
                    textTransform: "none",
                    fontWeight: 600,
                    bgcolor: "#10b981",
                    "&:hover": { bgcolor: "#059669" },
                  }}
                >
                  {isThaiQrSightseeingPayment(
                    bookingDetails.rawData || bookingDetails
                  )
                    ? "Accept Thai QR Booking"
                    : isOnsiteSightseeingPayment(
                          bookingDetails.rawData || bookingDetails
                        )
                      ? "Accept Onsite Booking"
                      : "Accept & Confirm"}
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    if (confirm("Reject this booking?")) {
                      handleDelete(
                        bookingDetails.bookingId || bookingDetails.id,
                        bookingDetails.rawData || bookingDetails
                      );
                      setOpenBookingDetailsModal(false);
                    }
                  }}
                  sx={{
                    borderRadius: "10px",
                    textTransform: "none",
                    fontWeight: 600,
                    bgcolor: "#ef4444",
                    "&:hover": { bgcolor: "#dc2626" },
                  }}
                >
                  Decline
                </Button>
              </>
            )}

          {(isAdmin || isSubAdmin) &&
            needsSightseeingPaymentVerification(
              bookingDetails.rawData || bookingDetails
            ) && (
              <VerifyPaymentModalButton
                onClick={() =>
                  handleVerifyPayment(
                    bookingDetails.bookingId || bookingDetails.id,
                    bookingDetails.rawData || bookingDetails
                  )
                }
                loading={
                  verifyingPaymentId ===
                  (bookingDetails.bookingId || bookingDetails.id)
                }
              />
            )}

          {isRealTime && isSightseeingAccepted(bookingDetails.rawData || bookingDetails) && (
            <Button
              variant="outlined"
              onClick={() =>
                handleUpdateProvider(bookingDetails.bookingId || bookingDetails.id)
              }
              sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 600 }}
            >
              Update Provider
            </Button>
          )}

          <Button
            variant="outlined"
            onClick={() => setOpenBookingDetailsModal(false)}
            sx={{
              borderRadius: "10px",
              textTransform: "none",
              fontWeight: 600,
              color: "neutral.600",
              borderColor: "neutral.300",
              px: 3,
              "&:hover": {
                borderColor: "neutral.400",
                bgcolor: "neutral.50",
                color: "neutral.800",
              },
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
          style: { borderRadius: 24, padding: 0, backgroundColor: "#F8FAFC" },
        }}
      >
        <DialogTitle
          sx={{
            m: 0,
            p: 3,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "linear-gradient(135deg, #fff 0%, #f1f5f9 100%)",
            borderBottom: "1px solid #e2e8f0",
          }}
          id="customized-dialog-title"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-white rounded-xl shadow-sm text-purple-600 border border-neutral-100">
              <LuggageIcon />
            </div>
            <div>
              <span className="block font-extrabold text-xl text-slate-800 tracking-tight">
                Package Details
              </span>
              <span className="block text-xs font-medium text-slate-500 mt-0.5">
                {packageDetails?.title}
              </span>
            </div>
          </div>
          <IconButton
            aria-label="close"
            onClick={() => setOpenPackageDetailsModal(false)}
            sx={{
              color: "neutral.400",
              "&:hover": { color: "neutral.600", bgcolor: "neutral.100" },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
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
                {packageTextField("Package Name", packageDetails?.title, true)}
                {packageTextField("Location", packageDetails?.location, true)}
                {packageTextField("Price", packageDetails?.price, true)}
                {packageTextField("Discount", packageDetails?.discount, true)}
                {packageTextField(
                  "Discount Price",
                  calculateDiscountPrice(
                    packageDetails?.price,
                    packageDetails?.discount
                  ),
                  true
                )}
                {packageTextField("Period", packageDetails?.period, true)}
              </Grid>
            </Grid>
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              {/* Description */}
              {packageTextField("Description", packageDetails?.description)}

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
        <DialogActions sx={{ p: 3, borderTop: "1px solid #e5e5e5", bgcolor: "white" }}>
          <Button
            variant="outlined"
            onClick={() => setOpenPackageDetailsModal(false)}
            sx={{
              borderRadius: "10px",
              textTransform: "none",
              fontWeight: 600,
              color: "neutral.600",
              borderColor: "neutral.300",
              px: 3,
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div >
  );
};

export default TravelBookings;
