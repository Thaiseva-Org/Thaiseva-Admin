import { Chip } from "@mui/material";

const BOOKING_COLORS = {
  Pending: "warning",
  Accepted: "info",
  Confirmed: "info",
  Completed: "success",
  Rejected: "error",
  Canceled: "default",
};

const PAYMENT_COLORS = {
  Unpaid: "default",
  "Partially Paid": "warning",
  Paid: "success",
  Refunded: "secondary",
};

const BookingStatusBadge = ({ status, type = "booking", size = "small" }) => (
  <Chip
    size={size}
    label={status || (type === "payment" ? "Unpaid" : "Pending")}
    color={(type === "payment" ? PAYMENT_COLORS : BOOKING_COLORS)[status] || "default"}
    variant={status === "Pending" || status === "Partially Paid" ? "filled" : "outlined"}
    sx={{ fontWeight: 700 }}
  />
);

export default BookingStatusBadge;
