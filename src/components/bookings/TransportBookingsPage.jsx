import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  IconButton,
  TablePagination,
  Tooltip,
} from "@mui/material";
import {
  CancelOutlined,
  CheckCircleOutline,
  DoneAll,
  EditOutlined,
  PaymentsOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { onSnapshot } from "firebase/firestore";
import PageHeading from "../PageHeading";
import {
  carBookingsCollection,
  selfDriveBookingCollection,
  vanBookingsCollection,
} from "../../firebase/firebase.config";
import { getWorkflowError, runBookingAction } from "../../services/TransportWorkflow";
import {
  BOOKING_STATUSES,
  formatMoney,
  formatTransportDate,
  normalizeTransportBooking,
  validActionsFor,
} from "../../utils/transportBooking";
import AssignmentDialog from "./AssignmentDialog";
import BookingDetailsDialog from "./BookingDetailsDialog";
import BookingStatusBadge from "./BookingStatusBadge";
import LifecycleDialog from "./LifecycleDialog";
import PaymentDialog from "./PaymentDialog";
import TransportBookingFilters from "./TransportBookingFilters";
import EditBookingDialog from "./EditBookingDialog";

const defaultFilters = {
  status: "Pending",
  paymentStatus: "All",
  search: "",
  bookingDateFrom: "",
  bookingDateTo: "",
  travelDate: "",
  vehicleType: "All",
  company: "All",
  provider: "All",
};

const sameDay = (date, value) => !value || (date && date.toISOString().slice(0, 10) === value);
const withinRange = (date, from, to) => {
  if (!from && !to) return true;
  if (!date) return false;
  const value = date.toISOString().slice(0, 10);
  return (!from || value >= from) && (!to || value <= to);
};
const unique = (values) => [...new Set(values.filter((value) => value && value !== "—"))].sort();

const TransportBookingsPage = ({ kind, title, subtitle, icon, headerAction }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filters, setFilters] = useState(defaultFilters);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selected, setSelected] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setLoading(true);
    setLoadError("");
    const sources = kind === "van"
      ? [
        [vanBookingsCollection, "manual"],
        [carBookingsCollection, "mobile"],
      ]
      : [[kind === "taxi" ? carBookingsCollection : selfDriveBookingCollection, "mobile"]];
    const results = new Map();
    const publish = () => {
      if (results.size < sources.length) return;
      const combined = [...results.values()].flat().filter((booking) => {
        const isVan = String(booking.transportType || booking.vehicleType || "").toLowerCase().includes("van");
        return kind === "taxi" ? !isVan : kind === "van" && booking.source === "mobile" ? isVan : true;
      });
      combined.sort((a, b) => {
        if (a.bookingStatus === "Pending" && b.bookingStatus !== "Pending") return -1;
        if (a.bookingStatus !== "Pending" && b.bookingStatus === "Pending") return 1;
        return (b.createdDateValue?.getTime() || 0) - (a.createdDateValue?.getTime() || 0);
      });
      setBookings(combined);
      setLoading(false);
    };
    const unsubscribers = sources.map(([collectionRef, source]) => onSnapshot(
      collectionRef,
      (snapshot) => {
        results.set(source, snapshot.docs.map((doc) => normalizeTransportBooking({ id: doc.id, ...doc.data() }, kind, source)));
        publish();
      },
      (error) => {
        console.error(`Unable to load ${kind} bookings`, error);
        setLoadError("Bookings could not be loaded. Check your connection and access permissions.");
        setLoading(false);
      }
    ));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [kind]);

  useEffect(() => {
    setSelected((current) => {
      if (!current) return current;
      return bookings.find((booking) => booking.id === current.id && booking.source === current.source) || current;
    });
  }, [bookings]);

  const counts = useMemo(() => Object.fromEntries(BOOKING_STATUSES.map((status) => [
    status,
    status === "All" ? bookings.length : bookings.filter((booking) => booking.bookingStatus === status).length,
  ])), [bookings]);

  const filtered = useMemo(() => bookings.filter((booking) => {
    const term = filters.search.trim().toLowerCase();
    const matchesSearch = !term || [
      booking.customerName,
      booking.customerPhone,
      booking.bookingReference,
      booking.pickup,
      booking.destination,
    ].some((value) => String(value || "").toLowerCase().includes(term));
    return matchesSearch &&
      (filters.status === "All" || booking.bookingStatus === filters.status) &&
      (filters.paymentStatus === "All" || booking.paymentStatus === filters.paymentStatus) &&
      (filters.vehicleType === "All" || booking.vehicleType === filters.vehicleType) &&
      (filters.company === "All" || booking.companyName === filters.company) &&
      (filters.provider === "All" || booking.driverName === filters.provider || booking.providerSnapshot?.name === filters.provider) &&
      withinRange(booking.createdDateValue, filters.bookingDateFrom, filters.bookingDateTo) &&
      sameDay(booking.travelDateValue, filters.travelDate);
  }), [bookings, filters]);

  useEffect(() => setPage(0), [filters]);

  const openDialog = (booking, name) => {
    setSelected(booking);
    setActionError("");
    setSuccess("");
    setDialog(name);
  };
  const closeDialog = () => {
    if (busy) return;
    setDialog(null);
    setActionError("");
  };

  const submitAction = async (action, values = {}, keepDialog = null) => {
    if (!selected) return;
    setBusy(true);
    setActionError("");
    try {
      await runBookingAction({
        bookingKind: kind,
        bookingId: selected.id,
        source: selected.source,
        action,
        ...values,
      });
      setSuccess(`${action === "recordPayment" ? "Payment" : action === "recordRefund" ? "Refund" : "Booking"} updated successfully.`);
      setDialog(keepDialog);
    } catch (error) {
      console.error("Transport booking action failed", error);
      setActionError(getWorkflowError(error));
    } finally {
      setBusy(false);
    }
  };

  const rowActions = (booking) => validActionsFor(booking.bookingStatus);

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <PageHeading text={title} subtitle={subtitle} icon={icon} />
        {headerAction}
      </div>
      {success && <Alert severity="success" onClose={() => setSuccess("")} sx={{ mb: 2 }}>{success}</Alert>}
      {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between"><div><p className="text-primary-100 text-sm font-medium mb-1">Total Bookings</p><p className="text-3xl font-bold">{bookings.length}</p></div><div className="bg-white/20 p-3 rounded-lg text-3xl">{icon}</div></div>
        </div>
        <div className="bg-gradient-to-br from-warning-500 to-warning-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between"><div><p className="text-warning-100 text-sm font-medium mb-1">Pending</p><p className="text-3xl font-bold">{counts.Pending || 0}</p></div><div className="bg-white/20 p-3 rounded-lg text-3xl">⏳</div></div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between"><div><p className="text-orange-100 text-sm font-medium mb-1">Waiting for Payment</p><p className="text-3xl font-bold">{bookings.filter((booking) => ["Accepted", "Completed"].includes(booking.bookingStatus) && booking.remainingBalance > 0).length}</p></div><div className="bg-white/20 p-3 rounded-lg text-3xl">💳</div></div>
        </div>
        <div className="bg-gradient-to-br from-success-500 to-success-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between"><div><p className="text-success-100 text-sm font-medium mb-1">Paid</p><p className="text-3xl font-bold">{bookings.filter((booking) => booking.paymentStatus === "Paid").length}</p></div><div className="bg-white/20 p-3 rounded-lg text-3xl">✅</div></div>
        </div>
      </div>
      <TransportBookingFilters
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(defaultFilters)}
        counts={counts}
        companies={unique(bookings.map((booking) => booking.companyName))}
        providers={unique(bookings.map((booking) => booking.driverName !== "—" ? booking.driverName : booking.providerSnapshot?.name))}
        vehicleTypes={unique(bookings.map((booking) => booking.vehicleType))}
      />

      <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden relative">
        {loading ? (
          <div className="py-20 grid place-items-center"><CircularProgress /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                <tr>
                  {[
                    "Reference", "Customer", "Trip", "Travel date", "Assignment", "Amount", "Booking", "Payment", "Actions",
                  ].map((label) => <th key={label} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">{label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((booking) => {
                  const actions = rowActions(booking);
                  return (
                    <tr key={`${booking.source}-${booking.id}`} className="hover:bg-primary-50/50">
                      <td className="px-4 py-4 text-sm font-semibold">{booking.bookingReference}<span className="block text-[10px] uppercase text-neutral-400">{booking.source}</span></td>
                      <td className="px-4 py-4 text-sm"><span className="font-medium">{booking.customerName}</span><span className="block text-xs text-neutral-500">{booking.customerPhone}</span></td>
                      <td className="px-4 py-4 text-sm max-w-[190px]"><span className="block truncate" title={booking.pickup}>{booking.pickup}</span><span className="block truncate text-neutral-500" title={booking.destination}>→ {booking.destination}</span></td>
                      <td className="px-4 py-4 text-sm whitespace-nowrap">{formatTransportDate(booking.travelDateValue)}</td>
                      <td className="px-4 py-4 text-sm"><span>{booking.companyName}</span><span className="block text-xs text-neutral-500">{booking.driverName} · {booking.registrationNumber}</span></td>
                      <td className="px-4 py-4 text-sm font-semibold whitespace-nowrap">{formatMoney(booking.finalAmount)}<span className="block text-xs font-normal text-neutral-500">Due {formatMoney(booking.remainingBalance)}</span></td>
                      <td className="px-4 py-4"><BookingStatusBadge status={booking.bookingStatus} /></td>
                      <td className="px-4 py-4"><BookingStatusBadge status={booking.paymentStatus} type="payment" /></td>
                      <td className="px-4 py-4"><div className="flex items-center gap-0.5">
                        <Tooltip title="View details"><IconButton size="small" onClick={() => openDialog(booking, "details")}><VisibilityOutlined fontSize="small" /></IconButton></Tooltip>
                        {actions.includes("edit") && <Tooltip title="Edit booking"><IconButton size="small" onClick={() => openDialog(booking, "editDetails")}><EditOutlined fontSize="small" /></IconButton></Tooltip>}
                        {actions.includes("accept") && <Tooltip title="Accept / confirm"><IconButton color="success" size="small" onClick={() => openDialog(booking, "assignment")}><CheckCircleOutline fontSize="small" /></IconButton></Tooltip>}
                        {actions.includes("assignment") && <Tooltip title="Edit assignment"><IconButton size="small" onClick={() => openDialog(booking, "editAssignment")}><EditOutlined fontSize="small" /></IconButton></Tooltip>}
                        {actions.includes("payment") && booking.remainingBalance > 0 && <Tooltip title="Record payment"><IconButton color="primary" size="small" onClick={() => openDialog(booking, "payment")}><PaymentsOutlined fontSize="small" /></IconButton></Tooltip>}
                        {actions.includes("complete") && <Tooltip title="Mark completed"><IconButton color="success" size="small" onClick={() => openDialog(booking, "complete")}><DoneAll fontSize="small" /></IconButton></Tooltip>}
                        {actions.includes("reject") && <Tooltip title="Reject"><IconButton color="error" size="small" onClick={() => openDialog(booking, "reject")}><CancelOutlined fontSize="small" /></IconButton></Tooltip>}
                        {actions.includes("cancel") && <Tooltip title="Cancel"><IconButton color="error" size="small" onClick={() => openDialog(booking, "cancel")}><CancelOutlined fontSize="small" /></IconButton></Tooltip>}
                      </div></td>
                    </tr>
                  );
                })}
                {!filtered.length && <tr><td colSpan={9} className="py-16 text-center text-neutral-500"><p className="text-lg font-semibold">No bookings match these filters</p><p className="text-sm mt-1">Reset the filters or select another status.</p><Button sx={{ mt: 2 }} onClick={() => setFilters(defaultFilters)}>Reset filters</Button></td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <TablePagination
          component="div"
          count={filtered.length}
          page={Math.min(page, Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1))}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, value) => setPage(value)}
          onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
        />
      </div>

      <AssignmentDialog open={["assignment", "editAssignment"].includes(dialog)} booking={selected} kind={kind} edit={dialog === "editAssignment"} busy={busy} error={actionError} onClose={closeDialog} onSubmit={(values) => submitAction(dialog === "editAssignment" ? "updateAssignment" : "accept", values)} />
      <EditBookingDialog open={dialog === "editDetails"} booking={selected} busy={busy} error={actionError} onClose={closeDialog} onSubmit={(values) => submitAction("editDetails", values)} />
      <PaymentDialog open={dialog === "payment"} booking={selected} busy={busy} error={actionError} onClose={closeDialog} onSubmit={(values) => submitAction("recordPayment", values)} />
      <PaymentDialog open={dialog === "refund"} booking={selected} refund busy={busy} error={actionError} onClose={closeDialog} onSubmit={(values) => submitAction("recordRefund", values)} />
      <LifecycleDialog open={["complete", "reject", "cancel"].includes(dialog)} action={dialog} busy={busy} error={actionError} onClose={closeDialog} onSubmit={(values) => submitAction(dialog, values)} />
      <BookingDetailsDialog
        open={dialog === "details"}
        booking={selected}
        busy={busy}
        error={actionError}
        onClose={closeDialog}
        onRefund={() => setDialog("refund")}
        onVerifyDocument={(documentType, verificationStatus) => submitAction("verifyDocument", { documentType, verificationStatus }, "details")}
      />
    </div>
  );
};

export default TransportBookingsPage;
