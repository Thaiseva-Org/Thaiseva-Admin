import { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Box,
    CircularProgress
} from "@mui/material";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../../../firebase/firebase.config";

const SightseeingSettingsModal = ({ open, onClose }) => {
    const [limit, setLimit] = useState(200);
    const [dailyLimit, setDailyLimit] = useState(20);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            fetchSettings();
        }
    }, [open]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const docRef = doc(db, "settings", "sightseeingConfig");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setLimit(docSnap.data().globalWeeklyLimit || 200);
                setDailyLimit(docSnap.data().globalDailyLimit ?? 20);
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, "settings", "sightseeingConfig"), {
                globalWeeklyLimit: parseInt(limit),
                globalDailyLimit: parseInt(dailyLimit),
                updatedAt: new Date()
            }, { merge: true });
            onClose();
            alert("Settings updated successfully!");
        } catch (error) {
            console.error("Error saving settings:", error);
            alert("Failed to save settings.");
        }
        setSaving(false);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold' }}>Sightseeing Configuration</DialogTitle>
            <DialogContent>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box sx={{ pt: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Set the default maximum number of bookings allowed per week for all sightseeing packages.
                        </Typography>
                        <TextField
                            label="Global Weekly Booking Limit"
                            type="number"
                            fullWidth
                            value={limit}
                            onChange={(e) => setLimit(e.target.value)}
                            helperText="This limit applies to all packages unless specifically overridden."
                            InputProps={{ inputProps: { min: 1 } }}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            label="Global Daily Tour-Date Limit"
                            type="number"
                            fullWidth
                            value={dailyLimit}
                            onChange={(e) => setDailyLimit(e.target.value)}
                            helperText="Instant booking starts 3 days ahead. This daily limit counts confirmed bookings and active checkouts; excess bookings require confirmation."
                            InputProps={{ inputProps: { min: 0 } }}
                        />
                    </Box>
                )}
            </DialogContent>
            <DialogActions sx={{ p: 2.5 }}>
                <Button onClick={onClose} color="inherit">Cancel</Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    disabled={saving || loading}
                >
                    {saving ? "Saving..." : "Save Configuration"}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SightseeingSettingsModal;
