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
} from "@mui/material";
import PageHeading from "../../../../../components/PageHeading";
import { useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { carBookingsCollection } from "../../../../../firebase/firebase.config";
import {
  // calculateDiscountPrice,
  dateCalculator,
  formatPhoneNumber,
  getDateAndTime,
  timeCalculator,
} from "../../../../../utils/utils";
import LoadingContent from "../../../../../components/LoadingContent";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DoneRoundedIcon from "@mui/icons-material/DoneRounded";
import CloseIcon from "@mui/icons-material/Close";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FilterListIcon from "@mui/icons-material/FilterList";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useContext } from "react";
import { useState } from "react";
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";
import {
  updateHourlyEarnings,
  updateMonthlyEarnings,
} from "../../../../../services/Earning";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import {
  fetchBookings,
  fetchBookingsTotalPages,
} from "../../../../../services/Bookings";
import { useNotifications } from "../../../../../contextAPIs/NotificationsProvider";

const CarBookings = () => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const { carBookings } = useContext(PartnerContext);
  const { CreateNewNotificationToUser } = useNotifications();
  const [matchedBookings, setMatchedBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState({ for: "", text: "" });
  const [openBookingDetailsModal, setOpenBookingDetailsModal] = useState(false);
  const [bookingDetails, setBookingDetails] = useState({
    Driver: { name: "", phone: "" },
    vehicleDetails: { vehicle: "", vehicleNumber: "" },
    AmountOffered: "",
    comission: 0,
    status: "Accepted",
  });
  const [refetch, setRefetch] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isRealTime, setIsRealTime] = useState(true);
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
        "Taxi Bookings"
      );
      fetchBookings(
        setMatchedBookings,
        setLoading,
        "Taxi Bookings",
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
    { property: "guestName", label: "Guest Name", width: "10%" },
    { property: "phone", label: "Phone", width: "10%" },
    { property: "reqTime", label: "Required At", width: "10%" },
    { property: "transportType", label: "Vehicle Type", width: "10%" },
    { property: "from", label: "Pickup Point", width: "15%" },
    { property: "to", label: "Drop Point", width: "15%" },
    { property: "orderedAt", label: "Booking time", width: "10%" },
    { property: "status", label: "Status", width: "10%" },
    { property: "action", label: "Action", width: "10%" },
  ];

  // creating single row
  function createData(
    guestName,
    phone,
    reqTime,
    from,
    to,
    orderedAt,
    status,
    id,
    transportType
  ) {
    return {
      guestName,
      phone,
      reqTime,
      from,
      to,
      orderedAt,
      status,
      id,
      transportType,
    };
  }

  // calling createData function with partner's data
  const rows = (bookings) => {
    return bookings?.map((booking) => {
      return createData(
        booking?.name || "-",
        booking?.contact || "-",
        booking?.time || "-",
        booking?.pickup || "-",
        booking?.drop || "-",
        booking?.timestamp || "-",
        booking?.status === "pending"
          ? "Pending"
          : booking?.status || "Pending",
        booking?.id || "-",
        booking?.transportType
      );
    });
  };

  // setting booking details to the state
  const handleViewBookingDetails = async (id) => {
    const snapshot = await getDoc(doc(carBookingsCollection, id));
    if (snapshot.exists()) {
      const existingData = { id: snapshot.id, ...snapshot.data() };
      setBookingDetails({ ...bookingDetails, ...existingData });
      setOpenBookingDetailsModal(true);
    }
  };

  // delete canceled booking
  const handleDelete = async (id) => {
    if (confirm("Do you want to reject this booking?")) {
      await updateDoc(doc(carBookingsCollection, id), {
        status: "Canceled",
      }).then(async () => {
        alert("Booking rejected!.");
        setBookingDetails({
          Driver: { name: "", phone: "" },
          vehicleDetails: { vehicle: "", vehicleNumber: "" },
          AmountOffered: "",
          comission: 0,
          status: "Accepted",
        });
        await CreateNewNotificationToUser(
          "Car booking rejected!",
          `Hey ${bookingDetails?.name}! sorry your car booking is rejeted!`,
          bookingDetails?.userId
        );
      });
    }
  };

  // custom text field for common data

  const handleConfirmBooking = async () => {
    setError({ for: "", text: "" });
    if (bookingDetails.Driver.name.trim().length < 1) {
      setError({ for: "driverName", text: "Driver name is required." });
      return;
    }
    if (bookingDetails.Driver.phone.trim().length < 1) {
      setError({ for: "driverPhone", text: "Driver number is required." });
      return;
    }
    if (bookingDetails.vehicleDetails.vehicle.trim().length < 1) {
      setError({ for: "vehicle", text: "Vehicle name is required." });
      return;
    }
    if (bookingDetails.vehicleDetails.vehicleNumber.trim().length < 1) {
      setError({ for: "vehicleNumber", text: "Vehicle number is required." });
      return;
    }
    if (bookingDetails.AmountOffered.trim().length < 1) {
      setError({ for: "amount", text: "Amount is required." });
      return;
    }
    if (bookingDetails.comission.toString().trim().length < 1) {
      setError({ for: "comission", text: "Commission is required." });
      return;
    }

    if (confirm("Do you want to proceed with confirming this booking?")) {
      await updateDoc(doc(carBookingsCollection, bookingDetails.id), {
        ...bookingDetails,
        status: "Accepted",
      }).then(async () => {
        alert("Booking confirmed successfully.");
        setOpenBookingDetailsModal(false);
        await updateHourlyEarnings(bookingDetails?.AmountOffered, "Cars");
        await updateHourlyEarnings(
          bookingDetails?.AmountOffered,
          "Cars",
          bookingDetails?.Driver?.phone
        );
        await updateMonthlyEarnings(bookingDetails?.AmountOffered, "Cars");
        await updateMonthlyEarnings(
          bookingDetails?.AmountOffered,
          "Cars",
          bookingDetails?.Driver?.phone
        );
        setBookingDetails({
          Driver: { name: "", phone: "" },
          vehicleDetails: { vehicle: "", vehicleNumber: "" },
          AmountOffered: "",
          comission: 0,
          status: "Accepted",
        });
        await CreateNewNotificationToUser(
          "Car booking confirm!",
          `Hey ${bookingDetails?.name}! your car booking is confirmed!`,
          bookingDetails?.userId
        );
      });
    }
  };

  // custom text field for common data
  const textField = (label, value, is12) => {
    return (
      <Grid item xs={12} sm={label === "Description" || is12 ? 12 : 6}>
        <div className="flex gap-2">
          <p>
            <span className="font-bold">{label}: </span>
            {label.includes("Price") && "$"}
            {value}
            {label === "Discount" && "%"}
          </p>
        </div>
      </Grid>
    );
  };

  const headingTextField = (label) => {
    return (
      <Grid item xs={12} sm={12}>
        <div className="flex justify-center mb-2">
          <h2 className="font-bold text-center text-xl">{label}</h2>
        </div>
      </Grid>
    );
  };

  return (
    <div className="animate-fade-in">
      <PageHeading
        text="Taxi Bookings"
        subtitle="Manage taxi and car service bookings"
        icon="🚖"
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
                {(isRealTime ? carBookings : matchedBookings).length}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">🚖</span>
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
                  (isRealTime ? carBookings : matchedBookings).filter(
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
                  (isRealTime ? carBookings : matchedBookings).filter(
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
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 active:scale-95"
              onClick={() => {
                const today = new Date();
                const next7 = new Date(today);
                next7.setDate(today.getDate() + 7);
                setStartDate(today.toISOString().split('T')[0]);
                setEndDate(next7.toISOString().split('T')[0]);
                setPage(0);
                setLastDocs([]);
                setRefetch((p) => !p);
                setIsRealTime(false);
              }}
            >
              <CalendarMonthIcon sx={{ fontSize: 18 }} />
              Next 7 Days
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

      {/* Bookings Table */}
      <div className="bg-white rounded-xl shadow-md border border-neutral-200 overflow-hidden">
        {loading ? (
          <LoadingContent />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.property}
                        className="px-4 py-4 text-center text-sm font-semibold"
                        style={{ width: column.width }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {(isRealTime ? carBookings : matchedBookings).length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <span className="text-6xl opacity-50">🚖</span>
                          <p className="text-neutral-500 font-medium">
                            No Taxi Bookings Found
                          </p>
                          <p className="text-neutral-400 text-sm">
                            Bookings will appear here once customers make
                            reservations
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows(isRealTime ? carBookings : matchedBookings).map(
                      (row, i) => {
                        const date = new Date(
                          row["orderedAt"]?.seconds * 1000 +
                          row["orderedAt"]?.nanoseconds / 1000000
                        );

                        return (
                          <tr
                            key={i}
                            className="hover:bg-primary-50 transition-colors duration-150"
                          >
                            {columns.map((column) => {
                              const value = row[column.property];

                              return (
                                <td
                                  key={column.property}
                                  className="px-4 py-4 text-center text-sm"
                                >
                                  {value === "Pending" ||
                                    value === "Accepted" ||
                                    value === "Canceled" ? (
                                    <span
                                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${value === "Pending"
                                        ? "bg-warning-100 text-warning-700"
                                        : value === "Accepted"
                                          ? "bg-success-100 text-success-700"
                                          : "bg-danger-100 text-danger-700"
                                        }`}
                                    >
                                      {value === "Pending" && "⏳ "}
                                      {value === "Accepted" && "✓ "}
                                      {value === "Canceled" && "✗ "}
                                      {value}
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
                                      <button
                                        onClick={() =>
                                          isRealTime &&
                                          handleViewBookingDetails(row.id)
                                        }
                                        disabled={
                                          !isRealTime ||
                                          row["status"] === "Canceled" ||
                                          row["status"] === "Accepted"
                                        }
                                        className={`p-2 rounded-full transition-all duration-200 ${!isRealTime ||
                                          row["status"] === "Canceled" ||
                                          row["status"] === "Accepted"
                                          ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                                          : "bg-success-500 text-white hover:bg-success-600 hover:scale-110"
                                          }`}
                                        title="Accept Booking"
                                      >
                                        <DoneRoundedIcon className="scale-90" />
                                      </button>
                                      <button
                                        onClick={() =>
                                          isRealTime && handleDelete(row.id)
                                        }
                                        disabled={
                                          !isRealTime ||
                                          row["status"] === "Canceled" ||
                                          row["status"] === "Accepted"
                                        }
                                        className={`p-2 rounded-full transition-all duration-200 ${!isRealTime ||
                                          row["status"] === "Canceled" ||
                                          row["status"] === "Accepted"
                                          ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                                          : "bg-danger-500 text-white hover:bg-danger-600 hover:scale-110"
                                          }`}
                                        title="Cancel Booking"
                                      >
                                        <CloseRoundedIcon className="scale-90" />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-neutral-700 font-medium">
                                      {value}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      }
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!isRealTime && (
              <div className="border-t border-neutral-200">
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
                      padding: "12px 16px",
                    },
                    "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows":
                    {
                      color: "#6B7280",
                      fontWeight: 500,
                    },
                    "& .MuiTablePagination-select": {
                      borderRadius: "8px",
                      padding: "4px 8px",
                      border: "1px solid #E5E7EB",
                      "&:hover": {
                        backgroundColor: "#F3F4F6",
                      },
                    },
                    "& .MuiTablePagination-actions button": {
                      borderRadius: "8px",
                      padding: "4px",
                      "&:hover": {
                        backgroundColor: "#EFF6FF",
                      },
                    },
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* View Booking details and confirm booking modal */}

      <Dialog
        open={openBookingDetailsModal}
        onClose={() => {
          setOpenBookingDetailsModal(false);
          setBookingDetails({
            Driver: { name: "", phone: "" },
            vehicleDetails: { vehicle: "", vehicleNumber: "" },
            AmountOffered: "",
            comission: 0,
            status: "Accepted",
          });
          setError({ for: "", text: "" });
        }}
        aria-labelledby="responsive-dialog-title"
        fullWidth
        maxWidth="md"
      >
        <Box>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            Confirm Booking
          </DialogTitle>
          <IconButton
            aria-label="close"
            onClick={() => {
              setOpenBookingDetailsModal(false);
              setBookingDetails({
                Driver: { name: "", phone: "" },
                vehicleDetails: { vehicle: "", vehicleNumber: "" },
                AmountOffered: "",
                status: "Accepted",
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
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              {/* Customer Details */}
              {headingTextField("Customer Details")}

              {/* Guest Name */}
              {textField(
                "Guest Name",
                `${bookingDetails?.name || "not available"}`
              )}

              {/* Guest Phone */}
              {textField(
                "Guest Phone",
                `${bookingDetails?.contact || "not available"}`
              )}

              {/* Pick Up location */}
              {textField(
                "Pick up location",
                `${bookingDetails?.pickup || "not available"}`
              )}

              {/* Drop location */}
              {textField(
                "Drop location",
                `${bookingDetails?.drop || "not available"}`
              )}

              {/* Required vehicle type */}
              {textField("Vehicle Type", `${bookingDetails?.transportType}`)}

              {/* Required time */}
              {textField("Required time", `${bookingDetails?.time}`)}

              {/* booking time */}
              {textField(
                "Booking time",
                `${dateCalculator(bookingDetails?.timestamp)} ${timeCalculator(
                  bookingDetails?.timestamp
                )}`
              )}

              {/* Driver Details */}
              {headingTextField("Driver Details")}

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Driver Name"
                  type="text"
                  value={bookingDetails?.Driver?.name}
                  autoComplete="off"
                  autoCorrect="off"
                  error={error?.for === "driverName"}
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
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Driver Phone"
                  type="text"
                  value={bookingDetails?.Driver?.phone}
                  autoComplete="off"
                  autoCorrect="off"
                  error={error?.for === "driverPhone"}
                  helperText={
                    error?.for === "driverPhone" && (
                      <span className="text-red-500">{error.text}</span>
                    )
                  }
                  onChange={(e) =>
                    setBookingDetails((p) => ({
                      ...p,
                      Driver: {
                        ...p.Driver,
                        phone: formatPhoneNumber(e.target.value),
                      },
                    }))
                  }
                  fullWidth
                />
              </Grid>

              {/* Vehicle Details */}
              {headingTextField("Vehicle Details")}

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Vehicle Name"
                  type="text"
                  value={bookingDetails?.vehicleDetails?.vehicle}
                  autoComplete="off"
                  autoCorrect="off"
                  error={error?.for === "vehicle"}
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
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Vehicle Number"
                  type="text"
                  value={bookingDetails?.vehicleDetails?.vehicleNumber}
                  autoComplete="off"
                  autoCorrect="off"
                  error={error?.for === "vehicleNumber"}
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
              </Grid>

              {headingTextField("Other Details")}

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Amount"
                  type="number"
                  onWheel={(e) => e.target.blur()}
                  onKeyDown={(e) => {
                    if (["+", "-", "e", "/"].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  value={bookingDetails?.AmountOffered}
                  error={error?.for === "amount"}
                  helperText={
                    error?.for === "amount" && (
                      <span className="text-red-500">{error.text}</span>
                    )
                  }
                  onChange={(e) =>
                    setBookingDetails((p) => ({
                      ...p,
                      AmountOffered: e.target.value,
                    }))
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Commission"
                  type="number"
                  onWheel={(e) => e.target.blur()}
                  onKeyDown={(e) => {
                    if (["+", "-", "e", ".", "/"].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  onInput={(e) => {
                    if (e.target.value) {
                      let value = parseInt(e.target.value, 10);
                      if (value < 0) e.target.value = 0;
                      if (value > 100) e.target.value = 100;
                    }
                  }}
                  defaultValue={bookingDetails?.comission}
                  error={error?.for === "comission"}
                  helperText={
                    error?.for === "comission" && (
                      <span className="text-red-500">{error.text}</span>
                    )
                  }
                  onChange={(e) =>
                    setBookingDetails((p) => ({
                      ...p,
                      comission: e.target.value,
                    }))
                  }
                  fullWidth
                />
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
              onClick={handleConfirmBooking}
            >
              Confirm
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </div>
  );
};

export default CarBookings;
