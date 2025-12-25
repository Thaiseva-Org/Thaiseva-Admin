import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    CircularProgress,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    IconButton,
    Container,
    Breadcrumbs,
    Link,
    Divider,
    Card,
    CardContent,
    Stack,
    Tooltip,
    Zoom,
    Chip
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useNavigate } from 'react-router-dom';
import readXlsxFile from 'read-excel-file';
import writeXlsxFile from 'write-excel-file';
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc, collection, query, where } from "firebase/firestore";
import { db } from "../../../../../firebase/firebase.config";
import {
    hotelsCollection,
    usersCollection,
    firebaseConfig,
} from "../../../../../firebase/firebase.config";
import { successNotification } from "../../../../../utils/utils";

const ExcelUploadPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [successCount, setSuccessCount] = useState(0);
    const [previewData, setPreviewData] = useState([]);
    const [editingRow, setEditingRow] = useState(null);
    const [tempRowData, setTempRowData] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [batchResults, setBatchResults] = useState(null); // New state for summary


    const handleDownloadTemplate = async () => {
        const schema = [
            { column: 'Hotel Name', type: String, value: hotel => hotel.hotelName, width: 25 },
            { column: 'Email', type: String, value: hotel => hotel.email, width: 25 },
            { column: 'Phone Number', type: String, value: hotel => hotel.phoneNumber, width: 15 },
            { column: 'Address', type: String, value: hotel => hotel.address, width: 30 },
            { column: 'Description', type: String, value: hotel => hotel.description, width: 30 },
            { column: 'Star Rating', type: Number, value: hotel => hotel.rating, width: 10 },
            { column: 'Pets Allowed', type: String, value: hotel => hotel.petsAllowed, width: 15 }, // "Yes" or "No"
            { column: 'Discount', type: Number, value: hotel => hotel.discount, width: 10 },
            { column: 'Features', type: String, value: hotel => hotel.features, width: 40 }, // Comma separated
            { column: 'Room Name', type: String, value: hotel => hotel.roomName, width: 25 },
            { column: 'Room Price', type: Number, value: hotel => hotel.roomPrice, width: 15 },
            { column: 'Max Guests', type: Number, value: hotel => hotel.maxGuests, width: 15 }
        ];

        const data = [
            {
                hotelName: "Example Hotel",
                email: "hotel@example.com",
                phoneNumber: "1234567890",
                address: "123 Main St, City, Country",
                description: "A lovely place to stay.",
                rating: 5,
                petsAllowed: "No",
                discount: 10,
                features: "Pool, Wifi, Gym",
                roomName: "Standard Room",
                roomPrice: 1500,
                maxGuests: 2
            }
        ];

        try {
            await writeXlsxFile(data, {
                schema,
                fileName: 'Hotel_Upload_Template.xlsx'
            });
        } catch (error) {
            console.error("Error downloading template:", error);
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload({ target: { files: e.dataTransfer.files } });
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        setError("");
        setSuccessCount(0);
        setBatchResults(null);

        try {
            const rows = await readXlsxFile(file);

            if (!rows || rows.length === 0) {
                setError("The uploaded file is empty.");
                setLoading(false);
                return;
            }

            const headers = rows[0];
            const dataRows = rows.slice(1);

            if (dataRows.length === 0) {
                setError("The uploaded file contains no data rows.");
                setLoading(false);
                return;
            }

            // Map headers to keys
            const headerMap = {
                'Hotel Name': 'hotelName',
                'Email': 'email',
                'Phone Number': 'phoneNumber',
                'Address': 'address',
                'Description': 'description',
                'Star Rating': 'rating',
                'Pets Allowed': 'petsAllowed',
                'Discount': 'discount',
                'Features': 'features',
                'Room Name': 'roomName',
                'Room Price': 'roomPrice',
                'Max Guests': 'maxGuests'
            };

            const mappedData = dataRows.map(row => {
                const obj = {};
                headers.forEach((header, index) => {
                    const headerStr = String(header).trim();
                    const key = headerMap[headerStr];
                    if (key) {
                        obj[key] = row[index];
                    }
                });

                // --- VALIDATION LOGIC ---
                const missing = [];
                if (!obj.hotelName) missing.push('hotelName');
                if (!obj.email) missing.push('email');
                if (!obj.phoneNumber) missing.push('phoneNumber');
                if (!obj.address) missing.push('address');
                if (!obj.description) missing.push('description');
                if (!obj.features) missing.push('features');
                if (!obj.roomName) missing.push('roomName');
                if (!obj.roomPrice) missing.push('roomPrice');

                obj._errors = missing;
                return obj;
            });

            setPreviewData(mappedData);

            // Check for immediate errors to notify user
            const hasValidationErrors = mappedData.some(r => r._errors && r._errors.length > 0);
            if (hasValidationErrors) {
                setError("Some rows are missing compulsory fields. Please edit the highlighted red cells before confirming.");
            }

            setLoading(false);
        } catch (err) {
            console.error("Error parsing file:", err);
            setError(`Failed to parse the Excel file: ${err.message || err}`);
            setLoading(false);
        }
    };

    const handleEditClick = (index, row) => {
        setEditingRow(index);
        setTempRowData({ ...row });
    };

    const handleSaveClick = (index) => {
        const newData = [...previewData];
        newData[index] = tempRowData;
        setPreviewData(newData);
        setEditingRow(null);
        setTempRowData(null);
    };

    const handleCancelClick = () => {
        setEditingRow(null);
        setTempRowData(null);
    };

    const handleTempChange = (field, value) => {
        setTempRowData(prev => {
            const updated = { ...prev, [field]: value };
            // Auto-clear error if field is filled
            if (value && updated._errors && updated._errors.includes(field)) {
                updated._errors = updated._errors.filter(e => e !== field);
            }
            return updated;
        });
    };

    const handleConfirmUpload = async () => {
        setLoading(true);
        const results = await processExcelData(previewData);
        setBatchResults(results); // Show summary instead of clearing immediately
        setPreviewData([]);
        setLoading(false);
    };

    const handleCancelPreview = () => {
        setPreviewData([]);
        setError("");
        setBatchResults(null);
    };

    const processExcelData = async (data) => {
        const results = [];
        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);

        // 1. Group rows by Email (to handle multiple rooms per hotel)
        const groups = {};
        for (const row of data) {
            const email = row.email?.trim();
            if (!email) continue;
            if (!groups[email]) groups[email] = [];
            groups[email].push(row);
        }

        // 2. Process each hotel group
        for (const email of Object.keys(groups)) {
            const rows = groups[email];
            const firstRow = rows[0]; // Use first row for Hotel Details
            const hotelName = firstRow.hotelName;

            try {
                // Check if user exists (logic relying on creation failure or custom query if possible)
                // Since we can't easily query Auth, we'll try to create. 
                // If it fails with 'email-already-in-use', we'll try to find the existing doc in Firestore.

                let uid = null;
                let isNew = true;

                try {
                    const res = await createUserWithEmailAndPassword(secondaryAuth, email, "TempPass123!");
                    uid = res.user.uid;
                    await updateProfile(res.user, { displayName: hotelName });
                    await signOut(secondaryAuth);
                } catch (authErr) {
                    if (authErr.code === 'auth/email-already-in-use') {
                        // User exists, try to find UID from Firestore users collection
                        // (We need to query users collection by email)
                        const { getDocs, query, where, collection } = await import("firebase/firestore");
                        const q = query(usersCollection, where("email", "==", email));
                        const querySnapshot = await getDocs(q);

                        if (!querySnapshot.empty) {
                            uid = querySnapshot.docs[0].id;
                            isNew = false;
                        } else {
                            results.push({ name: hotelName, email, status: 'Error', message: "Email exists in Auth but not in DB. Manual check required." });
                            continue;
                        }
                    } else {
                        throw authErr;
                    }
                }

                if (uid) {
                    // Update/Create Hotel Document
                    // Only update basic fields if it's new, or maybe update everything? 
                    // Let's assume Excel is source of truth, BUT we must NOT overwrite images with empty ones if they exist.

                    const hotelPayload = {
                        hotelId: uid, // Use UID as ID
                        hotelUid: uid,
                        hotelName: hotelName,
                        country: "Thailand",
                        currency: "THB",
                        startingPrice: Number(firstRow.roomPrice) || 0,
                        discount: Number(firstRow.discount) || 0,
                        address: firstRow.address || "",
                        description: firstRow.description || "",
                        petsAllowed: String(firstRow.petsAllowed).toLowerCase() === 'yes' || firstRow.petsAllowed === true,
                        // features: firstRow.features ? String(firstRow.features).split(',').map(s => s.trim()) : [], // Careful not to overwrite if existing?
                        phoneNumber: firstRow.phoneNumber || "",
                        email: email || "",
                        rating: Number(firstRow.rating) || 0,
                        status: "Verified",
                        updatedAt: new Date().toISOString()
                    };

                    if (firstRow.features) {
                        hotelPayload.features = String(firstRow.features).split(',').map(s => s.trim());
                    }

                    // Only set images if new, otherwise don't touch them (to avoid wiping existing photos)
                    if (isNew) {
                        hotelPayload.images = { logo: "", gallery: [] };
                        hotelPayload.numberOfReviews = 0;
                        hotelPayload.nearbyAttractions = [];
                    }

                    // Update User Doc
                    await setDoc(doc(usersCollection, uid), {
                        displayName: hotelName,
                        email,
                        role: "Partner",
                        serviceCategory: "Hotel",
                        status: "Verified",
                        phoneNumber: firstRow.phoneNumber || "",
                        uid: uid,
                        isVerified: true,
                        // Only set createdAt if new
                        ...(isNew && { createdAt: new Date() })
                    }, { merge: true });

                    // Update Hotel Doc
                    await setDoc(doc(db, "HotelDB", uid), { hotel: hotelPayload }, { merge: true });


                    // Process Rooms (All rows in group)
                    const roomsCollectionRef = collection(db, "HotelDB", uid, "rooms");
                    let roomsAdded = 0;

                    for (const row of rows) {
                        if (row.roomName && row.roomPrice) {
                            // Create a deterministic ID based on room name to avoid duplicates if re-uploaded? 
                            // Or just Date.now() + random? using random for safety.
                            const roomId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;

                            const roomData = {
                                id: roomId,
                                roomName: row.roomName,
                                packageName: row.roomName, // Fallback
                                maxGuests: Number(row.maxGuests) || 2,
                                numberOfBeds: 1,
                                bedType: "King",
                                photos: [],
                                amenities: row.features ? String(row.features).split(',').map(s => s.trim()) : [],
                                description: `Standard ${row.roomName}`,
                                policies: {
                                    checkIn: "14:00",
                                    checkOut: "12:00",
                                    extraBed: "",
                                    paymentInfo: "Prepaid",
                                    refundable: true
                                },
                                foodInfo: {
                                    breakfastIncluded: false,
                                    breakfastType: "Continental"
                                },
                                pricing: {
                                    basePrice: Number(row.roomPrice),
                                    discountPercent: 0,
                                    taxIncluded: true,
                                    pricePerNightAfterDiscount: Number(row.roomPrice),
                                    priceForStay: {
                                        nights: 1,
                                        totalAmount: Number(row.roomPrice)
                                    }
                                }
                            };

                            await setDoc(doc(roomsCollectionRef, roomId), roomData);
                            roomsAdded++;
                        }
                    }

                    results.push({
                        name: hotelName,
                        email: email,
                        uid: uid,
                        status: 'Success',
                        isNew,
                        roomsAdded
                    });
                }

            } catch (err) {
                console.error("Error processing group:", email, err);
                results.push({ name: hotelName, email, status: 'Error', message: err.message });
            }
        }

        await deleteApp(secondaryApp);
        return results;
    };

    return (
        <Box sx={{ p: 4, minHeight: '100vh', bgcolor: '#f1f5f9' }}>
            <Container maxWidth="xl">
                {/* Breadcrumbs */}
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb" sx={{ mb: 3 }}>
                    <Link underline="hover" color="inherit" onClick={() => navigate('/dashboard/hotels')} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        Hotels
                    </Link>
                    <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>Excel Upload</Typography>
                </Breadcrumbs>

                {/* Header Section */}
                <Box sx={{ mb: 5 }}>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e293b', mb: 1 }}>
                        Bulk Hotel Upload
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Streamline your workflow by uploading multiple hotels at once using our Excel template.
                    </Typography>
                </Box>

                {loading && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                        <CircularProgress size={60} thickness={4} sx={{ color: '#3b82f6', mb: 3 }} />
                        <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                            Processing your file...
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            This may take a few moments depending on the file size.
                        </Typography>
                    </Box>
                )}

                {/* Summary View */}
                {!loading && batchResults && (
                    <Zoom in={true}>
                        <Card sx={{ borderRadius: '24px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)' }}>
                            <CardContent sx={{ p: 4 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                                    <CheckCircleIcon sx={{ fontSize: 40, color: '#22c55e', mr: 2 }} />
                                    <Box>
                                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b' }}>
                                            Upload Completed!
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Your hotels have been processed. Use the "Add Photos" button to complete their profiles.
                                        </Typography>
                                    </Box>
                                </Box>

                                <TableContainer sx={{ mb: 4, bgcolor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 600 }}>Hotel Name</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Rooms Added</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 600 }}>Action</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {batchResults.map((res, i) => (
                                                <TableRow key={i}>
                                                    <TableCell sx={{ fontWeight: 500 }}>{res.name}</TableCell>
                                                    <TableCell>
                                                        {res.status === 'Success' ? (
                                                            <Chip
                                                                label={res.isNew ? "Created" : "Updated"}
                                                                color={res.isNew ? "success" : "info"}
                                                                size="small"
                                                                variant="soft"
                                                            />
                                                        ) : (
                                                            <Chip label="Error" color="error" size="small" />
                                                        )}
                                                        {res.status === 'Error' && <Typography variant="caption" display="block" color="error">{res.message}</Typography>}
                                                    </TableCell>
                                                    <TableCell>{res.roomsAdded || 0}</TableCell>
                                                    <TableCell align="right">
                                                        {res.status === 'Success' && (
                                                            <Button
                                                                variant="outlined"
                                                                size="small"
                                                                startIcon={<CloudUploadIcon />}
                                                                onClick={() => window.open(`/dashboard/hotels/edit/${res.uid}`, '_blank')}
                                                                sx={{ textTransform: 'none', borderRadius: '8px' }}
                                                            >
                                                                Add Photos
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>

                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                                    <Button
                                        variant="text"
                                        onClick={() => {
                                            setBatchResults(null);
                                            setPreviewData([]);
                                        }}
                                        sx={{ textTransform: 'none', color: '#64748b' }}
                                    >
                                        Upload More
                                    </Button>
                                    <Button
                                        variant="contained"
                                        onClick={() => navigate('/dashboard/hotels')}
                                        sx={{
                                            textTransform: 'none',
                                            borderRadius: '12px',
                                            bgcolor: '#3b82f6',
                                            px: 4
                                        }}
                                    >
                                        Done & Go to List
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>
                    </Zoom>
                )}

                {/* Upload Section (Hidden if Results shown) */}
                {!loading && !batchResults && previewData.length === 0 && (
                    <Card sx={{ borderRadius: '24px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)', overflow: 'visible' }}>
                        {/* ... Existing Upload Card Content ... */}

                        <CardContent sx={{ p: 6 }}>
                            <Stack spacing={4} alignItems="center">
                                {error && (
                                    <Alert
                                        severity="error"
                                        icon={<ErrorIcon fontSize="inherit" />}
                                        sx={{ width: '100%', maxWidth: '700px', borderRadius: '12px' }}
                                    >
                                        {error}
                                    </Alert>
                                )}

                                <Box
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={handleDrop}
                                    sx={{
                                        width: '100%',
                                        maxWidth: '700px',
                                        height: '300px',
                                        border: `3px dashed ${dragActive ? '#3b82f6' : '#cbd5e1'}`,
                                        borderRadius: '24px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        bgcolor: dragActive ? '#eff6ff' : '#f8fafc',
                                        transition: 'all 0.3s ease',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        '&:hover': {
                                            borderColor: '#3b82f6',
                                            bgcolor: '#eff6ff',
                                            transform: 'translateY(-2px)',
                                        }
                                    }}
                                >
                                    <input
                                        type="file"
                                        id="excel-upload-input"
                                        hidden
                                        accept=".xlsx, .xls"
                                        onChange={handleFileUpload}
                                    />
                                    <label htmlFor="excel-upload-input" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                        <Box
                                            sx={{
                                                width: '80px',
                                                height: '80px',
                                                borderRadius: '50%',
                                                bgcolor: '#dbeafe',
                                                color: '#3b82f6',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                mb: 2,
                                            }}
                                        >
                                            <CloudUploadIcon sx={{ fontSize: '40px' }} />
                                        </Box>
                                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
                                            {dragActive ? "Drop file here" : "Click or Drag to Upload"}
                                        </Typography>
                                        <Typography variant="body1" color="text.secondary">
                                            Supported formats: .xlsx, .xls
                                        </Typography>
                                    </label>
                                </Box>

                                <Divider sx={{ width: '100%', maxWidth: '700px' }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>OR</Typography>
                                </Divider>

                                <Button
                                    startIcon={<DownloadIcon />}
                                    onClick={handleDownloadTemplate}
                                    variant="outlined"
                                    size="large"
                                    sx={{
                                        textTransform: 'none',
                                        borderRadius: '12px',
                                        px: 4,
                                        py: 1.5,
                                        fontWeight: 600,
                                        borderColor: '#cbd5e1',
                                        color: '#64748b',
                                        '&:hover': {
                                            borderColor: '#3b82f6',
                                            color: '#3b82f6',
                                            bgcolor: '#eff6ff',
                                        },
                                    }}
                                >
                                    Download Excel Template
                                </Button>
                            </Stack>
                        </CardContent>
                    </Card>
                )}

                {!loading && previewData.length > 0 && (
                    <Zoom in={true}>
                        <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Button
                                    startIcon={<ArrowBackIcon />}
                                    onClick={handleCancelPreview}
                                    sx={{
                                        textTransform: 'none',
                                        color: '#64748b',
                                        fontWeight: 600,
                                        '&:hover': { color: '#1e293b', bgcolor: 'transparent' }
                                    }}
                                >
                                    Back to Upload
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={handleConfirmUpload}
                                    startIcon={<CheckCircleIcon />}
                                    disabled={previewData.some(r => r._errors && r._errors.length > 0)}
                                    sx={{
                                        bgcolor: '#3b82f6',
                                        borderRadius: '12px',
                                        px: 4,
                                        py: 1.5,
                                        fontWeight: 700,
                                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                                        textTransform: 'none',
                                        '&:hover': {
                                            bgcolor: '#2563eb',
                                            boxShadow: '0 6px 16px rgba(59, 130, 246, 0.4)',
                                        },
                                        '&:disabled': {
                                            bgcolor: '#94a3b8',
                                            color: '#f1f5f9'
                                        }
                                    }}
                                >
                                    Confirm Upload
                                </Button>
                            </Box>

                            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
                                <TableContainer sx={{ maxHeight: 'calc(100vh - 250px)' }}>
                                    <Table stickyHeader aria-label="sticky table">
                                        <TableHead>
                                            <TableRow>
                                                {['Hotel Name', 'Email', 'Phone', 'Address', 'Desc', 'Rating', 'Pets', 'Features', 'Room Name', 'Price', 'Guests'].map((head) => (
                                                    <TableCell key={head} sx={{ minWidth: 100, fontWeight: 'bold', bgcolor: '#3b82f6', color: '#fff', fontSize: '0.95rem', py: 2 }}>
                                                        {head}
                                                    </TableCell>
                                                ))}
                                                <TableCell sx={{ minWidth: 100, fontWeight: 'bold', bgcolor: '#3b82f6', color: '#fff', fontSize: '0.95rem', position: 'sticky', right: 0, zIndex: 5, py: 2 }}>
                                                    Action
                                                </TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {previewData.map((row, index) => {
                                                const isEditing = editingRow === index;
                                                return (
                                                    <TableRow key={index} hover role="checkbox" tabIndex={-1} sx={{ '&:nth-of-type(odd)': { bgcolor: '#f8fafc' }, transition: 'background-color 0.2s' }}>
                                                        <TableCell sx={{ border: (row._errors?.includes('hotelName')) ? '2px solid #ef4444' : 'none' }}>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.hotelName || ''}
                                                                    onChange={(e) => handleTempChange('hotelName', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    fullWidth
                                                                    error={!tempRowData.hotelName}
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>{row.hotelName || <span style={{ color: 'red' }}>Required</span>}</Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell sx={{ border: (row._errors?.includes('email')) ? '2px solid #ef4444' : 'none' }}>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.email || ''}
                                                                    onChange={(e) => handleTempChange('email', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    fullWidth
                                                                    error={!tempRowData.email}
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Typography variant="body2" color="text.secondary">{row.email || <span style={{ color: 'red' }}>Required</span>}</Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell sx={{ border: (row._errors?.includes('phoneNumber')) ? '2px solid #ef4444' : 'none' }}>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.phoneNumber || ''}
                                                                    onChange={(e) => handleTempChange('phoneNumber', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    fullWidth
                                                                    error={!tempRowData.phoneNumber}
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Typography variant="body2" color="text.secondary">{row.phoneNumber || <span style={{ color: 'red' }}>Required</span>}</Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell sx={{ border: (row._errors?.includes('address')) ? '2px solid #ef4444' : 'none' }}>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.address || ''}
                                                                    onChange={(e) => handleTempChange('address', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    fullWidth
                                                                    multiline
                                                                    maxRows={3}
                                                                    error={!tempRowData.address}
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Tooltip title={row.address || "Missing Address"} placement="top">
                                                                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>
                                                                        {row.address || <span style={{ color: 'red' }}>Required</span>}
                                                                    </Typography>
                                                                </Tooltip>
                                                            )}
                                                        </TableCell>
                                                        <TableCell sx={{ border: (row._errors?.includes('description')) ? '2px solid #ef4444' : 'none' }}>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.description || ''}
                                                                    onChange={(e) => handleTempChange('description', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    fullWidth
                                                                    multiline
                                                                    maxRows={3}
                                                                    error={!tempRowData.description}
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Tooltip title={row.description || "Missing Description"} placement="top">
                                                                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>
                                                                        {row.description || <span style={{ color: 'red' }}>Required</span>}
                                                                    </Typography>
                                                                </Tooltip>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.rating || 0}
                                                                    onChange={(e) => handleTempChange('rating', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    type="number"
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Typography variant="body2" color="text.secondary">{row.rating || 0}</Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.petsAllowed || ''}
                                                                    onChange={(e) => handleTempChange('petsAllowed', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    placeholder="Yes/No"
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Typography variant="body2" color="text.secondary">{String(row.petsAllowed)}</Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell sx={{ border: (row._errors?.includes('features')) ? '2px solid #ef4444' : 'none' }}>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.features || ''}
                                                                    onChange={(e) => handleTempChange('features', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    fullWidth
                                                                    error={!tempRowData.features}
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Tooltip title={row.features || "Missing Features"} placement="top">
                                                                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                                                                        {row.features || <span style={{ color: 'red' }}>Required</span>}
                                                                    </Typography>
                                                                </Tooltip>
                                                            )}
                                                        </TableCell>
                                                        <TableCell sx={{ border: (row._errors?.includes('roomName')) ? '2px solid #ef4444' : 'none' }}>
                                                            {isEditing ? (
                                                                <TextField value={tempRowData.roomName || ''} onChange={(e) => handleTempChange('roomName', e.target.value)} variant="outlined" size="small" error={!tempRowData.roomName} sx={{ bgcolor: '#fff' }} />
                                                            ) : <Typography variant="body2" color="text.secondary">{row.roomName || <span style={{ color: 'red' }}>Required</span>}</Typography>}
                                                        </TableCell>
                                                        <TableCell sx={{ border: (row._errors?.includes('roomPrice')) ? '2px solid #ef4444' : 'none' }}>
                                                            {isEditing ? (
                                                                <TextField value={tempRowData.roomPrice || ''} onChange={(e) => handleTempChange('roomPrice', e.target.value)} variant="outlined" size="small" type="number" error={!tempRowData.roomPrice} sx={{ bgcolor: '#fff' }} />
                                                            ) : <Typography variant="body2" color="text.secondary">{row.roomPrice || <span style={{ color: 'red' }}>Required</span>}</Typography>}
                                                        </TableCell>
                                                        <TableCell>
                                                            {isEditing ? (
                                                                <TextField value={tempRowData.maxGuests || ''} onChange={(e) => handleTempChange('maxGuests', e.target.value)} variant="outlined" size="small" type="number" sx={{ bgcolor: '#fff' }} />
                                                            ) : <Typography variant="body2" color="text.secondary">{row.maxGuests}</Typography>}
                                                        </TableCell>
                                                        <TableCell sx={{ position: 'sticky', right: 0, bgcolor: isEditing ? '#fff' : (index % 2 === 0 ? '#fff' : '#f8fafc'), zIndex: 5, borderLeft: '1px solid #e2e8f0' }}>
                                                            {isEditing ? (
                                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                                    <IconButton onClick={() => handleSaveClick(index)} color="primary" size="small" sx={{ bgcolor: '#eff6ff' }}>
                                                                        <SaveIcon fontSize="small" />
                                                                    </IconButton>
                                                                    <IconButton onClick={handleCancelClick} color="error" size="small" sx={{ bgcolor: '#fef2f2' }}>
                                                                        <CancelIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Box>
                                                            ) : (
                                                                <Button
                                                                    variant="outlined"
                                                                    size="small"
                                                                    startIcon={<EditIcon />}
                                                                    onClick={() => handleEditClick(index, row)}
                                                                    sx={{
                                                                        textTransform: 'none',
                                                                        borderColor: '#cbd5e1',
                                                                        color: '#64748b',
                                                                        '&:hover': {
                                                                            borderColor: '#3b82f6',
                                                                            color: '#3b82f6',
                                                                            bgcolor: '#eff6ff',
                                                                        }
                                                                    }}
                                                                >
                                                                    Edit
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Paper>
                        </Box>
                    </Zoom>
                )}
            </Container>
        </Box>
    );
};

export default ExcelUploadPage;
