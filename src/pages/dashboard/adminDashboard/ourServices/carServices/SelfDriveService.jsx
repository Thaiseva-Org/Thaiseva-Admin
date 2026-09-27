import { useContext, useEffect } from "react";
import { useState } from "react";
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
  TableRow,
  TextField,
} from "@mui/material";
import { CloseIcon } from "@icons";
import { useForm } from "react-hook-form";
import { v4 as uuid } from "uuid";
import { deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { carDetailsCollection } from "../../../../../firebase/firebase.config";
import {
  askingForDelete,
  deleteNotification,
  getFileUrl,
  successNotification,
} from "../../../../../utils/utils";
import Loading from "../../../../../components/Loading";
import PageHeading from "../../../../../components/PageHeading";
import DeleteButton from "../../../../../components/DeleteButton";
import UpdateButton from "../../../../../components/UpdateButton";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";

const SelfDriveServices = () => {
  const [services, setServices] = useState([]);
  const [addServiceModal, setAddServiceModal] = useState(false); //Add service modal
  const [refetchServices, setRefetchServices] = useState(false);
  const { loadingUserData, user } = useContext(AuthContext);
  const [error, setError] = useState(" ");
  const [serviceDetails, setServiceDetails] = useState({
    id: "",
    title: "",
    description: "",
    from: "",
    to: "",
    noOfPassengers: 0,
    price: 0,
    coverPhoto: "",
  });

  const {
    handleSubmit,
    reset,
    register,
    formState: { errors },
  } = useForm();

  useEffect(() => {
    const loadData = async (user, carDetailsCollection) => {
      const q = query(carDetailsCollection, where("carType", "==", "Car"));
      const docSnapshot = await getDocs(q);

      if (docSnapshot.docs.length > 0) {
        const list = docSnapshot.docs.map((doc) => doc.data());
        setServices(list);
      }
      if (docSnapshot.docs.length == 0) {
        setServices([]);
      }
    };
    user && !loadingUserData && loadData(user, carDetailsCollection);
  }, [user, loadingUserData, refetchServices]);

  // Partners table header
  let columns = [
    { id: "title", label: "Title", width: 70 },
    { id: "price", label: "Price", width: 70 },
    { id: "from", label: "From", width: 50 },
    { id: "to", label: "To", width: 50 },
    { id: "action", label: "Action", width: 60 },
  ];

  // creating single row
  function createData(title, price, from, to, id) {
    return { title, price, from, to, id };
  }

  // calling createData function with partner's data
  const rows = services?.map((service) => {
    return createData(
      service.title,
      service.price,
      service.from,
      service.to,
      service.id
    );
  });

  const handleOpenAddServiceModal = () => {
    reset();
    setServiceDetails({
      id: "",
      title: "",
      description: "",
      from: "",
      to: "",
      noOfPassengers: 0,
      price: 0,
      coverPhoto: "",
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
      title,
      description,
      price,
      noOfPassengers,
      from,
      to,
      carType,
      locality,
    } = data;

    let id = "";
    if (serviceDetails?.id) {
      id = serviceDetails?.id;
    } else {
      id = uuid();
    }

    let service = {
      id,
      title,
      description,
      price: parseInt(price),
      noOfPassengers: parseInt(noOfPassengers),
      from,
      to,
      coverPhoto: serviceDetails.coverPhoto,
      carType,
      locality,
      location: locality,
      date: new Date(),
      noOfRatings: 0,
      ratings: "0.0",
      searchQuery: "_" + carType.toLowerCase(),
    };

    await setDoc(doc(carDetailsCollection, id), service).then(() => {
      successNotification(
        `The service is ${
          serviceDetails?.title ? "updated" : "added"
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
        await deleteDoc(doc(carDetailsCollection, id)).then(() => {
          setRefetchServices((p) => !p);
          deleteNotification("The service is deleted successfully.");
        });
      }
    });
  };

  const handleUpdateServiceModal = async (id) => {
    console.log(id);
    reset();
    setServiceDetails({
      id: "",
      title: "",
      description: "",
      from: "",
      to: "",
      noOfPassengers: 0,
      price: 0,
      coverPhoto: "",
    });
    const res = await getDoc(doc(carDetailsCollection, id));
    const singleService = res.data();
    setServiceDetails(singleService);
    setAddServiceModal(true);
  };

  const handleUploadCoverPhoto = async (e) => {
    const { files } = e.target;
    setError({ for: "", text: "" });
    const result = await getFileUrl(files);
    if (result?.error) {
      setError({ for: "coverPhoto", text: result.message });
    } else {
      setServiceDetails((p) => ({ ...p, coverPhoto: result.url }));
    }
  };

  const loadingContent = (
    <div className="md:h-[40vh] w-full flex items-center justify-center">
      <Loading />
    </div>
  );

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
      <PageHeading text={"Self Drive Services"} />

      <div className="flex items-center justify-between  md:pr-3 mb-2">
        <p className="my-2 font-bold">{services?.length} services available</p>{" "}
        <button
          onClick={handleOpenAddServiceModal}
          className="py-1 px-2 rounded bg-[var(--primary-bg)] text-white"
        >
          Add Service
        </button>
      </div>
      <Paper sx={{ width: "100%", overflowX: "hidden" }}>
        <TableContainer sx={{ maxHeight: 440, maxWidth: "87vw" }}>
          {!services ? (
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
                {rows.map((row, i) => {
                  return (
                    <TableRow hover role="checkbox" tabIndex={-1} key={i}>
                      {columns.map((column) => {
                        const value = row[column.id];
                        return (
                          <TableCell key={column.id} align="center">
                            {column.id === "price" && value !== undefined ? (
                              `$${value}`
                            ) : column.id === "title" && value !== undefined ? (
                              `${value}`
                            ) : column.id === "action" ? (
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
                            ) : value !== undefined ? (
                              value
                            ) : (
                              "N/A"
                            )}
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
      </Paper>

      {/* Add service modal */}
      <Dialog
        open={addServiceModal}
        onClose={handleCloseAddServiceModal}
        aria-labelledby="responsive-dialog-title"
      >
        <Box component="form" onSubmit={handleSubmit(handleAddService)}>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            {serviceDetails?.title ? "Update the service" : "Add New Service"}
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
            {serviceDetails?.coverPhoto && (
              <div className="flex items-center justify-center w-full">
                <img
                  src={serviceDetails?.coverPhoto}
                  alt=""
                  className="w-52 h-40 rounded"
                />
              </div>
            )}
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              {/* Service Name */}
              {textField("Service Title", "title", "", serviceDetails?.title)}

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Select Cover Photo"
                  type="file"
                  onChange={handleUploadCoverPhoto}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
                {error?.for === "coverPhoto" && (
                  <span className="text-red-500 text-sm">{error?.text}</span>
                )}
              </Grid>

              {/* Service Area */}
              {textField(
                "Price",
                "price",
                "Service Price",
                serviceDetails?.price
              )}

              {/* Number of Passengers */}
              {textField(
                "Number of Passengers",
                "noOfPassengers",
                "How many passengers can go?",
                serviceDetails?.noOfPassengers
              )}

              {textField(
                "From",
                "from",
                "Picking Location",
                serviceDetails?.from
              )}

              {textField(
                "To",
                "to",
                "Destination location",
                serviceDetails?.to
              )}
              {textField(
                "Car Type",
                "carType",
                "Example : Taxi",
                serviceDetails?.carType
              )}
              {textField(
                "Locality",
                "locality",
                "Available Location",
                serviceDetails?.locality
              )}

              {/* Description */}
              {textField(
                "Description",
                "description",
                "Type the task description here...",
                serviceDetails?.description
              )}
            </Grid>
            {error.for && (
              <p className="text-red-500 text-center">{error.text}</p>
            )}
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
              {serviceDetails?.title ? "Update" : "Add"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </div>
  );
};

export default SelfDriveServices;
