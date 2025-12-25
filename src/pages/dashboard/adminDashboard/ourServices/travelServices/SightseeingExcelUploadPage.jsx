import React, { useState } from 'react';
import { MdEdit, MdDelete } from "react-icons/md";
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
    Zoom
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
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router-dom';
import readXlsxFile from 'read-excel-file';
import writeXlsxFile from 'write-excel-file';
import { doc, setDoc, collection } from "firebase/firestore";
import { v4 as uuid } from 'uuid';
import {
    db,
    travelServicesCollection,
} from "../../../../../firebase/firebase.config";
import { successNotification } from "../../../../../utils/utils";
import { getEmptySightseeingPackage } from "../../../../../utils/sightseeingTransformation";

const SightseeingExcelUploadPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [successCount, setSuccessCount] = useState(0);
    const [previewData, setPreviewData] = useState([]);
    const [editingRow, setEditingRow] = useState(null);
    const [tempRowData, setTempRowData] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [batchResults, setBatchResults] = useState(null); // New state for summary view

    const handleDownloadTemplate = async () => {
        const schema = [
            { column: 'Package Title', type: String, value: p => p.title, width: 30 },
            { column: 'Location', type: String, value: p => p.location, width: 20 },
            { column: 'Duration (Days)', type: Number, value: p => p.period, width: 15 },
            { column: 'Base Price', type: Number, value: p => p.price, width: 15 },
            { column: 'Discount (%)', type: Number, value: p => p.discount, width: 15 },
            { column: 'Description', type: String, value: p => p.description, width: 40 },
            { column: 'Price Per Child', type: Number, value: p => p.pricePerChild, width: 15 },
            { column: 'Extra Adult Price', type: Number, value: p => p.extraAdultPrice, width: 15 },
            { column: 'Transport Type', type: String, value: p => p.transportType, width: 20 },
            { column: 'Pickup (Yes/No)', type: String, value: p => p.pickupFromHotel, width: 15 },
            { column: 'Drop (Yes/No)', type: String, value: p => p.dropToAirport, width: 15 },
            { column: 'Highlights', type: String, value: p => p.amenities, width: 30 }, // Comma separated
            { column: 'Included', type: String, value: p => p.included, width: 30 }, // Comma separated
            { column: 'Excluded', type: String, value: p => p.excluded, width: 30 }, // Comma separated
            { column: 'Places', type: String, value: p => p.places, width: 30 }, // Comma separated
        ];

        const data = [
            {
                title: "Example Sightseeing Tour",
                location: "Bangkok",
                period: 3,
                price: 5000,
                discount: 0,
                description: "An amazing tour around Bangkok.",
                pricePerChild: 2500,
                extraAdultPrice: 4000,
                transportType: "Van",
                pickupFromHotel: "Yes",
                dropToAirport: "No",
                amenities: "Lunch, Guide, Transport",
                included: "Entrance fees, Water",
                excluded: "Tips, Personal expenses",
                places: "Grand Palace, Wat Arun"
            }
        ];

        try {
            await writeXlsxFile(data, {
                schema,
                fileName: 'Sightseeing_Upload_Template.xlsx'
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
                'Package Title': 'title',
                'Location': 'location',
                'Duration (Days)': 'period',
                'Base Price': 'price',
                'Discount (%)': 'discount',
                'Description': 'description',
                'Price Per Child': 'pricePerChild',
                'Extra Adult Price': 'extraAdultPrice',
                'Transport Type': 'transportType',
                'Pickup (Yes/No)': 'pickupFromHotel',
                'Drop (Yes/No)': 'dropToAirport',
                'Highlights': 'amenities',
                'Included': 'included',
                'Excluded': 'excluded',
                'Places': 'places'
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

                // Validation
                const missing = [];
                if (!obj.title) missing.push('title');
                if (!obj.location) missing.push('location');
                if (!obj.price) missing.push('price');
                if (!obj.period) missing.push('period');
                if (!obj.description) missing.push('description');

                obj._errors = missing;
                return obj;
            });

            setPreviewData(mappedData);

            // Check for errors
            const hasValidationErrors = mappedData.some(r => r._errors && r._errors.length > 0);
            if (hasValidationErrors) {
                setError("Some rows are missing compulsory fields (Title, Location, Price, Duration, Description). Please edit the highlighted red cells.");
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
        // Validate saved data
        const row = tempRowData;
        const missing = [];
        if (!row.title) missing.push('title');
        if (!row.location) missing.push('location');
        if (!row.price) missing.push('price');
        if (!row.period) missing.push('period');
        if (!row.description) missing.push('description');
        row._errors = missing;

        newData[index] = row;
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
            // Auto-clear error
            if (value && updated._errors && updated._errors.includes(field)) {
                updated._errors = updated._errors.filter(e => e !== field);
            }
            return updated;
        });
    };

    const handleConfirmUpload = async () => {
        setLoading(true);
        const results = await processExcelData(previewData);
        setBatchResults(results); // Step 2: Show summary
        setPreviewData([]);
        setLoading(false);
    };

    const handleCancelPreview = () => {
        setPreviewData([]);
        setError("");
        setBatchResults(null);
    };

    const processExcelData = async (data) => {
        let results = [];

        for (const row of data) {
            const title = row.title;
            const price = row.price;
            // No need to check required fields here as button is disabled if errors exist

            try {
                const id = uuid();
                const coverPhotoURL = "https://via.placeholder.com/400x300?text=No+Image";

                const travelInfo = {
                    id,
                    title,
                    description: row.description || "",
                    price: Number(price),
                    discount: Number(row.discount || 0),
                    location: row.location || "",
                    period: Number(row.period || 1),
                    coverPhoto: coverPhotoURL,
                    timestamp: new Date(),
                    images: [],
                };

                const baseStruct = getEmptySightseeingPackage();

                const travelDetails = {
                    ...baseStruct,
                    ...travelInfo,
                    packageId: id,
                    packageName: title,
                    about: row.description || "",
                    startingPrice: Number(price),
                    currency: "THB",
                    duration: {
                        days: Number(row.period || 1),
                        nights: Math.max(0, Number(row.period || 1) - 1)
                    },
                    thumbnailImage: coverPhotoURL,

                    highlights: row.amenities ? String(row.amenities).split(',').map(s => s.trim()) : [],
                    amenities: row.amenities ? String(row.amenities).split(',').map(s => s.trim()) : [],
                    included: row.included ? String(row.included).split(',').map(s => s.trim()) : [],
                    excluded: row.excluded ? String(row.excluded).split(',').map(s => s.trim()) : [],
                    packageImages: [],
                    pictures: [],

                    sights: row.places ? String(row.places).split(',').map(s => ({
                        sightId: uuid(),
                        title: s.trim(),
                        description: "",
                        images: [],
                        location: { latitude: 0, longitude: 0 }
                    })) : [],
                    places: row.places ? String(row.places).split(',').map(s => s.trim()) : [],

                    pricingStructure: {
                        pricePerAdult: Number(price),
                        pricePerChild: Number(row.pricePerChild || 0),
                        extraAdultPrice: Number(row.extraAdultPrice || 0)
                    },

                    transportType: row.transportType || "",
                    pickupDropDetails: {
                        pickupFromHotel: String(row.pickupFromHotel).toLowerCase() === 'yes',
                        dropToAirport: String(row.dropToAirport).toLowerCase() === 'yes',
                        availablePickupTimes: [],
                        availableDropTimes: []
                    },

                    rating: { average: 5, totalReviews: 0 },
                };

                await setDoc(doc(travelServicesCollection, id), travelInfo);
                await setDoc(doc(collection(db, "sightseeingPackagesDetails"), id), travelDetails);

                results.push({ name: title, id: id, status: 'Success' });
            } catch (err) {
                console.error("Error processing row:", err);
                results.push({ name: title, status: 'Error', error: err.message });
            }
        }
        return results;
    };

    return (
        <Box sx={{ p: 4, minHeight: '100vh', bgcolor: '#f1f5f9' }}>
            <Container maxWidth="xl">
                {/* Breadcrumbs */}
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb" sx={{ mb: 3 }}>
                    <Link underline="hover" color="inherit" onClick={() => navigate('/dashboard/travel-services')} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        Sightseeing
                    </Link>
                    <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>Excel Upload</Typography>
                </Breadcrumbs>

                {/* Header Section */}
                <Box sx={{ mb: 5 }}>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e293b', mb: 1 }}>
                        Bulk Sightseeing Upload
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Streamline your workflow by uploading multiple sightseeing packages at once.
                    </Typography>
                </Box>

                {/* 1. Summary View (Post-Upload) */}
                {!loading && batchResults && (
                    <Card sx={{ borderRadius: '24px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                        <Box sx={{ bgcolor: '#ecfdf5', px: 4, py: 3, borderBottom: '1px solid #d1fae5', display: 'flex', alignItems: 'center', gap: 2 }}>
                            <CheckCircleIcon sx={{ color: '#10b981', fontSize: 32 }} />
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: '#065f46' }}>Upload Completed</Typography>
                                <Typography variant="body2" sx={{ color: '#047857' }}>
                                    Your packages have been created. IMPORTANT: Please add photos now to ensure they look good on the app.
                                </Typography>
                            </Box>
                        </Box>
                        <CardContent sx={{ p: 0 }}>
                            <TableContainer sx={{ maxHeight: '600px' }}>
                                <Table stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8fafc' }}>Package Name</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8fafc' }}>Status</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8fafc', width: '200px' }}>Action</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {batchResults.map((res, i) => (
                                            <TableRow key={i} hover>
                                                <TableCell sx={{ fontWeight: 600, color: '#334155' }}>{res.name}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={res.status}
                                                        size="small"
                                                        color={res.status === 'Success' ? 'success' : 'error'}
                                                        variant="soft"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {res.status === 'Success' && (
                                                        <Button
                                                            variant="contained"
                                                            size="small"
                                                            startIcon={<CloudUploadIcon />}
                                                            onClick={() => window.open(`/dashboard/travel-services/edit/${res.id}`, '_blank')}
                                                            sx={{
                                                                textTransform: 'none',
                                                                bgcolor: '#3b82f6',
                                                                borderRadius: '8px',
                                                                boxShadow: 'none',
                                                                '&:hover': { bgcolor: '#2563eb' }
                                                            }}
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
                            <Box sx={{ p: 3, bgcolor: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: 2, borderTop: '1px solid #e2e8f0' }}>
                                <Button
                                    onClick={() => { setBatchResults(null); setPreviewData([]); setError(""); }}
                                    variant="outlined"
                                    sx={{ borderRadius: '10px', textTransform: 'none' }}
                                >
                                    Upload More
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={() => navigate('/dashboard/travel-services')}
                                    sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: '#1e293b' }}
                                >
                                    Done & Go to List
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
                )}

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

                {!loading && !batchResults && previewData.length === 0 && (
                    <Card sx={{ borderRadius: '24px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)', overflow: 'visible' }}>
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

                {!loading && !batchResults && previewData.length > 0 && (
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
                                                {['Title', 'Location', 'Price', 'Duration', 'Description', 'Discount', 'Trans. Type'].map((head) => (
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
                                                        <TableCell sx={{ border: (row._errors?.includes('title')) ? '2px solid #ef4444' : 'none' }}>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.title || ''}
                                                                    onChange={(e) => handleTempChange('title', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    fullWidth
                                                                    error={!tempRowData.title}
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                                                                    {row.title || <span style={{ color: 'red' }}>Required</span>}
                                                                </Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell sx={{ border: (row._errors?.includes('location')) ? '2px solid #ef4444' : 'none' }}>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.location || ''}
                                                                    onChange={(e) => handleTempChange('location', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    fullWidth
                                                                    error={!tempRowData.location}
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Typography variant="body2" color="text.secondary">
                                                                    {row.location || <span style={{ color: 'red' }}>Required</span>}
                                                                </Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell sx={{ border: (row._errors?.includes('price')) ? '2px solid #ef4444' : 'none' }}>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.price || ''}
                                                                    onChange={(e) => handleTempChange('price', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    type="number"
                                                                    error={!tempRowData.price}
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Typography variant="body2" color="text.secondary">
                                                                    {row.price || <span style={{ color: 'red' }}>Required</span>}
                                                                </Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell sx={{ border: (row._errors?.includes('period')) ? '2px solid #ef4444' : 'none' }}>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.period || ''}
                                                                    onChange={(e) => handleTempChange('period', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    type="number"
                                                                    error={!tempRowData.period}
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Typography variant="body2" color="text.secondary">
                                                                    {row.period || <span style={{ color: 'red' }}>Required</span>}
                                                                </Typography>
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
                                                                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                                                                        {row.description || <span style={{ color: 'red' }}>Required</span>}
                                                                    </Typography>
                                                                </Tooltip>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.discount || ''}
                                                                    onChange={(e) => handleTempChange('discount', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    type="number"
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Typography variant="body2" color="text.secondary">{row.discount}%</Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.transportType || ''}
                                                                    onChange={(e) => handleTempChange('transportType', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    fullWidth
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Typography variant="body2" color="text.secondary">{row.transportType}</Typography>
                                                            )}
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
                                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                                    <Tooltip title="Edit Row">
                                                                        <IconButton
                                                                            onClick={() => handleEditClick(index, row)}
                                                                            size="small"
                                                                            sx={{
                                                                                color: '#f59e0b',
                                                                                '&:hover': { bgcolor: '#fffbeb' },
                                                                                transition: 'all 0.2s'
                                                                            }}
                                                                        >
                                                                            <MdEdit size={20} />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                    <Tooltip title="Delete Row">
                                                                        <IconButton
                                                                            onClick={() => {
                                                                                const newData = [...previewData];
                                                                                newData.splice(index, 1);
                                                                                setPreviewData(newData);
                                                                            }}
                                                                            size="small"
                                                                            sx={{
                                                                                color: '#ef4444',
                                                                                '&:hover': { bgcolor: '#fef2f2' },
                                                                                transition: 'all 0.2s'
                                                                            }}
                                                                        >
                                                                            <MdDelete size={20} />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                </Box>
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

export default SightseeingExcelUploadPage;
