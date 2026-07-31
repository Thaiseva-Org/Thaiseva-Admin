import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
} from "@mui/material";

const LifecycleDialog = ({ open, action, busy, error, onClose, onSubmit }) => {
  const [form, setForm] = useState({ reason: "", notes: "", showReasonToCustomer: false, additionalCharges: 0 });
  useEffect(() => {
    if (open) setForm({ reason: "", notes: "", showReasonToCustomer: false, additionalCharges: 0 });
  }, [open, action]);
  const needsReason = ["reject", "cancel"].includes(action);
  const title = action === "complete" ? "Mark booking completed" : action === "reject" ? "Reject booking" : "Cancel booking";

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers className="space-y-4">
        {error && <Alert severity="error">{error}</Alert>}
        {needsReason && <TextField autoFocus required fullWidth label={`${action === "reject" ? "Rejection" : "Cancellation"} reason`} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />}
        {action === "complete" && <TextField fullWidth type="number" label="Additional charges" value={form.additionalCharges} onChange={(event) => setForm({ ...form, additionalCharges: event.target.value })} inputProps={{ min: 0, step: 0.01 }} />}
        <TextField fullWidth multiline minRows={3} label={action === "complete" ? "Completion notes" : "Internal notes"} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        {action === "reject" && <FormControlLabel control={<Checkbox checked={form.showReasonToCustomer} onChange={(event) => setForm({ ...form, showReasonToCustomer: event.target.checked })} />} label="Show rejection reason to the customer" />}
        {action === "cancel" && <Alert severity="warning">If payment was received, record the required partial or full refund separately. Original payment history will be preserved.</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Close</Button>
        <Button color={action === "complete" ? "success" : "error"} variant="contained" disabled={busy || (needsReason && !form.reason.trim())} onClick={() => onSubmit(form)}>
          {busy ? "Saving…" : title}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LifecycleDialog;
