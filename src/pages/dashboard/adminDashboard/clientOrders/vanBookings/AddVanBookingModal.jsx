import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    IconButton,
    Grid,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    Chip
} from "@mui/material";
import { MdClose } from "react-icons/md";
import { addDoc, getDocs, updateDoc, doc } from "firebase/firestore";
import { vanBookingsCollection, vanCompaniesCollection, carBookingsCollection } from "../../../../../firebase/firebase.config";
import { successNotification } from "../../../../../utils/utils";

const AddVanBookingModal = ({ open, handleClose, bookingData }) => {
    const [companies, setCompanies] = useState([]);
    const [loadingCompanies, setLoadingCompanies] = useState(true);

    const [formData, setFormData] = useState({
        companyId: "",
        companyName: "", // Store name for easier display
        vanTypeId: "",
        vanTypeName: "",
        vanNumberId: "", // vehicle id
        vanNumber: "", // plate number
        pickupLocation: "",
        dropLocation: "",
        bookingDate: "", // datetime-local
        guestName: "",
        guestPhone: "",
        agentName: "",
        agentPhone: "",
        driverName: "",
        driverPhone: "",
        notes: "",
        price: "",
        passengers: []
    });

    const [newPassenger, setNewPassenger] = useState({ name: "", phone: "", pickup: "", drop: "", count: "" });

    const handleAddPassenger = () => {
        if (newPassenger.name.trim()) {
            setFormData(prev => ({
                ...prev,
                passengers: [...prev.passengers, {
                    name: newPassenger.name.trim(),
                    phone: newPassenger.phone.trim(),
                    pickup: newPassenger.pickup?.trim() || "",
                    drop: newPassenger.drop?.trim() || "",
                    count: newPassenger.count || 0
                }]
            }));
            setNewPassenger({ name: "", phone: "", pickup: "", drop: "", count: "" });
        }
    };

    const handleRemovePassenger = (index) => {
        setFormData(prev => ({
            ...prev,
            passengers: prev.passengers.filter((_, i) => i !== index)
        }));
    };

    // ... inside return ...

    {/* Passenger List */ }
    <Grid item xs={12}>
        <Typography variant="subtitle2" className="text-primary-600 font-bold mb-2 mt-2">PASSENGER LIST (Multiple Guests)</Typography>
        <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={5}>
                <TextField
                    label="Passenger Name"
                    fullWidth
                    size="small"
                    value={newPassenger.name}
                    onChange={(e) => setNewPassenger({ ...newPassenger, name: e.target.value })}
                />
            </Grid>
            <Grid item xs={12} md={5}>
                <TextField
                    label="Passenger Phone (Optional)"
                    fullWidth
                    size="small"
                    value={newPassenger.phone}
                    onChange={(e) => setNewPassenger({ ...newPassenger, phone: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPassenger())}
                />
            </Grid>
            <Grid item xs={12} md={2}>
                <Button variant="contained" onClick={handleAddPassenger} fullWidth>Add</Button>
            </Grid>
            <Grid item xs={12}>
                <div className="flex flex-wrap gap-2 mt-2">
                    {formData.passengers.map((p, index) => (
                        <Chip
                            key={index}
                            label={`${p.name || p} ${p.phone ? `(${p.phone})` : ""}`}
                            onDelete={() => handleRemovePassenger(index)}
                            color="primary"
                            variant="outlined"
                        />
                    ))}
                    {formData.passengers.length === 0 && <span className="text-gray-400 text-sm italic">No additional passengers added.</span>}
                </div>
            </Grid>
        </Grid>
    </Grid>

    // Derived state for dropdowns
    const [availableTypes, setAvailableTypes] = useState([]);
    const [availableVehicles, setAvailableVehicles] = useState([]); // All vehicles for the company
    const [filteredVehicles, setFilteredVehicles] = useState([]); // Filtered by type

    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const snap = await getDocs(vanCompaniesCollection);
                const list = snap.docs.map(doc => ({ ...doc.data(), uid: doc.id }));
                setCompanies(list);
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingCompanies(false);
            }
        };
        if (open) fetchCompanies();
    }, [open]);

    // Populate data if editing
    useEffect(() => {
        if (bookingData && open) {
            setFormData({
                companyId: bookingData.companyId || "",
                companyName: bookingData.companyName || "",
                vanTypeId: bookingData.vanTypeId || "",
                vanTypeName: bookingData.vanTypeName || "",
                vanNumberId: bookingData.vanNumberId || "",
                vanNumber: bookingData.vanNumber || "",
                pickupLocation: bookingData.pickupLocation || "",
                dropLocation: bookingData.dropLocation || "",
                bookingDate: bookingData.bookingDate || "",
                guestName: bookingData.guestName || "",
                guestPhone: bookingData.guestPhone || "",
                agentName: bookingData.agentName || "",
                agentPhone: bookingData.agentPhone || "",
                driverName: bookingData.driverName || "",
                driverPhone: bookingData.driverPhone || "",
                notes: bookingData.notes || "",
                price: bookingData.price || "",
                passengers: bookingData.passengers || []
            });
            // Trigger cascading selects if needed (e.g. to load van types/numbers)
            // Ideally we should pre-load or handle this more gracefully, but for now relies on user re-selecting if they want to change company
        } else if (open && !bookingData) {
            // Reset form
            setFormData({
                companyId: "",
                companyName: "",
                vanTypeId: "",
                vanTypeName: "",
                vanNumberId: "",
                vanNumber: "",
                pickupLocation: "",
                dropLocation: "",
                bookingDate: "",
                guestName: "",
                guestPhone: "",
                agentName: "",
                agentPhone: "",
                driverName: "",
                driverPhone: "",
                notes: "",
                price: "",
                passengers: []
            });
        }
    }, [bookingData, open]);

    // Handle Company Change
    const handleCompanyChange = (e) => {
        const pId = e.target.value;
        const company = companies.find(c => c.uid === pId);

        setFormData(prev => ({
            ...prev,
            companyId: pId,
            companyName: company?.name || "",
            vanTypeId: "",
            vanTypeName: "",
            vanNumberId: "",
            vanNumber: ""
        }));

        if (company) {
            setAvailableTypes(company.vanTypes || []);
            setAvailableVehicles(company.vanNumbers || []);
            setFilteredVehicles([]); // Reset filtered vehicles until type is picked
        }
    };

    // Handle Type Change
    const handleTypeChange = (e) => {
        const tId = e.target.value;
        const type = availableTypes.find(t => t.id === tId);

        setFormData(prev => ({
            ...prev,
            vanTypeId: tId,
            vanTypeName: type?.name || "",
            vanNumberId: "", // reset specific van
            vanNumber: ""
        }));

        // Filter vehicles
        const properVehicles = availableVehicles.filter(v => v.type === tId);
        setFilteredVehicles(properVehicles);
    };

    // Handle Vehicle Change
    const handleVehicleChange = (e) => {
        const vId = e.target.value;
        const vehicle = filteredVehicles.find(v => v.id === vId);

        setFormData(prev => ({
            ...prev,
            vanNumberId: vId,
            vanNumber: vehicle?.number || ""
        }));
    };

    const handleSubmit = async () => {
        // Validation: For mobile/taxi edits, we might not have company details yet, but if they are adding them, good.
        // For new manual bookings, strict validation.
        const isMobile = bookingData?.source === 'mobile';

        if (!isMobile && (!formData.companyId || !formData.vanTypeId || !formData.bookingDate)) {
            alert("Please fill required fields (Company, Type, Date)");
            return;
        }

        try {
            if (bookingData?.id) {
                // Update existing
                const collectionRef = bookingData.source === 'mobile' ? carBookingsCollection : vanBookingsCollection;
                await updateDoc(doc(collectionRef, bookingData.id), {
                    ...formData,
                    // Preserve original status if not intended to change here, typically status changes happen in list
                });
                successNotification("Booking Updated Successfully");
            } else {
                // Create new
                await addDoc(vanBookingsCollection, {
                    ...formData,
                    status: "Pending",
                    createdAt: new Date().toISOString()
                });
                successNotification("Booking Created Successfully");
            }
            handleClose();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
            <DialogTitle sx={{ borderBottom: "1px solid #eee", fontSize: "1.25rem", fontWeight: "bold" }}>
                {bookingData?.id ? "Edit Booking Details" : "Add New Manual Booking"}
                <IconButton onClick={handleClose} sx={{ position: "absolute", right: 8, top: 8, color: "grey.500" }}>
                    <MdClose />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: 3 }}>
                <Grid container spacing={3} sx={{ mt: 0 }}>

                    {/* Van Selection Section */}
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" className="text-primary-600 font-bold mb-2">VAN DETAILS</Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={4}>
                                <FormControl fullWidth>
                                    <InputLabel>All Companies</InputLabel>
                                    <Select
                                        value={formData.companyId}
                                        label="All Companies"
                                        onChange={handleCompanyChange}
                                    >
                                        {companies.map(c => (
                                            <MenuItem key={c.uid} value={c.uid}>{c.name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <FormControl fullWidth disabled={!formData.companyId}>
                                    <InputLabel>Van Type</InputLabel>
                                    <Select
                                        value={formData.vanTypeId}
                                        label="Van Type"
                                        onChange={handleTypeChange}
                                    >
                                        {availableTypes.map(t => (
                                            <MenuItem key={t.id} value={t.id}>{t.name} ({t.capacity} seater)</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <FormControl fullWidth disabled={!formData.vanTypeId}>
                                    <InputLabel>Van Number</InputLabel>
                                    <Select
                                        value={formData.vanNumberId}
                                        label="Van Number"
                                        onChange={handleVehicleChange}
                                    >
                                        {filteredVehicles.map(v => (
                                            <MenuItem key={v.id} value={v.id}>{v.number}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                    </Grid>

                    {/* Trip Details */}
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" className="text-primary-600 font-bold mb-2 mt-2">TRIP INFORMATION</Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Pickup Location" fullWidth
                                    value={formData.pickupLocation} onChange={e => setFormData({ ...formData, pickupLocation: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Drop Location" fullWidth
                                    value={formData.dropLocation} onChange={e => setFormData({ ...formData, dropLocation: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Available Date & Time" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }}
                                    value={formData.bookingDate} onChange={e => setFormData({ ...formData, bookingDate: e.target.value })}
                                />
                            </Grid>

                        </Grid>
                    </Grid>

                    {/* Guest & Agent */}
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" className="text-primary-600 font-bold mb-2 mt-2">CONTACT DETAILS</Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Primary Guest Name" fullWidth
                                    value={formData.guestName} onChange={e => setFormData({ ...formData, guestName: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Primary Guest Phone" fullWidth
                                    value={formData.guestPhone} onChange={e => setFormData({ ...formData, guestPhone: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Booking Agent Name" fullWidth
                                    value={formData.agentName} onChange={e => setFormData({ ...formData, agentName: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Booking Agent Contact" fullWidth
                                    value={formData.agentPhone} onChange={e => setFormData({ ...formData, agentPhone: e.target.value })}
                                />
                            </Grid>
                        </Grid>
                    </Grid>

                    {/* Passenger List */}
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" className="text-primary-600 font-bold mb-2 mt-2">PASSENGER LIST (Detailed)</Typography>

                        {/* New Passenger Input Form */}
                        <Box sx={{ p: 2, border: "1px dashed #ccc", borderRadius: 2, mb: 2 }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        label="Passenger Name"
                                        fullWidth
                                        size="small"
                                        value={newPassenger.name}
                                        onChange={(e) => setNewPassenger({ ...newPassenger, name: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        label="Passenger Phone"
                                        fullWidth
                                        size="small"
                                        value={newPassenger.phone}
                                        onChange={(e) => setNewPassenger({ ...newPassenger, phone: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        label="Pickup Point"
                                        fullWidth
                                        size="small"
                                        value={newPassenger.pickup || ""}
                                        onChange={(e) => setNewPassenger({ ...newPassenger, pickup: e.target.value })}
                                        placeholder="Detailed Location"
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        label="Drop-off Point"
                                        fullWidth
                                        size="small"
                                        value={newPassenger.drop || ""}
                                        onChange={(e) => setNewPassenger({ ...newPassenger, drop: e.target.value })}
                                        placeholder="Detailed Location"
                                    />
                                </Grid>
                                <Grid item xs={12} md={2}>
                                    <TextField
                                        label="+ Guests"
                                        type="number"
                                        fullWidth
                                        size="small"
                                        value={newPassenger.count || ""}
                                        onChange={(e) => setNewPassenger({ ...newPassenger, count: e.target.value })}
                                        placeholder="0"
                                    />
                                </Grid>
                                <Grid item xs={12} md={2}>
                                    <Button variant="contained" onClick={handleAddPassenger} fullWidth sx={{ height: "40px" }}>Add</Button>
                                </Grid>
                            </Grid>
                        </Box>

                        {/* Passenger List Display */}
                        <Box className="flex flex-col gap-2 mt-2">
                            {formData.passengers.map((p, index) => (
                                <Box key={index} sx={{
                                    p: 1.5,
                                    border: "1px solid #eee",
                                    borderRadius: 1,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    bgcolor: "#f9f9f9"
                                }}>
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                                            {p.name || "Guest"} {p.phone && <span className="text-gray-500 font-normal">({p.phone})</span>}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: "0.85rem", color: "#555" }}>
                                            <span style={{ fontWeight: 600 }}>Route:</span> {p.pickup || "N/A"} ➝ {p.drop || "N/A"}
                                        </Typography>
                                        {p.count > 0 && (
                                            <Typography variant="caption" sx={{ color: "primary.main", fontWeight: "bold" }}>
                                                + {p.count} accompanying guest{p.count > 1 ? 's' : ''}
                                            </Typography>
                                        )}
                                    </Box>
                                    <IconButton onClick={() => handleRemovePassenger(index)} size="small" color="error">
                                        <MdClose />
                                    </IconButton>
                                </Box>
                            ))}
                            {formData.passengers.length === 0 && (
                                <Typography variant="body2" className="text-gray-400 italic text-center py-2">
                                    No passengers added yet.
                                </Typography>
                            )}
                        </Box>
                    </Grid>

                    {/* Driver Details */}
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" className="text-primary-600 font-bold mb-2 mt-2">DRIVER ASSIGNMENT (Optional)</Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Driver Name" fullWidth
                                    value={formData.driverName} onChange={e => setFormData({ ...formData, driverName: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Driver Phone" fullWidth
                                    value={formData.driverPhone} onChange={e => setFormData({ ...formData, driverPhone: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    label="Internal Notes" fullWidth multiline rows={2}
                                    value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </Grid>
                        </Grid>
                    </Grid>

                </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 2.5, borderTop: "1px solid #eee" }}>
                <Button onClick={handleClose} color="inherit">Cancel</Button>
                <Button onClick={handleSubmit} variant="contained" color="primary">{bookingData?.id ? "Update Booking" : "Create Booking"}</Button>
            </DialogActions>
        </Dialog>
    );
};

export default AddVanBookingModal;
