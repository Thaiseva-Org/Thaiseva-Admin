import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";

const toLocalInput = (date) => {
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const EditBookingDialog = ({ open, booking, busy, error, onClose, onSubmit }) => {
  const [form, setForm] = useState({ customerName: "", customerPhone: "", pickup: "", destination: "", travelAt: "", notes: "" });
  useEffect(() => {
    if (open && booking) setForm({
      customerName: booking.customerName || "",
      customerPhone: booking.customerPhone || "",
      pickup: booking.pickup === "—" ? "" : booking.pickup,
      destination: booking.destination === "—" ? "" : booking.destination,
      travelAt: toLocalInput(booking.travelDateValue),
      notes: booking.notes || "",
    });
  }, [open, booking]);
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  const valid = form.customerName.trim() && form.customerPhone.trim() && form.pickup.trim() && form.destination.trim();
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit pending booking</DialogTitle>
      <DialogContent dividers><div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        {error && <Alert severity="error" sx={{ gridColumn: "1 / -1" }}>{error}</Alert>}
        <TextField required label="Customer name" value={form.customerName} onChange={set("customerName")} />
        <TextField required label="Customer phone" value={form.customerPhone} onChange={set("customerPhone")} />
        <TextField required label="Pickup" value={form.pickup} onChange={set("pickup")} />
        <TextField required label="Destination" value={form.destination} onChange={set("destination")} />
        <TextField type="datetime-local" label="Travel date and time" value={form.travelAt} onChange={set("travelAt")} InputLabelProps={{ shrink: true }} sx={{ gridColumn: { sm: "1 / -1" } }} />
        <TextField multiline minRows={2} label="Internal notes" value={form.notes} onChange={set("notes")} sx={{ gridColumn: { sm: "1 / -1" } }} />
      </div></DialogContent>
      <DialogActions><Button onClick={onClose} disabled={busy}>Close</Button><Button variant="contained" disabled={busy || !valid} onClick={() => onSubmit(form)}>{busy ? "Saving…" : "Save details"}</Button></DialogActions>
    </Dialog>
  );
};

export default EditBookingDialog;
