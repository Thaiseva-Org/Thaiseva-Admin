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
    Button
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
    getDateAndTime
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
            await updateDoc(doc(collectionRef, row.id), { status: newStatus });

            if (newStatus === "Confirmed") {
                await updateHourlyEarnings(row.price || 0, "Vans");
                await updateMonthlyEarnings(row.price || 0, "Vans");
            }

            // Notification for Mobile Users
            if (row.source === 'mobile' && row.userId) {
                const title = newStatus === 'Confirmed' ? "Van Booking Confirmed" : "Van Booking Cancelled";
                const message = newStatus === 'Confirmed'
                    ? `Your van booking from ${row.pickupLocation} is confirmed.`
                    : `Your van booking from ${row.pickupLocation} has been cancelled.`;

                await CreateNewNotificationToUser(title, message, row.userId);
            }

            successNotification(`Booking marked as ${newStatus}`);
        } catch (err) {
            console.error(err);
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
            case 'pending': return 'warning';
            case 'cancelled': return 'error';
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
                                                    {(!row.status || row.status === 'Pending') && (
                                                        <>
                                                            <IconButton size="small" color="success" onClick={() => handleUpdateStatus(row, "Confirmed")} title="Confirm">
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
        </div>
    );
};

export default VanBookings;
