import React, { useState, useEffect } from "react";
import {
    Button,
    Card,
    CardContent,
    CardMedia,
    CardActions,
    Grid,
    IconButton,
    Typography,
    Fade,
    Skeleton,
    TextField,
    Chip
} from "@mui/material";
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../../firebase/firebase.config";
import DragDropImageUploader from "../../../../components/websiteConfig/DragDropImageUploader";
import ConfigHeader from "../../../../components/websiteConfig/ConfigHeader";
import Swal from "sweetalert2";
import { DeleteIcon } from "@icons";
import { EditIcon } from "@icons";
import { LinkIcon } from "@icons";
import { PaletteIcon } from "@icons";
import { AppsIcon } from "@icons";

// Custom Modal Components
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import DialogActions from "@mui/material/DialogActions";

const Services = () => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openModal, setOpenModal] = useState(false);
    const [isUpdate, setIsUpdate] = useState(false);
    const [selectedId, setSelectedId] = useState(null);

    const [currentService, setCurrentService] = useState({
        title: "",
        subtitle: "",
        description: "",
        icon: "",
        color: "",
        link: "",
        image: "",
    });

    const fetchServices = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "ServiceDB"));
            const servicesData = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setServices(servicesData);
        } catch (error) {
            console.error("Error fetching services:", error);
        } finally {
            setTimeout(() => setLoading(false), 500);
        }
    };

    useEffect(() => {
        fetchServices();
    }, []);

    const handleOpenAdd = () => {
        setCurrentService({
            title: "",
            subtitle: "",
            description: "",
            icon: "",
            color: "",
            link: "",
            image: "",
        });
        setIsUpdate(false);
        setSelectedId(null);
        setOpenModal(true);
    };

    const handleOpenEdit = (service) => {
        setCurrentService({
            title: service.title || "",
            subtitle: service.subtitle || "",
            description: service.description || "",
            icon: service.icon || "",
            color: service.color || "",
            link: service.link || "",
            image: service.image || "",
        });
        setIsUpdate(true);
        setSelectedId(service.id);
        setOpenModal(true);
    };

    const handleCloseModal = () => setOpenModal(false);

    const handleChange = (e) => {
        setCurrentService({ ...currentService, [e.target.name]: e.target.value });
    };

    const handleImageChange = (url) => setCurrentService(prev => ({ ...prev, image: url }));

    const handleSave = async () => {
        if (!currentService.title) {
            Swal.fire("Validation Error", "Title is required", "warning");
            return;
        }

        try {
            if (isUpdate && selectedId) {
                const serviceRef = doc(db, "ServiceDB", selectedId);
                await updateDoc(serviceRef, {
                    ...currentService,
                    updatedAt: serverTimestamp(),
                });
                Swal.fire({ icon: 'success', title: 'Updated', timer: 1000, showConfirmButton: false });
            } else {
                await addDoc(collection(db, "ServiceDB"), {
                    ...currentService,
                    createdAt: serverTimestamp(),
                });
                Swal.fire({ icon: 'success', title: 'Added', timer: 1000, showConfirmButton: false });
            }
            setOpenModal(false);
            fetchServices();
        } catch (error) {
            Swal.fire("Error", "Action failed.", "error");
        }
    };

    const handleDelete = async (id) => {
        Swal.fire({
            title: "Confirm Delete",
            text: "Remove this service card?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(db, "ServiceDB", id));
                    fetchServices();
                    Swal.fire("Deleted", "", "success");
                } catch (error) {
                    Swal.fire("Error", "Failed to delete.", "error");
                }
            }
        });
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <ConfigHeader
                title="Our Services"
                subtitle="Manage the service cards and links displayed on your home page."
                onAdd={handleOpenAdd}
                addLabel="Add Service Card"
            />

            {loading ? (
                <Grid container spacing={3}>
                    {[1, 2, 3].map(i => (
                        <Grid item xs={12} sm={6} md={4} key={i}>
                            <Skeleton variant="rectangular" height={160} sx={{ borderRadius: "16px", mb: 2 }} />
                            <Skeleton width="80%" />
                            <Skeleton width="40%" />
                        </Grid>
                    ))}
                </Grid>
            ) : services.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <AppsIcon sx={{ fontSize: 60, color: '#e2e8f0' }} />
                    <Typography className="text-gray-400 mt-2">No services added yet.</Typography>
                </div>
            ) : (
                <Grid container spacing={4}>
                    {services.map((service) => (
                        <Grid item xs={12} sm={6} md={4} key={service.id}>
                            <Fade in={true} timeout={500}>
                                <Card
                                    sx={{
                                        borderRadius: "20px",
                                        height: "100%",
                                        display: "flex",
                                        flexDirection: "column",
                                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                                        border: "1px solid #f8fafc",
                                        transition: "transform 0.2s",
                                        "&:hover": { transform: "translateY(-4px)", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }
                                    }}
                                >
                                    <CardMedia
                                        component="img"
                                        height="160"
                                        image={service.image || "https://placehold.co/600x400?text=No+Service+Image"}
                                        alt={service.title}
                                        sx={{ height: 160, objectFit: "cover" }}
                                    />

                                    <CardContent sx={{ flexGrow: 1, p: 3 }}>
                                        <div className="flex justify-between items-start mb-2">
                                            <Typography variant="h6" className="font-bold text-gray-800 leading-tight">
                                                {service.title}
                                            </Typography>
                                            {service.icon && <Chip label={service.icon} size="small" variant="outlined" sx={{ fontSize: '0.65rem', borderRadius: '4px' }} />}
                                        </div>

                                        <Typography variant="subtitle2" className="text-blue-500 font-medium mb-2 uppercase text-xs tracking-wider">
                                            {service.subtitle}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" className="line-clamp-3 leading-relaxed">
                                            {service.description}
                                        </Typography>
                                    </CardContent>

                                    <CardActions sx={{ justifyContent: "flex-end", p: 2, pt: 0 }}>
                                        <IconButton onClick={() => handleOpenEdit(service)} size="small" className="bg-blue-50 text-blue-500 hover:bg-blue-100">
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton onClick={() => handleDelete(service.id)} size="small" className="bg-red-50 text-red-500 hover:bg-red-100 ml-2">
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </CardActions>
                                </Card>
                            </Fade>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Add/Edit Modal */}
            <Dialog
                open={openModal}
                onClose={handleCloseModal}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: '24px', padding: 1 } }}
            >
                <DialogTitle sx={{ fontWeight: 700 }}>{isUpdate ? "Edit Service" : "Add Service Card"}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={3} sx={{ mt: 0 }}>
                        <Grid item xs={12}>
                            <TextField
                                label="Service Title"
                                name="title"
                                value={currentService.title}
                                onChange={handleChange}
                                fullWidth
                                variant="outlined"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Subtitle (Optional)"
                                name="subtitle"
                                value={currentService.subtitle}
                                onChange={handleChange}
                                fullWidth
                                variant="outlined"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Description"
                                name="description"
                                value={currentService.description}
                                onChange={handleChange}
                                fullWidth
                                multiline
                                rows={3}
                                variant="outlined"
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <DragDropImageUploader
                                label="Service Image"
                                image={currentService.image}
                                onImageChange={handleImageChange}
                                folder="services"
                                height={180}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ pb: 3, px: 3 }}>
                    <Button onClick={handleCloseModal} sx={{ color: 'gray' }}>Cancel</Button>
                    <Button
                        onClick={handleSave}
                        variant="contained"
                        sx={{
                            borderRadius: '8px',
                            bgcolor: 'var(--primary-500)',
                            px: 4,
                            "&:hover": { bgcolor: "var(--primary-600)" }
                        }}
                    >
                        {isUpdate ? "Update" : "Add Service"}
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default Services;
