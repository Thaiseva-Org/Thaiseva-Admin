import { deleteDoc, doc, getDoc, updateDoc, getCountFromServer, query, where } from "firebase/firestore";

import { CloseIcon } from "@icons";
import { DeleteForeverIcon } from "@icons";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TablePagination,
} from "@mui/material";
import { useContext, useEffect, useState } from "react";
import PartnerOnboarding from "../../../../forms/PartnerOnboarding";
import LoadingContent from "../../../../../components/LoadingContent";
import PageHeading from "../../../../../components/PageHeading";
import SearchBar from "../../../../../components/SearchBar";
import ServiceCategoryBtn from "../../../../../components/ServiceCategoryBtn";
import ViewDetailsIcon from "../../../../../components/ViewDetailsIcon";
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";
import {
  partnersCollection,
  usersCollection,
} from "../../../../../firebase/firebase.config";
import { successNotification } from "../../../../../utils/utils";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import {
  fetchlocalPartners,
  localPartnersTotalPages,
} from "../../../../../services/LocalRelated";

const DetailRow = ({ label, value, isFullWidth }) => (
  <Grid item xs={12} sm={isFullWidth ? 12 : 6}>
    <div className="flex flex-col">
      <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
        {label}
      </span>
      <span className="text-neutral-800 font-medium break-words">
        {label.includes("Price") && "$"}
        {value || "N/A"}
        {label === "Discount" && "%"}
      </span>
    </div>
  </Grid>
);

const SectionHeader = ({ label }) => (
  <Grid item xs={12}>
    <div className="flex items-center gap-4 py-3 mb-2">
      <h2 className="text-lg font-bold text-primary-700 m-0">{label}</h2>
      <div className="h-px bg-neutral-200 flex-grow"></div>
    </div>
  </Grid>
);

const LocalPartners = () => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetch, setRefetch] = useState(true);
  const [viewDetailsModal, setViewDetailsModal] = useState(false);
  const [openAddPartnerModal, setOpenAddPartnerModal] = useState(false);
  const [partnerDetails, setPartnerDetails] = useState({});
  const [status, setStatus] = useState("Pending");
  const { queryText, setQueryText, setRefetch: setPartnerContextRefetch } = useContext(PartnerContext);
  const [activeTab, setActiveTab] = useState(queryText || "Pending");
  const [partners, setPartners] = useState([]);
  const [matchedPartners, setMatchedPartners] = useState([]);
  const [partnerCounts, setPartnerCounts] = useState({
    total: 0,
    verified: 0,
    pending: 0,
    denied: 0,
  });

  const handleTabChange = (newStatus) => {
    setActiveTab(newStatus);
    if (setQueryText) setQueryText(newStatus);
    setPage(0);
    setLastDocs([]);
  };

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [totalSnap, verifiedSnap, pendingSnap, deniedSnap] = await Promise.all([
          getCountFromServer(partnersCollection),
          getCountFromServer(query(partnersCollection, where("status", "==", "Verified"))),
          getCountFromServer(query(partnersCollection, where("status", "==", "Pending"))),
          getCountFromServer(query(partnersCollection, where("status", "==", "Denied"))),
        ]);
        setPartnerCounts({
          total: totalSnap.data().count,
          verified: verifiedSnap.data().count,
          pending: pendingSnap.data().count,
          denied: deniedSnap.data().count,
        });
      } catch (err) {
        console.warn("Could not fetch partner counts:", err.message);
      }
    };
    if (isAdmin || isSubAdmin) {
      fetchCounts();
    }
  }, [isAdmin, isSubAdmin, refetch]);

  useEffect(() => {
    if (partners.length > 0) {
      setMatchedPartners(partners);
    }
  }, [partners]);

  useEffect(() => {
    if (isAdmin || isSubAdmin) {
      localPartnersTotalPages(setTotalPages, activeTab);
      fetchlocalPartners(
        setPartners,
        setMatchedPartners,
        setLoading,
        activeTab,
        lastDocs,
        setLastDocs,
        rowsPerPage,
        page
      );
    }
  }, [isAdmin, isSubAdmin, page, rowsPerPage, activeTab, refetch]);

  // Partners table header
  const columns = [
    { id: "name", label: "Name", width: 120 },
    {
      id: "phoneNumber",
      label: "Phone Number",
      width: 130,
    },
    {
      id: "serviceArea",
      label: "Service Area",
      width: 80,
    },
    // {
    //   id: "email",
    //   label: "Email",
    //   width: 80,
    // },
    {
      id: "status",
      label: "Status",
      width: 100,
    },
    {
      id: "action",
      label: "Action",
      width: 120,
    },
  ];

  // creating single row
  function createData(name, phoneNumber, serviceArea, status, id) {
    return { name, phoneNumber, serviceArea, status, id };
  }

  // calling createData function with partner's data
  const rows = matchedPartners.map((partner) => {
    return createData(
      partner.personalInformation.fullName,
      partner.personalInformation.phoneNumber,
      partner?.serviceInformation?.serviceArea,
      partner.status,
      partner.uid
    );
  });

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleClose = () => {
    setViewDetailsModal(false);
  };

  const handleViewDetails = async (id) => {
    setViewDetailsModal(true); //opening the modal
    const query = doc(partnersCollection, id);
    const data = await getDoc(query);

    setPartnerDetails(data.data());
  };

  // changing the status
  const handleChangeStatus = async (id) => {
    handleClose();

    const updatedStatus = { status: status, verified: status === "Verified" };
    try {
      await updateDoc(doc(partnersCollection, id), updatedStatus);
      await updateDoc(doc(usersCollection, id), updatedStatus);
      successNotification(`Partner status changed successfully to ${status}`);
      setRefetch((p) => !p);
      if (setPartnerContextRefetch) setPartnerContextRefetch((p) => !p);
      setPartnerDetails({});
      setStatus("Pending");
    } catch (error) {
      alert("Error Updating Status");
      console.log(error.message);
    }
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(partnersCollection, id)); // deleting partner data from partners collection
    await deleteDoc(doc(usersCollection, id)); // deleting partner data from user's collection
    // await deleteUserFromAuth({ uid: id }).then(() => console.log("deleted")); // deleting user account form authentication

    setRefetch((p) => !p);
  };




  const handleSearch = (text) => {
    const matchingObjects = partners.filter(
      (item) =>
        item.serviceInformation.serviceArea
          .toLowerCase()
          .includes(text.toLowerCase()) ||
        item.serviceCategory.toLowerCase().includes(text.toLowerCase()) ||
        item.personalInformation.fullName
          .toLowerCase()
          .includes(text.toLowerCase())
    );

    setMatchedPartners(matchingObjects);
  };

  return (
    <div className="animate-fade-in">
      <PageHeading
        text="Local Partners"
        subtitle="Manage local service partner accounts and verifications"
        icon="🤝"
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div
          onClick={() => handleTabChange("Verified")}
          className={`bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 text-white shadow-lg cursor-pointer transition-transform hover:scale-[1.02]`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium mb-1">
                Total Partners
              </p>
              <p className="text-3xl font-bold">{partnerCounts.total}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">🤝</span>
            </div>
          </div>
        </div>

        <div
          onClick={() => handleTabChange("Pending")}
          className={`bg-gradient-to-br from-warning-500 to-warning-600 rounded-xl p-6 text-white shadow-lg cursor-pointer transition-transform hover:scale-[1.02] ${
            activeTab === "Pending" ? "ring-4 ring-amber-300 ring-offset-2" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-warning-100 text-sm font-medium mb-1">
                Pending Requests
              </p>
              <p className="text-3xl font-bold">{partnerCounts.pending}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">⏳</span>
            </div>
          </div>
        </div>

        <div
          onClick={() => handleTabChange("Verified")}
          className={`bg-gradient-to-br from-success-500 to-success-600 rounded-xl p-6 text-white shadow-lg cursor-pointer transition-transform hover:scale-[1.02] ${
            activeTab === "Verified" ? "ring-4 ring-green-300 ring-offset-2" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-success-100 text-sm font-medium mb-1">
                Verified Partners
              </p>
              <p className="text-3xl font-bold">{partnerCounts.verified}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">✅</span>
            </div>
          </div>
        </div>

        <div
          onClick={() => handleTabChange("Denied")}
          className={`bg-gradient-to-br from-danger-500 to-danger-600 rounded-xl p-6 text-white shadow-lg cursor-pointer transition-transform hover:scale-[1.02] ${
            activeTab === "Denied" ? "ring-4 ring-red-300 ring-offset-2" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-danger-100 text-sm font-medium mb-1">Denied</p>
              <p className="text-3xl font-bold">{partnerCounts.denied}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">❌</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white p-3 rounded-xl shadow-sm border border-neutral-200">
        <span className="text-sm font-bold text-neutral-500 uppercase tracking-wide mr-2">
          Filter:
        </span>
        <button
          onClick={() => handleTabChange("Pending")}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
            activeTab === "Pending"
              ? "bg-warning-500 text-white shadow-md scale-105"
              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          }`}
        >
          <span>⏳ Pending Requests</span>
          {partnerCounts.pending > 0 && (
            <span className="bg-white text-warning-700 text-xs px-2 py-0.5 rounded-full font-bold">
              {partnerCounts.pending}
            </span>
          )}
        </button>
        <button
          onClick={() => handleTabChange("Verified")}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
            activeTab === "Verified"
              ? "bg-success-600 text-white shadow-md scale-105"
              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          }`}
        >
          <span>✅ Verified Partners</span>
          <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">
            {partnerCounts.verified}
          </span>
        </button>
        <button
          onClick={() => handleTabChange("Denied")}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
            activeTab === "Denied"
              ? "bg-danger-600 text-white shadow-md scale-105"
              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          }`}
        >
          <span>❌ Denied</span>
          <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">
            {partnerCounts.denied}
          </span>
        </button>
      </div>

      <SearchBar
        handleSearch={handleSearch}
        handleOpenModal={() => setOpenAddPartnerModal(true)}
        btnTitle="Add New Partner"
      />

      {/* Partners Table */}
      <div className="bg-white rounded-xl shadow-md border border-neutral-200 overflow-hidden">
        {loading ? (
          <LoadingContent />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.id}
                        className="px-4 py-4 text-center text-sm font-semibold"
                        style={{ width: column.width }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {matchedPartners.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <span className="text-6xl opacity-50">🤝</span>
                          <p className="text-neutral-500 font-medium">
                            No {activeTab} Partners Found
                          </p>
                          <p className="text-neutral-400 text-sm">
                            Partner accounts will appear here once they register
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, i) => {
                      return (
                        <tr
                          key={i}
                          className="hover:bg-primary-50 transition-colors duration-150"
                        >
                          {columns.map((column) => {
                            const value = row[column.id];
                            return (
                              <td
                                key={column.id}
                                className="px-4 py-4 text-center text-sm"
                              >
                                {value === "Pending" ||
                                  value === "Verified" ||
                                  value === "Denied" ? (
                                  <span
                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${value === "Pending"
                                      ? "bg-warning-100 text-warning-700"
                                      : value === "Verified"
                                        ? "bg-success-100 text-success-700"
                                        : "bg-danger-100 text-danger-700"
                                      }`}
                                  >
                                    {value === "Pending" && "⏳ "}
                                    {value === "Verified" && "✓ "}
                                    {value === "Denied" && "✗ "}
                                    {value}
                                  </span>
                                ) : column.id === "action" ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <div
                                      onClick={() => handleViewDetails(row.id)}
                                    >
                                      <ViewDetailsIcon />
                                    </div>
                                    {queryText === "Denied" && (
                                      <button
                                        onClick={() => handleDelete(row.id)}
                                        className="p-2 rounded-full bg-gradient-to-r from-danger-500 to-danger-600 text-white hover:scale-110 transition-all duration-200 shadow-md"
                                        title="Delete Partner"
                                      >
                                        <DeleteForeverIcon className="scale-90" />
                                      </button>
                                    )}
                                  </div>
                                ) : column.id === "phoneNumber" ? (
                                  <span className="text-neutral-600 font-mono">
                                    {value}
                                  </span>
                                ) : (
                                  <span className="text-neutral-700 font-medium">
                                    {value}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="border-t border-neutral-200">
              <TablePagination
                rowsPerPageOptions={[10, 25, 100]}
                component="div"
                count={totalPages}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                sx={{
                  "& .MuiTablePagination-toolbar": {
                    padding: "12px 16px",
                  },
                  "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows":
                  {
                    color: "#6B7280",
                    fontWeight: 500,
                  },
                  "& .MuiTablePagination-select": {
                    borderRadius: "8px",
                    padding: "4px 8px",
                    border: "1px solid #E5E7EB",
                    "&:hover": {
                      backgroundColor: "#F3F4F6",
                    },
                  },
                  "& .MuiTablePagination-actions button": {
                    borderRadius: "8px",
                    padding: "4px",
                    "&:hover": {
                      backgroundColor: "#EFF6FF",
                    },
                  },
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* View partner details modal  */}
      <Dialog
        open={viewDetailsModal}
        onClose={handleClose}
        aria-labelledby="responsive-dialog-title"
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: "16px" },
        }}
      >
        <div className="bg-primary-50 p-4 flex justify-between items-center border-b border-primary-100">
          <DialogTitle
            sx={{ m: 0, p: 0, fontSize: "1.25rem", fontWeight: "bold" }}
            id="customized-dialog-title"
            className="text-primary-800"
          >
            Partner Profile
          </DialogTitle>
          <IconButton
            aria-label="close"
            onClick={handleClose}
            sx={{
              color: "var(--primary-color)",
              "&:hover": { backgroundColor: "rgba(0,0,0,0.05)" },
            }}
          >
            <CloseIcon />
          </IconButton>
        </div>

        <DialogContent sx={{ p: { xs: 3, md: 4 } }}>
          <div className="flex flex-col md:flex-row gap-6 mb-8 items-start">
            <div className="flex-shrink-0 mx-auto md:mx-0">
              <img
                src={
                  partnerDetails?.personalInformation?.photoURL ||
                  "https://via.placeholder.com/150"
                }
                alt={partnerDetails?.personalInformation?.fullName}
                className="w-32 h-32 object-cover rounded-2xl shadow-lg border-4 border-white"
              />
            </div>
            <div className="flex-grow text-center md:text-left">
              <h2 className="text-2xl font-bold text-neutral-800 mb-2">
                {partnerDetails?.personalInformation?.fullName || "No Name"}
              </h2>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-3">
                <ServiceCategoryBtn value={partnerDetails.serviceCategory} />
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide text-white ${partnerDetails?.status === "Verified"
                    ? "bg-success-500"
                    : partnerDetails?.status === "Denied"
                      ? "bg-danger-500"
                      : "bg-warning-500"
                    }`}
                >
                  {partnerDetails?.status || "Unknown"}
                </span>
              </div>
              <p className="text-neutral-500 text-sm">
                UID: {partnerDetails.uid}
              </p>
            </div>
          </div>

          <Grid container spacing={3}>
            {/* Personal Information */}
            <SectionHeader label="Personal Information" />
            <DetailRow
              label="Full Name"
              value={partnerDetails?.personalInformation?.fullName}
            />
            <DetailRow
              label="Email Address"
              value={partnerDetails?.personalInformation?.email}
            />
            <DetailRow
              label="Phone Number"
              value={partnerDetails?.personalInformation?.phoneNumber}
            />
            <DetailRow
              label="Full Address"
              value={partnerDetails?.personalInformation?.address}
            />

            {/* Service Information */}
            <SectionHeader label="Service Information" />
            <DetailRow
              label="Service Area"
              value={partnerDetails?.serviceInformation?.serviceArea}
            />

            {(partnerDetails.serviceCategory === "Legal Administrative" ||
              partnerDetails.serviceCategory === "Official Work") && (
                <DetailRow
                  label="Education"
                  value={partnerDetails?.serviceInformation?.educationalBackground}
                />
              )}

            {(partnerDetails.serviceCategory === "Logistics and Transportation" ||
              partnerDetails.serviceCategory === "Order Pick Up") && (
                <>
                  <DetailRow
                    label="Number of Vehicles"
                    value={partnerDetails?.serviceInformation?.numberPlate}
                  />
                  <Grid item xs={12} sm={6}>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                        Vehicles List
                      </span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {partnerDetails?.serviceInformation?.vechicleNames?.length >
                          0 ? (
                          partnerDetails?.serviceInformation?.vechicleNames?.map(
                            (item, idx) => (
                              <span
                                key={idx}
                                className="bg-neutral-100 text-neutral-700 py-1 px-3 rounded-md text-sm border border-neutral-200"
                              >
                                {item}
                              </span>
                            )
                          )
                        ) : (
                          <span className="text-neutral-400 italic">
                            No vehicles listed
                          </span>
                        )}
                      </div>
                    </div>
                  </Grid>
                </>
              )}

            {/* Payment Information */}
            <SectionHeader label="Payment Information" />
            <DetailRow
              label="Bank Name"
              value={partnerDetails?.paymentInformation?.bankName}
            />
            <DetailRow
              label="Account Number"
              value={partnerDetails?.paymentInformation?.accountNumber}
            />
            <DetailRow
              label="Bank Branch/Location"
              value={partnerDetails?.paymentInformation?.bankAddress}
            />

            {/* Admin Actions */}
            <SectionHeader label="Administrative Actions" />
            <Grid item xs={12}>
              <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-700">
                      Change Partnership Status:
                    </span>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <FormControl
                      size="small"
                      sx={{ minWidth: 200, backgroundColor: "white" }}
                    >
                      <InputLabel id="status-label">Select Status</InputLabel>
                      <Select
                        labelId="status-label"
                        label="Select Status"
                        value={status || "Pending"}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        <MenuItem value="Pending">Pending</MenuItem>
                        <MenuItem value="Verified">Verified</MenuItem>
                        <MenuItem value="Denied">Denied</MenuItem>
                      </Select>
                    </FormControl>
                    <Button
                      variant="contained"
                      onClick={() => handleChangeStatus(partnerDetails.uid)}
                      sx={{
                        background: "linear-gradient(to right, #3b82f6, #2563eb)",
                        textTransform: "none",
                        fontWeight: "bold",
                        px: 4,
                        py: 1,
                        color: "white",
                        boxShadow: "0 4px 6px -1px rgba(59, 130, 246, 0.5)",
                        "&:hover": {
                          background: "linear-gradient(to right, #2563eb, #1d4ed8)",
                          boxShadow: "0 10px 15px -3px rgba(59, 130, 246, 0.6)",
                        },
                      }}
                    >
                      Update Status
                    </Button>
                  </div>
                </div>
              </div>
            </Grid>
          </Grid>
        </DialogContent>
      </Dialog>

      {/* Add New Partner Popup Modal */}
      <Dialog
        open={openAddPartnerModal}
        onClose={() => setOpenAddPartnerModal(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "20px",
            overflow: "hidden",
            maxHeight: "92vh",
          },
        }}
      >
        <PartnerOnboarding
          isModal={true}
          onClose={() => setOpenAddPartnerModal(false)}
          onSuccess={() => {
            setOpenAddPartnerModal(false);
            setRefetch((p) => !p);
            if (setPartnerContextRefetch) setPartnerContextRefetch((p) => !p);
          }}
        />
      </Dialog>
    </div>
  );
};

export default LocalPartners;
