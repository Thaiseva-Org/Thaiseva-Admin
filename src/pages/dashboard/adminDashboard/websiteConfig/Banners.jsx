import React, { useState, useEffect } from "react";
import {
    Box,
    Button,
    Card,
    CardContent,
    Grid,
    TextField,
    Typography,
    Divider,
    InputAdornment
} from "@mui/material";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebase.config";
import DragDropImageUploader from "../../../../components/websiteConfig/DragDropImageUploader";
import ConfigHeader from "../../../../components/websiteConfig/ConfigHeader";
import Swal from "sweetalert2";
import { SaveIcon } from "@icons";
import { TitleIcon } from "@icons";
import { DescriptionIcon } from "@icons";
import { PersonIcon } from "@icons";
import { ThumbUpIcon } from "@icons";
import { DownloadIcon } from "@icons";

const Banners = () => {
    const [loading, setLoading] = useState(false);
    const [heroData, setHeroData] = useState({
        headline: "",
        subheadline: "",
        backgroundImage: "",
        handImage: "",
        stats: {
            users: 0,
            likes: 0,
            downloads: 0,
        },
    });

    const fetchHeroData = async () => {
        // setLoading(true); // Initial load logic handled silently usually or with skeleton if needed
        try {
            const docRef = doc(db, "ContentDB", "home_hero");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                setHeroData({
                    headline: data.headline || "",
                    subheadline: data.subheadline || "",
                    backgroundImage: data.backgroundImage || "",
                    handImage: data.handImage || "",
                    stats: {
                        users: data.stats?.users || 0,
                        likes: data.stats?.likes || 0,
                        downloads: data.stats?.downloads || 0,
                    },
                });
            }
        } catch (error) {
            console.error("Error getting document:", error);
            Swal.fire("Error", "Failed to fetch data.", "error");
        } finally {
            //   setLoading(false);
        }
    };

    useEffect(() => {
        fetchHeroData();
    }, []);

    const handleChange = (e) => {
        setHeroData({ ...heroData, [e.target.name]: e.target.value });
    };

    const handleStatsChange = (e) => {
        setHeroData({
            ...heroData,
            stats: { ...heroData.stats, [e.target.name]: e.target.value },
        });
    };

    const handleImageChange = (url, type) => {
        const fieldName = type === "background" ? "backgroundImage" : "handImage";
        setHeroData(prev => ({ ...prev, [fieldName]: url }));
    }

    const handleSave = async () => {
        setLoading(true);
        try {
            await setDoc(doc(db, "ContentDB", "home_hero"), {
                ...heroData,
                updatedAt: new Date(),
            });
            Swal.fire({
                icon: 'success',
                title: 'Saved!',
                text: 'Hero section updated successfully.',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Error updating document: ", error);
            Swal.fire("Error", "Failed to update.", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <ConfigHeader
                title="Hero Section Config"
                subtitle="Manage the main landing page hero visual and text."
                showAdd={false}
            />

            <Grid container spacing={4}>
                {/* Left Column: Text & Stats */}
                <Grid item xs={12} lg={7}>
                    <Card
                        elevation={0}
                        sx={{
                            borderRadius: "24px",
                            border: "1px solid #f1f5f9",
                            height: '100%'
                        }}
                    >
                        <CardContent className="p-8 space-y-6">
                            <div>
                                <Typography variant="h6" className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <TitleIcon className="text-blue-500" />
                                    Text Content
                                </Typography>
                                <Grid container spacing={3}>
                                    <Grid item xs={12}>
                                        <TextField
                                            label="Headline Title"
                                            name="headline"
                                            value={heroData.headline}
                                            onChange={handleChange}
                                            fullWidth
                                            multiline
                                            rows={2}
                                            variant="outlined"
                                            InputProps={{ sx: { borderRadius: '12px' } }}
                                            helperText="Main prominent text (H1) on the home page."
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <TextField
                                            label="Sub-headline"
                                            name="subheadline"
                                            value={heroData.subheadline}
                                            onChange={handleChange}
                                            fullWidth
                                            multiline
                                            rows={3}
                                            variant="outlined"
                                            InputProps={{ sx: { borderRadius: '12px' } }}
                                            helperText="Descriptive text under the headline."
                                        />
                                    </Grid>
                                </Grid>
                            </div>

                            <Divider />

                            <div>
                                <Typography variant="h6" className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <TitleIcon className="text-green-500" /> {/* Just using random color icon for visual pop */}
                                    Social Proof Stats
                                </Typography>
                                <Grid container spacing={3}>
                                    <Grid item xs={12} sm={4}>
                                        <TextField
                                            label="Active Users"
                                            name="users"
                                            type="number"
                                            value={heroData.stats.users}
                                            onChange={handleStatsChange}
                                            fullWidth
                                            variant="outlined"
                                            InputProps={{
                                                sx: { borderRadius: '12px' },
                                                startAdornment: <InputAdornment position="start"><PersonIcon fontSize="small" className="text-gray-400" /></InputAdornment>
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <TextField
                                            label="Total Likes"
                                            name="likes"
                                            type="number"
                                            value={heroData.stats.likes}
                                            onChange={handleStatsChange}
                                            fullWidth
                                            variant="outlined"
                                            InputProps={{
                                                sx: { borderRadius: '12px' },
                                                startAdornment: <InputAdornment position="start"><ThumbUpIcon fontSize="small" className="text-gray-400" /></InputAdornment>
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <TextField
                                            label="Downloads"
                                            name="downloads"
                                            type="number"
                                            value={heroData.stats.downloads}
                                            onChange={handleStatsChange}
                                            fullWidth
                                            variant="outlined"
                                            InputProps={{
                                                sx: { borderRadius: '12px' },
                                                startAdornment: <InputAdornment position="start"><DownloadIcon fontSize="small" className="text-gray-400" /></InputAdornment>
                                            }}
                                        />
                                    </Grid>
                                </Grid>
                            </div>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Right Column: Images */}
                <Grid item xs={12} lg={5}>
                    <Card
                        elevation={0}
                        sx={{
                            borderRadius: "24px",
                            border: "1px solid #f1f5f9",
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <CardContent className="p-8 flex flex-col gap-8 h-full">
                            <div className="flex-1">
                                <DragDropImageUploader
                                    label="Hero Background Image (Landscape)"
                                    image={heroData.backgroundImage}
                                    onImageChange={(url) => handleImageChange(url, 'background')}
                                    folder="banners"
                                    height={200}
                                />
                                <Typography variant="caption" className="text-gray-400 mt-2 block text-center">
                                    Recommended: 1920x1080px (optimize &#60; 200KB)
                                </Typography>
                            </div>

                            <Divider />

                            <div className="flex-1">
                                <DragDropImageUploader
                                    label="Phone Mockup / Foreground (Portrait)"
                                    image={heroData.handImage}
                                    onImageChange={(url) => handleImageChange(url, 'hand')}
                                    folder="banners"
                                    height={250} // Taller for phone
                                />
                                <Typography variant="caption" className="text-gray-400 mt-2 block text-center">
                                    Recommended: Transparent PNG
                                </Typography>
                            </div>
                        </CardContent>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <Button
                                variant="contained"
                                size="large"
                                startIcon={loading ? null : <SaveIcon />}
                                onClick={handleSave}
                                disabled={loading}
                                sx={{
                                    borderRadius: "12px",
                                    textTransform: "none",
                                    px: 6,
                                    py: 1.5,
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    boxShadow: 'none',
                                    bgcolor: 'var(--primary-500)',
                                    "&:hover": {
                                        bgcolor: 'var(--primary-600)',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                    }
                                }}
                            >
                                {loading ? "Saving Changes..." : "Save Configuration"}
                            </Button>
                        </div>
                    </Card>
                </Grid>
            </Grid>
        </div>
    );
};

export default Banners;
