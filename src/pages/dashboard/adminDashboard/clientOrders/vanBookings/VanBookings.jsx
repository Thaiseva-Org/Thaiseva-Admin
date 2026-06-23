import {
    TablePagination,
    IconButton,
    TextField,
    InputAdornment,
    Chip,
    Dialog,
    ToggleButton,
    ToggleButtonGroup,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Button,
    Grid,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Typography
} from "@mui/material";
import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    where,
    updateDoc
} from "firebase/firestore";
import { MdAdd, MdDelete, MdEdit, MdVisibility, MdCheck, MdClose } from "react-icons/md";
import { Search, ViewList, GridView } from "@mui/icons-material";
import { useEffect, useState } from "react";
import LoadingContent from "../../../../../components/LoadingContent";
import PageHeading from "../../../../../components/PageHeading";
import { vanBookingsCollection, carBookingsCollection } from "../../../../../firebase/firebase.config";

import {
    askingForDelete,
    deleteNotification,
    successNotification,
    getDateAndTime,
    dateCalculator,
    timeCalculator,
    formatPhoneNumber
} from "../../../../../utils/utils";
import { updateHourlyEarnings, updateMonthlyEarnings } from "../../../../../services/Earning";
import AddVanBookingModal from "./AddVanBookingModal";
import { useNotifications } from "../../../../../contextAPIs/NotificationsProvider";
import { getBookingSpecialNotes } from "../../../../../utils/bookingNotes";

const VanBookings = () => {
    const { CreateNewNotificationToUser } = useNotifications();
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(true);
    const [bookings, setBookings] = useState([]);
    const [matchedBookings, setMatchedBookings] = useState([]);
    const [viewMode, setViewMode] = useState('list');
    const [openAddModal, setOpenAddModal] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [isEdit, setIsEdit] = useState(false);
    const [statusFilter, setStatusFilter] = useState("All");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [searchText, setSearchText] = useState("");

    const [openConfirmModal, setOpenConfirmModal] = useState(false);
    const [confirmBookingDetails, setConfirmBookingDetails] = useState({
        Driver: { name: "", phone: "" },
        vehicleDetails: { vehicle: "", vehicleNumber: "" },
        AmountOffered: "",
        comission: 0,
        status: "Accepted",
    });
    const [confirmError, setConfirmError] = useState({ for: "", text: "" });

    // Filtering Logic
    const filterBookings = () => {
        let filtered = bookings;

        // Text Search
        if (searchText) {
            const lower = searchText.toLowerCase();
            filtered = filtered.filter(b =>
                b.companyName?.toLowerCase().includes(lower) ||
                b.guestName?.toLowerCase().includes(lower) ||
                b.vanNumber?.toLowerCase().includes(lower) ||
                b.pickupLocation?.toLowerCase().includes(lower) ||
                b.dropLocation?.toLowerCase().includes(lower)
            );
        }

        // Status Filter
        if (statusFilter !== "All") {
            filtered = filtered.filter(b => b.status === statusFilter);
        }

        // Date Filter (Booking Date)
        if (dateFrom && dateTo) {
            const from = new Date(dateFrom).getTime();
            const to = new Date(dateTo).getTime();

            filtered = filtered.filter(b => {
                const bDateStr = b.bookingDate || b.createdAt;
                if (!bDateStr) return false;

                // Handle Firebase Timestamp or ISO string
                const bTime = (bDateStr.seconds ? bDateStr.seconds * 1000 : new Date(bDateStr).getTime());

                return bTime >= from && bTime <= to + 86400000; // +1 day to include end date fully
            });
        }

        setMatchedBookings(filtered);
    };

    useEffect(() => {
        filterBookings();
    }, [bookings, searchText, statusFilter, dateFrom, dateTo]);

    const [vanData, setVanData] = useState([]);
    const [carData, setCarData] = useState([]);

    useEffect(() => {
        // Realtime listener for Van Bookings (Manual)
        const q = query(vanBookingsCollection, orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, source: 'manual' }));
            setVanData(list);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        // Realtime listener for Taxi Bookings (Mobile) - Filter for Vans
        const q = query(carBookingsCollection, orderBy("timestamp", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    source: 'mobile',
                    // Map Taxi fields to Van fields
                    companyName: "Mobile Request",
                    vanType: data.transportType || "Taxi Van",
                    vanNumber: "N/A",
                    pickupLocation: data.pickup,
                    dropLocation: data.drop,
                    bookingDate: data.timestamp, // Use creation time as booking date for now
                    guestName: data.name,
                    reqTime: data.time // Keep original time
                };
            });
            // Filter only Van related bookings
            const vans = list.filter(b => b.transportType?.toLowerCase().includes('van'));
            setCarData(vans);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        // Merge and sort
        const merged = [...vanData, ...carData].sort((a, b) => {
            // Helper to get milliseconds
            const getTime = (date) => {
                if (!date) return 0;
                if (date.seconds) return date.seconds * 1000; // Firebase Timestamp
                return new Date(date).getTime(); // ISO String or Date
            };
            return getTime(b.bookingDate) - getTime(a.bookingDate); // Descending
        });

        setBookings(merged);
        // setMatchedBookings(merged); // Handled by filter effect
        setLoading(false);
    }, [vanData, carData]);

    const handleChangePage = (_, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };



    const handleSearch = (text) => {
        setSearchText(text);
    };

    const handleDelete = async (row) => {
        askingForDelete().then(async (result) => {
            if (result.isConfirmed) {
                const collectionRef = row.source === 'mobile' ? carBookingsCollection : vanBookingsCollection;
                await deleteDoc(doc(collectionRef, row.id));
                deleteNotification("Booking deleted successfully.");
            }
        });
    };

    const handleUpdateStatus = async (row, newStatus) => {
        try {
            const collectionRef = row.source === 'mobile' ? carBookingsCollection : vanBookingsCollection;
            const updatedStatus = row.source === 'mobile' && newStatus === 'Cancelled' ? 'Canceled' : newStatus;
            await updateDoc(doc(collectionRef, row.id), { status: updatedStatus });

            if (newStatus === "Confirmed" || newStatus === "Accepted") {
                const finalPrice = row.price || row.AmountOffered || 0;
                await updateHourlyEarnings(finalPrice, "Vans");
                await updateMonthlyEarnings(finalPrice, "Vans");
            }

            // Notification for Mobile Users
            if (row.source === 'mobile' && row.userId) {
                const title = newStatus === 'Confirmed' || newStatus === 'Accepted' ? "Van Booking Confirmed" : "Van Booking Cancelled";
                const message = newStatus === 'Confirmed' || newStatus === 'Accepted'
                    ? `Your van booking from ${row.pickupLocation} is confirmed.`
                    : `Your van booking from ${row.pickupLocation} has been cancelled.`;

                await CreateNewNotificationToUser(title, message, row.userId);
            }

            successNotification(`Booking marked as ${newStatus}`);
        } catch (err) {
            console.error(err);
        }
    };

    const handleConfirmMobileBooking = async () => {
        setConfirmError({ for: "", text: "" });
        if (confirmBookingDetails.Driver.name.trim().length < 1) {
            setConfirmError({ for: "driverName", text: "Driver name is required." });
            return;
        }
        if (confirmBookingDetails.Driver.phone.trim().length < 1) {
            setConfirmError({ for: "driverPhone", text: "Driver number is required." });
            return;
        }
        if (confirmBookingDetails.vehicleDetails.vehicle.trim().length < 1) {
            setConfirmError({ for: "vehicle", text: "Vehicle name is required." });
            return;
        }
        if (confirmBookingDetails.vehicleDetails.vehicleNumber.trim().length < 1) {
            setConfirmError({ for: "vehicleNumber", text: "Vehicle number is required." });
            return;
        }
        if (confirmBookingDetails.AmountOffered.toString().trim().length < 1) {
            setConfirmError({ for: "amount", text: "Amount is required." });
            return;
        }
        if (confirmBookingDetails.comission.toString().trim().length < 1) {
            setConfirmError({ for: "comission", text: "Commission is required." });
            return;
        }

        if (confirm("Do you want to proceed with confirming this booking?")) {
            try {
                await updateDoc(doc(carBookingsCollection, confirmBookingDetails.id), {
                    Driver: confirmBookingDetails.Driver,
                    vehicleDetails: confirmBookingDetails.vehicleDetails,
                    AmountOffered: confirmBookingDetails.AmountOffered,
                    comission: confirmBookingDetails.comission,
                    status: "Accepted",
                });

                await updateHourlyEarnings(confirmBookingDetails.AmountOffered, "Vans");
                await updateHourlyEarnings(confirmBookingDetails.AmountOffered, "Vans", confirmBookingDetails.Driver.phone);
                await updateMonthlyEarnings(confirmBookingDetails.AmountOffered, "Vans");
                await updateMonthlyEarnings(confirmBookingDetails.AmountOffered, "Vans", confirmBookingDetails.Driver.phone);

                if (confirmBookingDetails.userId) {
                    await CreateNewNotificationToUser(
                        "Van booking confirm!",
                        `Hey ${confirmBookingDetails.name}! your van booking is confirmed!`,
                        confirmBookingDetails.userId
                    );
                }

                successNotification("Booking confirmed successfully.");
                setOpenConfirmModal(false);
            } catch (err) {
                console.error(err);
            }
        }
    };

    const columns = [
        { id: "companyName", label: "Van Company", width: "15%" },
        { id: "vanDetails", label: "Van Details", width: "15%" },
        { id: "route", label: "Route", width: "20%" },
        { id: "datetime", label: "Date/Time", width: "15%" },
        { id: "guest", label: "Guest/Agent", width: "15%" },
        { id: "status", label: "Status", width: "10%" },
        { id: "action", label: "Action", width: "10%" },
    ];

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'confirmed': return 'success';
            case 'accepted': return 'success';
            case 'pending': return 'warning';
            case 'cancelled': return 'error';
            case 'canceled': return 'error';
            default: return 'default';
        }
    };

    return (
        <div className="animate-fade-in">
            <PageHeading
                text="Van Bookings"
                subtitle="Manage van reservations and schedules"
                icon="📅"
            />

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
                <div className="flex gap-4 w-full md:w-auto">
                    <TextField
                        placeholder="Search bookings..."
                        onChange={(e) => handleSearch(e.target.value)}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><Search /></InputAdornment>
                        }}
                        sx={{ flexGrow: 1, bgcolor: 'white', borderRadius: '12px', minWidth: '300px' }}
                    />
                    <FormControl sx={{ minWidth: 120, bgcolor: 'white', borderRadius: '12px' }}>
                        <InputLabel>Status</InputLabel>
                        <Select
                            value={statusFilter}
                            label="Status"
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <MenuItem value="All">All</MenuItem>
                            <MenuItem value="Pending">Pending</MenuItem>
                            <MenuItem value="Confirmed">Confirmed</MenuItem>
                            <MenuItem value="Cancelled">Cancelled</MenuItem>
                        </Select>
                    </FormControl>

                    {/* Date Filters */}
                    <TextField
                        type="date"
                        label="From Date"
                        InputLabelProps={{ shrink: true }}
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        sx={{ bgcolor: 'white', borderRadius: '12px' }}
                    />
                    <TextField
                        type="date"
                        label="To Date"
                        InputLabelProps={{ shrink: true }}
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        sx={{ bgcolor: 'white', borderRadius: '12px' }}
                    />

                    <button
                        onClick={() => {
                            const today = new Date();
                            const next7 = new Date(today);
                            next7.setDate(today.getDate() + 7);
                            setDateFrom(today.toISOString().split('T')[0]);
                            setDateTo(next7.toISOString().split('T')[0]);
                        }}
                        className="px-4 py-2 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg border border-blue-200 font-medium transition-colors"
                    >
                        Next 7 Days
                    </button>

                    {(dateFrom || dateTo || statusFilter !== 'All' || searchText) && (
                        <button
                            onClick={() => {
                                setDateFrom(""); setDateTo(""); setStatusFilter("All"); setSearchText("");
                            }}
                            className="px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg border border-red-200"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>

                <button
                    className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
                    onClick={() => { setIsEdit(false); setSelectedBooking(null); setOpenAddModal(true); }}
                >
                    + New Booking
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
                {loading ? <LoadingContent /> : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                                <tr>
                                    {columns.map(col => (
                                        <th key={col.id} className="px-6 py-4 text-center text-sm font-semibold uppercase">{col.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200">
                                {matchedBookings
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((row, i) => (
                                        <tr key={i} className="hover:bg-primary-50 text-sm">
                                            <td className="px-6 py-4 text-center font-medium">{row.companyName}</td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{row.vanType}</span>
                                                    <span className="text-xs text-neutral-500">{row.vanNumber}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col text-xs">
                                                    <span><strong className="text-green-600">From:</strong> {row.pickupLocation}</span>
                                                    <span><strong className="text-red-600">To:</strong> {row.dropLocation}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {getDateAndTime(row.bookingDate)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col">
                                                    <span>
                                                        {row.guestName}
                                                        {row.passengers?.length > 0 && <span className="text-xs font-bold text-primary-600 ml-1">(+{row.passengers.length})</span>}
                                                    </span>
                                                    <span className="text-xs text-neutral-500">Ag: {row.agentName || 'None'}</span>
                                                    {getBookingSpecialNotes(row) && (
                                                        <span className="text-xs text-neutral-500">Note: {getBookingSpecialNotes(row)}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <Chip label={row.status || 'Pending'} color={getStatusColor(row.status || 'Pending')} size="small" />
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center gap-1">
                                                    {/* Status Actions */}
                                                    {(!row.status || row.status?.toLowerCase() === 'pending') && (
                                                        <>
                                                            <IconButton 
                                                                size="small" 
                                                                color="success" 
                                                                onClick={() => {
                                                                    if (row.source === 'mobile') {
                                                                        setConfirmBookingDetails({
                                                                            id: row.id,
                                                                            name: row.guestName || "",
                                                                            contact: row.guestPhone || row.contact || "",
                                                                            pickup: row.pickupLocation || "",
                                                                            drop: row.dropLocation || "",
                                                                            transportType: row.vanType || "",
                                                                            time: row.reqTime || "",
                                                                            timestamp: row.bookingDate || null,
                                                                            userId: row.userId || "",
                                                                            Driver: { name: "", phone: "" },
                                                                            vehicleDetails: { vehicle: "", vehicleNumber: "" },
                                                                            AmountOffered: "",
                                                                            comission: 0,
                                                                            status: "Accepted"
                                                                        });
                                                                        setOpenConfirmModal(true);
                                                                    } else {
                                                                        handleUpdateStatus(row, "Confirmed");
                                                                    }
                                                                }} 
                                                                title="Confirm"
                                                            >
                                                                <MdCheck />
                                                            </IconButton>
                                                            <IconButton size="small" color="error" onClick={() => handleUpdateStatus(row, "Cancelled")} title="Cancel">
                                                                <MdClose />
                                                            </IconButton>
                                                        </>
                                                    )}

                                                    <IconButton size="small" color="primary" onClick={() => { setSelectedBooking(row); setOpenAddModal(true); }} title="Edit"><MdEdit /></IconButton>
                                                    <IconButton size="small" color="default" onClick={() => handleDelete(row)}><MdDelete /></IconButton>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                {matchedBookings.length === 0 && (
                                    <tr><td colSpan={7} className="text-center py-10 text-neutral-500">No Bookings Found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                <TablePagination
                    component="div"
                    count={matchedBookings.length}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                />
            </div>

            {openAddModal && (
                <AddVanBookingModal
                    open={openAddModal}
                    handleClose={() => { setOpenAddModal(false); setSelectedBooking(null); }}
                    bookingData={selectedBooking}
                />
            )}

            {/* Confirm Mobile Booking Modal */}
            <Dialog
                open={openConfirmModal}
                onClose={() => {
                    setOpenConfirmModal(false);
                    setConfirmError({ for: "", text: "" });
                }}
                fullWidth
                maxWidth="md"
                PaperProps={{ sx: { borderRadius: "16px" } }}
            >
                <Box>
                    <DialogTitle sx={{ m: 0, p: 2, borderBottom: "1px solid #eee", fontSize: "1.25rem", fontWeight: "bold" }}>
                        Confirm Mobile Van Booking
                        <IconButton
                            onClick={() => {
                                setOpenConfirmModal(false);
                                setConfirmError({ for: "", text: "" });
                            }}
                            sx={{ position: "absolute", right: 8, top: 8, color: "grey.500" }}
                        >
                            <MdClose />
                        </IconButton>
                    </DialogTitle>

                    <DialogContent dividers sx={{ p: 3 }}>
                        <Grid container spacing={3}>
                            {/* Customer Details */}
                            <Grid item xs={12}>
                                <Typography variant="subtitle2" sx={{ color: "primary.main", fontWeight: "bold", borderBottom: "1px solid #f0f0f0", pb: 1, mb: 1 }}>
                                    CUSTOMER DETAILS
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="body2"><span className="font-bold">Guest Name:</span> {confirmBookingDetails.name || "N/A"}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="body2"><span className="font-bold">Guest Phone:</span> {confirmBookingDetails.contact || "N/A"}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="body2"><span className="font-bold">Pickup Location:</span> {confirmBookingDetails.pickup || "N/A"}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="body2"><span className="font-bold">Drop Location:</span> {confirmBookingDetails.drop || "N/A"}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="body2"><span className="font-bold">Vehicle Type:</span> {confirmBookingDetails.transportType || "N/A"}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="body2"><span className="font-bold">Required Time:</span> {confirmBookingDetails.time || "N/A"}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="body2">
                                    <span className="font-bold">Booking Time:</span> {confirmBookingDetails.timestamp ? `${dateCalculator(confirmBookingDetails.timestamp)} ${timeCalculator(confirmBookingDetails.timestamp)}` : "N/A"}
                                </Typography>
                            </Grid>

                            {/* Driver Details */}
                            <Grid item xs={12}>
                                <Typography variant="subtitle2" sx={{ color: "primary.main", fontWeight: "bold", borderBottom: "1px solid #f0f0f0", pb: 1, mb: 1, mt: 2 }}>
                                    DRIVER ASSIGNMENT
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Driver Name"
                                    fullWidth
                                    value={confirmBookingDetails.Driver.name}
                                    error={confirmError.for === "driverName"}
                                    helperText={confirmError.for === "driverName" && confirmError.text}
                                    onChange={(e) => setConfirmBookingDetails(prev => ({
                                        ...prev,
                                        Driver: { ...prev.Driver, name: e.target.value }
                                    }))}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Driver Phone"
                                    fullWidth
                                    value={confirmBookingDetails.Driver.phone}
                                    error={confirmError.for === "driverPhone"}
                                    helperText={confirmError.for === "driverPhone" && confirmError.text}
                                    onChange={(e) => setConfirmBookingDetails(prev => ({
                                        ...prev,
                                        Driver: { ...prev.Driver, phone: formatPhoneNumber(e.target.value) }
                                    }))}
                                />
                            </Grid>

                            {/* Vehicle Details */}
                            <Grid item xs={12}>
                                <Typography variant="subtitle2" sx={{ color: "primary.main", fontWeight: "bold", borderBottom: "1px solid #f0f0f0", pb: 1, mb: 1, mt: 2 }}>
                                    VEHICLE DETAILS
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Vehicle/Van Name"
                                    fullWidth
                                    value={confirmBookingDetails.vehicleDetails.vehicle}
                                    error={confirmError.for === "vehicle"}
                                    helperText={confirmError.for === "vehicle" && confirmError.text}
                                    onChange={(e) => setConfirmBookingDetails(prev => ({
                                        ...prev,
                                        vehicleDetails: { ...prev.vehicleDetails, vehicle: e.target.value }
                                    }))}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Plate Number"
                                    fullWidth
                                    value={confirmBookingDetails.vehicleDetails.vehicleNumber}
                                    error={confirmError.for === "vehicleNumber"}
                                    helperText={confirmError.for === "vehicleNumber" && confirmError.text}
                                    onChange={(e) => setConfirmBookingDetails(prev => ({
                                        ...prev,
                                        vehicleDetails: { ...prev.vehicleDetails, vehicleNumber: e.target.value }
                                    }))}
                                />
                            </Grid>

                            {/* Financial Details */}
                            <Grid item xs={12}>
                                <Typography variant="subtitle2" sx={{ color: "primary.main", fontWeight: "bold", borderBottom: "1px solid #f0f0f0", pb: 1, mb: 1, mt: 2 }}>
                                    PRICING DETAILS
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Amount Offered (฿)"
                                    type="number"
                                    fullWidth
                                    value={confirmBookingDetails.AmountOffered}
                                    error={confirmError.for === "amount"}
                                    helperText={confirmError.for === "amount" && confirmError.text}
                                    onChange={(e) => setConfirmBookingDetails(prev => ({
                                        ...prev,
                                        AmountOffered: e.target.value
                                    }))}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Commission (฿)"
                                    type="number"
                                    fullWidth
                                    value={confirmBookingDetails.comission}
                                    error={confirmError.for === "comission"}
                                    helperText={confirmError.for === "comission" && confirmError.text}
                                    onChange={(e) => setConfirmBookingDetails(prev => ({
                                        ...prev,
                                        comission: e.target.value
                                    }))}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>

                    <DialogActions sx={{ p: 2.5, borderTop: "1px solid #eee" }}>
                        <Button onClick={() => setOpenConfirmModal(false)} color="inherit">Cancel</Button>
                        <Button onClick={handleConfirmMobileBooking} variant="contained" color="success">Confirm Booking</Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </div>
    );
};

export default VanBookings;
