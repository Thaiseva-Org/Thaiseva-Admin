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
  TableRow,
  TextField,
} from "@mui/material";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { useContext, useState } from "react";
import { useForm } from "react-hook-form";
import { v4 as uuid } from "uuid";

import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import DeleteButton from "../../../../../components/DeleteButton";
import LoadingContent from "../../../../../components/LoadingContent";
import PageHeading from "../../../../../components/PageHeading";
import UpdateButton from "../../../../../components/UpdateButton";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";
import {
  hotelPackageDetails,
  hotelPackages,
  storage,
} from "../../../../../firebase/firebase.config";
import {
  calculateDiscountPrice,
  successNotification,
} from "../../../../../utils/utils";

const AddedRooms = () => {
  const { myRooms, partnerDetails } = useContext(PartnerContext);
  const [addServiceModal, setOpenModal] = useState(false); //Add service modal
  const { user } = useContext(AuthContext);

  const [coverPhotoURL, setCoverPhotoURL] = useState("");
  const amenitiesRef = useRef();
  const [roomDetails, setRoomDetails] = useState({
    id: "",
    packageName: "",
    price: "",
    description: "",
    discount: 0,
    location: {},
    period: "",
    bookingInfo: {},
    numberOfGuests: "",
    address: "",
    ratings: "",
    numberOfReviews: "",
  });
  const [arrayData, setArrayData] = useState({
    amenities: [],
    included: [],
    pictures: [],
    places: [],
  });
  const [picture, setPicture] = useState({ label: "", url: "" });

  const {
    handleSubmit,
    reset,
    register,
    formState: { errors },
  } = useForm();

  // Partners table header
  let columns = [
    { property: "packageName", label: "Package Name", width: "20%" },
    { property: "price", label: "Price", width: "15%" },
    { property: "discount", label: "Discount", width: "10%" },
    { property: "discountPrice", label: "Discount Price", width: "15%" },
    { property: "noOfGuest", label: "Guests", width: "10%" },
    { property: "status", label: "Status", width: "15%" },
    { property: "action", label: "Action", width: "15%" },
    // { property: "period", label: "Period", width: 50 },
    // { property: "ratings", label: "Rating", width: 50 },
    // { property: "numberOfReviews", label: "Reviews", width: 50 },
  ];

  // creating single row
  function createData(
    packageName,
    price,
    discount,
    period,
    ratings,
    numberOfReviews,
    noOfGuest,
    status,
    id
  ) {
    return {
      packageName,
      price,
      period,
      discount,
      ratings,
      numberOfReviews,
      noOfGuest,
      status,
      id,
    };
  }

  // calling createData function with partner's data
  const rows = myRooms?.map((room) => {
    return createData(
      room.packageName,
      room.price,
      room.discount,
      room.period,
      room.rating,
      room.numberOfReviews,
      room.numberOfGuests,
      room.status,
      room.id
    );
  });

  // deleting room
  const handleDelete = async (id) => {
    if (confirm("Are you sure to delete this package?")) {
      await deleteDoc(doc(hotelPackages, id));
      await deleteDoc(doc(hotelPackageDetails, id)).then(() => {
        alert("The package is deleted successfully.");
      });
    }
    // askingForDelete().then(async (result) => {
    //   if (result.isConfirmed) {
    //   }
    // });
  };

  // opening AddPackagesModal the modal while cliking on right sign icon
  const handleCloseModal = () => {
    reset();
    setRoomDetails({
      id: "",
      packageName: "",
      price: "",
      description: "",
      discount: "",
      location: {},
      period: "",
      bookingInfo: {},
      numberOfGuests: "",
      address: "",
      ratings: "",
      numberOfReviews: "",
    });
    setCoverPhotoURL("");
    setArrayData({
      amenities: [],
      pictures: [],
    });
    setOpenModal(false);
  };
  // console.log(partnerDetails);
  // storing the requrement in the database
  const handleAddRoom = async (data) => {
    const location = partnerDetails?.hotelInformation?.location;
    const phoneNumber = partnerDetails?.hotelInformation?.phoneNumber;
    const name = partnerDetails?.hotelInformation?.hotelName;
    const {
      packageName,
      price,
      description,
      discount,
      period,
      numberOfGuests,
      address,
    } = data;

    let id;

    if (roomDetails.id) {
      id = roomDetails.id;
    } else {
      id = uuid();
    }

    const packageInfo = {
      id,
      packageName,
      price: parseFloat(price),
      discount: parseFloat(discount),
      period,
      address,
      name,
      coverPhoto: coverPhotoURL,
      rating: "0",
      status: "Pending",
      hotelUid: user?.uid,
      numberOfReviews: 0,
    };

    const packageDetails = {
      ...packageInfo,
      description,
      numberOfGuests,
      amenities: arrayData?.amenities,
      pictures: arrayData?.pictures,
      location,
      phoneNumber,
      duration: 30,
    };

    // await setDoc(doc(hotelPackages, id), packageInfo);
    await setDoc(doc(hotelPackageDetails, id), packageDetails).then(() => {
      successNotification(
        `The Package is ${
          roomDetails?.packageName ? "updated" : "added"
        } successfully`
      );
    });

    setRoomDetails({
      id: "",
      packageName: "",
      price: "",
      description: "",
      discount: 0,
      location: {},
      period: "",
      bookingInfo: {},
      numberOfGuests: "",
      address: "",
      ratings: "",
      numberOfReviews: "",
    });

    setCoverPhotoURL("");
    setArrayData({
      amenities: [],
      pictures: [],
    });
    setOpenModal(false);
  };

  /* =============================================================
              Add Packages functionalities end
  =============================================================*/

  // upadate package
  // const handleViewRoomDetails = async (id) => {
  //   reset();
  //   const snapshot = await getDoc(doc(hotelPackageDetails, id));
  //   if (snapshot.exists()) {
  //     const existingData = snapshot.data();
  //     const {
  //       id,
  //       packageName,
  //       price,
  //       address,
  //       description,
  //       discount,
  //       location,
  //       period,
  //       numberOfGuests,
  //       ratings,
  //       numberOfReviews,
  //     } = existingData;

  //     setRoomDetails({
  //       id,
  //       packageName,
  //       price,
  //       address,
  //       description,
  //       discount,
  //       location,
  //       period,
  //       numberOfGuests,
  //       ratings,
  //       numberOfReviews,
  //     });
  //     setCoverPhotoURL(existingData?.coverPhoto);
  //     setArrayData((p) => ({
  //       ...p,
  //       amenities: existingData?.amenities || [],
  //       pictures: existingData?.pictures || [],
  //     }));
  //   }
  //   setOpenModal(true);
  // };

  // handleing add amenities
  const handleAddAmenities = () => {
    const element = amenitiesRef.current.querySelector("input");
    if (!element.value) {
      return;
    }
    const newAmenities = [...arrayData.amenities, element.value];
    setArrayData((p) => ({ ...p, amenities: newAmenities }));
    element.value = "";
  };

  // handling remove amenities
  const handleRemoveAmenity = (i) => {
    const { amenities } = arrayData;
    const newAmenities = arrayData.amenities
      .slice(0, i)
      .concat(amenities.slice(i + 1));
    setArrayData((p) => ({ ...p, amenities: newAmenities }));
  };

  const navigate = useNavigate();

  // upload cover photo
  const handleUploadCoverPhoto = async (e) => {
    const file = e.target.files[0];
    const fileRef = ref(storage, `${file.lastModified}-coverPhoto`); // firebase storage to store license img
    //  // Uploading the profile image to storage
    const coverPhotoTask = await uploadBytesResumable(fileRef, file);

    // Get the download URL
    const photoURL = await getDownloadURL(coverPhotoTask.ref);

    if (photoURL) {
      setCoverPhotoURL(photoURL);
    }
  };

  // upload pictures
  const handleUploadPictures = async (e) => {
    let file = e.target.files[0];

    const imageRef = ref(storage, `${file.lastModified}-roomPhoto`); // firebase storage to store license img
    //  // Uploading the profile image to storage
    const imageTask = await uploadBytesResumable(imageRef, file);

    // Get the download URL
    const imageURL = await getDownloadURL(imageTask.ref);

    if (imageURL) {
      setPicture((p) => ({ ...p, url: imageURL }));
    }
  };

  // adding picture with label
  const handleAddPicture = () => {
    setArrayData((p) => ({ ...p, pictures: [...p.pictures, picture] }));
    setPicture({ label: "", url: "" });
  };

  // Remove picture
  const handleRemovePicture = (i) => {
    const { pictures } = arrayData;
    const newPictures = arrayData.pictures
      .slice(0, i)
      .concat(pictures.slice(i + 1));
    setArrayData((p) => ({ ...p, pictures: newPictures }));
  };

  // custom text field for common data
  const textField = (label, name, placeholder, defaultValue) => {
    return (
      <Grid item xs={12} sm={name === "description" ? 12 : 6}>
        <TextField
          label={label}
          type={
            ["price", "discount", "numberOfGuests", "period"].includes(name)
              ? "number"
              : "text"
          }
          inputProps={{
            min: ["discount"].includes(name)
              ? 0
              : ["price", "numberOfGuests", "period"].includes(name)
              ? 1
              : undefined,
            max: ["discount", "numberOfGuests"].includes(name)
              ? 100
              : undefined,
          }}
          defaultValue={defaultValue}
          placeholder={placeholder}
          multiline={name === "description"}
          fullWidth
          {...register(name, { required: true })}
          rows={name === "description" ? 3 : undefined}
        />
        {errors?.name && (
          <span className="text-red-500">{label} is required</span>
        )}
      </Grid>
    );
  };

  return (
    <div>
      <PageHeading text={"Added Rooms"} />

      <div className="flex items-center justify-between  md:pr-3 mb-2">
        <p className="my-2 font-bold"></p>
        <button
          onClick={() => {
            navigate("/dashboard/added-rooms/room-details");
          }}
          // className="py-1 px-2 rounded bg-[blue] text-white"
          className="add-new-btn"
        >
          Add Room
        </button>
      </div>
      <Paper sx={{ width: "100%", overflowX: "hidden" }}>
        <TableContainer>
          {!myRooms ? (
            <LoadingContent />
          ) : (
            <Table stickyHeader aria-label="sticky table">
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      key={column.property}
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
                        const value = row[column.property];

                        return (
                          <TableCell key={column.property} align="center">
                            {((value === "Pending" ||
                              value === "Approved" ||
                              value === "Denied") && (
                              <span
                                className={`${
                                  (value === "Pending" &&
                                    "bg-orange-300 text-black") ||
                                  (value === "Approved" && "bg-green-500") ||
                                  (value === "Denied" && "bg-red-600")
                                } text-white  py-1 px-2 rounded`}
                              >
                                {value}
                              </span>
                            )) ||
                              (column.property === "discountPrice" &&
                                `$ ${calculateDiscountPrice(
                                  row["price"],
                                  row["discount"]
                                )}`) ||
                              (column.property === "action" && (
                                <div className="flex gap-1 justify-center">
                                  <DeleteButton
                                    title={"delete room"}
                                    handleDelete={handleDelete}
                                    id={row.id}
                                  />
                                  {/* <button
                                    onClick={() => handleDelete(row.id)}
                                    className="bg-red-500 text-white p-1 rounded-full"
                                  >
                                    <DeleteForeverIcon />
                                  </button> */}
                                  <UpdateButton
                                    title={"edit room"}
                                    handleEdit={() =>
                                      navigate(
                                        "/dashboard/added-rooms/room-details",
                                        {
                                          state: { id: row.id },
                                        }
                                      )
                                    }
                                  />
                                  {/* <button
                                    onClick={
                                      () =>
                                        navigate(
                                          "/dashboard/added-rooms/room-details",
                                          {
                                            state: { id: row.id },
                                            replace: true,
                                          }
                                        )
                                      // handleViewRoomDetails(row.id)
                                    }
                                    className="bg-orange-500 text-white p-1 rounded-full ml-1"
                                  >
                                    <EditIcon />
                                  </button> */}
                                </div>
                              )) ||
                              (column.property === "price" && `$ ${value}`) ||
                              (column.property === "discount" &&
                                `${value} %`) ||
                              (column.property === "ratings" &&
                                (value != 0 ? `${value}` : "-")) ||
                              (column.property === "numberOfReviews" &&
                                (value !== 0 ? `${value}` : "-")) ||
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
      </Paper>

      {/* Add and Update Package modal */}
      <Dialog
        open={addServiceModal}
        onClose={handleCloseModal}
        aria-labelledby="responsive-dialog-title"
      >
        <Box component="form" onSubmit={handleSubmit(handleAddRoom)}>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            {roomDetails?.packageName ? "Update" : "Add New"} Package
          </DialogTitle>
          <IconButton
            aria-label="close"
            onClick={handleCloseModal}
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
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              {/* Package Name */}
              {textField(
                "Package Name",
                "packageName",
                "Package Name",
                roomDetails?.packageName
              )}

              {/* Price */}
              {textField("Price", "price", "Price", roomDetails?.price)}

              {/* Requirement Title */}
              {textField("Address", "address", "Address", roomDetails?.address)}

              {/* Discount */}
              {textField(
                "Discount",
                "discount",
                "Discount in %",
                roomDetails?.discount
              )}

              {/* Description */}
              {textField(
                "Description",
                "description",
                "Type Package Description...",
                roomDetails?.description
              )}

              {/* Period */}
              {textField("Period", "period", "Period", roomDetails?.period)}

              {/* Number Of Guests */}
              {textField(
                "Number Of Guests",
                "numberOfGuests",
                "Number Of Guests",
                roomDetails?.numberOfGuests
              )}

              {/* Cover Photo */}
              <Grid item xs={12}>
                <div className="flex md:flex-row flex-col gap-2 ">
                  <div className="flex-1">
                    <TextField
                      label={"Select cover photo"}
                      type="file"
                      defaultValue=""
                      onChange={handleUploadCoverPhoto}
                      placeholder=""
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </div>
                  <div className="flex-1">
                    {coverPhotoURL && (
                      <div className="w-fit relative">
                        <img
                          src={coverPhotoURL}
                          alt=""
                          className="h-16 w-16 rounded opacity-80"
                        />
                        <span
                          onClick={() => setCoverPhotoURL("")}
                          className="cross-btn"
                        >
                          x
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Grid>

              {/* Add Amenities */}
              <Grid item xs={12}>
                <div className="flex md:flex-row flex-col">
                  <div className="flex-1 flex gap-2 items-center">
                    <TextField
                      ref={amenitiesRef}
                      label="Add Amenities"
                      type="text"
                      placeholder="Add Amenities"
                      fullWidth
                    />
                    <div onClick={handleAddAmenities} className="input-add-btn">
                      Add
                    </div>
                  </div>
                  <div className="flex-1 p-4 ">
                    <h3 className="font-bold text-center">Added Amenities</h3>
                    <div className="flex flex-wrap gap-2">
                      {arrayData.amenities &&
                        arrayData?.amenities?.map((amenity, i) => (
                          <div key={i} className="flex gap-1 text-sm">
                            <span>{amenity}</span>
                            <div
                              onClick={() => handleRemoveAmenity(i)}
                              className="bg-gray-200 hover:bg-gray-300 p-1 rounded-full h-5 w-5 flex items-center justify-center cursor-pointer"
                            >
                              x
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </Grid>

              {/* Add images */}
              <Grid item xs={12}>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <TextField
                        label="Picture Title"
                        type="text"
                        value={picture.label}
                        placeholder="Name the Picture"
                        onChange={(e) =>
                          setPicture((p) => ({ ...p, label: e.target.value }))
                        }
                        fullWidth
                      />
                    </div>
                    <div className="flex-1">
                      <TextField
                        label="Select Image"
                        id="single-picture"
                        type="file"
                        onChange={handleUploadPictures}
                        defaultValue=""
                        placeholder=""
                        InputLabelProps={{ shrink: true }}
                      />
                    </div>
                  </div>
                  {picture.label && (
                    <div className="flex gap-2 items-end">
                      <div className="border p-2 rounded border-[blue] relative">
                        {picture.label && <h4>{picture?.label}</h4>}
                        {picture.url && (
                          <img
                            src={picture?.url}
                            alt=""
                            className="h-20 w-24 rounded"
                          />
                        )}
                        <span
                          onClick={() => setPicture({ label: "", url: "" })}
                          className="cross-btn"
                        >
                          x
                        </span>
                      </div>
                      <div
                        onClick={handleAddPicture}
                        className="bg-[blue] text-white h-fit w-fit cursor-pointer px-2 py-2 rounded-md flex items-center justify-center"
                      >
                        Add
                      </div>
                    </div>
                  )}
                  <div className="flex-1 px-3">
                    <h3 className="font-bold text-center">Added Pictures</h3>
                    <div className="flex flex-wrap gap-2">
                      {arrayData.pictures?.map((picture, i) => (
                        <div
                          key={i}
                          className="border p-2 rounded border-[blue] relative"
                        >
                          {picture.label && <h4>{picture?.label}</h4>}
                          {picture.url && (
                            <img
                              src={picture?.url}
                              alt=""
                              className="h-20 w-24 rounded"
                            />
                          )}
                          <span
                            onClick={() => handleRemovePicture(i, picture)}
                            className="cross-btn"
                          >
                            x
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Grid>

              <Grid item xs={12} sm={6}></Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              type="submit"
              autoFocus
              sx={{ bgcolor: "blue", color: "white", hover: "none" }}
            >
              {roomDetails?.packageName ? "Update" : "Add"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </div>
  );
};

export default AddedRooms;
