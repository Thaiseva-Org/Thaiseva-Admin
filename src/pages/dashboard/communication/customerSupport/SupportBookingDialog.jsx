import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
} from "@mui/material";
import {
  HotelIcon,
  CloseIcon,
  PersonIcon,
  PaymentsIcon,
  BedroomParentIcon,
  MeetingRoomIcon,
  CalendarMonthIcon,
  PhoneIcon,
  EmailIcon,
  PublicIcon,
  AttachMoneyIcon,
  CreditCardIcon,
  VerifiedUserIcon,
} from "@icons";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";

const display = (value) => {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "number" && value > 100000000000)
    return new Date(value).toLocaleDateString();
  if (typeof value === "object") return "—";
  return String(value);
};

export default function SupportBookingDialog({ open, booking, loading, error, onClose, onRetry }) {
  const navigate = useNavigate();
  const data = booking?.details || {};
  const status = booking?.status || data.status || "Confirmed";
  const isHotel = booking?.service === "hotel" || !!data.hotelName;

  const renderDetailItem = (label, value, icon, fullWidth = false, toneClass = "text-primary-600 bg-primary-50") => (
    <Grid item xs={12} sm={fullWidth ? 12 : 6} key={label}>
      <div className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-neutral-50 transition-all duration-200 border border-transparent hover:border-neutral-200 group">
        <div className={`mt-0.5 p-2 rounded-lg group-hover:scale-110 transition-transform duration-200 shadow-xs shrink-0 ${toneClass}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-0.5">
            {label}
          </p>
          <p className="text-sm font-semibold text-neutral-800 break-words leading-snug">
            {display(value)}
          </p>
        </div>
      </div>
    </Grid>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      aria-labelledby="support-booking-title"
      PaperProps={{
        style: { borderRadius: 24, padding: 0, backgroundColor: "#F8FAFC" },
      }}
    >
      <DialogTitle
        id="support-booking-title"
        sx={{
          m: 0,
          p: 3,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "linear-gradient(135deg, #fff 0%, #f1f5f9 100%)",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-white rounded-xl shadow-sm text-primary-600 border border-neutral-100">
            <HotelIcon />
          </div>
          <div>
            <span className="block font-extrabold text-xl text-slate-800 tracking-tight">
              Booking Details
            </span>
            <span className="block text-xs font-medium text-slate-500 mt-0.5">
              Ref: {booking?.reference || booking?.id || "N/A"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 pr-8">
          <span
            className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-xs border ${
              status === "Accepted" || status === "confirmed"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : status === "Pending"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            {(status === "Accepted" || status === "confirmed") && <span className="mr-1.5">✓</span>}
            {status}
          </span>
        </div>

        <IconButton
          aria-label="close"
          onClick={onClose}
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
      </DialogTitle>

      <DialogContent sx={{ p: 3, bgcolor: "#f8fafc" }}>
        {loading ? (
          <div
            role="status"
            className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500"
          >
            <CircularProgress size={24} sx={{ color: "#2563eb" }} />
            <span className="font-medium">Loading booking details…</span>
          </div>
        ) : error ? (
          <div role="alert" className="py-12 text-center">
            <p className="mb-4 text-rose-700 font-medium">{error}</p>
            <Button
              onClick={onRetry}
              variant="contained"
              sx={{ bgcolor: "#2563eb", borderRadius: "10px", textTransform: "none" }}
            >
              Try again
            </Button>
          </div>
        ) : (
          booking && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Stay / Service Info */}
              <div className="bg-white p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-50">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <BedroomParentIcon fontSize="small" />
                  </div>
                  <h3 className="font-bold text-base text-slate-800">
                    {isHotel ? "Stay Information" : "Booking Information"}
                  </h3>
                </div>
                <Grid container spacing={1}>
                  {isHotel ? (
                    <>
                      {renderDetailItem("Hotel Name", data.hotelName || booking?.title, <HotelIcon fontSize="small" />, false, "text-blue-600 bg-blue-50")}
                      {renderDetailItem("Room Type", data.roomName || "N/A", <MeetingRoomIcon fontSize="small" />, false, "text-blue-600 bg-blue-50")}
                      {renderDetailItem("Rooms", data.noOfRooms ?? data.rooms ?? 1, <BedroomParentIcon fontSize="small" />, false, "text-blue-600 bg-blue-50")}
                      {renderDetailItem("Nights", data.nights || "N/A", <CalendarMonthIcon fontSize="small" />, false, "text-blue-600 bg-blue-50")}
                      {renderDetailItem("Check In", data.checkIn || data.checkInDate || booking?.date, <CalendarMonthIcon fontSize="small" />, false, "text-blue-600 bg-blue-50")}
                      {renderDetailItem("Check Out", data.checkOut || data.checkOutDate, <CalendarMonthIcon fontSize="small" />, false, "text-blue-600 bg-blue-50")}
                      {(data.roomsInstant != null || data.roomsPending != null) &&
                        renderDetailItem(
                          "Instant / Pending",
                          `${data.roomsInstant ?? 0} confirmed · ${data.roomsPending ?? 0} pending`,
                          <BedroomParentIcon fontSize="small" />,
                          false,
                          "text-amber-600 bg-amber-50"
                        )}
                    </>
                  ) : (
                    <>
                      {renderDetailItem("Service", booking?.service, <HotelIcon fontSize="small" />, false, "text-blue-600 bg-blue-50")}
                      {renderDetailItem("Title", booking?.title, <MeetingRoomIcon fontSize="small" />, false, "text-blue-600 bg-blue-50")}
                      {renderDetailItem("Date", booking?.date, <CalendarMonthIcon fontSize="small" />, false, "text-blue-600 bg-blue-50")}
                      {renderDetailItem("Pickup", data.pickUpLocation || data.pickupLocation, <HotelIcon fontSize="small" />, false, "text-blue-600 bg-blue-50")}
                      {renderDetailItem("Drop-off", data.dropOffLocation || data.dropoffLocation, <HotelIcon fontSize="small" />, false, "text-blue-600 bg-blue-50")}
                      {renderDetailItem("Start", data.startDate || data.pickUpDate || data.pickUpTime, <CalendarMonthIcon fontSize="small" />, false, "text-blue-600 bg-blue-50")}
                      {renderDetailItem("End", data.endDate || data.dropOffDate, <CalendarMonthIcon fontSize="small" />, false, "text-blue-600 bg-blue-50")}
                    </>
                  )}
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
                  {renderDetailItem("Guest Name", data.name || data.fullName || "N/A", <PersonIcon fontSize="small" />, false, "text-purple-600 bg-purple-50")}
                  {renderDetailItem("Phone", data.phone || "N/A", <PhoneIcon fontSize="small" />, false, "text-purple-600 bg-purple-50")}
                  {renderDetailItem("Email", data.email || "N/A", <EmailIcon fontSize="small" />, false, "text-purple-600 bg-purple-50")}
                  {renderDetailItem("Nationality", data.nationality || "N/A", <PublicIcon fontSize="small" />, false, "text-purple-600 bg-purple-50")}
                  {renderDetailItem("Guests", `${data.adults || 0} Adults, ${data.children || 0} Children`, <PersonIcon fontSize="small" />, false, "text-purple-600 bg-purple-50")}
                  {data.specialNotes &&
                    renderDetailItem("Special Notes", data.specialNotes, <MeetingRoomIcon fontSize="small" />, true, "text-purple-600 bg-purple-50")}
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
                  {renderDetailItem("Amount (THB)", `฿${data.amountTHB ?? data.amount ?? 0}`, <AttachMoneyIcon fontSize="small" />, false, "text-emerald-600 bg-emerald-50")}
                  {data.amountINR &&
                    renderDetailItem("Amount (INR)", `₹${data.amountINR}`, <AttachMoneyIcon fontSize="small" />, false, "text-emerald-600 bg-emerald-50")}
                  {data.roomAmountTHB &&
                    renderDetailItem("Room Amount", `฿${data.roomAmountTHB}`, <AttachMoneyIcon fontSize="small" />, false, "text-emerald-600 bg-emerald-50")}
                  {data.amountPaid != null &&
                    renderDetailItem("Amount Paid", `฿${data.amountPaid}`, <AttachMoneyIcon fontSize="small" />, false, "text-emerald-600 bg-emerald-50")}
                  {data.amountDue != null &&
                    renderDetailItem("Amount Due", `฿${data.amountDue}`, <AttachMoneyIcon fontSize="small" />, false, "text-amber-600 bg-amber-50")}
                  {renderDetailItem("Payment Method", data.paymentMethod || "N/A", <CreditCardIcon fontSize="small" />, false, "text-emerald-600 bg-emerald-50")}
                  {renderDetailItem("Payment Status", data.paymentStatus || "N/A", <VerifiedUserIcon fontSize="small" />, false, "text-emerald-600 bg-emerald-50")}
                </Grid>
              </div>

              {/* Reference Info */}
              <div className="bg-white p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-50">
                  <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                    <HotelIcon fontSize="small" />
                  </div>
                  <h3 className="font-bold text-base text-slate-800">Reference & Admin</h3>
                </div>
                <Grid container spacing={1}>
                  {renderDetailItem("Booking Reference", booking?.reference || "N/A", <HotelIcon fontSize="small" />, false, "text-orange-600 bg-orange-50")}
                  {renderDetailItem("Booking ID", booking?.id || "N/A", <HotelIcon fontSize="small" />, false, "text-orange-600 bg-orange-50")}
                  {data.managerPhone &&
                    renderDetailItem("Manager Phone", data.managerPhone, <PhoneIcon fontSize="small" />, false, "text-orange-600 bg-orange-50")}
                </Grid>
              </div>
            </div>
          )
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: "1px solid #e5e5e5", bgcolor: "white", gap: 1.5 }}>
        {isHotel && (
          <Button
            variant="contained"
            onClick={() => {
              onClose();
              navigate("/dashboard/room-bookings");
            }}
            sx={{
              borderRadius: "10px",
              textTransform: "none",
              fontWeight: 600,
              bgcolor: "#2563eb",
              "&:hover": { bgcolor: "#1d4ed8" },
              px: 3,
            }}
          >
            Open in Room Bookings
          </Button>
        )}
        <Button
          onClick={onClose}
          variant="outlined"
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
  );
}

SupportBookingDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  booking: PropTypes.object,
  loading: PropTypes.bool,
  error: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onRetry: PropTypes.func.isRequired,
};
