import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@mui/material";
import PropTypes from "prop-types";

const display = (value) => {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "number" && value > 100000000000)
    return new Date(value).toLocaleDateString();
  if (typeof value === "object") return "—";
  return String(value);
};

export default function SupportBookingDialog({open, booking, loading, error, onClose, onRetry}) {
  const data = booking?.details || {};
  const groups = [
    {
      title: booking?.service === "hotel" ? "Stay information" : "Booking information",
      tone: "blue",
      fields:
        booking?.service === "hotel"
          ? [
              ["Hotel", data.hotelName || booking?.title],
              ["Room type", data.roomName],
              ["Rooms", data.noOfRooms ?? data.rooms],
              ["Nights", data.nights],
              ["Check in", data.checkIn || data.checkInDate || booking?.date],
              ["Check out", data.checkOut || data.checkOutDate],
              ["Confirmed rooms", data.roomsInstant],
              ["Pending rooms", data.roomsPending],
              ["Extra beds requested", data.extraBedCountRequested],
              ["Extra beds applied", data.extraBedCount],
            ]
          : [
              ["Service", booking?.service],
              ["Booking", booking?.title],
              ["Date", booking?.date],
              ["Pickup", data.pickUpLocation || data.pickupLocation],
              ["Drop-off", data.dropOffLocation || data.dropoffLocation],
              ["Start", data.startDate || data.pickUpDate || data.pickUpTime],
              ["End", data.endDate || data.dropOffDate],
            ],
    },
    {
      title: "Guest information",
      tone: "purple",
      fields: [
        ["Name", data.name || data.fullName],
        ["Phone", data.phone],
        ["Email", data.email],
        ["Nationality", data.nationality],
        ["Adults", data.adults],
        ["Children", data.children],
        ["Special notes", data.specialNotes],
      ],
    },
    {
      title: "Payment information",
      tone: "emerald",
      fields: [
        ["Amount (THB)", data.amountTHB ?? data.amount],
        ["Amount (INR)", data.amountINR],
        ["Room amount (THB)", data.roomAmountTHB],
        ["Extra beds (THB)", data.extraBedAmountTHB],
        ["Amount paid", data.amountPaid],
        ["Amount due", data.amountDue],
        ["Payment method", data.paymentMethod],
        ["Payment status", data.paymentStatus],
      ],
    },
    {
      title: "Reference details",
      tone: "orange",
      fields: [
        ["Booking reference", booking?.reference],
        ["Booking ID", booking?.id],
        ["Manager phone", data.managerPhone],
      ],
    },
  ];
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    emerald: "bg-emerald-50 text-emerald-700",
    orange: "bg-orange-50 text-orange-700",
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      aria-labelledby="support-booking-title"
      PaperProps={{sx: {borderRadius: 6, bgcolor: "#f8fafc"}}}
    >
      <DialogTitle
        id="support-booking-title"
        sx={{
          p: 3,
          pr: 8,
          borderBottom: "1px solid #e2e8f0",
          background: "linear-gradient(135deg,#fff,#f1f5f9)",
        }}
      >
        <span className="block text-xl font-extrabold text-slate-800">Booking Details</span>
        <span className="block mt-1 text-xs text-slate-500">
          {booking?.reference ? `Reference: ${booking.reference}` : "Loading booking…"}
        </span>
        <IconButton
          aria-label="Close booking details"
          onClick={onClose}
          sx={{position: "absolute", top: 16, right: 16}}
        >
          ×
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{p: 3}}>
        {loading ? (
          <div
            role="status"
            className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500"
          >
            <CircularProgress size={22} />
            Loading booking details…
          </div>
        ) : error ? (
          <div role="alert" className="py-10 text-center">
            <p className="mb-4 text-red-700">{error}</p>
            <Button onClick={onRetry}>Try again</Button>
          </div>
        ) : (
          booking && (
            <>
              <div className="my-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                  Booking status
                </h3>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-sm font-semibold text-blue-700">
                  {booking.status || "Not available"}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {groups.map((group) => (
                  <section
                    key={group.title}
                    className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                  >
                    <h3
                      className={`mb-4 rounded-lg px-3 py-2 text-sm font-bold ${tones[group.tone]}`}
                    >
                      {group.title}
                    </h3>
                    <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
                      {group.fields.map(([label, value]) => (
                        <div
                          key={label}
                          className={
                            label === "Special notes" || label === "Booking ID" || label === "Email"
                              ? "col-span-2"
                              : ""
                          }
                        >
                          <dt className="mb-1 text-xs text-slate-500">{label}</dt>
                          <dd className="whitespace-pre-wrap break-words text-sm font-medium text-slate-800">
                            {display(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>
            </>
          )
        )}
      </DialogContent>
      <DialogActions sx={{px: 3, py: 2, borderTop: "1px solid #e2e8f0", bgcolor: "white"}}>
        <Button onClick={onClose} variant="outlined">
          Close
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
