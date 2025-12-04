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
import { useNavigate } from 'react-router-dom';
import readXlsxFile from 'read-excel-file';
import writeXlsxFile from 'write-excel-file';
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
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

    const handleDownloadTemplate = async () => {
        const schema = [
            { column: 'Hotel Name', type: String, value: hotel => hotel.hotelName, width: 20 },
            { column: 'Email', type: String, value: hotel => hotel.email, width: 25 },
            { column: 'Phone Number', type: String, value: hotel => hotel.phoneNumber, width: 15 },
            { column: 'Address', type: String, value: hotel => hotel.address, width: 30 },
            { column: 'Description', type: String, value: hotel => hotel.description, width: 30 },
            { column: 'Bank Name', type: String, value: hotel => hotel.bankName, width: 20 },
            { column: 'Bank Address', type: String, value: hotel => hotel.bankAddress, width: 30 }
        ];

        const data = [
            {
                hotelName: "Example Hotel",
                email: "hotel@example.com",
                phoneNumber: "1234567890",
                address: "123 Main St, City, Country",
                description: "A lovely place to stay.",
                bankName: "Example Bank",
                bankAddress: "Bank Street, City"
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
                'Bank Name': 'bankName',
                'Bank Address': 'bankAddress'
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
                return obj;
            });

            setPreviewData(mappedData);
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
        setTempRowData(prev => ({ ...prev, [field]: value }));
    };

    const handleConfirmUpload = async () => {
        setLoading(true);
        await processExcelData(previewData);
        setPreviewData([]);
    };

    const handleCancelPreview = () => {
        setPreviewData([]);
        setError("");
    };

    const processExcelData = async (data) => {
        let count = 0;
        let errors = [];

        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);

        for (const row of data) {
            const email = row.email;
            const hotelName = row.hotelName;
            const phoneNumber = row.phoneNumber;

            if (!email || !hotelName) {
                errors.push(`Skipped row missing email or name.`);
                continue;
            }

            try {
                let createdUser;
                try {
                    const res = await createUserWithEmailAndPassword(secondaryAuth, email, "TempPass123!");
                    createdUser = res.user;
                    await updateProfile(createdUser, { displayName: hotelName });
                    await signOut(secondaryAuth);
                } catch (authErr) {
                    if (authErr.code === 'auth/email-already-in-use') {
                        errors.push(`Email ${email} already exists.`);
                    } else {
                        errors.push(`Failed to create user for ${email}: ${authErr.message}`);
                    }
                    continue;
                }

                if (createdUser) {
                    const hotelInfo = {
                        status: "Verified",
                        verified: true,
                        serviceCategory: "Hotel",
                        hotelInformation: {
                            email,
                            hotelName,
                            phoneNumber: phoneNumber || "",
                            address: row.address || "",
                            description: row.description || "",
                            location: null,
                            logoURL: "",
                            rating: 0,
                            amenities: [],
                            roomTypes: []
                        },
                        paymentInformation: {
                            bankName: row.bankName || "",
                            accountNumber: "",
                            bankAddress: row.bankAddress || ""
                        },
                        comission: 0,
                        timestamp: serverTimestamp(),
                        uid: createdUser.uid,
                    };

                    await setDoc(doc(usersCollection, createdUser.uid), {
                        displayName: hotelName,
                        email,
                        role: "Partner",
                        serviceCategory: "Hotel",
                        status: "Verified",
                        photoURL: "",
                        phoneNo: phoneNumber || "",
                        createdAt: new Date(),
                        uid: createdUser.uid,
                    });

                    await setDoc(doc(hotelsCollection, createdUser.uid), hotelInfo);
                    count++;
                }
            } catch (err) {
                console.error("Error processing row:", err);
                errors.push(`Error processing ${email}`);
            }
        }

        await deleteApp(secondaryApp);
        setLoading(false);
        setSuccessCount(count);

        if (errors.length > 0) {
            setError(`Processed ${count} hotels. Errors: ${errors.slice(0, 3).join(", ")}...`);
        } else {
            successNotification(`Successfully added ${count} hotels!`);
            setTimeout(() => {
                navigate('/dashboard/hotels');
            }, 2000);
        }
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

                {!loading && previewData.length === 0 && (
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
                                                {['Hotel Name', 'Email', 'Phone', 'Address', 'Description', 'Bank Name', 'Bank Address'].map((head) => (
                                                    <TableCell key={head} sx={{ minWidth: 150, fontWeight: 'bold', bgcolor: '#3b82f6', color: '#fff', fontSize: '0.95rem', py: 2 }}>
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
                                                        <TableCell>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.hotelName || ''}
                                                                    onChange={(e) => handleTempChange('hotelName', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    fullWidth
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>{row.hotelName}</Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.email || ''}
                                                                    onChange={(e) => handleTempChange('email', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    fullWidth
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Typography variant="body2" color="text.secondary">{row.email}</Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.phoneNumber || ''}
                                                                    onChange={(e) => handleTempChange('phoneNumber', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    fullWidth
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Typography variant="body2" color="text.secondary">{row.phoneNumber}</Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.address || ''}
                                                                    onChange={(e) => handleTempChange('address', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    fullWidth
                                                                    multiline
                                                                    maxRows={3}
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Tooltip title={row.address} placement="top">
                                                                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>
                                                                        {row.address}
                                                                    </Typography>
                                                                </Tooltip>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.description || ''}
                                                                    onChange={(e) => handleTempChange('description', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    fullWidth
                                                                    multiline
                                                                    maxRows={3}
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Tooltip title={row.description} placement="top">
                                                                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>
                                                                        {row.description}
                                                                    </Typography>
                                                                </Tooltip>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.bankName || ''}
                                                                    onChange={(e) => handleTempChange('bankName', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    fullWidth
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Typography variant="body2" color="text.secondary">{row.bankName}</Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {isEditing ? (
                                                                <TextField
                                                                    value={tempRowData.bankAddress || ''}
                                                                    onChange={(e) => handleTempChange('bankAddress', e.target.value)}
                                                                    variant="outlined"
                                                                    size="small"
                                                                    fullWidth
                                                                    sx={{ bgcolor: '#fff' }}
                                                                />
                                                            ) : (
                                                                <Typography variant="body2" color="text.secondary">{row.bankAddress}</Typography>
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
