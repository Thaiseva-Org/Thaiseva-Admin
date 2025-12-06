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
} from "@mui/material";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import LoadingContent from "../../../../../components/LoadingContent";
import PageHeading from "../../../../../components/PageHeading";
import ViewDetailsIcon from "../../../../../components/ViewDetailsIcon";
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
    packageId
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
    };
  }

  // calling createData function with partner's data
  const rows = (bookings) => {
    return bookings?.map((booking) => {
      return createData(
        booking?.guestDetails?.name,
        booking?.guestDetails?.phoneNumber,
        booking.title,
        booking?.orderedAt,
        booking.price,
        booking.status,
        booking.id,
        booking.dataid
      );
    });
  };

  // setting booking details to the state
  const handleViewBookingDetails = async (id) => {
    // console.log(id);
    const snapshot = await getDoc(doc(travelBookingCollection, id));
    if (snapshot.exists()) {
      const existingData = snapshot.data();
      setBookingDetails({ ...bookingDetails, ...existingData });
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
  const handleDelete = async (id) => {
    if (confirm("Do you want to reject this booking?")) {
      await updateDoc(doc(travelBookingCollection, id), {
        status: "Canceled",
      }).then(async () => {
        alert("Booking rejected!.");
        setBookingDetails({
          Provider: { name: "", phone: "" },
          // Driver: { name: "", phone: "" },
          // vehicleDetails: { vehicle: "", vehicleNumber: "" },
        });
        await CreateNewNotificationToUser(
          "Sightseeing booking rejected!",
          `Hey ${bookingDetails?.guestDetails?.name}! sorry your sightseeing booking for ${bookingDetails?.title} is rejeted!`,
          bookingDetails?.uId
        );
      });
    }
  };

  const handleAccept = async (id) => {
    // console.log(id);
    setError({ for: "", text: "" });
    if (bookingDetails.Provider.name.trim().length < 1) {
      setError({ for: "providerName", text: "Provider name is required." });
      return;
    }
    if (bookingDetails.Provider.phone.trim().length < 1) {
      setError({ for: "providerPhone", text: "Provider number is required." });
      return;
    }
    // if (bookingDetails.Driver.name.trim().length < 1) {
    //   setError({ for: "driverName", text: "Driver name is required." });
    //   return;
    // }
    // if (bookingDetails.Driver.phone.trim().length < 1) {
    //   setError({ for: "driverPhone", text: "Driver number is required." });
    //   return;
    // }
    // if (bookingDetails.vehicleDetails.vehicle.trim().length < 1) {
    //   setError({ for: "vehicle", text: "Vehicle name is required." });
    //   return;
    // }
    // if (bookingDetails.vehicleDetails.vehicleNumber.trim().length < 1) {
    //   setError({ for: "vehicleNumber", text: "Vehicle number is required." });
    //   return;
    // }
    if (confirm("Do you want to proceed with confirming this booking?")) {
      await updateDoc(doc(travelBookingCollection, id), {
        ...bookingDetails,
        status: "Accepted",
      }).then(async () => {
        alert("Booking confirmed successfully!.");
        setOpenBookingDetailsModal(false);
        setBookingDetails({
          Provider: { name: "", phone: "" },
          // Driver: { name: "", phone: "" },
          // vehicleDetails: { vehicle: "", vehicleNumber: "" },
        });
        await updateHourlyEarnings(bookingDetails?.price, "Sightseeing");
        await updateHourlyEarnings(
          bookingDetails?.price,
          "Sightseeing",
          bookingDetails?.Provider?.phone
        );
        await updateMonthlyEarnings(bookingDetails?.price, "Sightseeing");
        await updateMonthlyEarnings(
          bookingDetails?.price,
          "Sightseeing",
          bookingDetails?.Provider?.phone
        );
        await CreateNewNotificationToUser(
          "Sightseeing booking confirm!",
          `Hey ${bookingDetails?.guestDetails?.name}! your sightseeing booking for ${bookingDetails?.title} is confirmed!`,
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
            {label.includes("Price") && "฿"}
            {value}
            {label.includes("Period") && " days"}
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
        text="Sightseeing Bookings"
        subtitle="Manage tour bookings and reservations"
        icon="🎫"
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
                {(isRealTime ? travelBookings : matchedBookings).length}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">🎫</span>
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
                  (isRealTime ? travelBookings : matchedBookings).filter(
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
                  (isRealTime ? travelBookings : matchedBookings).filter(
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
                    {columns?.map((column) => (
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
                  {(isRealTime ? travelBookings : matchedBookings).length ===
                    0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <span className="text-6xl opacity-50">📅</span>
                          <p className="text-neutral-500 font-medium">
                            No Sightseeing Bookings Found
                          </p>
                          <p className="text-neutral-400 text-sm">
                            Bookings will appear here once customers make
                            reservations
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows(isRealTime ? travelBookings : matchedBookings)?.map(
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
                                          handleViewBookingDetails(row.orderId)
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
                                          isRealTime &&
                                          handleDelete(row.orderId)
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
                                      <div
                                        onClick={() =>
                                          handleViewPackageDetails(
                                            row.packageId
                                          )
                                        }
                                        className="cursor-pointer"
                                      >
                                        <ViewDetailsIcon title="View Package Details" />
                                      </div>
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
            {bookingDetails.title} Booking
          </DialogTitle>
          <IconButton
            aria-label="close"
            onClick={() => {
              setOpenBookingDetailsModal(false);
              setBookingDetails({
                Provider: { name: "", phone: "" },
                // Driver: { name: "", phone: "" },
                // vehicleDetails: { vehicle: "", vehicleNumber: "" },
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
                bookingDetails?.guestDetails?.name
                  ?.replace("not_present", "")
                  .trim()
              )}

              {/* Guest Phone */}
              {textField(
                "Guest Phone",
                bookingDetails?.guestDetails?.phoneNumber
              )}

              {/* Email */}
              {textField("Email", bookingDetails?.guestDetails?.email)}

              {/* Price */}
              {textField("Price", bookingDetails?.price)}

              {textField("Number of Guests", bookingDetails?.noOfPassengers)}

              {/* Pick Up Date */}
              {textField(
                "Pick Up Date",
                bookingDetails?.pickUpTime
                  ? new Date(
                    bookingDetails.pickUpTime.seconds * 1000 +
                    bookingDetails.pickUpTime.nanoseconds / 1000000
                  ).toLocaleDateString()
                  : "No pick-up time available"
              )}

              {/* Pick Up Date */}
              {textField(
                "Pick Up Time",
                bookingDetails?.pickUpTime
                  ? new Date(
                    bookingDetails.pickUpTime.seconds * 1000 +
                    bookingDetails.pickUpTime.nanoseconds / 1000000
                  ).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  : "No pick-up time available"
              )}

              {headingTextField("Provider Details")}

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Package Provider Name"
                  type="text"
                  value={bookingDetails?.Provider?.name}
                  autoComplete="off"
                  autoCorrect="off"
                  error={error?.for === "providerName"}
                  helperText={
                    error?.for === "providerName" && (
                      <span className="text-red-500">{error.text}</span>
                    )
                  }
                  onChange={(e) =>
                    setBookingDetails((p) => ({
                      ...p,
                      Provider: { ...p.Provider, name: e.target.value },
                    }))
                  }
                  fullWidth
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Package Provider Phone"
                  type="text"
                  value={bookingDetails?.Provider?.phone}
                  autoComplete="off"
                  autoCorrect="off"
                  error={error?.for === "providerPhone"}
                  helperText={
                    error?.for === "providerPhone" && (
                      <span className="text-red-500">{error.text}</span>
                    )
                  }
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
              onClick={() => handleAccept(`${bookingDetails?.orderId}`)}
            >
              Confirm
            </Button>
          </DialogActions>
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
                  <h3 className="font-bold text-[var(--primary-bg)] border-b">
                    Amenities
                  </h3>
                  <div className="flex flex-wrap gap-1 text-sm my-2">
                    {packageDetails.amenities &&
                      packageDetails?.amenities?.map((amenity, i) => (
                        <span key={i} className="bg-gray-200 py-1 px-2 rounded">
                          {amenity}
                        </span>
                      ))}
                  </div>
                </Grid>
              )}

              {packageDetails?.hotels?.length > 0 && (
                <Grid item xs={12}>
                  <h3 className="font-bold text-[var(--primary-bg)] border-b">
                    Hotels
                  </h3>
                  <div className="flex flex-wrap gap-1 text-sm my-2">
                    {packageDetails.hotels &&
                      packageDetails?.hotels?.map((amenity, i) => (
                        <span key={i} className="bg-gray-200 py-1 px-2 rounded">
                          {amenity}
                        </span>
                      ))}
                  </div>
                </Grid>
              )}

              {packageDetails?.places?.length > 0 && (
                <Grid item xs={12}>
                  <h3 className="font-bold text-[var(--primary-bg)] border-b">
                    Places
                  </h3>
                  <div className="flex flex-wrap gap-1 text-sm my-2">
                    {packageDetails.places &&
                      packageDetails?.places?.map((amenity, i) => (
                        <span key={i} className="bg-gray-200 py-1 px-2 rounded">
                          {amenity}
                        </span>
                      ))}
                  </div>
                </Grid>
              )}

              {packageDetails?.included?.length > 0 && (
                <Grid item xs={12}>
                  <h3 className="font-bold text-[var(--primary-bg)] border-b">
                    Includes
                  </h3>
                  <div className="flex flex-wrap gap-1 text-sm my-2">
                    {packageDetails.included &&
                      packageDetails?.included?.map((include, i) => (
                        <span key={i} className="bg-gray-200 py-1 px-2 rounded">
                          {include}
                        </span>
                      ))}
                  </div>
                </Grid>
              )}

              {/* Pictures */}
              <Grid item xs={12}>
                <h3 className="font-bold text-[var(--primary-bg)] border-b">
                  Room Pictures
                </h3>
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
    </div>
  );
};

export default TravelBookings;
