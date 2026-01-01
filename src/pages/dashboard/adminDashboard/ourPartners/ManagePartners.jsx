import {
    TablePagination,
    TextField,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Grid,
    Chip,
    InputAdornment,
    OutlinedInput,
    Box,
    ListItemText,
    Checkbox,
    Tooltip
} from "@mui/material";
import { Autocomplete } from "@react-google-maps/api";
import { useEffect, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import { MdEdit, MdDelete, MdSearch, MdCheckCircle, MdCancel, MdPending, MdLocalOffer, MdAccountBalance } from "react-icons/md";
import PartnerPackagesModal from "./PartnerPackagesModal";
import PageHeading from "../../../../components/PageHeading";
import { getDocs, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { generalPartnersCollection } from "../../../../firebase/firebase.config";
import LoadingContent from "../../../../components/LoadingContent";
import { successNotification, errorNotification, askingForDelete } from "../../../../utils/utils";

const ManagePartners = () => {
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [filteredPartners, setFilteredPartners] = useState([]);


    // Modal State
    const [openDialog, setOpenDialog] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // Package Modal State
    const [packageModalOpen, setPackageModalOpen] = useState(false);
    const [selectedPartnerForPackage, setSelectedPartnerForPackage] = useState(null);

    // Form State

    const initialFormState = {
        fullName: "",
        email: "",
        phoneNumber: "",
        address: "",
        serviceCategories: [],
        serviceArea: "",
        serviceLocation: null,
        bankDetails: {
            bankName: "",
            accountNumber: "",
            accountName: "",
            branchDetails: ""
        },
        commissions: {}, // Map: { "CategoryName": { type: "Percentage", rate: 0 } }
        status: "Pending"
    };
    const [formData, setFormData] = useState(initialFormState);
    const [searchBox, setSearchBox] = useState(null);
    const [selectedPartnerId, setSelectedPartnerId] = useState(null);

    useEffect(() => {
        fetchPartners();
    }, []);

    const fetchPartners = async () => {
        setLoading(true);
        try {
            const snapshot = await getDocs(generalPartnersCollection);
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPartners(list);
            setFilteredPartners(list);
        } catch (error) {
            console.error("Error fetching partners:", error);
            errorNotification("Failed to load partners");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (text) => {
        const term = text.toLowerCase();
        const filtered = partners.filter(
            (p) =>
                (p.personalInformation?.fullName || "").toLowerCase().includes(term) ||
                (p.personalInformation?.email || "").toLowerCase().includes(term) ||
                // Check if serviceCategory is string or array
                (Array.isArray(p.serviceCategory)
                    ? p.serviceCategory.some(c => c.toLowerCase().includes(term))
                    : (p.serviceCategory || "").toLowerCase().includes(term))
        );
        setFilteredPartners(filtered);
        setPage(0);
    };

    const handleOpenDialog = (partner = null) => {
        if (partner) {
            setIsEditMode(true);
            setSelectedPartnerId(partner.id);

            // Handle legacy string data for categories
            let categories = [];
            if (Array.isArray(partner.serviceCategory)) {
                categories = partner.serviceCategory;
            } else if (partner.serviceCategory) {
                categories = [partner.serviceCategory];
            }

            // Construct commissions map from existing data
            let loadedCommissions = {};
            if (partner.commissions) {
                loadedCommissions = partner.commissions;
            } else {
                // Fallback for legacy data: apply global commission to all categories
                categories.forEach(cat => {
                    loadedCommissions[cat] = {
                        type: partner.commissionType || "Percentage",
                        rate: partner.commissionRate || 0
                    };
                });
            }

            setFormData({
                fullName: partner.personalInformation?.fullName || "",
                email: partner.personalInformation?.email || "",
                phoneNumber: partner.personalInformation?.phoneNumber || "",
                address: partner.personalInformation?.address || "",
                serviceCategories: categories,
                serviceArea: partner.serviceInformation?.serviceArea || "",
                serviceLocation: partner.serviceInformation?.location || null,
                bankDetails: partner.bankDetails || { bankName: "", accountNumber: "", accountName: "", branchDetails: "" },
                commissions: loadedCommissions,
                status: partner.status || "Pending"
            });
        } else {
            setIsEditMode(false);
            setSelectedPartnerId(null);
            setFormData(initialFormState);
        }
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setFormData(initialFormState);
    };

    const handleManagePackages = (partner) => {
        setSelectedPartnerForPackage(partner);
        setPackageModalOpen(true);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCategoryChange = (event) => {
        const { target: { value } } = event;
        const newCategories = typeof value === 'string' ? value.split(',') : value;

        // Initialize commission for new categories if not present
        const newCommissions = { ...formData.commissions };
        newCategories.forEach(cat => {
            if (!newCommissions[cat]) {
                newCommissions[cat] = { type: "Percentage", rate: "" }; // Default
            }
        });

        // Cleanup removed categories from commissions map
        Object.keys(newCommissions).forEach(key => {
            if (!newCategories.includes(key)) {
                delete newCommissions[key];
            }
        });

        setFormData(prev => ({
            ...prev,
            serviceCategories: newCategories,
            commissions: newCommissions
        }));
    };

    const handleCommissionChange = (category, field, value) => {
        setFormData(prev => ({
            ...prev,
            commissions: {
                ...prev.commissions,
                [category]: {
                    ...prev.commissions[category],
                    [field]: value
                }
            }
        }));
    };

    const handleBankChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            bankDetails: {
                ...prev.bankDetails,
                [name]: value
            }
        }));
    };

    const onPlaceLoad = (ref) => {
        setSearchBox(ref);
    };

    const onPlaceChanged = () => {
        if (searchBox) {
            const place = searchBox.getPlace();
            if (place.geometry) {
                const location = {
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng(),
                };
                const address = place.formatted_address;
                setFormData(prev => ({
                    ...prev,
                    serviceArea: address,
                    serviceLocation: location
                }));
            }
        }
    };

    const handleSubmit = async () => {
        if (!formData.fullName || !formData.email) {
            alert("Name and Email are required");
            return;
        }

        setLoading(true);
        try {
            const partnerData = {
                personalInformation: {
                    fullName: formData.fullName,
                    email: formData.email,
                    phoneNumber: formData.phoneNumber,
                    address: formData.address,
                    photoURL: "https://via.placeholder.com/150"
                },
                serviceInformation: {
                    serviceArea: formData.serviceArea,
                    location: formData.serviceLocation
                },
                bankDetails: formData.bankDetails,
                serviceCategory: formData.serviceCategories,
                commissions: formData.commissions, // Save the detailed map
                status: formData.status,
                updatedAt: serverTimestamp()
            };

            if (isEditMode && selectedPartnerId) {
                const partnerRef = doc(generalPartnersCollection, selectedPartnerId);
                await updateDoc(partnerRef, partnerData);

                // Sync status to Users collection
                try {
                    const { usersCollection } = await import("../../../../firebase/firebase.config");
                    const userRef = doc(usersCollection, selectedPartnerId);
                    await updateDoc(userRef, { status: formData.status });
                } catch (syncError) {
                    console.warn("Failed to sync status to users collection:", syncError);
                }

                successNotification("Partner updated successfully");
            } else {
                const newDocPayload = {
                    ...partnerData,
                    createdAt: serverTimestamp(),
                    uid: ""
                };
                const docRef = await addDoc(generalPartnersCollection, newDocPayload);
                await updateDoc(docRef, { uid: docRef.id });
                successNotification("New partner added successfully");
            }

            handleCloseDialog();
            fetchPartners();
        } catch (error) {
            console.error("Error saving partner:", error);
            errorNotification("Failed to save partner details");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        askingForDelete().then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(generalPartnersCollection, id));
                    setPartners(prev => prev.filter(p => p.id !== id));
                    setFilteredPartners(prev => prev.filter(p => p.id !== id));
                    successNotification("Partner deleted successfully");
                } catch (error) {
                    console.error("Error deleting partner:", error);
                    errorNotification("Failed to delete partner");
                }
            }
        });
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(+event.target.value);
        setPage(0);
    };

    const getStatusChip = (status) => {
        switch (status) {
            case "Approved":
            case "Verified":
                return <Chip icon={<MdCheckCircle />} label="Approved" color="success" size="small" variant="outlined" />;
            case "Rejected":
            case "Denied":
                return <Chip icon={<MdCancel />} label="Rejected" color="error" size="small" variant="outlined" />;
            default:
                return <Chip icon={<MdPending />} label="Pending" color="warning" size="small" variant="outlined" />;
        }
    };

    const ServiceCategories = [
        "Hotel", "Sightseeing Packages"
    ];

    const columns = [
        { id: "partner", label: "Partner", width: "25%" },
        { id: "category", label: "Category", width: "20%" },
        { id: "status", label: "Status", width: "15%" },
        { id: "commission", label: "Commission", width: "20%" },
        { id: "contact", label: "Contact", width: "15%" },
        { id: "actions", label: "Actions", width: "5%" },
    ];

    return (
        <div className="animate-fade-in pb-12">
            <PageHeading
                text="General Partners"
                subtitle="Create, edit, and manage all partner details"
                icon="👥"
            />

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 text-white shadow-lg relative overflow-hidden group">
                    <div className="absolute right-0 top-0 h-full w-24 bg-white/10 skew-x-12 transform translate-x-8 group-hover:translate-x-6 transition-transform duration-500"></div>
                    <div className="absolute right-12 top-0 h-full w-12 bg-white/5 skew-x-12 transform translate-x-8 group-hover:translate-x-6 transition-transform duration-500 delay-75"></div>

                    <div className="flex items-center justify-between relative z-10">
                        <div>
                            <p className="text-primary-100 text-sm font-medium mb-1">
                                Total Partners
                            </p>
                            <p className="text-3xl font-bold">{partners.length}</p>
                        </div>
                        <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                            <span className="text-3xl">👥</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
                <div className="flex-grow flex gap-4 w-full md:w-auto">
                    <TextField
                        placeholder="Search partners..."
                        type="search"
                        fullWidth
                        variant="outlined"
                        size="medium"
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <MdSearch className="text-neutral-400 text-xl" />
                                </InputAdornment>
                            ),
                        }}
                        sx={{
                            flexGrow: 1,
                            "& .MuiOutlinedInput-root": {
                                backgroundColor: "white",
                                borderRadius: "12px",
                                transition: "all 0.3s ease",
                                "&:hover": {
                                    backgroundColor: "#f8fafc",
                                    "& .MuiOutlinedInput-notchedOutline": {
                                        borderColor: "#3b82f6",
                                    },
                                },
                                "&.Mui-focused": {
                                    backgroundColor: "white",
                                    boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
                                    "& .MuiOutlinedInput-notchedOutline": {
                                        borderColor: "#3b82f6",
                                        borderWidth: "2px",
                                    },
                                },
                                "& .MuiOutlinedInput-notchedOutline": {
                                    borderColor: "#e5e7eb",
                                },
                            },
                        }}
                        onChange={(e) => handleSearch(e.target.value)}
                    />

                    <button
                        className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
                        onClick={() => handleOpenDialog()}
                    >
                        <span className="text-xl">+</span> Add New Partner
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
                {loading ? (
                    <LoadingContent variant="skeleton" />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                                    <tr>
                                        {columns.map((col) => (
                                            <th key={col.id} className="px-6 py-4 text-center text-sm font-semibold uppercase tracking-wider" style={{ width: col.width }}>
                                                {col.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200">
                                    {filteredPartners.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                                <div className="flex flex-col items-center justify-center text-neutral-400">
                                                    <span className="text-6xl mb-4">👥</span>
                                                    <p className="text-lg font-medium text-neutral-500">
                                                        No Partners Found
                                                    </p>
                                                    <p className="text-sm text-neutral-400 mt-2">
                                                        Add a new partner to get started.
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPartners.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((partner) => (
                                            <tr key={partner.id} className="hover:bg-primary-50 transition-colors duration-200">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center justify-center md:justify-start">
                                                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold mr-3 border border-indigo-200 shrink-0">
                                                            {partner.personalInformation?.fullName?.charAt(0) || "P"}
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="text-sm font-medium text-gray-900">{partner.personalInformation?.fullName || "N/A"}</div>
                                                            <div className="text-xs text-gray-500">{partner.serviceInformation?.serviceArea || "Area not set"}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <div className="flex flex-wrap gap-1 justify-center max-w-[250px]">
                                                        {Array.isArray(partner.serviceCategory) ? (
                                                            <>
                                                                {partner.serviceCategory.slice(0, 2).map((cat, idx) => (
                                                                    <span key={idx} className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-md bg-gray-100 text-gray-800 border border-gray-200">
                                                                        {cat}
                                                                    </span>
                                                                ))}
                                                                {partner.serviceCategory.length > 2 && (
                                                                    <Tooltip title={partner.serviceCategory.slice(2).join(", ")} arrow>
                                                                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-200 cursor-help">
                                                                            +{partner.serviceCategory.length - 2}
                                                                        </span>
                                                                    </Tooltip>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-md bg-gray-100 text-gray-800 border border-gray-200">
                                                                {partner.serviceCategory || "Unknown"}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    {getStatusChip(partner.status)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <div className="flex flex-col gap-1 items-center">
                                                        {partner.commissions ? (
                                                            Object.entries(partner.commissions).slice(0, 2).map(([cat, rule], idx) => (
                                                                <div key={idx} className="text-xs text-gray-600">
                                                                    <span className="font-semibold">{cat}:</span> {rule.rate}{rule.type === 'Percentage' ? '%' : '$'}
                                                                </div>
                                                            ))
                                                        ) : (
                                                            // Legacy or empty fallout
                                                            <div className="text-xs text-gray-500">
                                                                {partner.commissionRate ? `${partner.commissionRate}${partner.commissionType === 'Percentage' ? '%' : '$'}` : 'N/A'}
                                                            </div>
                                                        )}
                                                        {partner.commissions && Object.keys(partner.commissions).length > 2 && (
                                                            <Tooltip title={
                                                                Object.entries(partner.commissions).slice(2).map(([c, r]) => `${c}: ${r.rate}${r.type === 'Percentage' ? '%' : '$'}`).join(', ')
                                                            } arrow>
                                                                <span className="text-xs text-blue-600 font-medium cursor-help">
                                                                    +{Object.keys(partner.commissions).length - 2} more
                                                                </span>
                                                            </Tooltip>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                                                    <div>{partner.personalInformation?.email}</div>
                                                    <div className="text-xs">{partner.personalInformation?.phoneNumber}</div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <div className="flex items-center justify-center gap-3">
                                                        <Tooltip title="Manage Packages" arrow>
                                                            <IconButton
                                                                onClick={() => handleManagePackages(partner)}
                                                                sx={{
                                                                    color: '#3b82f6',
                                                                    border: '1px solid #93c5fd',
                                                                    bgcolor: '#eff6ff',
                                                                    '&:hover': { bgcolor: '#dbeafe', borderColor: '#3b82f6' },
                                                                    transition: 'all 0.2s',
                                                                    width: 36,
                                                                    height: 36
                                                                }}
                                                            >
                                                                <MdLocalOffer size={18} />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Edit Partner" arrow>
                                                            <IconButton
                                                                onClick={() => handleOpenDialog(partner)}
                                                                sx={{
                                                                    color: '#f59e0b',
                                                                    border: '1px solid #fcd34d',
                                                                    bgcolor: '#fffbeb',
                                                                    '&:hover': { bgcolor: '#fef3c7', borderColor: '#f59e0b' },
                                                                    transition: 'all 0.2s',
                                                                    width: 36,
                                                                    height: 36
                                                                }}
                                                            >
                                                                <MdEdit size={18} />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Delete Partner" arrow>
                                                            <IconButton
                                                                onClick={() => handleDelete(partner.id)}
                                                                sx={{
                                                                    color: '#ef4444',
                                                                    border: '1px solid #fca5a5',
                                                                    bgcolor: '#fef2f2',
                                                                    '&:hover': { bgcolor: '#fee2e2', borderColor: '#ef4444' },
                                                                    transition: 'all 0.2s',
                                                                    width: 36,
                                                                    height: 36
                                                                }}
                                                            >
                                                                <MdDelete size={18} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-4">
                            <TablePagination
                                rowsPerPageOptions={[10, 25, 100]}
                                component="div"
                                count={filteredPartners.length}
                                rowsPerPage={rowsPerPage}
                                page={page}
                                onPageChange={handleChangePage}
                                onRowsPerPageChange={handleChangeRowsPerPage}
                                sx={{
                                    "& .MuiTablePagination-toolbar": {
                                        color: "var(--text-primary)",
                                    },
                                    "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": {
                                        margin: 0,
                                        fontWeight: 500,
                                    },
                                    "& .MuiTablePagination-select": {
                                        borderRadius: "8px",
                                        backgroundColor: "white",
                                        border: "1px solid #e5e7eb",
                                        padding: "4px 8px",
                                    },
                                    "& .MuiTablePagination-actions button": {
                                        borderRadius: "8px",
                                        "&:hover": {
                                            backgroundColor: "var(--primary-bg-light)",
                                        },
                                    },
                                }}
                            />
                        </div>
                    </>
                )}
            </div>

            <Dialog
                open={openDialog}
                onClose={handleCloseDialog}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    style: {
                        borderRadius: "24px",
                    },
                }}
            >
                <DialogTitle
                    sx={{
                        borderBottom: "1px solid #e2e8f0",
                        pb: 2,
                        fontSize: "1.5rem",
                        fontWeight: "bold",
                        color: "#1e293b",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                    }}
                >
                    {isEditMode ? "Edit Partner Details" : "Add New Partner"}
                    <IconButton
                        onClick={handleCloseDialog}
                        sx={{
                            color: "#64748b",
                            bgcolor: "#f1f5f9",
                            "&:hover": { bgcolor: "#e2e8f0" },
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers sx={{ p: 4 }}>
                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <h3 className="font-bold text-gray-700 text-sm uppercase mb-2">Personal Information</h3>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Full Name"
                                name="fullName"
                                fullWidth
                                required
                                value={formData.fullName}
                                onChange={handleInputChange}
                                size="small"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Email"
                                name="email"
                                type="email"
                                fullWidth
                                required
                                value={formData.email}
                                onChange={handleInputChange}
                                size="small"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Phone Number"
                                name="phoneNumber"
                                fullWidth
                                value={formData.phoneNumber}
                                onChange={handleInputChange}
                                size="small"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Address"
                                name="address"
                                fullWidth
                                value={formData.address}
                                onChange={handleInputChange}
                                size="small"
                            />
                        </Grid>



                        <Grid item xs={12}>
                            <h3 className="font-bold text-gray-700 text-sm uppercase mb-2 mt-2">Service Details</h3>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Service Categories</InputLabel>
                                <Select
                                    name="serviceCategories"
                                    multiple
                                    value={formData.serviceCategories}
                                    onChange={handleCategoryChange}
                                    input={<OutlinedInput label="Service Categories" />}
                                    renderValue={(selected) => (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {selected.map((value) => (
                                                <Chip key={value} label={value} size="small" />
                                            ))}
                                        </Box>
                                    )}
                                >
                                    {ServiceCategories.map((cat) => (
                                        <MenuItem key={cat} value={cat}>
                                            <Checkbox checked={formData.serviceCategories.indexOf(cat) > -1} />
                                            <ListItemText primary={cat} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Autocomplete onLoad={onPlaceLoad} onPlaceChanged={onPlaceChanged}>
                                <TextField
                                    label="Service Area"
                                    name="serviceArea"
                                    fullWidth
                                    value={formData.serviceArea}
                                    onChange={handleInputChange}
                                    size="small"
                                    placeholder="Search location on Google Maps"
                                />
                            </Autocomplete>
                        </Grid>

                        <Grid item xs={12}>
                            <h3 className="font-bold text-gray-700 text-sm uppercase mb-2 mt-2">Bank Account Details</h3>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Bank Name"
                                name="bankName"
                                fullWidth
                                size="small"
                                value={formData.bankDetails?.bankName || ""}
                                onChange={handleBankChange}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start"><MdAccountBalance className="text-gray-400" /></InputAdornment>
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Account Number"
                                name="accountNumber"
                                fullWidth
                                size="small"
                                value={formData.bankDetails?.accountNumber || ""}
                                onChange={handleBankChange}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Account Holder Name"
                                name="accountName"
                                fullWidth
                                size="small"
                                value={formData.bankDetails?.accountName || ""}
                                onChange={handleBankChange}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Branch / Swift Code"
                                name="branchDetails"
                                fullWidth
                                size="small"
                                value={formData.bankDetails?.branchDetails || ""}
                                onChange={handleBankChange}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <h3 className="font-bold text-gray-700 text-sm uppercase mb-2 mt-2">Commission Rules</h3>
                            {formData.serviceCategories.length === 0 && (
                                <p className="text-sm text-gray-500 italic">Please select service categories to configure commissions.</p>
                            )}
                        </Grid>

                        {formData.serviceCategories.map((cat) => (
                            <Grid item xs={12} key={cat}>
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        {cat}
                                    </h4>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6}>
                                            <FormControl fullWidth size="small" className="bg-white">
                                                <InputLabel>Commission Type</InputLabel>
                                                <Select
                                                    value={formData.commissions && formData.commissions[cat] ? formData.commissions[cat].type : "Percentage"}
                                                    label="Commission Type"
                                                    onChange={(e) => handleCommissionChange(cat, 'type', e.target.value)}
                                                >
                                                    <MenuItem value="Percentage">Percentage (%)</MenuItem>
                                                    <MenuItem value="Fixed">Fixed Amount ($)</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <TextField
                                                label="Commission Value"
                                                type="number"
                                                fullWidth
                                                size="small"
                                                className="bg-white"
                                                value={formData.commissions && formData.commissions[cat] ? formData.commissions[cat].rate : ""}
                                                onChange={(e) => handleCommissionChange(cat, 'rate', e.target.value)}
                                                InputProps={{
                                                    endAdornment: <span className="text-gray-500 text-sm">
                                                        {(formData.commissions && formData.commissions[cat] && formData.commissions[cat].type === "Fixed") ? "$" : "%"}
                                                    </span>,
                                                }}
                                            />
                                        </Grid>
                                    </Grid>
                                </div>
                            </Grid>
                        ))}
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ padding: '16px' }}>
                    <Button onClick={handleCloseDialog} className="text-gray-500">Cancel</Button>
                    <Button
                        onClick={handleSubmit}
                        variant="contained"
                        disabled={loading}
                        sx={{
                            backgroundImage: 'linear-gradient(to right, var(--primary-500, #3b82f6), var(--primary-600, #2563eb))',
                            color: 'white'
                        }}
                    >
                        {isEditMode ? "Save Changes" : "Create Partner"}
                    </Button>
                </DialogActions>
            </Dialog>

            <PartnerPackagesModal
                open={packageModalOpen}
                onClose={() => setPackageModalOpen(false)}
                partnerId={selectedPartnerForPackage?.id}
                partnerName={selectedPartnerForPackage?.personalInformation?.fullName}
            />
        </div>
    );
};

export default ManagePartners;
