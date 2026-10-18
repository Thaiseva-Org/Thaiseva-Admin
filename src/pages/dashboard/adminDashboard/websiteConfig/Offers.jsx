import React, { useState, useEffect } from "react";
import {
    Button,
    Card,
    CardActions,
    CardContent,
    CardMedia,
    Grid,
    IconButton,
    Switch,
    Typography,
    TextField,
    InputAdornment,
    Skeleton,
    Fade,
    FormControlLabel
} from "@mui/material";
import {
    collection,
    onSnapshot,
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
import { SearchIcon } from "@icons";

// Custom Modal Components
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import DialogActions from "@mui/material/DialogActions";
import MenuItem from "@mui/material/MenuItem";

const emptyOffer = { title: "", description: "", image: "", type: "bundle", active: true,
    subtitle: "", order: 99, isAppOnly: false, actionUrl: "" };

const Offers = () => {
    const [offers, setOffers] = useState([]);
    const [filteredOffers, setFilteredOffers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [saving, setSaving] = useState(false);

    // Modal State
    const [openModal, setOpenModal] = useState(false);
    const [isUpdate, setIsUpdate] = useState(false);
    const [selectedId, setSelectedId] = useState(null);

    // Form State
    const [currentOffer, setCurrentOffer] = useState({ ...emptyOffer });

    useEffect(() => onSnapshot(collection(db, "OfferDB"), (snapshot) => {
        setOffers(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }))
            .sort((a, b) => (Number(a.order ?? 99) - Number(b.order ?? 99)) || a.id.localeCompare(b.id)));
        setLoading(false);
    }, (error) => {
        console.error("Error fetching offers:", error);
        setLoading(false);
        Swal.fire("Error", "Failed to load offers. Please reload to try again.", "error");
    }), []);

    useEffect(() => {
        const results = offers.filter(offer =>
            (offer.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (offer.description || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredOffers(results);
    }, [searchTerm, offers]);

    const handleOpenAdd = () => {
        setCurrentOffer({ ...emptyOffer });
        setIsUpdate(false);
        setSelectedId(null);
        setOpenModal(true);
    };

    const handleOpenEdit = (offer) => {
        setCurrentOffer({
            ...emptyOffer,
            ...offer,
            title: offer.title || "",
            description: offer.description || "",
            image: offer.image || "",
            type: offer.type || "bundle",
            active: offer.active !== undefined ? offer.active : true,
        });
        setIsUpdate(true);
        setSelectedId(offer.id);
        setOpenModal(true);
    };

    const handleCloseModal = () => {
        if (!saving) setOpenModal(false);
    };

    const handleChange = (e) => {
        setCurrentOffer({ ...currentOffer, [e.target.name]: e.target.value });
    }

    const handleImageChange = (url) => {
        setCurrentOffer(prev => ({ ...prev, image: url }));
    }

    const handleSave = async () => {
        if (saving) return;
        if (!currentOffer.title.trim() || !currentOffer.image) {
            Swal.fire("Error", "Title and Image are required", "warning");
            return;
        }

        const actionUrl = (currentOffer.actionUrl || "").trim();
        if (actionUrl && !/^\/(?![\/])[^\\]*$/.test(actionUrl) && !/^https:\/\//i.test(actionUrl)) {
            Swal.fire("Invalid destination", "Use a website path such as /tours or a full HTTPS URL.", "warning");
            return;
        }
        const order = Number(currentOffer.order);
        if (!Number.isInteger(order) || order < 0) {
            Swal.fire("Invalid order", "Display order must be a whole number of zero or higher.", "warning");
            return;
        }
        const { id: _id, ...fields } = currentOffer;
        const payload = { ...fields, title: currentOffer.title.trim(), actionUrl, order };
        setSaving(true);
        try {
            if (isUpdate && selectedId) {
                const offerRef = doc(db, "OfferDB", selectedId);
                await updateDoc(offerRef, {
                    ...payload,
                    updatedAt: serverTimestamp(),
                });
                Swal.fire({ icon: 'success', title: 'Updated!', timer: 1500, showConfirmButton: false });
            } else {
                await addDoc(collection(db, "OfferDB"), {
                    ...payload,
                    createdAt: serverTimestamp(),
                });
                Swal.fire({ icon: 'success', title: 'Added!', timer: 1500, showConfirmButton: false });
            }
            setOpenModal(false);

        } catch (error) {
            console.error("Error saving offer:", error);
            Swal.fire("Error", "Failed to save offer.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        Swal.fire({
            title: "Delete this offer?",
            text: "This action cannot be undone.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#cbd5e1",
            confirmButtonText: "Yes, delete it!",
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(db, "OfferDB", id));
                    Swal.fire("Deleted!", "Offer removed.", "success");

                } catch (error) {
                    Swal.fire("Error", "Failed to delete.", "error");
                }
            }
        });
    };

    const toggleActive = async (offer) => {
        try {
            const newStatus = offer.active === false;
            // Optimistic UI Update
            setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, active: newStatus } : o));

            const offerRef = doc(db, "OfferDB", offer.id);
            await updateDoc(offerRef, { active: newStatus, updatedAt: serverTimestamp() });
        } catch (error) {
            console.error("Error toggling status", error);

            setOffers(prev => prev.map(o => o.id === offer.id ? offer : o));
            Swal.fire("Error", "Failed to change visibility.", "error");
        }
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <ConfigHeader
                title="Special Offers"
                subtitle="Manage website offers. Saved changes appear live on the Offers page."
                onAdd={handleOpenAdd}
                addLabel="Add Offer"
            />

            {/* Search & Filter Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 mb-6">
                <TextField
                    placeholder="Search offers..."
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon className="text-gray-400" />
                            </InputAdornment>
                        ),
                        sx: { borderRadius: '10px', backgroundColor: '#f8fafc', '& fieldset': { border: 'none' } }
                    }}
                />
            </div>

            {loading ? (
                <Grid container spacing={3}>
                    {[1, 2, 3].map((n) => (
                        <Grid item xs={12} sm={6} md={4} key={n}>
                            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: "16px", mb: 1 }} />
                            <Skeleton width="60%" />
                            <Skeleton width="40%" />
                        </Grid>
                    ))}
                </Grid>
            ) : filteredOffers.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                    <img src="https://cdn-icons-png.flaticon.com/512/7486/7486777.png" alt="No Data" className="w-24 h-24 mx-auto opacity-20 mb-4 grayscale" />
                    <Typography variant="h6" className="text-gray-400 font-medium">No offers found</Typography>
                    <Typography variant="body2" className="text-gray-400">Try adjusting your search or add a new offer.</Typography>
                </div>
            ) : (
                <Grid container spacing={3}>
                    {filteredOffers.map((offer) => (
                        <Grid item xs={12} sm={6} md={4} key={offer.id}>
                            <Fade in={true} timeout={500}>
                                <Card
                                    sx={{
                                        borderRadius: "20px",
                                        height: "100%",
                                        display: "flex",
                                        flexDirection: "column",
                                        border: "1px solid #f1f5f9",
                                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                                        transition: "all 0.3s ease",
                                        "&:hover": {
                                            transform: "translateY(-4px)",
                                            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
                                        }
                                    }}
                                >
                                    <div className="relative">
                                        <CardMedia
                                            component="img"
                                            image={offer.image || "https://placehold.co/600x400?text=No+Image"}
                                            alt={offer.title}
                                            sx={{ height: 200, objectFit: "cover" }}
                                        />
                                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold shadow-sm">
                                            {(offer.type || "Bundle").toUpperCase()}
                                        </div>
                                        <div className="absolute top-3 left-3">
                                            <Switch
                                                checked={offer.active !== false}
                                                onChange={(e) => { e.stopPropagation(); toggleActive(offer); }}
                                                size="small"
                                                className="bg-white/80 rounded-full backdrop-blur pl-1"
                                                color="success"
                                            />
                                        </div>
                                    </div>

                                    <CardContent sx={{ flexGrow: 1, p: 3 }}>
                                        <div className="flex justify-between items-start mb-1">
                                            <Typography variant="h6" className="font-bold text-gray-800 leading-tight">
                                                {offer.title}
                                            </Typography>
                                        </div>
                                        <Typography variant="body2" className="text-gray-500 line-clamp-2 mt-2 leading-relaxed">
                                            {offer.description}
                                        </Typography>
                                    </CardContent>

                                    <CardActions sx={{ justifyContent: "flex-end", p: 2, pt: 0, borderTop: '1px solid #f8fafc' }}>
                                        <Button
                                            startIcon={<EditIcon sx={{ fontSize: 18 }} />}
                                            size="small"
                                            onClick={() => handleOpenEdit(offer)}
                                            sx={{ color: '#3b82f6', textTransform: 'none', borderRadius: '8px', minWidth: 'unset', px: 2 }}
                                        >
                                            Edit
                                        </Button>
                                        <IconButton
                                            onClick={() => handleDelete(offer.id)}
                                            size="small"
                                            sx={{
                                                color: '#ef4444',
                                                bgcolor: '#fef2f2',
                                                borderRadius: '8px',
                                                '&:hover': { bgcolor: '#fee2e2' }
                                            }}
                                        >
                                            <DeleteIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                    </CardActions>
                                </Card>
                            </Fade>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Add/Edit Dialog with Custom Input Logic */}
            <Dialog
                open={openModal}
                onClose={handleCloseModal}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: "24px", padding: "16px" }
                }}
            >
                <DialogTitle sx={{ fontWeight: 800, fontSize: '1.5rem', color: '#1e293b' }}>
                    {isUpdate ? "Edit Offer" : "New Offer"}
                </DialogTitle>
                <DialogContent sx={{ overflowY: 'visible' }}> {/* allow drag drop overflow if needed */}
                    <div className="grid gap-6 mt-2">
                        <TextField
                            label="Offer Title"
                            name="title"
                            value={currentOffer.title}
                            onChange={handleChange}
                            fullWidth
                            variant="outlined"
                            InputProps={{ sx: { borderRadius: '12px' } }}
                        />

                        <TextField
                            select
                            label="Offer Type"
                            name="type"
                            value={currentOffer.type}
                            onChange={handleChange}
                            fullWidth
                            variant="outlined"
                            InputProps={{ sx: { borderRadius: '12px' } }}
                        >
                            <MenuItem value="bundle">Bundle</MenuItem>
                            <MenuItem value="food">Food</MenuItem>
                            <MenuItem value="transport">Transport</MenuItem>
                            <MenuItem value="activity">Activity</MenuItem>
                            <MenuItem value="hotel">Hotel / Stay</MenuItem>
                            <MenuItem value="tour">Tour</MenuItem>
                            <MenuItem value="stay">Stay</MenuItem>
                        </TextField>

                        <TextField
                            label="Description"
                            name="description"
                            value={currentOffer.description}
                            onChange={handleChange}
                            fullWidth
                            multiline
                            rows={3}
                            variant="outlined"
                            InputProps={{ sx: { borderRadius: '12px' } }}
                        />

                        <TextField label="Offer badge" name="subtitle" value={currentOffer.subtitle || ""} onChange={handleChange} fullWidth />
                        <TextField label="Display order" name="order" type="number" value={currentOffer.order ?? 99} onChange={handleChange} inputProps={{ min: 0, step: 1 }} helperText="Lower numbers appear first." fullWidth />
                        <TextField label="Promotion destination" name="actionUrl" value={currentOffer.actionUrl || ""} onChange={handleChange} helperText="Optional: /tours, /stays, or an HTTPS URL. Otherwise uses the offer type." fullWidth />
                        <FormControlLabel control={<Switch checked={currentOffer.active !== false} onChange={e => setCurrentOffer(prev => ({ ...prev, active: e.target.checked }))} />} label="Visible on website" />
                        <FormControlLabel control={<Switch checked={Boolean(currentOffer.isAppOnly)} onChange={e => setCurrentOffer(prev => ({ ...prev, isAppOnly: e.target.checked }))} />} label="App only (opens app download)" />
                        <div className="mt-2">
                            <DragDropImageUploader cropWidth={1200} cropHeight={750}
                                label="Offer Cover Image"
                                image={currentOffer.image}
                                onImageChange={handleImageChange}
                                folder="offers"
                            />
                        </div>
                    </div>
                </DialogContent>
                <DialogActions sx={{ padding: "0 24px 24px" }}>
                    <Button
                        onClick={handleCloseModal}
                        sx={{
                            color: 'gray',
                            borderRadius: '10px',
                            textTransform: 'none',
                            fontWeight: 600,
                            px: 3
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        variant="contained"
                        disableElevation
                        sx={{
                            bgcolor: 'var(--primary-500)',
                            color: 'white',
                            borderRadius: '10px',
                            textTransform: 'none',
                            fontWeight: 600,
                            px: 4,
                            py: 1.2,
                            "&:hover": { bgcolor: "var(--primary-600)" }
                        }}
                    >
                        {saving ? "Saving..." : isUpdate ? "Update Offer" : "Create Offer"}
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default Offers;
