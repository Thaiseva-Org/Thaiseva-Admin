import React, { useState, useEffect } from "react";
import {
    Button,
    Card,
    CardContent,
    CardActions,
    Grid,
    IconButton,
    Typography,
    Rating,
    Avatar,
    Fade,
    Skeleton,
    TextField,
    Box
} from "@mui/material";
import DragDropImageUploader from "../../../../components/websiteConfig/DragDropImageUploader";
import ConfigHeader from "../../../../components/websiteConfig/ConfigHeader";
import Swal from "sweetalert2";
import { DeleteIcon } from "@icons";
import { EditIcon } from "@icons";
import { FormatQuoteIcon } from "@icons";
import { SortIcon } from "@icons";
import { deleteTestimonial, getAdminTestimonials, saveTestimonial } from "../../../../services/WebsiteConfig";
import { getZodErrorMessage, testimonialSchema } from "../../../../validation/websiteConfigSchemas";

// Custom Modal Components
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import DialogActions from "@mui/material/DialogActions";

const Testimonials = () => {
    const [testimonials, setTestimonials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openModal, setOpenModal] = useState(false);
    const [isUpdate, setIsUpdate] = useState(false);
    const [selectedId, setSelectedId] = useState(null);

    const [currentTestimonial, setCurrentTestimonial] = useState({
        user: "",
        role: "",
        rating: 5,
        text: "",
        image: "",
        displayOrder: 0,
    });

    const fetchTestimonials = async () => {
        setLoading(true);
        try {
            const data = await getAdminTestimonials();
            setTestimonials(data);
        } catch (error) {
            console.error("Error fetching testimonials:", error);
            Swal.fire("Error", "Failed to fetch testimonials.", "error");
        } finally {
            setTimeout(() => setLoading(false), 500);
        }
    };

    useEffect(() => {
        fetchTestimonials();
    }, []);

    const handleOpenAdd = () => {
        setCurrentTestimonial({
            user: "",
            role: "",
            rating: 5,
            text: "",
            image: "",
            displayOrder: testimonials.length + 1,
        });
        setIsUpdate(false);
        setSelectedId(null);
        setOpenModal(true);
    };

    const handleOpenEdit = (item) => {
        setCurrentTestimonial({
            user: item.user || "",
            role: item.role || "",
            rating: item.rating || 5,
            text: item.text || "",
            image: item.image || "",
            displayOrder: item.displayOrder || 0,
        });
        setIsUpdate(true);
        setSelectedId(item.id);
        setOpenModal(true);
    };

    const handleCloseModal = () => setOpenModal(false);

    const handleChange = (e) => {
        setCurrentTestimonial({ ...currentTestimonial, [e.target.name]: e.target.value });
    };

    const handleImageChange = (url) => setCurrentTestimonial(prev => ({ ...prev, image: url }));

    const handleSave = async () => {
        const parsedTestimonial = testimonialSchema.safeParse({
            ...currentTestimonial,
            user: currentTestimonial.user.trim(),
            role: currentTestimonial.role.trim(),
            text: currentTestimonial.text.trim(),
            image: currentTestimonial.image.trim(),
            rating: Number(currentTestimonial.rating),
            displayOrder: Number(currentTestimonial.displayOrder) || 0,
        });

        if (!parsedTestimonial.success) {
            Swal.fire("Validation Error", getZodErrorMessage(parsedTestimonial.error), "warning");
            return;
        }

        try {
            await saveTestimonial(parsedTestimonial.data, isUpdate ? selectedId : null);
            Swal.fire({ icon: 'success', title: isUpdate ? 'Testimonial Updated' : 'Testimonial Added', timer: 1000, showConfirmButton: false });
            setOpenModal(false);
            fetchTestimonials();
        } catch (error) {
            Swal.fire("Error", "Action failed.", "error");
        }
    };

    const handleDelete = async (id) => {
        Swal.fire({
            title: "Delete review?",
            text: "This cannot be undone.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteTestimonial(id);
                    fetchTestimonials();
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
                title="Testimonials"
                subtitle="Manage customer reviews and feedback."
                onAdd={handleOpenAdd}
                addLabel="Add Testimonial"
            />

            {loading ? (
                <Grid container spacing={3}>
                    {[1, 2, 3].map(i => (
                        <Grid item xs={12} sm={6} md={4} key={i}>
                            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: "16px", mb: 2 }} />
                            <Skeleton width="60%" />
                            <Skeleton width="40%" />
                        </Grid>
                    ))}
                </Grid>
            ) : testimonials.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <FormatQuoteIcon sx={{ fontSize: 60, color: '#e2e8f0' }} />
                    <Typography className="text-gray-400 mt-2">No testimonials yet.</Typography>
                </div>
            ) : (
                <Grid container spacing={4}>
                    {testimonials.map((item) => (
                        <Grid item xs={12} sm={6} md={4} key={item.id}>
                            <Fade in={true} timeout={500}>
                                <Card
                                    sx={{
                                        borderRadius: "20px",
                                        height: "100%",
                                        display: "flex",
                                        flexDirection: "column",
                                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                                        border: "1px solid #f8fafc",
                                        position: 'relative',
                                        overflow: 'visible',
                                        mt: 4, // Space for avatar
                                    }}
                                >
                                    <div className="absolute -top-6 left-0 right-0 flex justify-center">
                                        <Avatar
                                            src={item.image}
                                            sx={{
                                                width: 64,
                                                height: 64,
                                                border: '4px solid white',
                                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                                            }}
                                        />
                                    </div>

                                    <CardContent sx={{ flexGrow: 1, pt: 6, textAlign: "center", px: 3 }}>
                                        <FormatQuoteIcon sx={{ color: '#e2e8f0', fontSize: 30 }} />

                                        <Typography variant="body1" className="text-gray-600 italic mb-4 line-clamp-4 relative z-10">
                                            "{item.text}"
                                        </Typography>

                                        <Rating value={Number(item.rating)} readOnly size="small" className="mb-2" />

                                        <Typography variant="h6" className="font-bold text-gray-800 text-sm">
                                            {item.user}
                                        </Typography>
                                        <Typography variant="caption" className="text-gray-400 uppercase tracking-wide font-medium">
                                            {item.role}
                                        </Typography>
                                    </CardContent>

                                    <CardActions sx={{ justifyContent: "space-between", px: 3, pb: 2, borderTop: '1px solid #f8fafc' }}>
                                        <div className="flex items-center gap-1 text-xs text-gray-400">
                                            <SortIcon fontSize="inherit" /> Order: {item.displayOrder}
                                        </div>
                                        <div>
                                            <IconButton onClick={() => handleOpenEdit(item)} size="small" className="bg-blue-50 text-blue-500 hover:bg-blue-100">
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton onClick={() => handleDelete(item.id)} size="small" className="bg-red-50 text-red-500 hover:bg-red-100 ml-2">
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </div>
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
                <DialogTitle sx={{ fontWeight: 700 }}>{isUpdate ? "Edit Testimonial" : "Add Testimonial"}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={3} sx={{ mt: 0 }}>
                        <Grid item xs={12} className="flex justify-center">
                            <Box className="w-full">
                                <DragDropImageUploader cropWidth={600} cropHeight={600}
                                    label="User Avatar"
                                    image={currentTestimonial.image}
                                    onImageChange={handleImageChange}
                                    folder="testimonials"
                                    height={140}
                                />
                            </Box>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="User Name"
                                name="user"
                                value={currentTestimonial.user}
                                onChange={handleChange}
                                fullWidth
                                variant="outlined"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                label="Role/Job Title"
                                name="role"
                                value={currentTestimonial.role}
                                onChange={handleChange}
                                fullWidth
                                variant="outlined"
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <Typography component="legend" className="text-sm text-gray-500 mb-1">Rating</Typography>
                            <div className="border border-gray-300 rounded p-2 flex justify-center">
                                <Rating
                                    name="rating"
                                    value={Number(currentTestimonial.rating)}
                                    onChange={(event, newValue) => {
                                        setCurrentTestimonial(prev => ({ ...prev, rating: newValue ?? 1 }));
                                    }}
                                />
                            </div>
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                label="Display Order"
                                name="displayOrder"
                                type="number"
                                value={currentTestimonial.displayOrder}
                                onChange={handleChange}
                                fullWidth
                                variant="outlined"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Review Text"
                                name="text"
                                value={currentTestimonial.text}
                                onChange={handleChange}
                                fullWidth
                                multiline
                                rows={4}
                                variant="outlined"
                                placeholder="What did they say?"
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
                        {isUpdate ? "Update Review" : "Add Review"}
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default Testimonials;
