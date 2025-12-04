import { deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";

import CloseIcon from "@mui/icons-material/Close";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
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

const LocalPartners = () => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetch, setRefetch] = useState(true);
  // const [queryText, setQueryText] = useState("Verified");
  const [viewDetailsModal, setViewDetailsModal] = useState(false);
  const [partnerDetails, setPartnerDetails] = useState({});
  // const [serviceCategories, setServiceCategories] = useState([]);
  const [status, setStatus] = useState("Pending");
  // const {
  //   partners,
  //   setRefetch,
  //   queryText,
  //   setQueryCategory,
  //   queryCategory,
  //   loadingPartnerData,
  // } = useContext(PartnerContext);
  const { queryText } = useContext(PartnerContext);
  const [partners, setPartners] = useState([]);
  const [matchedPartners, setMatchedPartners] = useState([]);

  // useEffect(() => {
  //   setMatchedPartners(partners);
  // }, [partners]);

  useEffect(() => {
    if (isAdmin || isSubAdmin) {
      localPartnersTotalPages(setTotalPages, queryText);
      fetchlocalPartners(
        setPartners,
        setMatchedPartners,
        setLoading,
        queryText,
        lastDocs,
        setLastDocs,
        rowsPerPage,
        page
      );
    }
  }, [isAdmin, isSubAdmin, page, rowsPerPage, queryText, refetch]);

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
    setRowsPerPage(+event.target.value);
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

    const updatedStatus = { status: status };
    try {
      await updateDoc(doc(partnersCollection, id), updatedStatus);
      await updateDoc(doc(usersCollection, id), updatedStatus);
      // if (status == "Verified") {
      //   await setDoc(
      //     doc(agentsCollection, id),
      //     {
      //       email: partnerDetails.personalInformation.email,
      //       name: partnerDetails.personalInformation.fullName,
      //       id: id,
      //       status: "available",
      //     },
      //     { merge: true }
      //   );
      // }
      successNotification("Status is changed successfully");
      setRefetch((p) => !p);
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

  /* =============================================================
              serach functionalities start
  =============================================================*/
  // const handleSearchByName = (text) => {
  //   const matchingObjects = partners.filter((item) =>
  //     item.personalInformation.fullName
  //       .toLowerCase()
  //       .includes(text.toLowerCase())
  //   );

  //   setMatchedPartners(matchingObjects);
  // };

  // const handleSearchByServiceArea = (text) => {
  //   const matchingObjects = partners.filter((item) =>
  //     item.serviceInformation.serviceArea
  //       .toLowerCase()
  //       .includes(text.toLowerCase())
  //   );

  //   setMatchedPartners(matchingObjects);
  // };

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
  /* =============================================================
              serach functionalities end
  =============================================================*/

  // const serviceCategories = [
  //   "All",
  //   "Official Work",
  //   "Legal Administrative",
  //   "Logistics and Transportation",
  //   "Order Local Sim",
  //   "Home Services",
  //   "Order Pick Up",
  //   "Others",
  // ];

  // useEffect(() => {
  //   const fetchServiceCategories = async () => {
  //     await getDoc(serviceCategoriesDoc).then((snapshot) => {
  //       const data = snapshot.data();
  //       setServiceCategories([
  //         "All",
  //         ...data.categories.map((cat) => cat.title),
  //       ]);
  //     });
  //   };
  //   fetchServiceCategories();
  // }, []);

  const textField = (label, value, is12) => {
    return (
      <Grid item xs={12} sm={label === "Description" || is12 ? 12 : 6}>
        <div className="flex gap-2">
          <p>
            <span className="font-bold">{label}: </span>
            {label.includes("Price") && "$"}
            {value}
            {label === "Discount" && "%"}
          </p>
        </div>
      </Grid>
    );
  };

  const headingTextField = (label) => {
    return (
      <Grid item xs={12} sm={12}>
        <div className="flex justify-center mb-2">
          <h2 className="font-bold text-center text-xl">{label}</h2>
        </div>
      </Grid>
    );
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
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium mb-1">
                Total Partners
              </p>
              <p className="text-3xl font-bold">{matchedPartners.length}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">🤝</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-success-500 to-success-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-success-100 text-sm font-medium mb-1">
                Verified
              </p>
              <p className="text-3xl font-bold">
                {matchedPartners.filter((p) => p.status === "Verified").length}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">✅</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-warning-500 to-warning-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-warning-100 text-sm font-medium mb-1">
                Pending
              </p>
              <p className="text-3xl font-bold">
                {matchedPartners.filter((p) => p.status === "Pending").length}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">⏳</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-danger-500 to-danger-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-danger-100 text-sm font-medium mb-1">Denied</p>
              <p className="text-3xl font-bold">
                {matchedPartners.filter((p) => p.status === "Denied").length}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">❌</span>
            </div>
          </div>
        </div>
      </div>

      <SearchBar
        handleSearch={handleSearch}
        to="/partner-onboarding"
        btnTitle="Add New Partner"
      />
      {/* <Grid container spacing={0.5} sx={{ mb: 2, mt: 0.5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth>
            <InputLabel id="service-category-label">
              Service Category
            </InputLabel>
            <Select
              labelId="service-category-label"
              label="Service Category"
              defaultValue="Others"
              onChange={(e) => setQueryCategory(e.target.value)}
            >
              <MenuItem value="Official Work">Official Work</MenuItem>
              <MenuItem value="Legal Administrative">
                Legal Administrative
              </MenuItem>
              <MenuItem value="Logistics and Transportation">
                Logistics and Transportation
              </MenuItem>
              <MenuItem value="Order Local Sim">Order Local Sim</MenuItem>
              <MenuItem value="Home Services">Home Services</MenuItem>
              <MenuItem value="Order Pick Up">Order Pick Up</MenuItem>
              <MenuItem value="Others">Others</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By Partner's Name"
            type="search"
            placeholder="Partner's Name"
            fullWidth
            onChange={(e) => handleSearchByName(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By Service Area"
            type="search"
            placeholder="Type Location"
            fullWidth
            onChange={(e) => handleSearchByServiceArea(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <div className="flex items-center h-full justify-end">
            <Link
              to="/partner-onboarding"
              className="py-1 px-2 rounded bg-[var(--primary-bg)] text-white"
              target="_blank"
            >
              Add new Partner
            </Link>
          </div>
        </Grid>
      </Grid> */}

      {/* <p className="my-2 font-bold">
        {matchedPartners.length + " " + queryText} partners available at{" "}
        <span className="text-[var(--primary-bg)]"> {queryCategory} </span>
        category
      </p> */}
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
                            No {queryText} Partners Found
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
                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                      value === "Pending"
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
      >
        <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
          Name: {partnerDetails?.personalInformation?.fullName}
        </DialogTitle>
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: "absolute",
            right: 0,
            top: 0,
            color: "gray",
          }}
        >
          <CloseIcon />
        </IconButton>

        {/* modal body */}
        <DialogContent dividers sx={{ p: { xs: 2, md: 4 } }}>
          {/* {headingTextField("Personal Information")} */}
          <div className="flex sm:flex-row flex-col gap-2 justify-between my-4">
            <ServiceCategoryBtn value={partnerDetails.serviceCategory} />

            <img
              src={partnerDetails?.personalInformation?.photoURL}
              alt=""
              className="w-36 h-36 border-2 border-[var(--primary-bg)] rounded-lg"
            />
          </div>

          {/* Personal Information */}
          {/* <SubTitle text="Personal Information" /> */}
          {headingTextField("Personal Information")}

          {/* <Divider /> */}
          <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
            {textField("Name", partnerDetails?.personalInformation?.fullName)}
            {textField("Email", partnerDetails?.personalInformation?.email)}
            {textField(
              "Phone Number",
              partnerDetails?.personalInformation?.phoneNumber
            )}
            {textField("Address", partnerDetails?.personalInformation?.address)}
            {/* {textField("Name", partnerDetails?.personalInformation?.fullName)}
            {textField("Email", partnerDetails?.personalInformation?.email)}
            {textField(
              "Phone Number",
              partnerDetails?.personalInformation?.phoneNumber
            )}
            {textField("Address", partnerDetails?.personalInformation?.address)} */}
          </Grid>

          {/* Service Information */}
          {/* <SubTitle text="Service Information" /> */}
          {headingTextField("Service Information")}

          {/* <Divider /> */}
          <Grid container spacing={0.5} sx={{ mb: 2, mt: 0.5 }}>
            {textField(
              "Service Area",
              partnerDetails?.serviceInformation?.serviceArea
            )}

            {(partnerDetails.serviceCategory === "Legal Administrative" ||
              partnerDetails.serviceCategory === "Official Work") &&
              textField(
                "Education",
                partnerDetails?.serviceInformation?.educationalBackground
              )}

            {(partnerDetails.serviceCategory ===
              "Logistics and Transportation" ||
              partnerDetails.serviceCategory === "Order Pick Up") && (
              <>
                {textField(
                  "Number of Vehicles",
                  partnerDetails?.serviceInformation?.numberPlate
                )}

                <Grid item xs={12} sm={6}>
                  <h4 className="font-bold">Name of Vehicles: </h4>
                  <div className="flex flex-wrap gap-1">
                    {partnerDetails?.serviceInformation?.vechicleNames?.map(
                      (item) => (
                        <span
                          key={item}
                          className="bg-white py-1 px-2 rounded border border-[var(--primary-bg)]"
                        >
                          {item}
                        </span>
                      )
                    )}
                  </div>
                </Grid>
              </>
            )}
          </Grid>

          {/* Payment Information */}
          {/* <SubTitle text="Payment Information" /> */}
          {headingTextField("Payment Information")}

          <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
            {textField(
              "Bank Name",
              partnerDetails?.paymentInformation?.bankName
            )}
            {textField(
              "Account Number",
              partnerDetails?.paymentInformation?.accountNumber
            )}
            {textField(
              "Bank Location",
              partnerDetails?.paymentInformation?.bankAddress
            )}
          </Grid>

          {/* Permission */}
          {/* <SubTitle text="Permission" /> */}
          {headingTextField("Permission")}

          <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
            <Grid item xs={12} sm={6} md={6}>
              <span className="font-bold ">Current Status : </span>{" "}
              <span
                className={`${
                  (partnerDetails?.status === "Pending" &&
                    "bg-orange-300 text-black") ||
                  (partnerDetails?.status === "Verified" && "bg-green-500") ||
                  (partnerDetails?.status === "Denied" && "bg-red-600")
                } text-white  py-1 px-2 rounded`}
              >
                {partnerDetails?.status}
              </span>
            </Grid>
            <Grid item xs={12} sm={6} md={6}>
              <FormControl fullWidth>
                <InputLabel id="status-label ">Change Status</InputLabel>
                <Select
                  labelId="status-label"
                  label="Change Status"
                  defaultValue={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <MenuItem value="Pending">Pending</MenuItem>
                  <MenuItem value="Verified">Verified</MenuItem>
                  <MenuItem value="Denied">Denied</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            autoFocus
            sx={{
              bgcolor: "var(--button-bg-color)",
              color: "white",
              hover: "none",
            }}
            className="add-new-btn"
            onClick={() => handleChangeStatus(partnerDetails.uid)}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default LocalPartners;
