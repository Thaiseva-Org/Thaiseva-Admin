import AddTaskIcon from "@mui/icons-material/AddTask";
import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TablePagination,
  TextField,
} from "@mui/material";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import { v4 as uuid } from "uuid";
import LoadingContent from "../../../../../components/LoadingContent";
import PageHeading from "../../../../../components/PageHeading";
import SearchBar from "../../../../../components/SearchBar";
import ServiceCategoryBtn from "../../../../../components/ServiceCategoryBtn";
import ViewDetailsIcon from "../../../../../components/ViewDetailsIcon";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import {
  localServicesCollection,
  partnersCollection,
  requirementsCollection,
  serviceCategoriesDoc,
} from "../../../../../firebase/firebase.config";
import {
  fetchlocalServices,
  localServicesTotalPages,
} from "../../../../../services/LocalRelated";
import {
  formatPhoneNumber,
  successNotification,
} from "../../../../../utils/utils";

const LocalServices = () => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const [localServices, setLocalServices] = useState([]);
  const [queryCategory, setQueryCategory] = useState("All");
  const [matchedServices, setMatchedServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [error, setError] = useState("");
  const [openServiceDetailsModal, setOpenServiceDetailsModal] = useState(false);
  const [partnerDetails, setPartnerDetails] = useState({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);
  const [serviceName, setServiceName] = useState("");
  const [serviceCategories, setServiceCategories] = useState([]);
  const [openAddRequirementModal, setOpenAddRequirementModal] = useState(false); // Add requirement modal
  const [serviceDetails, setServiceDetails] = useState({
    serviceName: "",
    description: "",
    serviceCategory: "",
    serviceArea: "",
    phoneNumber: "",
  });

  // useEffect(() => {
  //   setMatchedServices(localServices);
  // }, [localServices]);

  // fetching all services
  // useEffect(() => {
  //   const loadRequirements = async () => {
  //     setLoadingServices(true);
  //     let unSub;
  //     if (queryCategory === "All") {
  //       let q = query(localServicesCollection, orderBy("timestamp", "desc"));
  //       unSub = onSnapshot(q, (result) => {
  //         const list = result.docs.map((doc) => doc.data());
  //         if (list?.length > 0) {
  //           setLocalServices(list);
  //           setLoadingServices(false);
  //         } else {
  //           setLocalServices([]);
  //           setLoadingServices(false);
  //         }
  //       });
  //     } else {
  //       let q = query(
  //         localServicesCollection,
  //         where("serviceCategory", "==", queryCategory),
  //         orderBy("timestamp", "desc")
  //       );
  //       unSub = onSnapshot(q, (result) => {
  //         const list = result.docs.map((doc) => doc.data());
  //         if (list?.length > 0) {
  //           setLocalServices(list);
  //           setLoadingServices(false);
  //         } else {
  //           setLocalServices([]);
  //           setLoadingServices(false);
  //         }
  //       });
  //     }

  //     return () => {
  //       unSub();
  //     };
  //   };

  //   (isAdmin || isSubAdmin) && loadRequirements();
  // }, [isAdmin, isSubAdmin, queryCategory]);

  useEffect(() => {
    if (isAdmin || isSubAdmin) {
      localServicesTotalPages(setTotalPages, queryCategory);
      fetchlocalServices(
        setLocalServices,
        setMatchedServices,
        setLoadingServices,
        queryCategory,
        lastDocs,
        setLastDocs,
        rowsPerPage,
        page
      );
    }
  }, [isAdmin, isSubAdmin, page, rowsPerPage, queryCategory]);

  const columns = [
    { id: "serviceName", label: "Service Name", width: "15%" },
    {
      id: "phoneNumber",
      label: "Phone Number",
      width: "15%",
    },
    {
      id: "serviceArea",
      label: "Service Area",
      width: "20%",
    },
    {
      id: "serviceProvider",
      label: "Service Provider",
      width: "15%",
    },
    {
      id: "serviceCategory",
      label: "Service Category",
      width: "20%",
    },
    {
      id: "action",
      label: "Action",
      width: "15%",
    },
  ];

  // creating single row
  function createData(
    serviceName,
    phoneNumber,
    serviceArea,
    serviceCategory,
    serviceProvider,
    providerUid,
    id
  ) {
    return {
      serviceName,
      phoneNumber,
      serviceArea,
      serviceCategory,
      serviceProvider,
      providerUid,
      id,
    };
  }

  // calling createData function with partner's data
  const rows = matchedServices?.map((service) => {
    return createData(
      service.serviceName,
      service.phoneNumber,
      service.serviceArea,
      service.serviceCategory,
      service.serviceProvider,
      service.providerUid,
      service.id
    );
  });

  /* =============================================================
              serach functionalities start
  =============================================================*/
  // const handleSearchByTitle = (text) => {
  //   const matchingObjects = localServices.filter((item) =>
  //     item.serviceName.toLowerCase().includes(text.toLowerCase())
  //   );
  //   setMatchedServices(matchingObjects);
  // };

  // const handleSearchByServiceArea = (text) => {
  //   const matchingObjects = localServices.filter((item) =>
  //     item.serviceArea.toLowerCase().includes(text.toLowerCase())
  //   );

  //   setMatchedServices(matchingObjects);
  // };

  // const handleSearchByName = (text) => {
  //   const matchingObjects = localServices.filter((item) =>
  //     item.serviceProvider.toLowerCase().includes(text.toLowerCase())
  //   );

  //   setMatchedServices(matchingObjects);
  // };

  const handleSearch = (text) => {
    const matchingObjects = localServices.filter(
      (item) =>
        item.serviceName.toLowerCase().includes(text.toLowerCase()) ||
        item.serviceProvider.toLowerCase().includes(text.toLowerCase()) ||
        item.serviceArea.toLowerCase().includes(text.toLowerCase())
    );

    setMatchedServices(matchingObjects);
  };
  /* =============================================================
              serach functionalities end
  =============================================================*/

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  /* =============================================================
              Add requirement functionalities start
  =============================================================*/
  // opening AddRequirementModal the modal while cliking on right sign icon
  const handleOpenAddRequirementModal = async (id, serviceName) => {
    setError("");
    const data = await getDoc(doc(partnersCollection, id));
    setPartnerDetails(data.data());
    setOpenAddRequirementModal(true);
    setServiceName(serviceName);
  };

  // storing the requrement in the database
  const handleAddRequirement = async (e) => {
    e.preventDefault();
    setError("");

    const requirementTitle = e.target.requirementTitle.value;
    const requirementText = e.target.requirementText.value;
    const locationName = e.target.locationName.value;
    const locationURL = e.target.locationURL.value;
    const clientName = e.target.clientName.value;
    const clientNumber = e.target.clientNumber.value;

    if (requirementTitle?.length < 5) {
      return setError("Invalid Requirement Title");
    } else if (requirementText?.length < 10) {
      return setError("Invalid Requirement Text");
    } else if (!clientName) {
      return setError("Client Name is required");
    } else if (!clientNumber) {
      return setError("Client Number is required");
    }

    // todo: add service area and location url
    const id = uuid();
    const date = new Date();

    const requirement = {
      id,
      date,
      providerUid: partnerDetails.uid,
      serviceCategory: partnerDetails.serviceCategory,
      serviceName,
      requirementTitle,
      requirementText,
      providerPhone: partnerDetails.personalInformation.phoneNumber,
      providerName: partnerDetails.personalInformation.fullName,
      isCompleted: false,
      isChecked: false,
      locationName,
      locationURL,
      clientName,
      clientNumber,
      comment: "",
    };

    await setDoc(doc(requirementsCollection, id), requirement).then(() => {
      setOpenAddRequirementModal(false);
      successNotification("Requirement is added successfully");
    });

    e.target.reset();
    setServiceName("");
  };
  /* =============================================================
              Add requirement functionalities end
  =============================================================*/

  // view service details modal
  const handleViewDetails = async (id) => {
    const res = await getDoc(doc(localServicesCollection, id));
    setServiceDetails(res.data());
    setOpenServiceDetailsModal(true);
  };

  useEffect(() => {
    const fetchServiceCategories = async () => {
      await getDoc(serviceCategoriesDoc).then((snapshot) => {
        const data = snapshot.data();
        setServiceCategories([
          "All",
          ...data.categories.map((cat) => cat.title),
          "Others",
        ]);
      });
    };
    fetchServiceCategories();
  }, []);

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

  // custom text field for common data
  const textField = (label, value, is12) => {
    return (
      <Grid item xs={12} sm={label === "Description" || is12 ? 12 : 6}>
        <div className="flex gap-2">
          <p>
            <span className="font-bold ">{label}: </span>
            <span className="text-slate-600">{value}</span>
          </p>
        </div>
      </Grid>
    );
  };

  return (
    <div className="animate-fade-in">
      <PageHeading
        text="Local Services"
        subtitle="Manage local service providers and offerings"
        icon="🏪"
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium mb-1">
                Total Services
              </p>
              <p className="text-3xl font-bold">{matchedServices.length}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">🏪</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-secondary-500 to-secondary-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary-100 text-sm font-medium mb-1">
                Service Providers
              </p>
              <p className="text-3xl font-bold">
                {new Set(matchedServices.map((s) => s.providerUid)).size}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">👥</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-success-500 to-success-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-success-100 text-sm font-medium mb-1">
                Categories
              </p>
              <p className="text-3xl font-bold">
                {new Set(matchedServices.map((s) => s.serviceCategory)).size}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">📂</span>
            </div>
          </div>
        </div>
      </div>

      <SearchBar handleSearch={handleSearch} btn={false} />

      {/* Category Filter */}
      <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-4 mb-6">
        <h3 className="text-sm font-semibold text-neutral-600 mb-3">
          Filter by Category
        </h3>
        <div className="flex gap-2 flex-wrap">
          {serviceCategories.map((serviceCategory, i) => (
            <button
              key={i}
              onClick={() => {
                setQueryCategory(serviceCategory), setPage(0);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${queryCategory === serviceCategory
                  ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md scale-105"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
            >
              {serviceCategory}
            </button>
          ))}
        </div>
      </div>
      {/* <Grid container spacing={0.5} sx={{ mb: 2, mt: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By Title"
            type="search"
            InputLabelProps={{ shrink: true }}
            placeholder="Requirement's Title"
            fullWidth
            onChange={(e) => handleSearchByTitle(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By Service Area"
            type="search"
            InputLabelProps={{ shrink: true }}
            placeholder="Type Location"
            fullWidth
            onChange={(e) => handleSearchByServiceArea(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By Provider's Name"
            type="search"
            placeholder="Provider's Name"
            fullWidth
            onChange={(e) => handleSearchByName(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By Requirement Id"
            type="search"
            placeholder="Type Requirement Id"
            fullWidth
            onChange={(e) => handleSearchByServiceArea(e.target.value)}
          />
        </Grid>
      </Grid> */}

      {/* Services Table */}
      <div className="bg-white rounded-xl shadow-md border border-neutral-200 overflow-hidden">
        {loadingServices ? (
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
                  {localServices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <span className="text-6xl opacity-50">🏪</span>
                          <p className="text-neutral-500 font-medium">
                            No Services Found
                          </p>
                          <p className="text-neutral-400 text-sm">
                            Local services will appear here once providers
                            register
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows?.map((row, i) => {
                      return (
                        <tr
                          key={i}
                          className="hover:bg-primary-50 transition-colors duration-150"
                        >
                          {columns.map((column) => {
                            let value = row[column.id];
                            return (
                              <td
                                key={column.id}
                                className="px-4 py-4 text-center text-sm"
                              >
                                {column.id === "action" ? (
                                  <div className="flex gap-2 items-center justify-center">
                                    <div
                                      onClick={() => handleViewDetails(row.id)}
                                    >
                                      <ViewDetailsIcon title="View service details" />
                                    </div>
                                    <button
                                      onClick={() =>
                                        handleOpenAddRequirementModal(
                                          row.providerUid,
                                          row.serviceName
                                        )
                                      }
                                      className="p-2 rounded-full bg-gradient-to-r from-secondary-500 to-secondary-600 text-white hover:scale-110 transition-all duration-200 shadow-md"
                                      title="Add Requirement"
                                    >
                                      <AddTaskIcon className="scale-90" />
                                    </button>
                                  </div>
                                ) : column.id === "serviceCategory" ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700">
                                    {value}
                                  </span>
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

      {/* View service details modal */}
      <Dialog
        open={openServiceDetailsModal}
        onClose={() => setOpenServiceDetailsModal(false)}
        aria-labelledby="responsive-dialog-title"
      >
        <Box>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            {serviceDetails?.serviceName}
          </DialogTitle>
          <IconButton
            aria-label="close"
            onClick={() => setOpenServiceDetailsModal(false)}
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
          <DialogContent dividers sx={{ p: { xs: 2, md: 2 } }}>
            <ServiceCategoryBtn value={serviceDetails?.serviceCategory} />

            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              {/* Service Provider Name */}
              {textField("Provider Name", serviceDetails?.serviceProvider)}

              {/* Service Area */}
              {textField("Service Area", serviceDetails?.serviceArea)}

              {/* Phone Number */}
              {textField("Phone Number", serviceDetails?.phoneNumber)}

              {/* Description */}
              {textField("Description", serviceDetails?.description, true)}

              {/* Vehicle Registration Number */}
              {partnerDetails.serviceCategory ===
                "Logistics and Transportation" && (
                  <>
                    {textField(
                      "Vehicle Registration Number",
                      "vehicleNumber",
                      "Number plate",
                      serviceDetails?.serviceArea
                    )}

                    {/* Vehicle Type */}
                    {textField(
                      "Vehicle Type",
                      "vehicleType",
                      "Truck or Ven",
                      serviceDetails?.serviceArea
                    )}
                  </>
                )}
            </Grid>
            {/* {error && <p className="text-red-500 text-center">{error}</p>} */}
          </DialogContent>
          <DialogActions>
            <button
              // variant="contained"
              type="submit"
              autoFocus
              className="add-new-btn"
              // sx={{
              //   bgcolor: "var(--primary-bg)",
              //   color: "white",
              //   hover: "none",
              // }}
              onClick={() => setOpenServiceDetailsModal(false)}
            >
              Close
            </button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Add requirement modal */}
      <Dialog
        open={openAddRequirementModal}
        onClose={() => setOpenAddRequirementModal(false)}
        aria-labelledby="responsive-dialog-title"
      >
        <Box component="form" onSubmit={handleAddRequirement}>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            Add Requirement
          </DialogTitle>
          <IconButton
            aria-label="close"
            onClick={() => setOpenAddRequirementModal(false)}
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
          <DialogContent dividers sx={{ p: { xs: 2, md: 2 } }}>
            <ServiceCategoryBtn value={partnerDetails?.serviceCategory} />

            <p className="mt-2">
              You are giving the task to{" "}
              {partnerDetails?.personalInformation?.fullName}.
            </p>

            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              {/* Requirement Title */}
              <Grid item xs={12}>
                <TextField
                  label="Requirement Title "
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  name="requirementTitle"
                  InputLabelProps={{ shrink: true }}
                  placeholder="Give a relevant name for the Requirement."
                  fullWidth
                />
                {error.includes("Title") && (
                  <span className="text-red-500 text-sm">{error}</span>
                )}
              </Grid>

              {/* location */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Client location name"
                  type="text"
                  name="locationName"
                  autoComplete="off"
                  autoCorrect="off"
                  InputLabelProps={{ shrink: true }}
                  placeholder="Type client location name"
                  fullWidth
                />
              </Grid>

              {/* location url */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Client location URL"
                  type="text"
                  name="locationURL"
                  autoComplete="off"
                  autoCorrect="off"
                  InputLabelProps={{ shrink: true }}
                  placeholder="Give Client location URL"
                  fullWidth
                />
              </Grid>

              {/* Client's Name */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Client's Name"
                  type="text"
                  name="clientName"
                  autoComplete="off"
                  autoCorrect="off"
                  InputLabelProps={{ shrink: true }}
                  placeholder="Client's Name"
                  fullWidth
                />
                {error.includes("Client Name") && (
                  <span className="text-red-500 text-sm">{error}</span>
                )}
              </Grid>

              {/* Client's Number */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Client's Number"
                  type="tel"
                  name="clientNumber"
                  autoComplete="off"
                  autoCorrect="off"
                  InputLabelProps={{ shrink: true }}
                  placeholder="Phone Number"
                  onChange={(e) => {
                    const formatted = formatPhoneNumber(e.target.value);
                    e.target.value = formatted;
                  }}
                  fullWidth
                />
                {error.includes("Client Number") && (
                  <span className="text-red-500 text-sm">{error}</span>
                )}
              </Grid>

              {/* Requirement Description */}
              <Grid item xs={12}>
                <TextField
                  label="Requirement Description"
                  type="text"
                  name="requirementText"
                  InputLabelProps={{ shrink: true }}
                  placeholder="Type the requirement in detail."
                  multiline
                  rows={3}
                  fullWidth
                />
                {error.includes("Text") && (
                  <span className="text-red-500 text-sm">{error}</span>
                )}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <button type="submit" autoFocus className="add-new-btn">
              Send
            </button>
          </DialogActions>
        </Box>
      </Dialog>
    </div>
  );
};

export default LocalServices;
