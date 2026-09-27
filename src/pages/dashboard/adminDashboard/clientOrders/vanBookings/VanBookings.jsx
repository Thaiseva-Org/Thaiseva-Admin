import TransportBookingsPage from "../../../../../components/bookings/TransportBookingsPage";

/**
 * Van bookings admin list.
 * Vans come from car_bookings with transportType "van" (no separate van API).
 */
const VanBookings = () => (
  <TransportBookingsPage
    kind="van"
    title="Van Bookings"
    subtitle="Review, assign, collect payment, and complete van bookings"
    icon="🚐"
  />
);

export default VanBookings;
