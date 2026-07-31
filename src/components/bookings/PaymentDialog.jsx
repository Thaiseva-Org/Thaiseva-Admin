import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { PAYMENT_METHODS, formatMoney } from "../../utils/transportBooking";

const initial = {
  amount: "",
  paymentMethod: "Cash",
  transactionReference: "",
  receivedDate: new Date().toISOString().slice(0, 10),
  notes: "",
};

const PaymentDialog = ({ open, booking, refund = false, busy, error, onClose, onSubmit }) => {
  const [form, setForm] = useState(initial);

  useEffect(() => {
    if (open) setForm(initial);
  }, [open, refund]);

  const maximum = refund
    ? Math.max(0, booking?.amountReceived - booking?.amountRefunded)
    : booking?.remainingBalance;
  const amount = Number(form.amount);
  const invalid = !Number.isFinite(amount) || amount <= 0 || amount > maximum;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{refund ? "Record refund" : "Record payment"}</DialogTitle>
      <DialogContent dividers className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-sm bg-neutral-50 rounded-lg p-3">
          <div><span className="text-neutral-500 block">Final</span>{formatMoney(booking?.finalAmount)}</div>
          <div><span className="text-neutral-500 block">Received</span>{formatMoney(booking?.amountReceived)}</div>
          <div><span className="text-neutral-500 block">{refund ? "Refundable" : "Remaining"}</span>{formatMoney(maximum)}</div>
        </div>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          autoFocus
          fullWidth
          required
          type="number"
          label={refund ? "Refund amount" : "Amount received"}
          value={form.amount}
          onChange={(event) => setForm({ ...form, amount: event.target.value })}
          inputProps={{ min: 0.01, max: maximum, step: 0.01 }}
          error={Boolean(form.amount) && invalid}
          helperText={Boolean(form.amount) && invalid ? `Enter an amount up to ${formatMoney(maximum)}.` : ""}
        />
        <FormControl fullWidth required>
          <InputLabel>Payment method</InputLabel>
          <Select value={form.paymentMethod} label="Payment method" onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>
            {PAYMENT_METHODS.map((method) => <MenuItem key={method} value={method}>{method}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField fullWidth label="Transaction reference" value={form.transactionReference} onChange={(event) => setForm({ ...form, transactionReference: event.target.value })} />
        <TextField fullWidth type="date" label="Received date" value={form.receivedDate} onChange={(event) => setForm({ ...form, receivedDate: event.target.value })} InputLabelProps={{ shrink: true }} />
        <TextField fullWidth multiline minRows={2} label="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>Close</Button>
        <Button disabled={busy || invalid || maximum <= 0} variant="contained" onClick={() => onSubmit(form)}>
          {busy ? "Saving…" : refund ? "Record refund" : "Record payment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentDialog;
