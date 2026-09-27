import {
    TablePagination,
    TextField,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    MenuItem,
    Select,
    FormControl,
    InputLabel
} from "@mui/material";
import { useEffect, useState } from "react";
import { CloseIcon } from "@icons";
import { EditIcon } from "@icons";
import PageHeading from "../../../../components/PageHeading";
import { getDocs, doc, updateDoc } from "firebase/firestore";
import { partnersCollection } from "../../../../firebase/firebase.config";
import LoadingContent from "../../../../components/LoadingContent";
import { successNotification } from "../../../../utils/utils";

const PartnerCommissions = () => {
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Edit State
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedPartner, setSelectedPartner] = useState(null);
    const [commissionRate, setCommissionRate] = useState("");
    const [commissionType, setCommissionType] = useState("Percentage");

    useEffect(() => {
        fetchPartners();
    }, []);

    const fetchPartners = async () => {
        setLoading(true);
        try {
            // In a real app with many partners, we would paginate at the database level.
            // For now, fetching all and filtering client-side for simplicity as per existing patterns.
            const snapshot = await getDocs(partnersCollection);
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPartners(list);
        } catch (error) {
            console.error("Error fetching partners:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (partner) => {
        setSelectedPartner(partner);
        setCommissionRate(partner.commissionRate || 0);
        setCommissionType(partner.commissionType || "Percentage");
        setEditModalOpen(true);
    };

    const handleSaveCommission = async () => {
        if (!selectedPartner) return;

        try {
            const partnerRef = doc(partnersCollection, selectedPartner.id);
            await updateDoc(partnerRef, {
                commissionRate: Number(commissionRate),
                commissionType: commissionType
            });

            successNotification("Commission updated successfully");

            // Update local state
            setPartners(prev => prev.map(p =>
                p.id === selectedPartner.id
                    ? { ...p, commissionRate: Number(commissionRate), commissionType }
                    : p
            ));

            setEditModalOpen(false);
        } catch (error) {
            console.error("Error updating commission:", error);
            alert("Failed to update commission");
        }
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Pagination Logic
    const paginatedPartners = partners.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    return (
        <div className="animate-fade-in pb-12">
            <PageHeading
                text="Partner Commissions"
                subtitle="Manage commission rates for all registered partners"
                icon="💰"
            />

            <div className="bg-white rounded-xl shadow-md border border-neutral-200 overflow-hidden mt-6">
                {loading ? (
                    <LoadingContent />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Partner Name</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Service Category</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Service Area</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Commission Type</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Value</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {paginatedPartners.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                                No partners found.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedPartners.map((partner) => (
                                            <tr key={partner.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        {partner.personalInformation?.photoURL ? (
                                                            <img className="h-10 w-10 rounded-full object-cover mr-3" src={partner.personalInformation.photoURL} alt="" />
                                                        ) : (
                                                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3">
                                                                {partner.personalInformation?.fullName?.charAt(0) || "P"}
                                                            </div>
                                                        )}
                                                        <div className="text-sm font-medium text-gray-900">{partner.personalInformation?.fullName || "N/A"}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                        {partner.serviceCategory || "Unknown"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {partner.serviceInformation?.serviceArea || "N/A"}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                                                    {partner.commissionType || "Percentage"}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-green-600">
                                                    {partner.commissionRate ? (
                                                        partner.commissionType === "Fixed" ? `$${partner.commissionRate}` : `${partner.commissionRate}%`
                                                    ) : (
                                                        <span className="text-gray-400 italic">Not Set</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                                    <button
                                                        onClick={() => handleEditClick(partner)}
                                                        className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 p-2 rounded-full transition-colors"
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <TablePagination
                            rowsPerPageOptions={[10, 25, 100]}
                            component="div"
                            count={partners.length}
                            rowsPerPage={rowsPerPage}
                            page={page}
                            onPageChange={handleChangePage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                        />
                    </>
                )}
            </div>

            {/* Edit Modal */}
            <Dialog open={editModalOpen} onClose={() => setEditModalOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle className="flex justify-between items-center">
                    Update Commission
                    <IconButton onClick={() => setEditModalOpen(false)} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <div className="space-y-6 pt-2">
                        <div className="text-sm text-gray-600 mb-2">
                            Set the commission rate for <b>{selectedPartner?.personalInformation?.fullName}</b>.
                        </div>

                        <FormControl fullWidth>
                            <InputLabel>Commission Type</InputLabel>
                            <Select
                                value={commissionType}
                                label="Commission Type"
                                onChange={(e) => setCommissionType(e.target.value)}
                            >
                                <MenuItem value="Percentage">Percentage (%)</MenuItem>
                                <MenuItem value="Fixed">Fixed Amount ($)</MenuItem>
                            </Select>
                        </FormControl>

                        <TextField
                            label="Commission Value"
                            type="number"
                            fullWidth
                            value={commissionRate}
                            onChange={(e) => setCommissionRate(e.target.value)}
                            InputProps={{
                                endAdornment: <span className="text-gray-500">{commissionType === "Percentage" ? "%" : "$"}</span>,
                            }}
                        />
                    </div>
                </DialogContent>
                <DialogActions sx={{ padding: '16px' }}>
                    <Button onClick={() => setEditModalOpen(false)} className="text-gray-500">Cancel</Button>
                    <Button
                        onClick={handleSaveCommission}
                        variant="contained"
                        sx={{ backgroundColor: 'var(--primary-color)', color: 'white' }}
                    >
                        Save Changes
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default PartnerCommissions;
