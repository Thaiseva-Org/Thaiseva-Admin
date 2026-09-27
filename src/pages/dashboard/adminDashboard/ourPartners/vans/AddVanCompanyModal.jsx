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
    Divider,
    Chip,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Box
} from "@mui/material";
import { MdClose, MdDelete, MdAdd } from "@icons";
import { doc, setDoc, updateDoc, addDoc } from "firebase/firestore";
import { vanCompaniesCollection } from "../../../../../firebase/firebase.config";
import { successNotification } from "../../../../../utils/utils";

const AddVanCompanyModal = ({ open, handleClose, isEdit, initialData }) => {
    const [formData, setFormData] = useState({
        name: "",
        contact: "",
        address: "",
        description: "",
    });

    const [vanTypes, setVanTypes] = useState([]);
    const [newType, setNewType] = useState({ name: "", capacity: "" });

    const [vanVehicles, setVanVehicles] = useState([]);
    const [newVehicle, setNewVehicle] = useState({ number: "", type: "" });

    useEffect(() => {
        if (isEdit && initialData) {
            setFormData({
                name: initialData.name || "",
                contact: initialData.contact || "",
                address: initialData.address || "",
                description: initialData.description || "",
            });
            setVanTypes(initialData.vanTypes || []);
            setVanVehicles(initialData.vanNumbers || []);
        } else {
            // Reset
            setFormData({ name: "", contact: "", address: "", description: "" });
            setVanTypes([]);
            setVanVehicles([]);
        }
    }, [isEdit, initialData, open]);

    const handleAddType = () => {
        if (newType.name && newType.capacity) {
            setVanTypes([...vanTypes, { ...newType, id: Date.now().toString() }]);
            setNewType({ name: "", capacity: "" });
        }
    };

    const handleDeleteType = (id) => {
        setVanTypes(vanTypes.filter(t => t.id !== id));
        // Also remove vehicles of this type or warn? For now just remove
        setVanVehicles(vanVehicles.filter(v => v.type !== id));
    };

    const handleAddVehicle = () => {
        if (newVehicle.number && newVehicle.type) {
            setVanVehicles([...vanVehicles, { ...newVehicle, id: Date.now().toString() }]);
            setNewVehicle({ number: "", type: "" });
        }
    };

    const handleDeleteVehicle = (id) => {
        setVanVehicles(vanVehicles.filter(v => v.id !== id));
    };

    const handleSubmit = async () => {
        if (!formData.name) return;

        const payload = {
            ...formData,
            vanTypes,
            vanNumbers: vanVehicles,
            updatedAt: new Date().toISOString()
        };

        try {
            if (isEdit && initialData?.uid) {
                await updateDoc(doc(vanCompaniesCollection, initialData.uid), payload);
                successNotification("Van Company updated successfully");
            } else {
                payload.createdAt = new Date().toISOString();
                await addDoc(vanCompaniesCollection, payload);
                successNotification("Van Company added successfully");
            }
            handleClose();
        } catch (error) {
            console.error("Error saving van company:", error);
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
            <DialogTitle sx={{ borderBottom: "1px solid #eee", fontSize: "1.25rem", fontWeight: "bold" }}>
                {isEdit ? "Edit Van Company" : "Add Van Company"}
                <IconButton
                    onClick={handleClose}
                    sx={{ position: "absolute", right: 8, top: 8, color: "grey.500" }}
                >
                    <MdClose />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: 3 }}>
                <Grid container spacing={3} sx={{ mt: 0 }}>
                    {/* Company Details */}
                    <Grid item xs={12}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>Company Details</Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Company Name"
                                    fullWidth
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Contact Info (Phone/Email)"
                                    fullWidth
                                    value={formData.contact}
                                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    label="Address"
                                    fullWidth
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            </Grid>
                        </Grid>
                    </Grid>

                    <Grid item xs={12}><Divider /></Grid>

                    {/* Van Types */}
                    <Grid item xs={12}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>Van Types</Typography>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={5}>
                                <TextField
                                    label="Type Name (e.g. Luxury Van)"
                                    fullWidth
                                    size="small"
                                    value={newType.name}
                                    onChange={(e) => setNewType({ ...newType, name: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={4}>
                                <TextField
                                    label="Capacity"
                                    fullWidth
                                    size="small"
                                    type="number"
                                    value={newType.capacity}
                                    onChange={(e) => setNewType({ ...newType, capacity: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={3}>
                                <Button variant="contained" onClick={handleAddType} startIcon={<MdAdd />}>Add</Button>
                            </Grid>
                        </Grid>
                        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {vanTypes.map((type) => (
                                <Chip
                                    key={type.id}
                                    label={`${type.name} (${type.capacity} seats)`}
                                    onDelete={() => handleDeleteType(type.id)}
                                    color="primary"
                                    variant="outlined"
                                />
                            ))}
                        </Box>
                    </Grid>

                    <Grid item xs={12}><Divider /></Grid>

                    {/* Van Vehicles */}
                    <Grid item xs={12}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>Van Vehicles</Typography>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={5}>
                                <TextField
                                    label="Van Number / Plate"
                                    fullWidth
                                    size="small"
                                    value={newVehicle.number}
                                    onChange={(e) => setNewVehicle({ ...newVehicle, number: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={4}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Type</InputLabel>
                                    <Select
                                        value={newVehicle.type}
                                        label="Type"
                                        onChange={(e) => setNewVehicle({ ...newVehicle, type: e.target.value })}
                                    >
                                        {vanTypes.map(t => (
                                            <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={3}>
                                <Button variant="contained" onClick={handleAddVehicle} startIcon={<MdAdd />}>Add</Button>
                            </Grid>
                        </Grid>

                        {/* List Vehicles */}
                        <div className="mt-3 border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-2 text-left">Plate Number</th>
                                        <th className="p-2 text-left">Type</th>
                                        <th className="p-2 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {vanVehicles.map(v => {
                                        const type = vanTypes.find(t => t.id === v.type);
                                        return (
                                            <tr key={v.id}>
                                                <td className="p-2">{v.number}</td>
                                                <td className="p-2">{type ? type.name : 'Unknown'}</td>
                                                <td className="p-2 text-center">
                                                    <IconButton size="small" color="error" onClick={() => handleDeleteVehicle(v.id)}><MdDelete /></IconButton>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {vanVehicles.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-gray-500">No vehicles added</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Grid>

                </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 2.5, borderTop: "1px solid #eee" }}>
                <Button onClick={handleClose} color="inherit">Cancel</Button>
                <Button onClick={handleSubmit} variant="contained" color="primary">Save Company</Button>
            </DialogActions>
        </Dialog>
    );
};

export default AddVanCompanyModal;
