import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Grid,
    CircularProgress,
    Box,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Autocomplete
} from "@mui/material";
import { CloseIcon } from "@icons";
import { DeleteIcon } from "@icons";
import { AddCircleIcon } from "@icons";
import {
    collection,
    doc,
    getDocs,
    addDoc,
    deleteDoc,
    query,
    where,
    serverTimestamp
} from "firebase/firestore";
import { db, generalPartnersCollection } from "../../../../firebase/firebase.config";
import { successNotification, errorNotification } from "../../../../utils/utils";

const PartnerPackagesModal = ({ open, onClose, partnerId, partnerName }) => {
    const [loading, setLoading] = useState(false);
    const [assignedPackages, setAssignedPackages] = useState([]);
    const [availableSightseeingPackages, setAvailableSightseeingPackages] = useState([]);
    const [fetchingPackages, setFetchingPackages] = useState(false);

    // Form State
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [formState, setFormState] = useState({
        commissionType: "Percentage",
        commissionRate: "",
        maxBookingsPerWeek: "",
        startDate: "",
        endDate: ""
    });

    useEffect(() => {
        if (open && partnerId) {
            fetchAssignedPackages();
            fetchSightseeingPackages();
        } else {
            // Reset state on close
            setAssignedPackages([]);
            setSelectedPackage(null);
            setFormState({
                commissionType: "Percentage",
                commissionRate: "",
                maxBookingsPerWeek: "",
                startDate: "",
                endDate: ""
            });
        }
    }, [open, partnerId]);

    const fetchSightseeingPackages = async () => {
        if (availableSightseeingPackages.length > 0) return; // Cache

        setFetchingPackages(true);
        try {
            // Fetch from sightseeingPackagesDetails (or travelServicesCollection which has summaries)
            // Using sightseeingPackagesDetails for full titles
            const q = collection(db, "sightseeingPackagesDetails");
            const snapshot = await getDocs(q);
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                title: doc.data().packageName || doc.data().title || "Untitled Package",
                price: doc.data().startingPrice || 0
            }));
            setAvailableSightseeingPackages(list);
        } catch (error) {
            console.error("Error fetching available packages:", error);
        } finally {
            setFetchingPackages(false);
        }
    };

    const fetchAssignedPackages = async () => {
        setLoading(true);
        try {
            const subCollectionRef = collection(db, "general_partners", partnerId, "assignedPackages");
            const snapshot = await getDocs(subCollectionRef);
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAssignedPackages(list);
        } catch (error) {
            console.error("Error fetching assigned packages:", error);
            errorNotification("Failed to load assigned packages");
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleAddPackage = async () => {
        if (!selectedPackage || !formState.commissionRate || !formState.maxBookingsPerWeek || !formState.startDate || !formState.endDate) {
            alert("Please fill in all fields.");
            return;
        }

        // Basic date validation
        if (new Date(formState.startDate) > new Date(formState.endDate)) {
            alert("End date cannot be before start date.");
            return;
        }

        setLoading(true);
        try {
            const subCollectionRef = collection(db, "general_partners", partnerId, "assignedPackages");

            const newAssignment = {
                packageId: selectedPackage.id,
                packageName: selectedPackage.title,
                commissionType: formState.commissionType,
                commissionRate: Number(formState.commissionRate),
                maxBookingsPerWeek: Number(formState.maxBookingsPerWeek),
                startDate: formState.startDate,
                endDate: formState.endDate,
                createdAt: serverTimestamp()
            };

            await addDoc(subCollectionRef, newAssignment);

            successNotification("Package assigned successfully");
            fetchAssignedPackages(); // Refresh list

            // Reset Form (keep dates probably? No, reset all for safety)
            setSelectedPackage(null);
            setFormState({
                commissionType: "Percentage",
                commissionRate: "",
                maxBookingsPerWeek: "",
                startDate: "",
                endDate: ""
            });

        } catch (error) {
            console.error("Error assigning package:", error);
            errorNotification("Failed to assign package");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAssignment = async (assignmentId) => {
        if (!window.confirm("Are you sure you want to remove this package assignment?")) return;

        try {
            await deleteDoc(doc(db, "general_partners", partnerId, "assignedPackages", assignmentId));
            setAssignedPackages(prev => prev.filter(p => p.id !== assignmentId));
            successNotification("Assignment removed");
        } catch (error) {
            console.error("Error removing assignment:", error);
            errorNotification("Failed to remove assignment");
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                style: { borderRadius: "24px", padding: '10px' }
            }}
        >
            <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
                <div>
                    <span className="font-bold text-xl">Manage Partner Packages</span>
                    <p className="text-sm text-gray-500 font-normal mt-1">Assign packages and set limits for <b>{partnerName}</b></p>
                </div>
                <IconButton onClick={onClose} sx={{ bgcolor: "#f1f5f9" }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent>
                {/* Form Section */}
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 mb-6 mt-2">
                    <h4 className="text-sm font-bold text-slate-700 uppercase mb-4 flex items-center gap-2">
                        <AddCircleIcon className="text-primary-500" fontSize="small" /> Assign New Package
                    </h4>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Autocomplete
                                options={availableSightseeingPackages}
                                getOptionLabel={(option) => option.title}
                                value={selectedPackage}
                                onChange={(e, newValue) => setSelectedPackage(newValue)}
                                loading={fetchingPackages}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Select Package to Assign"
                                        size="small"
                                        fullWidth
                                        variant="outlined"
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {fetchingPackages ? <CircularProgress color="inherit" size={20} /> : null}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        }}
                                    />
                                )}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Max Bookings / Week"
                                name="maxBookingsPerWeek"
                                type="number"
                                fullWidth
                                size="small"
                                value={formState.maxBookingsPerWeek}
                                onChange={handleInputChange}
                                placeholder="e.g. 50"
                            />
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Commission Type</InputLabel>
                                <Select
                                    name="commissionType"
                                    value={formState.commissionType}
                                    label="Commission Type"
                                    onChange={handleInputChange}
                                >
                                    <MenuItem value="Percentage">Percentage (%)</MenuItem>
                                    <MenuItem value="Fixed">Fixed Amount ($)</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <TextField
                                label="Commission Value"
                                name="commissionRate"
                                type="number"
                                fullWidth
                                size="small"
                                value={formState.commissionRate}
                                onChange={handleInputChange}
                            />
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <TextField
                                label="Valid From"
                                name="startDate"
                                type="date"
                                fullWidth
                                size="small"
                                InputLabelProps={{ shrink: true }}
                                value={formState.startDate}
                                onChange={handleInputChange}
                            />
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <TextField
                                label="Valid To"
                                name="endDate"
                                type="date"
                                fullWidth
                                size="small"
                                InputLabelProps={{ shrink: true }}
                                value={formState.endDate}
                                onChange={handleInputChange}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <Button
                                variant="contained"
                                fullWidth
                                onClick={handleAddPackage}
                                disabled={loading}
                                sx={{
                                    textTransform: 'none',
                                    fontWeight: 'bold',
                                    boxShadow: 'none',
                                    backgroundImage: 'linear-gradient(to right, var(--primary-500, #3b82f6), var(--primary-600, #2563eb))'
                                }}
                            >
                                {loading ? <CircularProgress size={24} color="inherit" /> : "Assign Package"}
                            </Button>
                        </Grid>
                    </Grid>
                </div>

                {/* List Section */}
                <h4 className="text-sm font-bold text-slate-700 uppercase mb-3">Assigned Packages ({assignedPackages.length})</h4>

                {loading && assignedPackages.length === 0 ? (
                    <div className="flex justify-center p-8"><CircularProgress /></div>
                ) : (
                    <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #e2e8f0", maxHeight: 400 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Package Name</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Commission</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8fafc' }} align="center">Max/Week</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Valid Period</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8fafc' }} align="center">Action</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {assignedPackages.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center" sx={{ py: 4, color: '#94a3b8' }}>
                                            No packages assigned to this partner yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    assignedPackages.map((pkg) => (
                                        <TableRow key={pkg.id} hover>
                                            <TableCell component="th" scope="row">
                                                <div className="font-medium text-slate-700">{pkg.packageName}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={`${pkg.commissionRate}${pkg.commissionType === "Percentage" ? "%" : "$"}`}
                                                    size="small"
                                                    color="success"
                                                    variant="outlined"
                                                    sx={{ getattr: "height: 24px" }}
                                                />
                                            </TableCell>
                                            <TableCell align="center">
                                                <span className="font-bold text-slate-800">{pkg.maxBookingsPerWeek}</span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs text-slate-500">
                                                    <div>From: {pkg.startDate}</div>
                                                    <div>To: {pkg.endDate}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell align="center">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => handleDeleteAssignment(pkg.id)}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} sx={{ color: '#64748b' }}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};

export default PartnerPackagesModal;
