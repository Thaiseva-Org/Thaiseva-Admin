import PrivateIdentityDocument from "../PrivateIdentityDocument";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Tab,
  Tabs,
} from "@mui/material";
import { useEffect, useState } from "react";
import BookingStatusBadge from "./BookingStatusBadge";
import {
  formatMoney,
  formatTransportDate,
} from "../../utils/transportBooking";

const Detail = ({ label, value }) => (
  <div className="min-w-0">
    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
    <p className="text-sm text-neutral-900 break-words mt-0.5">{value || "-"}</p>
  </div>
);

const BookingDetailsDialog = ({ open, booking, busy, error, onClose, onVerifyDocument, onRefund }) => {
  const [tab, setTab] = useState(0);
  useEffect(() => {
    if (open) setTab(0);
  }, [open, booking?.id]);
  if (!booking) return null;
  const commission = Number(booking.businessCommission) || booking.finalAmount * (Number(booking.commissionPercentage) || 0) / 100;
  const payout = Number(booking.providerPayout) || booking.finalAmount - commission;
  const activities = booking.activityHistory.length ? booking.activityHistory : booking.statusHistory;
  const documentsEditable = booking.bookingStatus === "Pending";

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle className="flex flex-wrap items-center gap-2">
        <span className="grow">Booking {booking.bookingReference}</span>
        <BookingStatusBadge status={booking.bookingStatus} />
        <BookingStatusBadge status={booking.paymentStatus} type="payment" />
      </DialogTitle>
      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ px: 2, borderTop: "1px solid #eee" }}>
        <Tab label="Overview" />
        <Tab label={`Payments (${booking.paymentTransactions.length + booking.refundTransactions.length})`} />
        <Tab label={`Activity (${activities.length})`} />
        {booking.kind === "selfDrive" && <Tab label="Documents" />}
      </Tabs>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {tab === 0 && (
          <div className="space-y-5">
            <section>
              <h3 className="font-bold text-primary-700 mb-3">Customer and trip</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Detail label="Customer" value={booking.customerName} />
                <Detail label="Phone" value={booking.customerPhone} />
                <Detail label="Pickup" value={booking.pickup} />
                <Detail label="Destination" value={booking.destination} />
                <Detail label="Travel date" value={formatTransportDate(booking.travelDateValue)} />
                <Detail label="Booked at" value={formatTransportDate(booking.createdDateValue)} />
                <Detail label="Booking source" value={booking.source} />
                <Detail label="Vehicle type" value={booking.vehicleType} />
              </div>
            </section>
            <Divider />
            <section>
              <h3 className="font-bold text-primary-700 mb-3">Assignment</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Detail label="Company / provider" value={booking.companyName !== "-" ? booking.companyName : booking.providerSnapshot?.name} />
                <Detail label="Driver" value={booking.driverName} />
                <Detail label="Vehicle" value={booking.vehicleName} />
                <Detail label="Registration" value={booking.registrationNumber} />
              </div>
            </section>
            <Divider />
            <section>
              <h3 className="font-bold text-primary-700 mb-3">Financial summary</h3>
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                <Detail label="Final amount" value={formatMoney(booking.finalAmount)} />
                <Detail label="Commission %" value={`${Number(booking.commissionPercentage ?? booking.comission) || 0}%`} />
                <Detail label="Business commission" value={formatMoney(commission)} />
                <Detail label="Provider payout" value={formatMoney(payout)} />
                <Detail label="Received" value={formatMoney(booking.amountReceived)} />
                <Detail label="Remaining" value={formatMoney(booking.remainingBalance)} />
              </div>
            </section>
            {(booking.notes || booking.description || booking.specialNotes) && <><Divider /><Detail label="Notes" value={booking.notes || booking.description || booking.specialNotes} /></>}
          </div>
        )}
        {tab === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-neutral-50 p-4">
              <Detail label="Final" value={formatMoney(booking.finalAmount)} />
              <Detail label="Received" value={formatMoney(booking.amountReceived)} />
              <Detail label="Remaining" value={formatMoney(booking.remainingBalance)} />
            </div>
            {[...booking.paymentTransactions, ...booking.refundTransactions]
              .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
              .map((transaction) => (
                <div key={transaction.id || `${transaction.type}-${transaction.createdAt?.seconds}`} className="border rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Detail label="Type" value={transaction.type || "Payment"} />
                  <Detail label="Amount" value={formatMoney(transaction.amount)} />
                  <Detail label="Method" value={transaction.paymentMethod} />
                  <Detail label="Reference" value={transaction.transactionReference} />
                  <Detail label="Received date" value={formatTransportDate(transaction.receivedDate)} />
                  <Detail label="Received by" value={transaction.receivedBy?.name} />
                  <div className="md:col-span-2"><Detail label="Notes" value={transaction.notes} /></div>
                </div>
              ))}
            {!booking.paymentTransactions.length && !booking.refundTransactions.length && <p className="py-10 text-center text-neutral-500">No payments have been recorded.</p>}
            {booking.amountReceived > booking.amountRefunded && <Button color="secondary" variant="outlined" onClick={onRefund}>Record refund</Button>}
          </div>
        )}
        {tab === 2 && (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-neutral-200">
            {activities.map((entry, index) => (
              <div key={`${entry.timestamp?.seconds || index}-${entry.action}`} className="relative rounded-xl border p-4 before:absolute before:-left-[1.35rem] before:top-5 before:w-3 before:h-3 before:rounded-full before:bg-primary-500">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-semibold">{entry.action}</p>
                  <p className="text-xs text-neutral-500">{formatTransportDate(entry.timestamp)}</p>
                </div>
                <p className="text-sm text-neutral-600">{entry.previousStatus} → {entry.newStatus}</p>
                <p className="text-sm">By {entry.changedBy?.name || "System"}{entry.reason ? ` · ${entry.reason}` : ""}</p>
                {entry.notes && <p className="text-sm text-neutral-500 mt-1">{entry.notes}</p>}
              </div>
            ))}
            {!activities.length && <p className="py-10 text-center text-neutral-500">No activity has been recorded yet.</p>}
          </div>
        )}
        {booking.kind === "selfDrive" && tab === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {!documentsEditable && <Alert severity="info" sx={{ gridColumn: "1 / -1" }}>Document verification is read-only after the booking is accepted or closed.</Alert>}
            {[
              ["licence", "Driving licence", booking.licenceLink || booking.licenseLink || booking.drivingLicenceLink || booking.drivingLicenseLink || booking.licenceUrl || booking.licenseUrl || booking.drivingLicenceUrl || booking.drivingLicenseUrl || booking.licence || booking.license, booking.licenceVerificationStatus],
              ["passport", "Passport", booking.passportLink || booking.passportDocumentLink || booking.passportUrl || booking.passportDocumentUrl || booking.passport || booking.passportImage, booking.passportVerificationStatus],
            ].map(([type, label, link, status]) => (
              <div key={type} className="border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2"><h3 className="font-bold">{label}</h3><BookingStatusBadge status={status} /></div>
                {link ? <PrivateIdentityDocument path={link} label={label} /> : <p className="h-52 grid place-items-center bg-neutral-50 rounded-lg text-neutral-500">Not uploaded</p>}
                <div className="flex gap-2">
                  <Button disabled={busy || !link || !documentsEditable} size="small" color="success" variant="outlined" onClick={() => onVerifyDocument(type, "Verified")}>Verify</Button>
                  <Button disabled={busy || !link || !documentsEditable} size="small" color="error" variant="outlined" onClick={() => onVerifyDocument(type, "Rejected")}>Reject</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose} disabled={busy}>Close</Button></DialogActions>
    </Dialog>
  );
};

export default BookingDetailsDialog;
