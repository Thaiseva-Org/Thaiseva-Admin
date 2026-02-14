import {
    TablePagination,
    IconButton,
    Tooltip,
    Card,
    CardMedia,
    CardContent,
    CardActions,
    ToggleButtonGroup,
    ToggleButton,
    Grid,
    Typography,
    Box,
    InputAdornment,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    Tabs,
    Tab
} from "@mui/material";
import {
    collection,
    deleteDoc,
    doc,
    getCountFromServer,
    onSnapshot,
    query,
} from "firebase/firestore";
import { MdEdit, MdDelete, MdMeetingRoom } from "react-icons/md";
import { GridView, ViewList, LocationOn, Search, DirectionsBus } from "@mui/icons-material"; // Changed icon
import { useContext, useEffect, useState } from "react";
import LoadingContent from "../../../../../components/LoadingContent";
import PageHeading from "../../../../../components/PageHeading";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import {
    db,
    vanCompaniesCollection,
} from "../../../../../firebase/firebase.config"; // Ensure this import works after your previous step
import {
    askingForDelete,
    deleteNotification,
} from "../../../../../utils/utils";
import CloseIcon from "@mui/icons-material/Close";
import AddVanCompanyModal from "./AddVanCompanyModal";

const Vans = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(true);
    const [vanCompanies, setVanCompanies] = useState([]);
    const [matchedCompanies, setMatchedCompanies] = useState([]);
    const [viewMode, setViewMode] = useState('list');
    const [openAddModal, setOpenAddModal] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [isEdit, setIsEdit] = useState(false);

    // For viewing details
    const [viewDetailsModal, setViewDetailsModal] = useState(false);
    const [companyDetails, setCompanyDetails] = useState(null);
    const [tabValue, setTabValue] = useState(0);

    const { isAdmin, isSubAdmin } = useContext(AuthContext);

    useEffect(() => {
        const unsubscribe = onSnapshot(vanCompaniesCollection, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id }));
            setVanCompanies(list);
            setMatchedCompanies(list);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleChangePage = (_, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleSearch = (text) => {
        const filtered = vanCompanies.filter(c =>
            c.name?.toLowerCase().includes(text.toLowerCase()) ||
            c.contact?.toLowerCase().includes(text.toLowerCase())
        );
        setMatchedCompanies(filtered);
    };

    const handleDelete = async (id) => {
        askingForDelete().then(async (result) => {
            if (result.isConfirmed) {
                await deleteDoc(doc(vanCompaniesCollection, id));
                deleteNotification("Van Company deleted successfully.");
            }
        });
    };

    const handleEdit = (company) => {
        setSelectedCompany(company);
        setIsEdit(true);
        setOpenAddModal(true);
    };

    const handleView = (company) => {
        setCompanyDetails(company);
        setViewDetailsModal(true);
    };

    const handleCloseModal = () => {
        setOpenAddModal(false);
        setSelectedCompany(null);
        setIsEdit(false);
    };

    const columns = [
        { id: "name", label: "Company Name", width: "25%" },
        { id: "contact", label: "Contact", width: "20%" },
        { id: "totalVans", label: "Total Vans", width: "15%" },
        { id: "action", label: "Action", width: "15%" },
    ];

    return (
        <div className="animate-fade-in">
            <PageHeading
                text="Van Management"
                subtitle="Manage van companies and their fleets"
                icon="🚐"
            />

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
                <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={(e, newMode) => { if (newMode) setViewMode(newMode); }}
                    sx={{ bgcolor: 'white', borderRadius: '12px', height: '52px' }}
                >
                    <ToggleButton value="list"><ViewList /></ToggleButton>
                    <ToggleButton value="grid"><GridView /></ToggleButton>
                </ToggleButtonGroup>

                <div className="flex-grow flex gap-4 w-full md:w-auto">
                    <TextField
                        placeholder="Search companies..."
                        onChange={(e) => handleSearch(e.target.value)}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><Search /></InputAdornment>
                        }}
                        sx={{ flexGrow: 1, bgcolor: 'white', borderRadius: '12px' }}
                    />
                    <button
                        className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
                        onClick={() => { setIsEdit(false); setSelectedCompany(null); setOpenAddModal(true); }}
                    >
                        + Add New Company
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
                {loading ? <LoadingContent /> : (
                    viewMode === 'list' ? (
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
                                    {matchedCompanies.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, i) => (
                                        <tr key={i} className="hover:bg-primary-50">
                                            <td className="px-6 py-4 text-center font-medium">{row.name}</td>
                                            <td className="px-6 py-4 text-center">{row.contact || "N/A"}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-primary-50 text-primary-700 px-3 py-1 rounded-full font-bold text-sm">
                                                    {row.vanNumbers?.length || 0} Vans
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <IconButton onClick={() => handleEdit(row)} color="warning"><MdEdit /></IconButton>
                                                    <IconButton onClick={() => handleDelete(row.uid)} color="error"><MdDelete /></IconButton>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {matchedCompanies.length === 0 && (
                                        <tr><td colSpan={4} className="text-center py-10 text-neutral-500">No Van Companies Found</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                            {matchedCompanies.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => (
                                <Card key={row.uid} sx={{ borderRadius: 3, transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
                                    <CardContent>
                                        <Typography variant="h6" fontWeight="bold">{row.name}</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{row.contact}</Typography>
                                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                                            <span className="text-sm font-semibold text-gray-600">Fleet Size:</span>
                                            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-bold text-sm">
                                                {row.vanNumbers?.length || 0} Vehicles
                                            </span>
                                        </div>
                                    </CardContent>
                                    <CardActions sx={{ borderTop: '1px solid #f0f0f0', justifyContent: 'flex-end' }}>
                                        <IconButton onClick={() => handleEdit(row)} color="warning"><MdEdit /></IconButton>
                                        <IconButton onClick={() => handleDelete(row.uid)} color="error"><MdDelete /></IconButton>
                                    </CardActions>
                                </Card>
                            ))}
                        </div>
                    )
                )}
                <TablePagination
                    component="div"
                    count={matchedCompanies.length}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                />
            </div>

            {/* Add/Edit Modal */}
            {openAddModal && (
                <AddVanCompanyModal
                    open={openAddModal}
                    handleClose={handleCloseModal}
                    isEdit={isEdit}
                    initialData={selectedCompany}
                />
            )}
        </div>
    );
};

export default Vans;
