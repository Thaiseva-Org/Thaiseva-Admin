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
    CircularProgress,
    InputAdornment
} from "@mui/material";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../../../firebase/firebase.config";
import { successNotification } from "../../../../../utils/utils";

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
        const parsedDaily = parseInt(dailyLimit);
        const parsedWeekly = parseInt(limit);
        if (isNaN(parsedDaily) || parsedDaily < 0) {
            alert("Please enter a valid daily limit (0 or greater).");
            return;
        }

        setSaving(true);
        try {
            await setDoc(doc(db, "settings", "sightseeingConfig"), {
                globalWeeklyLimit: isNaN(parsedWeekly) ? 200 : parsedWeekly,
                globalDailyLimit: parsedDaily,
                updatedAt: new Date()
            }, { merge: true });
            if (typeof successNotification === "function") {
                successNotification("Daily Limit and tour settings updated successfully!");
            } else {
                alert("Settings updated successfully!");
            }
            onClose();
        } catch (error) {
            console.error("Error saving settings:", error);
            alert("Failed to save settings: " + error.message);
        }
        setSaving(false);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: "20px",
                    overflow: "hidden",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
                }
            }}
        >
            <DialogTitle
                sx={{
                    background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                    color: "white",
                    fontWeight: 700,
                    fontSize: "1.25rem",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    py: 2.5,
                    px: 3
                }}
            >
                <span className="text-2xl">⚡</span>
                <div>
                    <div>Daily Limit & Tour Capacity</div>
                    <div className="text-xs text-purple-200 font-normal mt-0.5">
                        Configure daily booking thresholds and weekly limits
                    </div>
                </div>
            </DialogTitle>
            <DialogContent sx={{ p: 3, pt: 3.5 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 6 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-900">
                            <span className="font-semibold block mb-1">📅 Daily Booking Limit Rule:</span>
                            Instant booking starts 3 days ahead. This daily limit counts confirmed bookings and active checkouts; bookings exceeding this limit require admin confirmation.
                        </div>

                        <TextField
                            label="Global Daily Tour-Date Limit"
                            type="number"
                            fullWidth
                            value={dailyLimit}
                            onChange={(e) => setDailyLimit(e.target.value)}
                            helperText="Maximum allowed instant bookings per tour day."
                            InputProps={{
                                inputProps: { min: 0 },
                                startAdornment: <InputAdornment position="start">📊</InputAdornment>
                            }}
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: "12px",
                                    fontSize: "1.05rem",
                                    fontWeight: 600
                                }
                            }}
                        />

                        <TextField
                            label="Global Weekly Booking Limit"
                            type="number"
                            fullWidth
                            value={limit}
                            onChange={(e) => setLimit(e.target.value)}
                            helperText="Applies as default capacity across all packages unless overridden."
                            InputProps={{
                                inputProps: { min: 1 },
                                startAdornment: <InputAdornment position="start">📈</InputAdornment>
                            }}
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: "12px"
                                }
                            }}
                        />
                    </Box>
                )}
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 1, borderTop: "1px solid #f1f5f9", gap: 1.5 }}>
                <Button
                    onClick={onClose}
                    color="inherit"
                    sx={{
                        borderRadius: "10px",
                        px: 3,
                        py: 1,
                        textTransform: "none",
                        fontWeight: 600,
                        color: "#64748b"
                    }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    disabled={saving || loading}
                    sx={{
                        background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                        borderRadius: "10px",
                        px: 3.5,
                        py: 1,
                        textTransform: "none",
                        fontWeight: 600,
                        boxShadow: "0 4px 14px 0 rgba(124, 58, 237, 0.39)",
                        "&:hover": {
                            background: "linear-gradient(135deg, #6d28d9 0%, #4338ca 100%)"
                        }
                    }}
                >
                    {saving ? "Saving..." : "Update Daily Limit"}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SightseeingSettingsModal;
