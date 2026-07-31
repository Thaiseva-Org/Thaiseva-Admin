import { useState } from "react";
import { Button } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import TransportBookingsPage from "../../../../../components/bookings/TransportBookingsPage";
import AddVanBookingModal from "./AddVanBookingModal";

const VanBookings = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TransportBookingsPage
        kind="van"
        title="Van Bookings"
        subtitle="Manage mobile van requests and manual admin bookings in one workflow"
        icon="🚐"
        headerAction={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Manual van booking
          </Button>
        }
      />
      <AddVanBookingModal open={open} handleClose={() => setOpen(false)} />
    </>
  );
};

export default VanBookings;
