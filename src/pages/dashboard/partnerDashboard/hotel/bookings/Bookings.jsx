import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
} from "@mui/material";
import { useContext, useEffect, useState } from "react";
import PageHeading from "../../../../../components/PageHeading";
import CountryPhoneInput from "../../../../../components/CountryPhoneInput";
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";
// import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
// import EditIcon from "@mui/icons-material/Edit";
import { CloseIcon } from "@icons";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import LoadingContent from "../../../../../components/LoadingContent";
import UpdateButton from "../../../../../components/UpdateButton";
import ViewDetailsIcon from "../../../../../components/ViewDetailsIcon";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import { useNotifications } from "../../../../../contextAPIs/NotificationsProvider";
import {
  hotelPackageDetails,
  roomBookingCollection,
} from "../../../../../firebase/firebase.config";
import {
  fetchHotelBookings,
  fetchHotelBookingsTotalPages,
} from "../../../../../services/Bookings";
import {
  normalizeHotelBookingStatus,
  isHotelPaymentVerified,
  isStripeHotelPayment,
  isThaiQrHotelPayment,
} from "../../../../../utils/bookingStatus";
import { backfillCreatedAt } from "../../../../../utils/bookingTimestamps";
import {
  calculateDiscountPrice,
  deleteNotification,
  getDate,
  getDateAndTime,
  successNotification,
} from "../../../../../utils/utils";
import { getBookingSpecialNotes } from "../../../../../utils/bookingNotes";
import { acceptHotelBookingWithAvailability } from "../../../../../services/HotelBookingAccept";

const Bookings = () => {
  const { userData, isPartner } = useContext(AuthContext);
  const { myRoomBookings } = useContext(PartnerContext);
  const { CreateNewNotificationToUser } = useNotifications();
  const [matchedBookings, setMatchedBookings] = useState([]);
  const [openPackageDetailsModal, setOpenPackageDetailsModal] = useState(false);
  const [openBookingDetailsModal, setOpenBookingDetailsModal] = useState(false);
  const [bookingDetails, setBookingDetails] = useState({});
  const [packageDetails, setPackageDetailss] = useState({});
  const [data, setData] = useState({ managerPhone: "", roomNumbers: [] });
  const [roomNumber, setRoomNumber] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
    if (!isRealTime && isPartner && userData?.serviceCategory === "Hotel") {
      fetchHotelBookingsTotalPages(
        setTotalPages,
        startDate,
        endDate,
        userData?.uid
      );
      fetchHotelBookings(
        setMatchedBookings,
        setLoading,
        userData?.uid,
        startDate,
        endDate,
        lastDocs,
        setLastDocs,
        rowsPerPage,
        page
      );
    } else {
      setMatchedBookings(myRoomBookings);
    }
  }, [isPartner, userData, page, rowsPerPage, isRealTime, refetch]);

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const normalizeBookingStatus = normalizeHotelBookingStatus;

  const normalizeDate = (value) => {
    if (!value || value === "-") return null;
    if (value.seconds) {
      return new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000);
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const normalizeRoomBooking = (booking = {}) => {
    const orderedAt = booking.createdAt || booking.orderedAt || booking.timestamp || null;
    const amount = booking.amountTHB || booking.amount || booking.subtotal || 0;

    return {
      ...booking,
      name: booking.fullName || booking.guestDetails?.name || booking.name || "-",
      phone: booking.guestPhone || booking.userPhone || booking.phone || booking.guestDetails?.phone || "-",
      email: booking.guestEmail || booking.userEmail || booking.email || booking.guestDetails?.email || "-",
      noOfRooms: booking.rooms || booking.noOfRooms || 0,
      orderedAt,
      roomNumbers: booking.roomNumbers || [],
      status: normalizeBookingStatus(booking),
      packageId: booking.packageId || booking.roomId || null,
      bookingId: booking.bookingId || booking.id,
      hotelUid: booking.hotelUid,
      userId: booking.userId || booking.authUid,
      hotelName: booking.hotelName || booking.hotel?.hotelName || "Hotel",
      roomName: booking.roomName || booking.packageName || "N/A",
      amount,
      amountTHB: booking.amountTHB || amount,
      paymentMethod: booking.paymentMethod || booking.paymentConfirmation?.provider || "N/A",
      isPaymentDone: isHotelPaymentVerified(booking),
      adults: booking.adults ?? booking.guestDetails?.adults ?? 0,
      children: booking.children ?? booking.guestDetails?.children ?? 0,
      nationality: booking.nationality || "N/A",
      nights: booking.nights || 0,
      specialNotes: getBookingSpecialNotes(booking),
    };
  };

  // Bookings table header
  let columns = [
    { property: "name", label: "Guest Name", width: "15%" },
    { property: "phone", label: "Phone", width: "15%" },
    { property: "noOfRooms", label: "Room Quantity", width: "10%" },
    { property: "orderedAt", label: "Ordered At", width: "15%" },
    { property: "roomNumbers", label: "Room Numbers", width: "15%" },
    { property: "status", label: "Status", width: "15%" },
    { property: "action", label: "Action", width: "15%" },
  ];

  // calling createData function with partner's data
  const rows = (bookings) => {
    return bookings?.map((booking) => normalizeRoomBooking(booking)) || [];
  };

  const handleViewBookingDetails = async (id) => {
    setError("");
    const snapshot = await getDoc(doc(roomBookingCollection, id));
    if (snapshot.exists()) {
      const existingData = snapshot.data();
      const checkInDate = existingData?.checkInDate?.seconds
        ? new Date(
          existingData?.checkInDate?.seconds * 1000 +
          existingData?.checkInDate?.nanoseconds / 1000000
        )
        : new Date(existingData?.checkInDate);
      const checkOutDate = existingData?.checkOutDate?.seconds
        ? new Date(
          existingData?.checkOutDate?.seconds * 1000 +
          existingData?.checkOutDate?.nanoseconds / 1000000
        )
        : new Date(existingData?.checkOutDate);
      setBookingDetails({
        ...normalizeRoomBooking({ ...existingData, bookingId: snapshot.id }),
        bookingId: snapshot.id,
        checkInDate: getDate(checkInDate),
        checkOutDate: getDate(checkOutDate),
      });
      setOpenBookingDetailsModal(true);
    }
    // setOpenModal(true);
  };

  const handleViewPackageDetails = async (id) => {
    const snapshot = await getDoc(doc(hotelPackageDetails, id));
    if (snapshot.exists()) {
      const existingData = snapshot.data();
      setPackageDetailss(existingData);
      setOpenPackageDetailsModal(true);
    }
  };

  // const formatPhoneNumber = (value) => {
  //   // Remove all non-numeric characters
  //   let cleaned = value.replace(/\D/g, "");

  //   // Limit to 9 digits
  //   cleaned = cleaned.slice(0, 9);

  //   // Apply spacing format: XX XXX XXXX
  //   let formatted = cleaned;
  //   if (cleaned.length > 2)
  //     formatted = `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
  //   if (cleaned.length > 5)
  //     formatted = `${cleaned.slice(0, 2)} ${cleaned.slice(
  //       2,
  //       5
  //     )} ${cleaned.slice(5)}`;

  //   return formatted;
  // };

  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    setError("");
    if (normalizeBookingStatus(bookingDetails) !== "Pending") {
      setOpenBookingDetailsModal(false);
      return;
    }
    if (!/^\+?\d{8,15}$/.test(data?.managerPhone || "")) {
      return setError("Invalid manager phone number");
    } else if (data?.roomNumbers?.length > bookingDetails?.noOfRooms) {
      return setError("Rooms provided are more than required!");
    } else if (data?.roomNumbers?.length < bookingDetails?.noOfRooms) {
      return setError("Rooms provided are less than required!");
    }
    if (confirm("Check details twice before confirming")) {
      let acceptResult = null;
      try {
        acceptResult = await acceptHotelBookingWithAvailability(
          bookingDetails.bookingId
        );
      } catch (acceptErr) {
        console.error("[PartnerConfirm] Accept/reserve failed", acceptErr);
        const msg =
          acceptErr?.message ||
          "Could not confirm this booking. Please try again.";
        setError(String(msg).replace(/^FirebaseError:\s*/i, ""));
        return;
      }

      const createdAtBackfill = backfillCreatedAt(bookingDetails);
      const updatedDoc = {
        comission: Number(userData.comission || 0),
        managerPhone: data.managerPhone,
        roomNumbers: data.roomNumbers,
        ...(createdAtBackfill && !bookingDetails.createdAt
          ? { createdAt: createdAtBackfill }
          : {}),
      };
      await updateDoc(
        doc(roomBookingCollection, bookingDetails.bookingId),
        updatedDoc
      ).then(async () => {
        setOpenBookingDetailsModal(false);
        const amountDue = Number(acceptResult?.amountDue || 0);
        const payNow = acceptResult?.payNow === true || amountDue > 0;
        const paymentMessage = payNow
          ? amountDue > 0
            ? `Amount due: ฿${amountDue}. Please complete payment from My Bookings.`
            : "Please complete payment from My Bookings."
          : acceptResult?.isPaymentDone === true
            ? "Payment is confirmed. Your stay is booked."
            : isThaiQrHotelPayment(bookingDetails)
              ? "We will verify your Thai QR payment shortly."
              : "Your room booking has been approved.";

        successNotification(
          payNow
            ? "Booking accepted — guest must pay (Unpaid)."
            : "Booking approved."
        );
        setData({ managerPhone: "", roomNumbers: [] });
        await CreateNewNotificationToUser(
          payNow
            ? "Booking accepted — payment required"
            : "Room booking approved!",
          `Hey ${bookingDetails?.name}! your room booking at ${bookingDetails?.hotelName} is approved. ${paymentMessage}`,
          bookingDetails?.userId
        );
      });
    }
  };

  const handleCancelBooking = async (e) => {
    e.preventDefault();
    setError("");
    if (normalizeBookingStatus(bookingDetails) === "Accepted") {
      setOpenBookingDetailsModal(false);
      return;
    }

    if (confirm("Are you sure to cancel this booking?")) {
      const updatedDoc = {
        status: "Canceled",
        bookingStatus: "CANCELED",
        isBookingConfirmed: false,
      };

      await updateDoc(
        doc(roomBookingCollection, bookingDetails.bookingId),
        updatedDoc
      ).then(() => {
        setOpenBookingDetailsModal(false);
        deleteNotification("Booking is cancelled!");
        setData({ managerPhone: "", roomNumbers: [] });
      });
    }
  };

  const handleAddRoomNumber = () => {
    setData((p) => ({ ...p, roomNumbers: [...p.roomNumbers, roomNumber] }));
    setRoomNumber("");
  };

  const handleRemoveRoomNumber = (i) => {
    const { roomNumbers } = data;
    const newRoomNumbers = data.roomNumbers
      .slice(0, i)
      .concat(roomNumbers.slice(i + 1));
    setData((p) => ({ ...p, roomNumbers: newRoomNumbers }));
  };

  // delete canceled booking
  // const handleDelete = (id) => {
  //   askingForDelete().then(async (result) => {
  //     if (result.isConfirmed) {
  //       await deleteDoc(doc(roomBookingCollection, id)).then(() => {
  //         deleteNotification("The booking is deleted successfully.");
  //       });
  //     }
  //   });
  // };

  // close confirm booking modal
  // const handleCloseModal = (e) => {
  //   e.preventDefault();
  //   setData({ managerPhone: "", roomNumbers: [] });
  //   setOpenBookingDetailsModal(false);
  // };

  // custom text field for common data
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
    <div>
      <PageHeading text="Our Bookings" />

      <div className="flex justify-end items-center mb-4">
        <div className="flex gap-2 flex-wrap">
          <form
            onSubmit={(e) => {
              handleDateRangeSubmit(e);
            }}
            className="flex items-end justify-between"
          >
            <fieldset className="px-2 pb-2 border border-black rounded-md">
              <legend className="px-1 text-sm">Start</legend>
              <input
                type="date"
                className="date-input w-[7.5rem] outline-none  bg-transparent"
                placeholder="Select date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                }}
                max={new Date().toISOString().split("T")[0]}
              />
            </fieldset>
            <p className="px-2 pt-1 m-auto"> to </p>
            <fieldset className="px-2 pb-2 border border-black rounded-md">
              <legend className="px-1 text-sm">End</legend>
              <input
                type="date"
                className="date-input w-[7.5rem] outline-none bg-transparent"
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
              className="w-24 py-2 mb-1 ml-2 text-sm font-semibold text-white bg-orange-400 rounded hover:bg-orange-500 focus:outline-none focus:shadow-outline"
            >
              Apply
            </button>
          </form>
          <div className="mb-1 flex items-end">
            <button
              className={` py-2 px-4 rounded text-white font-semibold bg-orange-400 hover:bg-orange-500 focus:outline-none focus:shadow-outline text-sm`}
              onClick={() => {
                setIsRealTime(true), setStartDate(""), setEndDate("");
              }}
            >
              Show Realtime
            </button>
          </div>
        </div>
      </div>

      <Paper sx={{ width: "100%", overflowX: "hidden" }}>
        <TableContainer>
          {loading ? (
            <LoadingContent />
          ) : (
            <Table stickyHeader aria-label="sticky table">
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      key={column.property}
                      align="center"
                      style={{
                        width: column.width,
                        color: "var(--primary-bg)",
                        fontWeight: "bold",
                      }}
                    >
                      {column.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows(isRealTime ? myRoomBookings : matchedBookings).map(
                  (row, i) => {
                    return (
                      <TableRow hover role="checkbox" tabIndex={-1} key={i}>
                        {columns.map((column) => {
                          const value = row[column.property];

                          const date = normalizeDate(row.orderedAt);
                          return (
                            <TableCell key={column.property} align="center">
                              {(column.property === "status" && (
                                <span
                                  className={`${(value === "Pending" &&
                                    "bg-orange-300 text-black") ||
                                    (value === "Accepted" && "bg-green-500") ||
                                    (value === "Canceled" && "bg-red-600")
                                    } text-white  py-1 px-2 rounded`}
                                >
                                  {value}
                                </span>
                              )) ||
                                (column.property === "orderedAt" &&
                                  (date ? getDateAndTime(date) : "N/A")) ||
                                (column.property === "roomNumbers" && (
                                  <div className="flex items-center justify-center flex-wrap gap-1">
                                    {value?.map((item, i) => (
                                      <span
                                        key={i}
                                        className="bg-[var(--primary-bg)] font-semibold opacity-80 text-white p-1 rounded text-xs"
                                      >
                                        {item}
                                      </span>
                                    ))}
                                  </div>
                                )) ||
                                (column.property === "action" && (
                                  <div className="flex gap-1 justify-center">
                                    {/* {row["status"] === 3 && (
                                    <button
                                      onClick={() => handleDelete(row.id)}
                                      className="bg-red-500 text-white p-1 rounded"
                                    >
                                      <DeleteForeverIcon />
                                    </button>
                                  )} */}
                                    <UpdateButton
                                      title={"acknowledge booking"}
                                      handleEdit={() =>
                                        handleViewBookingDetails(row.bookingId)
                                      }
                                    />
                                    {/* {row["status"] !== 3 && (
                                    <button
                                      onClick={() =>
                                        handleViewBookingDetails(row.bookingId)
                                      }
                                      className="bg-orange-500 text-white p-1 rounded-full ml-1"
                                    >
                                      <EditIcon />
                                    </button>
                                  )} */}

                                    {/* <div
                                    onClick={() =>
                                      handleViewPackageDetails(row.packageId)
                                    }
                                  > */}
                                    <ViewDetailsIcon
                                      title="View Package Details"
                                      handleView={handleViewPackageDetails}
                                      id={row.packageId}
                                    />
                                    {/* </div> */}
                                  </div>
                                )) ||
                                value}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  }
                )}
                {(isRealTime ? myRoomBookings : matchedBookings).length ===
                  0 && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <div className="w-full text-center my-5 light-text">
                          No Room Bookings
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
              </TableBody>
            </Table>
          )}
        </TableContainer>
        {!isRealTime && (
          <TablePagination
            rowsPerPageOptions={[10, 25, 100]}
            component="div"
            count={totalPages}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        )}
      </Paper>

      {/* View Booking details and confirm booking modal */}
      <Dialog
        open={openBookingDetailsModal}
        onClose={() => setOpenBookingDetailsModal(false)}
        aria-labelledby="responsive-dialog-title"
      >
        <Box component="form" onSubmit={handleConfirmBooking}>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            Booking Details
          </DialogTitle>
          <IconButton
            aria-label="close"
            onClick={() => {
              setData({ managerPhone: "", roomNumbers: [] });
              setOpenBookingDetailsModal(false);
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
            {/* Stay Info */}
            <div className="bg-neutral-50 p-4 rounded-lg mb-4 border border-neutral-200">
              <h3 className="font-bold text-lg mb-3 text-primary-700 border-b border-neutral-200 pb-2">Stay Information</h3>
              <Grid container spacing={2}>
                {textField("Room Type", bookingDetails?.roomName || "N/A")}
                {textField("Rooms", bookingDetails?.noOfRooms || "N/A")}
                {(bookingDetails?.extraBed || bookingDetails?.extraBedCountRequested != null) && textField(
                  "Extra Beds",
                  `${bookingDetails.extraBedCountRequested ?? (bookingDetails.extraBed ? bookingDetails.rooms || bookingDetails.noOfRooms || 1 : 0)} requested · ${bookingDetails.extraBedCount ?? (bookingDetails.isBookingConfirmed && bookingDetails.extraBed ? bookingDetails.rooms || bookingDetails.noOfRooms || 1 : 0)} applied`
                )}
                {textField("Nights", bookingDetails?.nights || "N/A")}
                {textField("Check In", bookingDetails?.checkInDate || "N/A")}
                {textField("Check Out", bookingDetails?.checkOutDate || "N/A")}
              </Grid>
            </div>

            {/* Guest Info */}
            <div className="bg-neutral-50 p-4 rounded-lg mb-4 border border-neutral-200">
              <h3 className="font-bold text-lg mb-3 text-primary-700 border-b border-neutral-200 pb-2">Guest Information</h3>
              <Grid container spacing={2}>
                {textField("Guest Name", bookingDetails?.name || bookingDetails?.fullName || bookingDetails?.guestDetails?.name || "N/A")}
                {textField("Phone", bookingDetails?.phone || bookingDetails?.guestPhone || bookingDetails?.userPhone || bookingDetails?.guestDetails?.phone || "N/A")}
                {textField("Email", bookingDetails?.email || bookingDetails?.guestEmail || bookingDetails?.userEmail || bookingDetails?.guestDetails?.email || "N/A")}
                {textField("Nationality", bookingDetails?.nationality || "N/A")}
                {bookingDetails?.specialNotes && textField("Special Notes", bookingDetails.specialNotes, true)}
                <Grid item xs={12} sm={6}>
                  <div className="flex gap-2">
                    <p><span className="font-bold">Guests:</span> {bookingDetails?.adults || 0} Adults, {bookingDetails?.children || 0} Children</p>
                  </div>
                </Grid>
              </Grid>
            </div>

            {/* Payment Info */}
            <div className="bg-neutral-50 p-4 rounded-lg mb-4 border border-neutral-200">
              <h3 className="font-bold text-lg mb-3 text-primary-700 border-b border-neutral-200 pb-2">Payment Details</h3>
              <Grid container spacing={2}>
                {textField("Amount (THB)", `฿${bookingDetails?.amountTHB || bookingDetails?.amount || 0}`)}
                {Number(bookingDetails?.roomAmountTHB) > 0 && textField("Room Amount", `฿${bookingDetails.roomAmountTHB}`)}
                {Number(bookingDetails?.extraBedAmountTHB) > 0 && textField("Extra Bed Amount", `฿${bookingDetails.extraBedAmountTHB}`)}
                {bookingDetails?.amountINR && textField("Amount (INR)", `₹${bookingDetails?.amountINR}`)}
                {textField("Payment Method", bookingDetails?.paymentMethod || "N/A")}
                {textField("Customer Invoice", bookingDetails?.customerInvoiceId || "N/A")}
                {textField("Partner Invoice", bookingDetails?.partnerInvoiceId || bookingDetails?.invoiceId || "N/A")}
                {textField("Payment Verification", bookingDetails?.paymentVerificationStatus || bookingDetails?.paymentConfirmation?.status || "N/A")}
                <Grid item xs={12} sm={6}>
                  <div className="flex gap-2 items-center">
                    <span className="font-bold">Payment Status:</span>
                    <span className={`px-2 py-0.5 rounded text-sm font-semibold ${bookingDetails?.isPaymentDone ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                      {bookingDetails?.isPaymentDone ? "PAID" : "UNPAID"}
                    </span>
                  </div>
                </Grid>
              </Grid>
            </div>

            {/* manager information */}
            {bookingDetails?.status === "Pending" && (
              <Grid item xs={12}>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <CountryPhoneInput
                        label="Manager's Number"
                        value={data?.managerPhone}
                        placeholder="Manager's Phone Number"
                        onChange={(e) =>
                          setData((p) => ({
                            ...p,
                            managerPhone: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex-1 flex gap-2 items-center">
                      <TextField
                        label="Add Room Number"
                        type="number"
                        value={roomNumber}
                        placeholder="Add Room Number"
                        onChange={(e) => setRoomNumber(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddRoomNumber();
                          }
                        }}
                        fullWidth
                      />
                      <div
                        onClick={handleAddRoomNumber}
                        className="input-add-btn"
                      >
                        Add
                      </div>
                    </div>
                  </div>
                  {error && (
                    <span className="text-sm text-red-500">{error}</span>
                  )}
                  {data?.roomNumbers.length > 0 && (
                    <h3 className="font-bold text-center">Added Rooms</h3>
                  )}
                  {data.roomNumbers.length > 0 && (
                    <div className="flex gap-2 items-end">
                      <div className="flex items-center justify-center w-full gap-3">
                        {data?.roomNumbers?.map((include, i) => (
                          <Chip
                            label={include}
                            key={i}
                            onDelete={() => handleRemoveRoomNumber(i)}
                          />
                        ))}
                        {/* {data?.roomNumbers?.map((item, i) => (
                          <div
                            key={i}
                            className="bg-[var(--primary-bg)] font-semibold opacity-80 text-white py-1 px-2 rounded text-md relative"
                          >
                            {item}
                            <span
                              onClick={() => handleRemoveRoomNumber(i)}
                              className="bg-red-400 hover:bg-red-500 cursor-pointer text-white p-1 absolute -top-2 -right-2 h-4 w-5 rounded-full flex items-center justify-center"
                            >
                              <CloseIcon
                                fontSize="small"
                                sx={{ stroke: "white" }}
                                className="bg-red-400 font-bold hover:bg-red-500 cursor-pointer text-white p-[0.05rem] rounded-full"
                              />
                            </span>
                          </div>
                        ))} */}
                      </div>
                    </div>
                  )}
                </div>
              </Grid>
            )}

            {bookingDetails?.roomNumbers && (
              <div>
                <h3 className="font-bold text-center">Booked Rooms</h3>
                <div className="flex gap-2 items-end">
                  <div className="flex items-center justify-center w-full gap-3">
                    {bookingDetails?.roomNumbers?.map((item, i) => (
                      <div
                        key={i}
                        className="bg-[var(--primary-bg)] font-semibold opacity-80 text-white py-1 px-2 rounded text-md relative"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <button
              // variant="contained"
              type="submit"
              autoFocus
              className={`add-new-btn ${bookingDetails?.status === "Pending" &&
                "!bg-blue-500 hover:!bg-blue-600"
                }`}
            // sx={{ bgcolor: "blue", color: "white", hover: "none" }}
            >
              {bookingDetails?.status !== "Pending" ? "Close" : "Confirm"}
            </button>
            {bookingDetails?.status === "Pending" && (
              <button
                // variant="contained"
                type="button"
                onClick={(e) => handleCancelBooking(e)}
                autoFocus
                className="add-new-btn !bg-red-500 hover:!bg-red-600"
              // sx={{ bgcolor: "blue", color: "white", hover: "none" }}
              >
                {"Cancel"}
              </button>
            )}
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
            Package : {packageDetails?.packageName}
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
                {/* Room Name */}
                {textField("Package Name", packageDetails?.packageName, true)}
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
                {textField(
                  "Number Of Guests",
                  packageDetails?.numberOfGuests,
                  true
                )}

                {/* Period */}
                {/* {textField("Period", packageDetails?.period, true)} */}
              </Grid>
            </Grid>
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              {/* Description */}
              {textField("Description", packageDetails?.description)}

              {/* Add Amenities */}
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

              {/* Pictures */}
              <Grid item xs={12}>
                <h3 className="font-bold text-[var(--primary-bg)] border-b">
                  Room Pictures
                </h3>
                <div className="flex flex-wrap gap-2 my-2">
                  {packageDetails.pictures?.map((picture, i) => (
                    <div key={i}>
                      <h4 className="text-lg">{picture?.label}</h4>
                      <img
                        src={picture?.url}
                        alt=""
                        className="h-36 w-40 rounded"
                      />
                    </div>
                  ))}
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

export default Bookings;
