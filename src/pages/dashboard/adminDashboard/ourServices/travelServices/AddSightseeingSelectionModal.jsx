import {
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    Typography,
    Box,
    Paper,
} from '@mui/material';
import { CloseIcon } from "@icons";
import { EditIcon } from "@icons";
import { useNavigate } from 'react-router-dom';

const AddSightseeingSelectionModal = ({ open, onClose }) => {
    const navigate = useNavigate();

    const handleManualEntry = () => {
        onClose();
        navigate('/dashboard/travel-services/add');
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                style: {
                    borderRadius: '24px',
                    maxWidth: '850px',
                    padding: '16px',
                },
            }}
        >
            <DialogTitle sx={{ p: 2, textAlign: 'center', position: 'relative' }}>
                <Typography variant="h4" component="div" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
                    Add New Package
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.1rem' }}>
                    Choose your preferred method to add a new sightseeing package.
                </Typography>
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    sx={{
                        position: 'absolute',
                        right: 16,
                        top: 16,
                        color: '#94a3b8',
                        '&:hover': {
                            backgroundColor: '#f1f5f9',
                            color: '#64748b',
                        },
                    }}
                >
                    <CloseIcon fontSize="medium" />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap', py: 2 }}>
                    {/* Manual Entry Card */}
                    <Paper
                        elevation={0}
                        sx={{
                            p: 5,
                            border: '2px solid #e2e8f0',
                            borderRadius: '20px',
                            width: '320px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            backgroundColor: '#fff',
                            '&:hover': {
                                borderColor: '#3b82f6',
                                boxShadow: '0 20px 40px -12px rgba(59, 130, 246, 0.15)',
                                transform: 'translateY(-4px)',
                            },
                        }}
                        onClick={handleManualEntry}
                    >
                        <Box
                            sx={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                bgcolor: '#eff6ff', // Blue-50
                                color: '#3b82f6', // Blue-500
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mx: 'auto',
                                mb: 3,
                                transition: 'transform 0.3s ease',
                                '.MuiPaper-root:hover &': {
                                    transform: 'scale(1.1)',
                                },
                            }}
                        >
                            <EditIcon sx={{ fontSize: '40px' }} />
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5, color: '#1e293b' }}>
                            Manual Entry
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                            Create a single package profile step-by-step with our guided form.
                        </Typography>
                    </Paper>

                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default AddSightseeingSelectionModal;
