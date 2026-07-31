import { useState, useEffect } from "react";
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
    Box
} from "@mui/material";
import { MdClose } from "react-icons/md";
import { getDocs, updateDoc, doc } from "firebase/firestore";
import {
    vanBookingsCollection,
    carBookingsCollection,
    transportCompaniesCollection,
    transportDriversCollection,
    transportVehiclesCollection,
} from "../../../../../firebase/firebase.config";
import { successNotification } from "../../../../../utils/utils";
import {
    mapVanBookingForManualWrite,
    mapVanBookingForMobileWrite,
} from "../../../../../utils/vanBookingMapper";
import { createManualVanBooking } from "../../../../../services/TransportWorkflow";
import {
    DEMO_TRANSPORT_COMPANIES,
    DEMO_TRANSPORT_DRIVERS,
    DEMO_TRANSPORT_VEHICLES,
} from "../../../../../data/transportDemoData";

const CUSTOM_ID = "__custom__";

const buildVanCompanyOptions = (companyRecords, vehicleList) => companyRecords
    .map(companyRecord => {
        const company = { ...companyRecord, uid: companyRecord.id };
        const companyVehicles = vehicleList.filter(vehicle =>
            vehicle.companyId === companyRecord.id &&
            vehicle.active !== false &&
            String(vehicle.vehicleType || "").toLowerCase().includes("van")
        );
        const types = [...new Set(companyVehicles.map(vehicle => vehicle.vehicleType || "Van"))];
        return {
            ...company,
            name: company.companyName,
            vanTypes: types.map(name => ({ id: name, name, capacity: "" })),
            vanNumbers: companyVehicles.map(vehicle => ({
                id: vehicle.id,
                number: vehicle.registrationNumber,
                name: vehicle.vehicleName,
                type: vehicle.vehicleType || "Van",
            })),
        };
    })
    .filter(company => company.active !== false && ["Van Company", "Taxi and Van Company"].includes(company.companyType));

const AddVanBookingModal = ({ open, handleClose, bookingData }) => {
    const [companies, setCompanies] = useState(() =>
        buildVanCompanyOptions(DEMO_TRANSPORT_COMPANIES, DEMO_TRANSPORT_VEHICLES)
    );
    const [, setLoadingCompanies] = useState(true);
    const [drivers, setDrivers] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        companyId: "",
        companyName: "", // Store name for easier display
        companyPhone: "",
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
        driverId: "",
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

    // Derived state for dropdowns
    const [availableTypes, setAvailableTypes] = useState([]);
    const [availableVehicles, setAvailableVehicles] = useState([]); // All vehicles for the company
    const [filteredVehicles, setFilteredVehicles] = useState([]); // Filtered by type

    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const [companySnap, driverSnap, vehicleSnap] = await Promise.all([
                    getDocs(transportCompaniesCollection),
                    getDocs(transportDriversCollection),
                    getDocs(transportVehiclesCollection),
                ]);
                const vehicleRecords = vehicleSnap.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id }));
                const vehicleList = vehicleRecords.length ? vehicleRecords : DEMO_TRANSPORT_VEHICLES;
                const companyRecords = companySnap.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id }));
                const list = buildVanCompanyOptions(
                    companyRecords.length ? companyRecords : DEMO_TRANSPORT_COMPANIES,
                    vehicleList
                );
                setCompanies(list);
                const driverRecords = driverSnap.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id }));
                setDrivers((driverRecords.length ? driverRecords : DEMO_TRANSPORT_DRIVERS)
                    .filter(driver => driver.active !== false));
            } catch (err) {
                console.error(err);
                setCompanies(buildVanCompanyOptions(DEMO_TRANSPORT_COMPANIES, DEMO_TRANSPORT_VEHICLES));
                setDrivers(DEMO_TRANSPORT_DRIVERS);
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
                companyPhone: bookingData.companySnapshot?.phone || "",
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
                driverId: bookingData.driverId || "",
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
                companyPhone: "",
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
                driverId: "",
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
        const isCustom = pId === CUSTOM_ID;

        setFormData(prev => ({
            ...prev,
            companyId: pId,
            companyName: company?.name || "",
            companyPhone: company?.phone || "",
            vanTypeId: isCustom ? CUSTOM_ID : "",
            vanTypeName: isCustom ? "Van" : "",
            vanNumberId: isCustom ? CUSTOM_ID : "",
            vanNumber: "",
            vehicleName: "",
            driverId: isCustom ? CUSTOM_ID : "",
            driverName: "",
            driverPhone: ""
        }));

        if (isCustom) {
            setAvailableTypes([]);
            setAvailableVehicles([]);
            setFilteredVehicles([]);
        } else if (company) {
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
            vanTypeName: type?.name || (tId === CUSTOM_ID ? "" : ""),
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
            vanNumber: vehicle?.number || "",
            vehicleId: vId,
            vehicleName: vehicle?.name || "",
        }));
    };

    const handleDriverChange = (event) => {
        const driver = drivers.find(item => item.id === event.target.value);
        setFormData(prev => ({
            ...prev,
            driverId: event.target.value,
            driverName: driver?.driverName || "",
            driverPhone: driver?.phone || "",
        }));
    };

    const handleSubmit = async () => {
        // Validation: For mobile/taxi edits, we might not have company details yet, but if they are adding them, good.
        // For new manual bookings, strict validation.
        const isMobile = bookingData?.source === 'mobile';

        if (!isMobile && (!formData.companyId || !formData.vanTypeId || !formData.vanNumberId || !formData.driverId || !formData.bookingDate || !formData.guestName || !formData.pickupLocation || !formData.dropLocation)) {
            alert("Please fill company, van, driver, travel date, guest, pickup and destination.");
            return;
        }
        if (!isMobile && (
            (formData.companyId === CUSTOM_ID && (!formData.companyName || !formData.companyPhone)) ||
            (formData.vanNumberId === CUSTOM_ID && (!formData.vehicleName || !formData.vanNumber)) ||
            (formData.driverId === CUSTOM_ID && (!formData.driverName || !formData.driverPhone))
        )) {
            alert("Please complete all custom company, vehicle, and driver details.");
            return;
        }

        if (!(Number(formData.price) > 0)) {
            alert("Price must be greater than zero.");
            return;
        }

        setSubmitting(true);
        try {
            if (bookingData?.id) {
                const collectionRef =
                    bookingData.source === "mobile"
                        ? carBookingsCollection
                        : vanBookingsCollection;

                const payload = isMobile
                    ? {
                        ...mapVanBookingForMobileWrite(formData),
                        passengers: formData.passengers,
                    }
                    : {
                        ...mapVanBookingForManualWrite(formData),
                        companyId: formData.companyId === CUSTOM_ID ? null : formData.companyId,
                        companyName: formData.companyName,
                        vanTypeId: formData.vanTypeId,
                        vanNumberId: formData.vanNumberId,
                        vanNumber: formData.vanNumber,
                        agentName: formData.agentName,
                        agentPhone: formData.agentPhone,
                        driverName: formData.driverName,
                        driverPhone: formData.driverPhone,
                        driverId: formData.driverId === CUSTOM_ID ? null : formData.driverId,
                        vehicleId: formData.vanNumberId === CUSTOM_ID ? null : formData.vanNumberId,
                        companySnapshot: {
                            name: formData.companyName,
                            phone: formData.companyPhone || "",
                            companyType: formData.companyId === CUSTOM_ID ? "Custom" : "Van Company",
                        },
                        driverSnapshot: {
                            name: formData.driverName,
                            phone: formData.driverPhone,
                        },
                        vehicleSnapshot: {
                            name: formData.vehicleName || formData.vanTypeName,
                            vehicleType: formData.vanTypeName || "Van",
                            registrationNumber: formData.vanNumber,
                        },
                        notes: formData.notes,
                        passengers: formData.passengers,
                    };

                await updateDoc(doc(collectionRef, bookingData.id), payload);
                successNotification("Booking Updated Successfully");
            } else {
                await createManualVanBooking({
                    ...formData,
                    vehicleId: formData.vanNumberId,
                });
                successNotification("Booking Created Successfully");
            }
            handleClose();
        } catch (err) {
            console.error(err);
            alert(err?.message || "Unable to save booking.");
        } finally {
            setSubmitting(false);
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
                                        <MenuItem value={CUSTOM_ID}>Custom / unregistered company</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            {formData.companyId === CUSTOM_ID && <Grid item xs={12} md={4}>
                                <TextField label="Custom company name" required fullWidth value={formData.companyName} onChange={e => setFormData({ ...formData, companyName: e.target.value })} />
                            </Grid>}
                            {formData.companyId === CUSTOM_ID && <Grid item xs={12} md={4}>
                                <TextField label="Custom company phone" required fullWidth value={formData.companyPhone || ""} onChange={e => setFormData({ ...formData, companyPhone: e.target.value })} />
                            </Grid>}
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
                                        <MenuItem value={CUSTOM_ID}>Custom van type</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            {formData.vanTypeId === CUSTOM_ID && <Grid item xs={12} md={4}>
                                <TextField label="Custom van type" required fullWidth value={formData.vanTypeName} onChange={e => setFormData({ ...formData, vanTypeName: e.target.value })} />
                            </Grid>}
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
                                        <MenuItem value={CUSTOM_ID}>Custom / unregistered van</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            {formData.vanNumberId === CUSTOM_ID && <>
                                <Grid item xs={12} md={4}><TextField label="Custom vehicle name" required fullWidth value={formData.vehicleName || ""} onChange={e => setFormData({ ...formData, vehicleName: e.target.value })} /></Grid>
                                <Grid item xs={12} md={4}><TextField label="Custom registration number" required fullWidth value={formData.vanNumber} onChange={e => setFormData({ ...formData, vanNumber: e.target.value })} /></Grid>
                            </>}
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
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Price (฿)"
                                    type="number"
                                    fullWidth
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    InputProps={{ inputProps: { min: 0 } }}
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
                                <FormControl fullWidth>
                                    <InputLabel>Registered Driver</InputLabel>
                                    <Select value={formData.driverId || ""} label="Registered Driver" onChange={handleDriverChange} disabled={!formData.companyId}>
                                        <MenuItem value={CUSTOM_ID}>Custom / unregistered driver</MenuItem>
                                        {drivers.filter(driver => driver.companyId === formData.companyId && ["Available", "Assigned"].includes(driver.availabilityStatus || "Available")).map(driver => (
                                            <MenuItem key={driver.id} value={driver.id}>{driver.driverName} · {driver.phone}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            {formData.driverId === CUSTOM_ID && <Grid item xs={12} md={6}>
                                <TextField label="Custom driver name" required fullWidth value={formData.driverName} onChange={e => setFormData({ ...formData, driverName: e.target.value })} />
                            </Grid>}
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
                <Button onClick={handleClose} color="inherit" disabled={submitting}>Cancel</Button>
                <Button onClick={handleSubmit} variant="contained" color="primary" disabled={submitting}>{submitting ? "Saving…" : bookingData?.id ? "Update Booking" : "Create Booking"}</Button>
            </DialogActions>
        </Dialog>
    );
};

export default AddVanBookingModal;
