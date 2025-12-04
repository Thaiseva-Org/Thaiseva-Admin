import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
} from "@mui/material";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { v4 as uuid } from "uuid";
import DeleteButton from "../../../../components/DeleteButton";
import LoadingContent from "../../../../components/LoadingContent";
import PageHeading from "../../../../components/PageHeading";
import ServiceCategoryBtn from "../../../../components/ServiceCategoryBtn";
import UpdateButton from "../../../../components/UpdateButton";
import { AuthContext } from "../../../../contextAPIs/AuthProvider";
import { PartnerContext } from "../../../../contextAPIs/PartnerProvider";
import { localServicesCollection } from "../../../../firebase/firebase.config";
import {
  fetchPartnerlocalServices,
  localPartnerServicesTotalPages,
} from "../../../../services/LocalRelated";
import {
  askingForDelete,
  deleteNotification,
  formatPhoneNumber,
  successNotification,
} from "../../../../utils/utils";

const MyServices = () => {
  const [services, setServices] = useState([]);
  const [addServiceModal, setAddServiceModal] = useState(false); //Add service modal
  const [refetchServices, setRefetchServices] = useState(false);
  const { user, isVerifiedPartner } = useContext(AuthContext);
  const [loadingServices, setLoadingServices] = useState(false);
  const { partnerDetails } = useContext(PartnerContext);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);
  const [error, setError] = useState(" ");
  const [serviceDetails, setServiceDetails] = useState({
    id: "",
    serviceName: "",
    description: "",
    serviceCategory: "",
    serviceArea: "",
    phoneNumber: "",
  });

  const {
    handleSubmit,
    reset,
    register,
    control,
    formState: { errors },
  } = useForm();

  // useEffect(() => {
  //   const loadData = async (user, localServicesCollection) => {
  //     const docSnapshot = await getDocs(
  //       query(
  //         localServicesCollection,
  //         where("providerUid", "==", user.uid),
  //         orderBy("timestamp", "desc")
  //       )
  //     );

  //     if (docSnapshot.docs.length > 0) {
  //       const list = docSnapshot.docs.map((doc) => doc.data());
  //       setServices(list);
  //     }
  //     if (docSnapshot.docs.length == 0) {
  //       setServices([]);
  //     }
  //   };
  //   user && !loadingUserData && loadData(user, localServicesCollection);
  // }, [user, loadingUserData, refetchServices]);

  useEffect(() => {
    if (isVerifiedPartner && user) {
      localPartnerServicesTotalPages(setTotalPages, user.uid);
      fetchPartnerlocalServices(
        setServices,
        setLoadingServices,
        user.uid,
        lastDocs,
        setLastDocs,
        rowsPerPage,
        page
      );
    }
  }, [user, isVerifiedPartner, page, rowsPerPage, refetchServices]);

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(event.target.value);
    setPage(0);
  };

  // Partners table header
  let columns = [
    { id: "name", label: "Name", width: 70 },
    { id: "phone", label: "Contact", width: 70 },
    {
      id: "serviceArea",
      label: "Service Area",
      width: 130,
    },
    {
      id: "action",
      label: "Action",
      width: 120,
    },
  ];

  // if (userData.serviceCategory === "Logistics and Transportation") {
  //   columns.push({ id: "vehicleNumber", label: "Vehicle Number", width: 80 });
  // }
  // columns.push({
  //   id: "action",
  //   label: "Action",
  //   width: 120,
  // });

  // creating single row
  function createData(
    name,
    serviceArea,
    phone,
    providerUid,
    id,
    vehicleNumber
  ) {
    return { name, serviceArea, phone, providerUid, id, vehicleNumber };
  }

  // calling createData function with partner's data
  const rows = services?.map((service) => {
    return createData(
      service.serviceName,
      service.serviceArea,
      service.phoneNumber,
      service.providerUid,
      service.id,
      service.vehicleNumber
    );
  });

  const handleOpenAddServiceModal = () => {
    reset();
    setServiceDetails({
      serviceName: "",
      serviceCategory: "",
      serviceArea: "",
      phoneNumber: "",
    });
    setAddServiceModal(true);
  };

  const handleCloseAddServiceModal = () => {
    setAddServiceModal(false);
  };

  // adding new service
  const handleAddService = async (data) => {
    setError("");
    const {
      serviceName,
      serviceArea,
      description,
      // vehicleNumber,
      // vehicleType,
      phoneNumber,
    } = data;

    if (phoneNumber?.length > 11 || phoneNumber?.length < 8) {
      return setError("Invalid phone number");
    }

    let id = "";
    if (serviceDetails?.id) {
      id = serviceDetails?.id;
    } else {
      id = uuid();
    }

    let timestamp = "";
    if (serviceDetails?.timestamp) {
      timestamp = serviceDetails?.timestamp;
    } else {
      timestamp = serverTimestamp();
    }
    // console.log(partnerDetails);

    let service = {
      serviceName,
      serviceArea,
      description,
      serviceCategory: partnerDetails.serviceCategory,
      serviceProvider: partnerDetails.personalInformation.fullName,
      providerUid: user.uid,
      phoneNumber,
      id,
      timestamp,
    };

    // if (userData.serviceCategory === "Logistics and Transportation") {
    //   service.vehicleNumber = vehicleNumber;
    //   service.vehicleType = vehicleType;
    // }

    await setDoc(doc(localServicesCollection, id), service).then(() => {
      successNotification(
        `The service is ${
          serviceDetails?.serviceName ? "updated" : "added"
        } successfully`
      );
      setRefetchServices((p) => !p);
      setAddServiceModal(false);
    });
  };

  // deleting service
  const handleDelete = async (id) => {
    askingForDelete().then(async (result) => {
      if (result.isConfirmed) {
        await deleteDoc(doc(localServicesCollection, id)).then(() => {
          setRefetchServices((p) => !p);
          deleteNotification("The service is deleted successfully.");
        });
      }
    });
  };

  const handleUpdateServiceModal = async (id) => {
    reset();
    setServiceDetails({
      serviceName: "",
      serviceCategory: "",
      serviceArea: "",
      phoneNumber: "",
    });
    const res = await getDoc(doc(localServicesCollection, id));
    const singleService = res.data();
    setServiceDetails(singleService);
    setAddServiceModal(true);
  };

  // custom text field for common data
  const textField = (label, name, placeholder, defaultValue) => {
    return (
      <Grid item xs={12} sm={name === "description" ? 12 : 6}>
        <TextField
          label={label}
          type={name === "phoneNumber" ? "number" : "text"}
          placeholder={placeholder}
          defaultValue={defaultValue && defaultValue}
          multiline={name === "description"}
          fullWidth
          {...register(name, { required: true })}
          rows={name === "description" ? 3 : ""}
        />
        {errors?.name && (
          <span className="text-red-500">{label} is required</span>
        )}
      </Grid>
    );
  };

  return (
    <div>
      <PageHeading text={"My services"} />

      <div className="flex items-center justify-between  md:pr-3 mb-2">
        <p className="my-2 font-bold"></p>
        <button
          onClick={handleOpenAddServiceModal}
          className="text-white add-new-btn"
        >
          Add Service
        </button>
      </div>
      <Paper sx={{ width: "100%", overflowX: "hidden" }}>
        <TableContainer sx={{ maxHeight: 440, maxWidth: "87vw" }}>
          {loadingServices ? (
            <LoadingContent />
          ) : (
            <Table stickyHeader aria-label="sticky table">
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      align="center"
                      style={{
                        width: column.width,
                        color: "var(--primary-bg)",
                        fontWeight: "bold",
                      }}
                    >
                      {column.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, i) => {
                  return (
                    <TableRow hover role="checkbox" tabIndex={-1} key={i}>
                      {columns.map((column) => {
                        const value = row[column.id];
                        return (
                          <TableCell key={column.id} align="center">
                            {(column.id === "action" && (
                              <div className="flex items-center justify-center gap-1">
                                <div onClick={() => handleDelete(row.id)}>
                                  <DeleteButton title="Delete the service" />
                                </div>
                                <div
                                  onClick={() =>
                                    handleUpdateServiceModal(row.id)
                                  }
                                >
                                  <UpdateButton title="Update the service" />
                                </div>
                              </div>
                            )) ||
                              value}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
                {services.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <div className="w-full text-center my-5 light-text">
                        No Services Present
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 100]}
          component="div"
          count={totalPages}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Add service modal */}
      <Dialog
        open={addServiceModal}
        onClose={handleCloseAddServiceModal}
        aria-labelledby="responsive-dialog-title"
      >
        <Box component="form" onSubmit={handleSubmit(handleAddService)}>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            {serviceDetails?.serviceName
              ? "Update the service"
              : "Add New Service"}
          </DialogTitle>
          <IconButton
            aria-label="close"
            onClick={handleCloseAddServiceModal}
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

            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              {/* Service Name */}
              {textField(
                "Service Name",
                "serviceName",
                "",
                serviceDetails?.serviceName
              )}

              {/* Service Area */}
              {textField(
                "Service Area",
                "serviceArea",
                "Your Available Range",
                serviceDetails?.serviceArea
              )}

              <Grid item xs={12} sm={6}>
                <Controller
                  name="phoneNumber"
                  control={control}
                  defaultValue={serviceDetails?.phoneNumber || ""}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Phone Number"
                      type="tel"
                      placeholder="Phone Number"
                      value={field.value}
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value);
                        field.onChange(formatted);
                      }}
                      fullWidth
                    />
                  )}
                />
              </Grid>

              {/* Description */}
              {textField(
                "Description",
                "description",
                "Type the task description here...",
                serviceDetails?.description
              )}

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
            {error && <p className="text-red-500 text-center">{error}</p>}
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              type="submit"
              autoFocus
              sx={{
                bgcolor: "var(--button-bg-color)",
                color: "white",
                hover: "none",
              }}
              className="add-new-btn"
            >
              {serviceDetails?.serviceName ? "Update" : "Add"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </div>
  );
};

export default MyServices;
