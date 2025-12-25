import CloseIcon from "@mui/icons-material/Close";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DoneRoundedIcon from "@mui/icons-material/DoneRounded";
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
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import { useNotifications } from "../../../../../contextAPIs/NotificationsProvider";
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";
import { selfDriveBookingCollection } from "../../../../../firebase/firebase.config";
import {
  fetchBookings,
  fetchBookingsTotalPages,
} from "../../../../../services/Bookings";
import {
  updateHourlyEarnings,
  updateMonthlyEarnings,
} from "../../../../../services/Earning";
import {
  dateCalculator,
  formatPhoneNumber,
  getDateAndTime,
  successNotification,
  timeCalculator,
} from "../../../../../utils/utils";

const SelfDriveBookings = () => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const { selfDriveBookings } = useContext(PartnerContext);
  const { CreateNewNotificationToUser } = useNotifications();
  const [matchedBookings, setMatchedBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState({ for: "", text: "" });
  const [openBookingDetailsModal, setOpenBookingDetailsModal] = useState(false);
  const [bookingDetails, setBookingDetails] = useState({
    Provider: { name: "", phone: "" },
    vehicleDetails: { vehicle: "", vehicleNumber: "" },
    dropDetails: { name: "", phone: "" },
    AmountOffered: "",
    comission: 0,
    PickUpLocation: "",
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
        "Selfdrive Bookings"
      );
      fetchBookings(
        setMatchedBookings,
        setLoading,
        "Selfdrive Bookings",
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

  // Bookings table data showing format with heading
  let columns = [
    { property: "guestName", label: "Guest Name", width: "10%" },
    { property: "phone", label: "Phone", width: "10%" },
    { property: "packageTitle", label: "Required on", width: "10%" },
    { property: "type", label: "Vehicle Type", width: "10%" },
    { property: "from", label: "From", width: "15%" },
    { property: "to", label: "To", width: "15%" },
    { property: "orderedAt", label: "Booking time", width: "10%" },
    { property: "status", label: "Status", width: "10%" },
    { property: "action", label: "Action", width: "10%" },
  ];

  // formatting data in a proper way to show in table
  function createData(
    guestName,
    phone,
    packageTitle,
    orderedAt,
    from,
    to,
    status,
    packageId,
    type
  ) {
    return {
      guestName,
      phone,
      packageTitle,
      orderedAt,
      from,
      to,
      status,
      packageId,
      type,
    };
  }

  // calling createData function with bookings data to setup data properly
  const rows = (bookings) => {
    return bookings?.map((booking) => {
      return createData(
        booking?.name || "-",
        booking?.phoneNo || "-",
        booking?.date || "-",
        booking?.time || "-",
        `${booking?.fromLocation?.primary} ${booking?.fromLocation?.secondary}` ||
        "-",
        `${booking?.toLocation?.primary} ${booking?.toLocation?.secondary}` ||
        "-",
        booking?.status === "pending"
          ? "Pending"
          : booking?.status || "Pending",
        booking?.id || "-",
        booking?.type || "-"
      );
    });
  };

  // function to set data in state to show on confirm boking modal open
  const handleViewBookingDetails = async (id) => {
    const snapshot = await getDoc(doc(selfDriveBookingCollection, id));
    if (snapshot.exists()) {
      const existingData = { id: snapshot.id, ...snapshot.data() };
      setBookingDetails({ ...bookingDetails, ...existingData });
      setOpenBookingDetailsModal(true);
    }
  };

  // canceled booking handling
  const handleDelete = async (id) => {
    if (confirm("Do you want to reject this booking?")) {
      await updateDoc(doc(selfDriveBookingCollection, id), {
        status: "Canceled",
      }).then(async () => {
        setRefetch((p) => !p);
        alert("Booking rejected!.");
        setBookingDetails({
          Provider: { name: "", phone: "" },
          vehicleDetails: { vehicle: "", vehicleNumber: "" },
          dropDetails: { name: "", phone: "" },
          AmountOffered: "",
          comission: 0,
          PickUpLocation: "",
          status: "Accepted",
        });
        await CreateNewNotificationToUser(
          "Self drive booking rejected!",
          `Hey ${bookingDetails?.username}! sorry your self drive booking is rejeted!`,
          bookingDetails?.uid
        );
      });
    }
  };

  // confirm booking handling
  const handleConfirmBooking = async () => {
    setError({ for: "", text: "" });
    if (bookingDetails.Provider.name.trim().length < 1) {
      setError({ for: "providerName", text: "Provider name is required." });
      return;
    }
    if (bookingDetails.Provider.phone.trim().length < 1) {
      setError({ for: "providerPhone", text: "Provider number is required." });
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
    if (bookingDetails.dropDetails.name.trim().length < 1) {
      setError({ for: "dropName", text: "Drop person name is required." });
      return;
    }
    if (bookingDetails.dropDetails.phone.trim().length < 1) {
      setError({ for: "dropPhone", text: "Drop person number is required." });
      return;
    }
    if (bookingDetails.AmountOffered.trim().length < 1) {
      setError({ for: "amount", text: "Amount is required." });
      return;
    }
    if (bookingDetails.PickUpLocation.trim().length < 1) {
      setError({ for: "pickLocation", text: "Drop Location is required." });
      return;
    }
    if (bookingDetails.comission.trim().length < 1) {
      setError({ for: "comission", text: "comission is required." });
      return;
    }

    if (confirm("Do you want to proceed with confirming this booking?")) {
      await updateDoc(doc(selfDriveBookingCollection, bookingDetails.id), {
        ...bookingDetails,
        status: "Accepted",
      }).then(async () => {
        successNotification("Booking confirmed successfully.");
        setOpenBookingDetailsModal(false);
        await updateHourlyEarnings(bookingDetails?.AmountOffered, "SelfDrive");
        await updateHourlyEarnings(
          bookingDetails?.AmountOffered,
          "SelfDrive",
          bookingDetails?.Provider?.phone
        );
        await updateMonthlyEarnings(bookingDetails?.AmountOffered, "SelfDrive");
        await updateMonthlyEarnings(
          bookingDetails?.AmountOffered,
          "SelfDrive",
          bookingDetails?.Provider?.phone
        );
        setBookingDetails({
          Provider: { name: "", phone: "" },
          vehicleDetails: { vehicle: "", vehicleNumber: "" },
          dropDetails: { name: "", phone: "" },
          AmountOffered: "",
          PickUpLocation: "",
          comission: 0,
          status: "Accepted",
        });
        await CreateNewNotificationToUser(
          "Self drive booking confirm!",
          `Hey ${bookingDetails?.username}! your self drive booking is confirmed!`,
          bookingDetails?.uid
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

  const imgTextField = (label, value) => {
    return (
      <Grid item xs={12} sm={6}>
        <div className="flex gap-2">
          {value !== undefined && value !== "" && (
            <p>
              <span className="font-bold">{label}: </span>
              <img
                src={value}
                alt={label}
                className="w-[80%] m-auto my-2 rounded-lg"
              />
            </p>
          )}
          {(value === undefined || value === "") && (
            <p>
              <span className="font-bold">{label}: </span>
              not provided
            </p>
          )}
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
        text="Self Drive Bookings"
        subtitle="Manage self-drive car rental bookings"
        icon="🚗"
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
                {(isRealTime ? selfDriveBookings : matchedBookings).length}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">🚗</span>
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
                  (isRealTime ? selfDriveBookings : matchedBookings).filter(
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
                  (isRealTime ? selfDriveBookings : matchedBookings).filter(
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
      <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-4 mb-6">
        <div className="flex justify-between items-center gap-4 flex-wrap">
          <h3 className="text-lg font-semibold text-neutral-700 flex items-center gap-2">
            <span>📆</span> Filter by Date Range
          </h3>
          <form
            onSubmit={(e) => {
              handleDateRangeSubmit(e);
            }}
            className="flex items-end gap-2 flex-wrap"
          >
            <fieldset className="px-3 pb-2 border-2 border-neutral-300 rounded-lg hover:border-primary-400 transition-colors">
              <legend className="px-2 text-sm font-medium text-neutral-600">
                Start Date
              </legend>
              <input
                type="date"
                className="date-input w-[7.5rem] outline-none bg-transparent text-neutral-700"
                placeholder="Select date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                }}
                max={new Date().toISOString().split("T")[0]}
              />
            </fieldset>
            <span className="text-neutral-500 font-medium pb-2">to</span>
            <fieldset className="px-3 pb-2 border-2 border-neutral-300 rounded-lg hover:border-primary-400 transition-colors">
              <legend className="px-2 text-sm font-medium text-neutral-600">
                End Date
              </legend>
              <input
                type="date"
                className="date-input w-[7.5rem] outline-none bg-transparent text-neutral-700"
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

            <button type="submit" className="btn-gradient-primary">
              Apply Filter
            </button>

            <button
              type="button"
              className="btn-gradient-secondary"
              onClick={() => {
                setIsRealTime(true), setStartDate(""), setEndDate("");
              }}
            >
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
                  {(isRealTime ? selfDriveBookings : matchedBookings).length ===
                    0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <span className="text-6xl opacity-50">🚗</span>
                          <p className="text-neutral-500 font-medium">
                            No Self Drive Bookings Found
                          </p>
                          <p className="text-neutral-400 text-sm">
                            Bookings will appear here once customers make
                            reservations
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows(isRealTime ? selfDriveBookings : matchedBookings).map(
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
                                  ) : column.property === "action" ? (
                                    <div className="flex gap-2 justify-center items-center">
                                      <button
                                        onClick={() =>
                                          isRealTime &&
                                          handleViewBookingDetails(
                                            row.packageId
                                          )
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
                                          handleDelete(row.packageId)
                                        }
                                        disabled={
                                          !isRealTime ||
                                          row["status"] === "Canceled" ||
                                          row["status"] === "Accepted"
                                        }
                                        className={`p-2 rounded-full transition-all duration-200 ${!isRealTime ||
                                          w["status"] === "Canceled" ||
                                          w["status"] === "Accepted"
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
            Provider: { name: "", phone: "" },
            vehicleDetails: { vehicle: "", vehicleNumber: "" },
            dropDetails: { name: "", phone: "" },
            AmountOffered: "",
            PickUpLocation: "",
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
                Provider: { name: "", phone: "" },
                vehicleDetails: { vehicle: "", vehicleNumber: "" },
                dropDetails: { name: "", phone: "" },
                AmountOffered: "",
                comission: 0,
                PickUpLocation: "",
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
                `${bookingDetails?.username || "not available"}`
              )}

              {/* Guest Phone */}
              {textField(
                "Guest Phone",
                `${bookingDetails?.phoneNo || "not available"}`
              )}

              {/* From */}
              {textField(
                "Travel from",
                `${bookingDetails?.fromLocation?.primary} ${bookingDetails?.fromLocation?.secondary}` ||
                "not available"
              )}

              {/* To */}
              {textField(
                "Travel to",
                `${bookingDetails?.toLocation?.primary} ${bookingDetails?.toLocation?.secondary}` ||
                "not available"
              )}

              {/* Check In Date */}
              {textField("Required on", bookingDetails.date || "not available")}

              {/* booking time */}
              {textField(
                "Booking time",
                `${dateCalculator(bookingDetails?.time)} ${timeCalculator(
                  bookingDetails?.time
                )}`
              )}

              {/* Vehicle Type */}
              {textField(
                "Vehicle Type",
                bookingDetails.type || "not available",
                true
              )}

              {/* Driving Licence */}
              {imgTextField(
                "Driving Licence",
                bookingDetails?.licenceLink,
                true
              )}

              {/* Passport */}
              {imgTextField("Passport", bookingDetails?.passportLink, true)}

              {/* Provider Details */}
              {headingTextField("Provider Details")}

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Vehicle Provider Name"
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
                  label="Vehicle Provider Phone"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  value={bookingDetails?.Provider?.phone}
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

              {/* Vehicle Details */}
              {headingTextField("Vehicle Details")}

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Vehicle Name"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  value={bookingDetails?.vehicleDetails?.vehicle}
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
                  autoComplete="off"
                  autoCorrect="off"
                  value={bookingDetails?.vehicleDetails?.vehicleNumber}
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

              {/* Provider Details */}
              {headingTextField("Drop Details")}

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Drop Person Name"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  value={bookingDetails?.dropDetails?.name}
                  error={error?.for === "dropName"}
                  helperText={
                    error?.for === "dropName" && (
                      <span className="text-red-500">{error.text}</span>
                    )
                  }
                  onChange={(e) =>
                    setBookingDetails((p) => ({
                      ...p,
                      dropDetails: { ...p.dropDetails, name: e.target.value },
                    }))
                  }
                  fullWidth
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Drop Person Phone"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  value={bookingDetails?.dropDetails?.phone}
                  error={error?.for === "dropPhone"}
                  helperText={
                    error?.for === "dropPhone" && (
                      <span className="text-red-500">{error.text}</span>
                    )
                  }
                  onChange={(e) =>
                    setBookingDetails((p) => ({
                      ...p,
                      dropDetails: {
                        ...p.dropDetails,
                        phone: formatPhoneNumber(e.target.value),
                      },
                    }))
                  }
                  fullWidth
                />
              </Grid>

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
                  label="Pick up location"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  defaultValue={bookingDetails?.PickUpLocation}
                  error={error?.for === "pickLocation"}
                  helperText={
                    error?.for === "pickLocation" && (
                      <span className="text-red-500">{error.text}</span>
                    )
                  }
                  onChange={(e) =>
                    setBookingDetails((p) => ({
                      ...p,
                      PickUpLocation: e.target.value,
                    }))
                  }
                  fullWidth
                />
              </Grid>

              {headingTextField("Other Details")}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Comission"
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
    </div >
  );
};

export default SelfDriveBookings;
