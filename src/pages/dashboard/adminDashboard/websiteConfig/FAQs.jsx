import React, { useState, useEffect } from "react";
import {
    Button,
    IconButton,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Grid,
    TextField,
    MenuItem,
    Skeleton,
    Fade
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
import ConfigHeader from "../../../../components/websiteConfig/ConfigHeader";
import Swal from "sweetalert2";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import EditIcon from "@mui/icons-material/EditOutlined";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";

// Custom Modal Components
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import DialogActions from "@mui/material/DialogActions";

const FAQs = () => {
    const [faqs, setFaqs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openModal, setOpenModal] = useState(false);
    const [isUpdate, setIsUpdate] = useState(false);
    const [selectedId, setSelectedId] = useState(null);

    const [currentFaq, setCurrentFaq] = useState({
        question: "",
        answer: "",
        category: "general", // general, payment, booking
    });

    const fetchFaqs = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "FaqDB"));
            const data = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setFaqs(data);
        } catch (error) {
            console.error("Error fetching FAQs:", error);
        } finally {
            setTimeout(() => setLoading(false), 500);
        }
    };

    useEffect(() => {
        fetchFaqs();
    }, []);

    const handleOpenAdd = () => {
        setCurrentFaq({
            question: "",
            answer: "",
            category: "general",
        });
        setIsUpdate(false);
        setSelectedId(null);
        setOpenModal(true);
    };

    const handleOpenEdit = (item) => {
        setCurrentFaq({
            question: item.question || "",
            answer: item.answer || "",
            category: item.category || "general",
        });
        setIsUpdate(true);
        setSelectedId(item.id);
        setOpenModal(true);
    };

    const handleCloseModal = () => setOpenModal(false);

    const handleChange = (e) => {
        setCurrentFaq({ ...currentFaq, [e.target.name]: e.target.value });
    };

    const handleSave = async () => {
        if (!currentFaq.question || !currentFaq.answer) {
            Swal.fire("Validation Error", "Question and Answer are required", "warning");
            return;
        }

        try {
            if (isUpdate && selectedId) {
                const docRef = doc(db, "FaqDB", selectedId);
                await updateDoc(docRef, {
                    ...currentFaq,
                    updatedAt: serverTimestamp(),
                });
                Swal.fire({ icon: 'success', title: 'Updated', timer: 1000, showConfirmButton: false });
            } else {
                await addDoc(collection(db, "FaqDB"), {
                    ...currentFaq,
                    createdAt: serverTimestamp(),
                });
                Swal.fire({ icon: 'success', title: 'Added', timer: 1000, showConfirmButton: false });
            }
            setOpenModal(false);
            fetchFaqs();
        } catch (error) {
            Swal.fire("Error", "Action failed.", "error");
        }
    };

    const handleDelete = async (id) => {
        Swal.fire({
            title: "Delete FAQ?",
            text: "This removal is permanent.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(db, "FaqDB", id));
                    fetchFaqs();
                    Swal.fire("Deleted", "", "success");
                } catch (error) {
                    Swal.fire("Error", "Failed to delete.", "error");
                }
            }
        });
    };

    const groupByCategory = (items) => {
        return items.reduce((acc, item) => {
            (acc[item.category] = acc[item.category] || []).push(item);
            return acc;
        }, {});
    };

    const groupedFaqs = groupByCategory(faqs);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <ConfigHeader
                title="FAQ Manager"
                subtitle="Organize common questions to support your users."
                onAdd={handleOpenAdd}
                addLabel="Add Question"
            />

            {loading ? (
                <div className="space-y-4">
                    <Skeleton variant="rectangular" height={60} sx={{ borderRadius: "8px" }} />
                    <Skeleton variant="rectangular" height={60} sx={{ borderRadius: "8px" }} />
                    <Skeleton variant="rectangular" height={60} sx={{ borderRadius: "8px" }} />
                </div>
            ) : faqs.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <HelpOutlineIcon sx={{ fontSize: 60, color: '#e2e8f0' }} />
                    <Typography className="text-gray-400 mt-2">No FAQs created yet.</Typography>
                </div>
            ) : (
                <div className="space-y-8">
                    {Object.keys(groupedFaqs).map(category => (
                        <Fade in={true} timeout={500} key={category}>
                            <div>
                                <Typography
                                    variant="subtitle2"
                                    className="capitalize mb-3 font-bold text-gray-500 flex items-center gap-2 border-b border-gray-100 pb-2"
                                >
                                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                                    {category}
                                </Typography>

                                <div className="space-y-3">
                                    {groupedFaqs[category].map(item => (
                                        <Accordion
                                            key={item.id}
                                            disableGutters
                                            elevation={0}
                                            sx={{
                                                borderRadius: "12px !important",
                                                border: '1px solid #f1f5f9',
                                                '&:before': { display: 'none' },
                                                mb: 1
                                            }}
                                        >
                                            <AccordionSummary expandIcon={<ExpandMoreIcon className="text-gray-400" />}>
                                                <div className="flex items-center justify-between w-full pr-2">
                                                    <Typography className="font-semibold text-gray-700">{item.question}</Typography>
                                                    <div onClick={(e) => e.stopPropagation()} className="flex">
                                                        <IconButton onClick={() => handleOpenEdit(item)} size="small" className="text-blue-500 hover:bg-blue-50">
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                        <IconButton onClick={() => handleDelete(item.id)} size="small" className="text-red-500 hover:bg-red-50 ml-1">
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </div>
                                                </div>
                                            </AccordionSummary>
                                            <AccordionDetails className="bg-gray-50/50 rounded-b-xl">
                                                <Typography color="text.secondary" className="text-sm leading-relaxed">
                                                    {item.answer}
                                                </Typography>
                                            </AccordionDetails>
                                        </Accordion>
                                    ))}
                                </div>
                            </div>
                        </Fade>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            <Dialog
                open={openModal}
                onClose={handleCloseModal}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: '24px', padding: 1 } }}
            >
                <DialogTitle sx={{ fontWeight: 700 }}>{isUpdate ? "Edit FAQ" : "New Question"}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={3} sx={{ mt: 0 }}>
                        <Grid item xs={12}>
                            <TextField
                                select
                                label="Category"
                                name="category"
                                value={currentFaq.category}
                                onChange={handleChange}
                                fullWidth
                                variant="outlined"
                            >
                                <MenuItem value="general">General</MenuItem>
                                <MenuItem value="payment">Payment</MenuItem>
                                <MenuItem value="booking">Booking</MenuItem>
                                <MenuItem value="account">Account</MenuItem>
                            </TextField>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Question"
                                name="question"
                                value={currentFaq.question}
                                onChange={handleChange}
                                fullWidth
                                multiline
                                rows={2}
                                variant="outlined"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                label="Answer"
                                name="answer"
                                value={currentFaq.answer}
                                onChange={handleChange}
                                fullWidth
                                multiline
                                rows={4}
                                variant="outlined"
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
                        {isUpdate ? "Save Changes" : "Add FAQ"}
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default FAQs;
