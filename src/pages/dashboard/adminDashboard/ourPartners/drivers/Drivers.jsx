import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

import { useContext, useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { CloseIcon } from "@icons";
import {
  driversCollection,
  travelRequirementsCollection,
  usersCollection,
} from "../../../../../firebase/firebase.config";
import Loading from "../../../../../components/Loading";
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";
import SubTitle from "../../../../../components/SubTitle";
import ViewDetailsIcon from "../../../../../components/ViewDetailsIcon";
import PageHeading from "../../../../../components/PageHeading";
import CountryPhoneInput from "../../../../../components/CountryPhoneInput";
import DeleteButton from "../../../../../components/DeleteButton";
import ServiceCategoryBtn from "../../../../../components/ServiceCategoryBtn";
import { successNotification } from "../../../../../utils/utils";
import { AddTaskIcon } from "@icons";
import { PersonIcon } from "@icons";
import { v4 as uuid } from "uuid";
import { Link } from "react-router-dom";
import SearchBar from "../../../../../components/SearchBar";
import PrivateIdentityDocument from "../../../../../components/PrivateIdentityDocument";

const Drivers = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [viewDetailsModal, setViewDetailsModal] = useState(false); //Add service modal
  const [driverDetails, setDriverDetails] = useState({});
  const [status, setStatus] = useState("Pending");
  const [error, setError] = useState({ for: "", text: "" });
  const { drivers, setRefetch, queryText, loadingPartnerData } =
    useContext(PartnerContext);
  const [openAddRequirementModal, setOpenAddRequirementModal] = useState(false);
  const [matchedDrivers, setMatchedDrivers] = useState([]);

  useEffect(() => {
    setMatchedDrivers(drivers);
  }, [drivers]);

  // Partners table header
  const columns = [
    { id: "name", label: "Name", width: 120 },
    {
      id: "phoneNumber",
      label: "Phone\u00a0Number",
      width: 130,
    },
    {
      id: "serviceArea",
      label: "Service\u00a0Area",
      width: 80,
    },
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
  function createData(
    name,
    phoneNumber,
    serviceArea,
    status,
    id,
    serviceCategory
  ) {
    return { name, phoneNumber, serviceArea, status, id, serviceCategory };
  }

  // calling createData function with partner's data
  const rows = matchedDrivers.map((driver) => {
    return createData(
      driver.driverInformation?.fullName,
      driver.driverInformation?.phoneNumber,
      driver.serviceArea,
      driver.status,
      driver.uid,
      driver.serviceCategory
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
    const query = doc(driversCollection, id);
    const data = await getDoc(query);

    setDriverDetails({...data.data(), id: data.id});
  };

  // change driver account status
  const handleChangeStatus = async (id) => {
    handleClose();

    const updatedStatus = { status: status };

    await updateDoc(doc(driversCollection, id), updatedStatus);
    await updateDoc(doc(usersCollection, id), updatedStatus);
    setRefetch((p) => !p);

    setDriverDetails({});

    setStatus("Pending");
  };

  // delete driver
  const handleDelete = async (id) => {
    await deleteDoc(doc(driversCollection, id)); // deleting partner data from partners collection
    await deleteDoc(doc(usersCollection, id)); // deleting partner data from user's collection
    // await deleteUserFromAuth({ uid: id }).then(() => console.log("deleted")); // deleting user account form authentication

    setRefetch((p) => !p);
  };

  /* =============================================================
              serach functionalities start
  =============================================================*/
  // const handleSearchByName = (text) => {
  //   const matchingObjects = drivers.filter((item) =>
  //     item.driverInformation.fullName.toLowerCase().includes(text.toLowerCase())
  //   );

  //   setMatchedDrivers(matchingObjects);
  // };

  // const handleSearchByServiceArea = (text) => {
  //   const matchingObjects = drivers.filter((item) =>
  //     item.serviceArea.toLowerCase().includes(text.toLowerCase())
  //   );

  //   setMatchedDrivers(matchingObjects);
  // };

  const handleSearch = (text) => {
    const matchingObjects = drivers.filter(
      (item) =>
        item.driverInformation.fullName
          .toLowerCase()
          .includes(text.toLowerCase()) ||
        item.serviceArea
          .toLowerCase()
          .includes(text.toLowerCase())
    );

    setMatchedDrivers(matchingObjects);
  };

  /* =============================================================
              serach functionalities end
  =============================================================*/

  const handleOpenAddRequirementModal = async (id) => {
    setError({ for: "", text: "" });
    const data = await getDoc(doc(driversCollection, id));
    setDriverDetails(data.data());
    setOpenAddRequirementModal(true);
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
      return setError({ for: "title", text: "Invalid Requirement Title" });
    } else if (requirementText?.length < 10) {
      return setError({ for: "description", text: "Invalid Requirement Text" });
    } else if (!clientName) {
      return setError({ for: "clientName", text: "Client Name is required" });
    } else if (!clientNumber) {
      return setError({ for: "number", text: "Client Number is required" });
    }

    // todo: add service area and location url
    const id = uuid();
    const date = new Date();

    const requirement = {
      id,
      date,
      providerUid: driverDetails.uid,
      serviceCategory: driverDetails.serviceCategory,
      requirementTitle,
      requirementText,
      providerPhone: driverDetails.driverInformation.phoneNumber,
      providerName: driverDetails.driverInformation.fullName,
      isCompleted: false,
      isChecked: false,
      locationName,
      locationURL,
      clientName,
      clientNumber,
      comment: "",
    };

    await setDoc(doc(travelRequirementsCollection, id), requirement).then(
      () => {
        setOpenAddRequirementModal(false);
        successNotification("Requirement is added successfully");
      }
    );

    e.target.reset();
  };

  const loadingContent = (
    <div className="md:h-[40vh] w-full flex items-center justify-center">
      <Loading />
    </div>
  );

  return (
    <div className="overflow-x-hidden">
      <PageHeading text="Drivers" />
      <SearchBar
        handleSearch={handleSearch}
        to="/driver-onboarding"
        btnTitle="Add New Driver"
      />
      {/* <Grid container spacing={0.5} sx={{ mb: 2, mt: 0.5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By Partner's Name"
            type="search"
            placeholder="Partner's Name"
            fullWidth
            defaultValue=""
            onChange={(e) => handleSearchByName(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {" "}
          <TextField
            label="Search By Service Area"
            type="search"
            placeholder="Type Location"
            fullWidth
            defaultValue=""
            onChange={(e) => handleSearchByServiceArea(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <div className="flex h-full items-center justify-end">
            <Link
              to="/driver-onboarding"
              className="py-1 px-2 rounded bg-[var(--primary-bg)] text-white"
              target="_blank"
            >
              Add new Partner
            </Link>
          </div>
        </Grid>
      </Grid> */}

      {/* <p className="my-2 font-bold">
        {matchedDrivers.length + " " + queryText} drivers available.
      </p> */}
      <Paper sx={{ width: "100%", overflowX: "hidden" }}>
        <TableContainer sx={{ maxHeight: 440, maxWidth: "87vw" }}>
          {loadingPartnerData ? (
            loadingContent
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
                {rows
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row, i) => {
                    return (
                      <TableRow hover role="checkbox" tabIndex={-1} key={i}>
                        {columns.map((column) => {
                          const value = row[column.id];
                          return (
                            <TableCell key={column.id} align="center">
                              {((value === "Pending" ||
                                value === "Verified" ||
                                value === "Denied") && (
                                  <span
                                    className={`${(value === "Pending" &&
                                        "bg-orange-300 text-black") ||
                                      (value === "Verified" && "bg-green-500") ||
                                      (value === "Denied" && "bg-red-600")
                                      } text-white  py-1 px-2 rounded`}
                                  >
                                    {value}
                                  </span>
                                )) ||
                                (column.id === "action" && (
                                  <div className="flex items-center justify-center gap-1">
                                    <div
                                      onClick={() => handleViewDetails(row.id)}
                                    >
                                      <ViewDetailsIcon title="View Details" />
                                    </div>
                                    {queryText === "Verified" && (
                                      <button
                                        onClick={() =>
                                          handleOpenAddRequirementModal(row.id)
                                        }
                                        className="bg-orange-400 text-white p-1 rounded-full ml-2"
                                      >
                                        <AddTaskIcon />
                                      </button>
                                    )}
                                    {queryText === "Denied" && (
                                      <button
                                        onClick={() => handleDelete(row.id)}
                                        className="ml-2"
                                      >
                                        <DeleteButton />
                                      </button>
                                    )}

                                    <Link
                                      to={`/dashboard/profile/${row.serviceCategory}/${row.id}`}
                                    >
                                      <button className="bg-slate-300 p-1 rounded-full ml-2">
                                        <PersonIcon />
                                      </button>
                                    </Link>
                                  </div>
                                )) ||
                                value}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 100]}
          component="div"
          count={rows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* modal  */}

      <Dialog
        open={viewDetailsModal}
        onClose={handleClose}
        aria-labelledby="responsive-dialog-title"
      >
        <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
          Name: {driverDetails?.driverInformation?.fullName}
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
          <div className="flex justify-between">
            <Typography variant="div">
              <span className="font-bold">Category : </span>{" "}
              <span className="bg-[var(--primary-bg)] text-white font-bold py-1 px-2 rounded inline-block">
                {driverDetails?.serviceCategory}
              </span>
            </Typography>

            <img
              src={driverDetails?.driverInformation?.photoURL}
              alt=""
              className="w-32 h-32 border-2 border-[var(--primary-bg)]"
            />
          </div>

          {/* Driver Information */}
          <SubTitle text=" Driver Information" />

          <Divider />
          <Grid container spacing={0.5} sx={{ mb: 2, mt: 0.5 }}>
            <Grid item xs={12} sm={6} md={6}>
              <span className="font-bold">Email: </span>
              {driverDetails?.driverInformation?.email}
            </Grid>
            <Grid item xs={12} sm={6} md={6}>
              <span className="font-bold">Phone Number: </span>{" "}
              {driverDetails?.driverInformation?.phoneNumber}
            </Grid>
            <Grid item xs={12} sm={6} md={6}>
              <span className="font-bold">Address: </span>
              {driverDetails?.driverInformation?.address}
            </Grid>
          </Grid>

          {/* Service Information */}
          <SubTitle text="Service Information" />

          <Divider />
          <Grid container spacing={0.5} sx={{ mb: 2, mt: 0.5 }}>
            <Grid item xs={12} sm={6} md={6}>
              <span className="font-bold">Service Area :</span>{" "}
              {driverDetails?.serviceArea}
            </Grid>

            <Grid item xs={12} sm={6} md={6}>
              <span className="font-bold">Vehicle Type : </span>
              {driverDetails?.vehicleInformation?.vehicleType}
            </Grid>
            <Grid item xs={12} sm={6} md={6}>
              <span className="font-bold">Number Plate : </span>
              {driverDetails?.vehicleInformation?.numberPlate}
            </Grid>
          </Grid>

          {/* Payment Information */}
          <SubTitle text="Payment Information" />

          <Grid container spacing={0.5} sx={{ mb: 2, mt: 0.5 }}>
            <Grid item xs={12} sm={6} md={6}>
              <span className="font-bold"> Bank Name : </span>
              {driverDetails?.paymentInformation?.bankName}
            </Grid>
            <Grid item xs={12} sm={6} md={6}>
              <span className="font-bold"> Account Number : </span>
              {driverDetails?.paymentInformation?.accountNumber}
            </Grid>
            <Grid item xs={12} sm={6} md={6}>
              <span className="font-bold"> Bank Location: </span>
              {driverDetails?.paymentInformation?.bankAddress}
            </Grid>
          </Grid>
          <div>
            <span className="font-bold"> Driving License: </span>
            <PrivateIdentityDocument driverId={driverDetails.id} label="Driving licence" />
          </div>

          {/* Permission */}
          <SubTitle text="Permission" />

          <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
            <Grid item xs={12} sm={6} md={6}>
              <span className="font-bold ">Current Status : </span>{" "}
              <span
                className={`${(driverDetails?.status === "Pending" &&
                    "bg-orange-300 text-black") ||
                  (driverDetails?.status === "Verified" && "bg-green-500") ||
                  (driverDetails?.status === "Denied" && "bg-red-600")
                  } text-white  py-1 px-2 rounded`}
              >
                {driverDetails?.status}
              </span>
            </Grid>
            <Grid item xs={12} sm={6} md={6}>
              <FormControl fullWidth>
                <InputLabel id="status-label ">Change Status</InputLabel>
                <Select
                  labelId="status-label"
                  label="Change Status"
                  defaultValue="Pending"
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
            sx={{ bgcolor: "var(--primary-bg)", color: "white", hover: "none" }}
            onClick={() => handleChangeStatus(driverDetails.uid)}
          >
            Save
          </Button>
        </DialogActions>
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
            <ServiceCategoryBtn value={driverDetails?.serviceCategory} />

            <p>
              You are giving the task to{" "}
              {driverDetails?.driverInformation?.fullName}.
            </p>

            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              {/* Requirement Title */}
              <Grid item xs={12}>
                <TextField
                  label="Requirement Title "
                  type="text"
                  name="requirementTitle"
                  InputLabelProps={{ shrink: true }}
                  placeholder="Give a relevant name for the Requirement."
                  fullWidth
                />
                {error.for === "title" && (
                  <span className="text-red-500 text-sm">{error.text}</span>
                )}
              </Grid>

              {/* location */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Client location name"
                  type="text"
                  name="locationName"
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
                  InputLabelProps={{ shrink: true }}
                  placeholder="Client's Name"
                  fullWidth
                />
                {error.for === "clientName" && (
                  <span className="text-red-500 text-sm">{error.text}</span>
                )}
              </Grid>

              {/* Client's Number */}
              <Grid item xs={12} sm={6}>
                <CountryPhoneInput
                  label="Client's Number"
                  name="clientNumber"
                  placeholder="Phone Number"
                />
                {error.for === "number" && (
                  <span className="text-red-500 text-sm">{error.text}</span>
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
                {error.for === "description" && (
                  <span className="text-red-500 text-sm">{error.text}</span>
                )}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              type="submit"
              autoFocus
              sx={{
                bgcolor: "var(--primary-bg)",
                color: "white",
                hover: "none",
              }}
            >
              Send
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </div>
  );
};

export default Drivers;
