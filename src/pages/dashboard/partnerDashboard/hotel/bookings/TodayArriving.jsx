import {
  Box,
  Button,
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
import {
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import LoadingContent from "../../../../../components/LoadingContent";
import UpdateButton from "../../../../../components/UpdateButton";
import ViewDetailsIcon from "../../../../../components/ViewDetailsIcon";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import { useNotifications } from "../../../../../contextAPIs/NotificationsProvider";
import {
  hotelPackageDetails,
  roomBookingCollection,
} from "../../../../../firebase/firebase.config";
import { normalizeHotelBookingStatus } from "../../../../../utils/bookingStatus";
import { backfillCreatedAt } from "../../../../../utils/bookingTimestamps";
import {
  calculateDiscountPrice,
  deleteNotification,
  getDate,
  successNotification,
} from "../../../../../utils/utils";
import { getBookingSpecialNotes } from "../../../../../utils/bookingNotes";
import { acceptHotelBookingWithAvailability } from "../../../../../services/HotelBookingAccept";

const TodayArriving = () => {
  const { loadingData } = useContext(PartnerContext);
  const { user } = useContext(AuthContext);
  const { CreateNewNotificationToUser } = useNotifications();
  const [matchedBookings, setMatchedBookings] = useState([]);
  const [openPackageDetailsModal, setOpenPackageDetailsModal] = useState(false);
  const [openBookingDetailsModal, setOpenBookingDetailsModal] = useState(false);
  const [bookingDetails, setBookingDetails] = useState({});
  const [packageDetails, setPackageDetailss] = useState({});
  const [data, setData] = useState({ managerPhone: "", roomNumbers: [] });
  const [roomNumber, setRoomNumber] = useState("");
  const [error, setError] = useState("");

  const normalizeBookingStatus = normalizeHotelBookingStatus;

  const normalizeDate = (value) => {
    if (!value || value === "-") return null;
    if (value.seconds) {
      return new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000);
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const isSameDay = (value, targetDate) => {
    const date = normalizeDate(value);
    if (!date) return false;

    return (
      date.getFullYear() === targetDate.getFullYear() &&
      date.getMonth() === targetDate.getMonth() &&
      date.getDate() === targetDate.getDate()
    );
  };

  const normalizeRoomBooking = (booking = {}) => ({
    ...booking,
    name: booking.fullName || booking.guestDetails?.name || booking.name || "-",
    phone: booking.guestPhone || booking.userPhone || booking.phone || booking.guestDetails?.phone || "-",
    email: booking.guestEmail || booking.userEmail || booking.email || booking.guestDetails?.email || "-",
    noOfRooms: booking.rooms || booking.noOfRooms || 0,
    orderedAt: booking.createdAt || booking.orderedAt || booking.timestamp || null,
    roomNumbers: booking.roomNumbers || [],
    status: normalizeBookingStatus(booking),
    packageId: booking.packageId || booking.roomId || booking.hotelUid,
    bookingId: booking.bookingId || booking.id,
    managerPhone: booking.managerPhone || "-",
    checkout: getDate(normalizeDate(booking.checkOutDate || booking.checkOut)),
    hotelUid: booking.hotelUid,
    userId: booking.userId || booking.authUid,
    hotelName: booking.hotelName || booking.hotel?.hotelName || "Hotel",
    roomName: booking.roomName || booking.packageName || "N/A",
    amount: booking.amountTHB || booking.amount || booking.subtotal || 0,
    amountTHB: booking.amountTHB || booking.amount || booking.subtotal || 0,
    paymentMethod: booking.paymentMethod || booking.paymentConfirmation?.provider || "N/A",
    isPaymentDone: Boolean(booking.isPaymentDone || booking.paymentConfirmation?.status === "paid"),
    adults: booking.adults ?? booking.guestDetails?.adults ?? 0,
    children: booking.children ?? booking.guestDetails?.children ?? 0,
    nationality: booking.nationality || "N/A",
    nights: booking.nights || 0,
    specialNotes: getBookingSpecialNotes(booking),
  });

  useEffect(() => {
    const loadBookings = async (user) => {
      const todayStart = new Date();
      todayStart.setDate(todayStart.getDate());
      todayStart.setHours(0, 0, 0, 0);
      try {
        const result = await getDocs(
          query(
            roomBookingCollection,
            where("hotelUid", "==", user?.uid)
          )
        );

        if (!result.empty) {
          const list = result.docs.map((doc) => ({
            ...doc.data(),
            bookingId: doc.id,
          })).filter((booking) => (
            normalizeBookingStatus(booking) === "Accepted" &&
            isSameDay(booking.checkInDate || booking.checkIn, todayStart)
          ));
          setMatchedBookings(list);
        } else {
          setMatchedBookings([]);
        }
      } catch (error) {
        console.error("Error fetching bookings:", error);
      }
    };

    user && loadBookings(user);
  }, [user]);

  // Bookings table header
  let columns = [
    { property: "name", label: "Guest Name", width: "15%" },
    { property: "phone", label: "Phone", width: "15%" },
    { property: "noOfRooms", label: "Room Quantity", width: "10%" },
    { property: "orderedAt", label: "Booking Date", width: "15%" },
    { property: "roomNumbers", label: "Rooms Alloted", width: "15%" },
    { property: "managerPhone", label: "Manager Contact", width: "15%" },
    { property: "checkout", label: "Check Out Date", width: "15%" },
  ];

  // calling createData function with partner's data
  const rows = matchedBookings?.map((booking) => {
    const row = normalizeRoomBooking(booking);
    return {
      ...row,
      orderedAt: row.orderedAt ? getDate(normalizeDate(row.orderedAt)) : "N/A",
    };
  });

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
        console.error("[TodayArriving] Accept/reserve failed", acceptErr);
        const msg =
          acceptErr?.message ||
          "Could not confirm this booking. Please try again.";
        setError(String(msg).replace(/^FirebaseError:\s*/i, ""));
        return;
      }

      const createdAtBackfill = backfillCreatedAt(bookingDetails);
      const updatedDoc = {
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
        successNotification(
          payNow
            ? "Booking accepted - guest must pay (Unpaid)."
            : "Booking approved."
        );
        setData({ managerPhone: "", roomNumbers: [] });
        await CreateNewNotificationToUser(
          payNow
            ? "Booking accepted - payment required"
            : "Room booking approved!",
          payNow
            ? `Hey ${bookingDetails?.name}! your room booking at ${bookingDetails?.hotelName} is approved. Amount due: ฿${amountDue || "-"}. Please complete payment from My Bookings.`
            : `Hey ${bookingDetails?.name}! your room booking at ${bookingDetails?.hotelName} is approved.`,
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
            {label.includes("Price") && "$"}
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

      <Paper sx={{ width: "100%", overflowX: "hidden" }}>
        <TableContainer>
          {loadingData ? (
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
                {rows.map((row, i) => {
                  return (
                    <TableRow hover role="checkbox" tabIndex={-1} key={i}>
                      {columns.map((column) => {
                        const value = row[column.property];

                        return (
                          <TableCell key={column.property} align="center">
                            {(column.property === "status" && (
                              <span
                                className={`${
                                  (value === "Pending" &&
                                    "bg-orange-300 text-black") ||
                                  (value === "Accepted" && "bg-green-500") ||
                                  (value === "Canceled" && "bg-red-600")
                                } text-white  py-1 px-2 rounded`}
                              >
                                {value}
                              </span>
                            )) ||
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
                })}
              </TableBody>
            </Table>
          )}
        </TableContainer>
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
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              {/* Guest Name */}
              {textField(
                "Guest Name",
                bookingDetails?.name || bookingDetails?.fullName || bookingDetails?.guestDetails?.name || "not available"
              )}

              {/* Phone */}
              {textField(
                "Phone",
                bookingDetails?.phone || bookingDetails?.guestPhone || bookingDetails?.userPhone || bookingDetails?.guestDetails?.phone || "not available"
              )}

              {/* Email */}
              {textField(
                "Email",
                bookingDetails?.email || bookingDetails?.guestEmail || bookingDetails?.userEmail || bookingDetails?.guestDetails?.email || "not available"
              )}

              {/* Room Quantity */}
              {textField(
                "Room Quantity",
                bookingDetails?.noOfRooms || "not available"
              )}

              {textField("Room Type", bookingDetails?.roomName || "not available")}
              {textField("Nights", bookingDetails?.nights || "not available")}
              {textField("Payment Status", bookingDetails?.isPaymentDone ? "PAID" : "UNPAID")}
              {bookingDetails?.specialNotes && textField("Special Notes", bookingDetails.specialNotes, true)}
              {textField("Customer Invoice", bookingDetails?.customerInvoiceId || "N/A")}

              {/* Check In Date */}
              {textField(
                "Check In",
                bookingDetails?.checkInDate || "not available"
              )}

              {/* Check Out Date */}
              {textField(
                "Check Out",
                bookingDetails?.checkOutDate || "not available"
              )}
              <Grid item xs={12} sm={6}></Grid>
            </Grid>

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
                        {data?.roomNumbers?.map((item, i) => (
                          <div
                            key={i}
                            className="bg-[blue] text-white py-1 px-2 rounded text-lg relative"
                          >
                            {item}
                            <span
                              onClick={() => handleRemoveRoomNumber(i)}
                              className="bg-red-400 hover:bg-red-500 cursor-pointer text-white p-1 absolute -top-2 -right-2 h-5 w-5 rounded-full flex items-center justify-center"
                            >
                              x
                            </span>
                          </div>
                        ))}
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
                        className="bg-[blue] text-white py-1 px-2 rounded text-lg relative"
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
              className={`add-new-btn ${
                bookingDetails?.status === "Pending" &&
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
                {textField("Period", packageDetails?.period, true)}
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

export default TodayArriving;
