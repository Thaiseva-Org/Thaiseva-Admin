import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TablePagination,
  TextField,
} from "@mui/material";
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useContext, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { v4 as uuid } from "uuid";
import DeleteButton from "../../../../../components/DeleteButton";
import Loading from "../../../../../components/Loading";
import PageHeading from "../../../../../components/PageHeading";
import SearchBar from "../../../../../components/SearchBar";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import {
  db,
  storage,
  travelServicesCollection,
} from "../../../../../firebase/firebase.config";
import {
  askingForDelete,
  deleteNotification,
  successNotification,
} from "../../../../../utils/utils";
import ViewDetailsIcon from "./../../../../../components/ViewDetailsIcon";

const TravelServices = () => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const [travelServices, setTravelServices] = useState([]);
  const [matchedTravelServices, setMatchedTravelServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [coverPhotoURL, setCoverPhotoURL] = useState("");
  const [refetch, setRefetch] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [packageDetails, setPackageDetails] = useState({
    id: "",
    title: "",
    price: 0,
    description: "",
    discount: 0,
    location: "",
    period: 0,
  });
  const [arrayData, setArrayData] = useState({
    amenities: [],
    hotels: [],
    included: [],
    pictures: [],
    places: [],
  });

  const [openModal, setOpenModal] = useState(false); // Add requirement modal
  const amenitiesRef = useRef();
  const hotelsRef = useRef();
  const placesRef = useRef();
  const includedRef = useRef();
  const {
    handleSubmit,
    reset,
    register,
    formState: { errors },
  } = useForm();

  // fetching all services
  const fetchTotalPages = async () => {
    let q = query(travelServicesCollection, orderBy("timestamp", "desc"));
    const querySnapshot = await getCountFromServer(q);
    setTotalPages(Math.ceil(querySnapshot.data().count));
  };

  const fetchData = async () => {
    setLoadingServices(true);
    let q = query(
      travelServicesCollection,
      orderBy("timestamp", "desc"),
      limit(rowsPerPage)
    );

    if (page > 0 && lastDocs[page - 1]) {
      q = query(
        travelServicesCollection,
        orderBy("timestamp", "desc"),
        startAfter(lastDocs[page - 1]),
        limit(rowsPerPage)
      );
    }
    const querySnapshot = await getDocs(q);
    const newData = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    const lastDoc =
      querySnapshot.docs.length > 0
        ? querySnapshot.docs[querySnapshot.docs.length - 1]
        : null;
    setLastDocs((prev) => {
      const updated = [...prev];
      updated[page] = lastDoc;
      return updated;
    });
    setTravelServices(newData);
    setMatchedTravelServices(newData);
    setLoadingServices(false);
  };
  useEffect(() => {
    if (isAdmin || isSubAdmin) {
      fetchTotalPages();
      fetchData();
    }
  }, [isAdmin, isSubAdmin, refetch, page, rowsPerPage]);

  const columns = [
    { id: "title", label: "Title", width: "20%" },
    { id: "description", label: "Description", width: "30%" },
    {
      id: "location",
      label: "Location",
      width: "10%",
    },
    {
      id: "period",
      label: "Period",
      width: "10%",
    },
    {
      id: "price",
      label: "Price",
      width: "10%",
    },
    {
      id: "discount",
      label: "Discount",
      width: "10%",
    },
    {
      id: "action",
      label: "Action",
      width: "10%",
    },
  ];

  // creating single row
  function createData(
    title,
    description,
    location,
    period,
    price,
    discount,
    rating,
    id
  ) {
    return {
      title,
      description,
      location,
      period,
      price,
      discount,
      rating,
      id,
    };
  }

  // calling createData function with driver's data
  const rows = matchedTravelServices.map((service) => {
    return createData(
      service.title,
      service.description,
      service.location,
      service.period,
      service.price,
      service.discount,
      service.rating,
      service.id
    );
  });

  /* =============================================================
              serach functionalities start
  =============================================================*/
  // const handleSearchByTitle = (text) => {
  //   const matchingObjects = travelServices.filter((item) =>
  //     item.title.toLowerCase().includes(text.toLowerCase())
  //   );
  //   setMatchedTravelServices(matchingObjects);
  // };

  // const handleSearchByServiceArea = (text) => {
  //   const matchingObjects = travelServices.filter((item) =>
  //     item.location.toLowerCase().includes(text.toLowerCase())
  //   );

  //   setMatchedTravelServices(matchingObjects);
  // };

  const handleSearch = (text) => {
    const matchingObjects = travelServices.filter(
      (item) =>
        item.location.toLowerCase().includes(text.toLowerCase()) ||
        item.title.toLowerCase().includes(text.toLowerCase())
    );

    setMatchedTravelServices(matchingObjects);
  };

  /* =============================================================
              serach functionalities end
  =============================================================*/

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(event.target.value);
    setPage(0);
  };

  /* =============================================================
              Add Packages functionalities start
  =============================================================*/
  const handleOpenModal = () => {
    reset();
    setOpenModal(true);
  };

  // opening AddPackagesModal the modal while cliking on right sign icon
  const handleCloseModal = () => {
    reset();
    setPackageDetails({
      id: "",
      title: "",
      price: 0,
      description: "",
      discount: 0,
      location: "",
      period: 0,
    });
    setCoverPhotoURL("");
    setArrayData({
      amenities: [],
      hotels: [],
      included: [],
      pictures: [],
      places: [],
    });
    setOpenModal(false);
  };

  // storing the requrement in the database
  const handleAddTravelService = async (data) => {
    const { title, price, description, discount, location, period } = data;
    if (!coverPhotoURL) {
      return alert("Please provide cover image");
    }
    if (arrayData?.amenities?.length < 3) {
      return alert("Please provide at least 3 amenities");
    }
    // if (arrayData?.places?.length < 3) {
    //   return alert("Please provide at least 3 places");
    // }
    // if (arrayData?.included?.length < 3) {
    //   return alert("Please provide at least 3 included");
    // }
    if (arrayData?.pictures?.length < 3) {
      return alert("Please provide at least 3 pictures");
    }
    if (
      confirm(
        `Are you sure to ${
          packageDetails?.title ? "update" : "add"
        } this package?`
      )
    ) {
      let id;
      if (packageDetails?.id) {
        id = packageDetails?.id;
      } else {
        id = uuid();
      }

      const travelInfo = {
        id,
        title,
        description,
        price: parseFloat(price),
        discount: parseFloat(discount),
        location,
        period: parseFloat(period),
        coverPhoto: coverPhotoURL,
        timestamp: packageDetails?.timestamp
          ? packageDetails.timestamp
          : new Date(),
      };

      const travelDetails = {
        ...travelInfo,
        amenities: arrayData?.amenities,
        included: arrayData?.included,
        pictures: arrayData?.pictures,
        hotels: arrayData?.hotels,
        places: arrayData?.places,
      };

      await setDoc(doc(travelServicesCollection, id), travelInfo);

      await setDoc(
        doc(collection(db, "sightseeingPackagesDetails"), id),
        travelDetails
      ).then(() => reset());

      setPackageDetails({
        id: "",
        title: "",
        price: 0,
        description: "",
        discount: "",
        location: "",
        period: "",
        rating: 0,
        numberOfReviews: 0,
      });

      setCoverPhotoURL("");
      setArrayData({
        amenities: [],
        hotels: [],
        included: [],
        pictures: [],
        places: [],
      });
      successNotification(
        `The Package is ${
          packageDetails?.title ? "updated" : "Added"
        } successfully`
      );
      setOpenModal(false);
      setRefetch((p) => !p);
    }
  };
  /* =============================================================
              Add Packages functionalities end
  =============================================================*/

  // upadate package
  const handleViewPackage = async (id) => {
    reset();
    const snapshot = await getDoc(
      doc(collection(db, "sightseeingPackagesDetails"), id)
    );
    if (snapshot.exists()) {
      const existingData = snapshot.data();
      const {
        id,
        title,
        price,
        description,
        discount,
        location,
        period,
        timestamp,
      } = existingData;

      setPackageDetails({
        id,
        title,
        price,
        description,
        discount,
        location,
        period,
        timestamp,
      });
      setCoverPhotoURL(existingData?.coverPhoto);
      setArrayData((p) => ({
        ...p,
        amenities: existingData?.amenities || [],
        hotels: existingData?.hotels || [],
        included: existingData?.included || [],
        pictures: existingData?.pictures || [],
        places: existingData?.places || [],
      }));
    }
    setOpenModal(true);
  };

  // delete package
  const handleDeletePackage = async (id) => {
    askingForDelete().then(async (result) => {
      if (result.isConfirmed) {
        await deleteDoc(doc(travelServicesCollection, id));
        await deleteDoc(
          doc(collection(db, "sightseeingPackagesDetails"), id)
        ).then(() => {
          deleteNotification("The Package is deleted successfully.");
        });
        setRefetch((p) => !p);
      }
    });
  };

  // handleing add amenities
  const handleAddHotels = () => {
    const element = hotelsRef.current.querySelector("input");
    if (!element.value) {
      return;
    }
    const newHotels = [...arrayData.hotels, element.value];
    setArrayData((p) => ({ ...p, hotels: newHotels }));
    element.value = "";
  };

  // handling remove amenities
  const handleRemoveHotels = (i) => {
    const { amenities } = arrayData;
    const newHotels = arrayData.hotels
      .slice(0, i)
      .concat(amenities.slice(i + 1));
    setArrayData((p) => ({ ...p, hotels: newHotels }));
  };

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

  // handling add include
  const handleAddInclude = () => {
    const element = includedRef.current.querySelector("input");
    if (!element.value) {
      return;
    }
    const newAmenities = [...arrayData.included, element.value];
    setArrayData((p) => ({ ...p, included: newAmenities }));
    element.value = "";
  };

  // handling remove include
  const handleRemoveInclude = (i) => {
    const { included } = arrayData;
    const newIncluded = arrayData.included
      .slice(0, i)
      .concat(included.slice(i + 1));
    setArrayData((p) => ({ ...p, included: newIncluded }));
  };

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

    const imageRef = ref(storage, `${file.lastModified}-placePhoto`); // firebase storage to store license img
    //  // Uploading the profile image to storage
    const imageTask = await uploadBytesResumable(imageRef, file);

    // Get the download URL
    const imageURL = await getDownloadURL(imageTask.ref);

    if (imageURL) {
      setArrayData((p) => ({
        ...p,
        pictures: [...arrayData.pictures, imageURL],
      }));
    }
  };

  // remove picture
  const handleRemovePicture = (i) => {
    const { pictures } = arrayData;
    const newPictures = arrayData.pictures
      .slice(0, i)
      .concat(pictures.slice(i + 1));
    setArrayData((p) => ({ ...p, pictures: newPictures }));
  };

  // handling add Places
  const handleAddPlace = () => {
    const element = placesRef.current.querySelector("input");
    if (!element.value) {
      return;
    }
    const newPlace = [...arrayData.places, element.value];
    setArrayData((p) => ({ ...p, places: newPlace }));
    element.value = "";
  };

  // handling remove place
  const handleRemovePlace = (i) => {
    const { places } = arrayData;
    const newPlaces = arrayData.places.slice(0, i).concat(places.slice(i + 1));
    setArrayData((p) => ({ ...p, places: newPlaces }));
  };

  // custom text field for common data
  const textField = (label, name, placeholder, defaultValue) => {
    return (
      <Grid item xs={12} sm={name === "description" ? 12 : 6}>
        <TextField
          label={label}
          type={
            ["price", "discount", "period"].includes(name) ? "number" : "text"
          }
          onWheel={(e) => e.target.blur()}
          onKeyDown={(e) => {
            if (
              e.target.type === "number" &&
              ["+", "-", "e", "/"].includes(e.key)
            ) {
              e.preventDefault();
            }
          }}
          required
          defaultValue={defaultValue || ""}
          placeholder={placeholder}
          multiline={name === "description"}
          fullWidth
          autoComplete="off"
          autoCorrect="off"
          rows={name === "description" ? 3 : ""}
          inputProps={{
            min:
              name === "price"
                ? 1
                : name === "discount"
                ? 0
                : name === "period"
                ? 1
                : undefined,
            max:
              name === "discount" ? 100 : name === "period" ? 100 : undefined,
          }}
          {...register(name, { required: true })}
        />
        {errors?.name && (
          <span className="text-red-500">{label} is required</span>
        )}
      </Grid>
    );
  };

  const loadingContent = (
    <div className="md:h-[40vh] w-full flex items-center justify-center">
      <Loading />
    </div>
  );

  return (
    <div className="animate-fade-in">
      <PageHeading
        text="Sightseeing Packages"
        subtitle="Manage tour packages and travel services"
        icon="🗺️"
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium mb-1">
                Total Packages
              </p>
              <p className="text-3xl font-bold">
                {matchedTravelServices.length}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">🗺️</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-success-500 to-success-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-success-100 text-sm font-medium mb-1">
                Active Tours
              </p>
              <p className="text-3xl font-bold">
                {matchedTravelServices.length}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">✅</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-secondary-500 to-secondary-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary-100 text-sm font-medium mb-1">
                Locations
              </p>
              <p className="text-3xl font-bold">
                {new Set(matchedTravelServices.map((s) => s.location)).size}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">📍</span>
            </div>
          </div>
        </div>
      </div>

      {/* <Grid container spacing={0.5} sx={{ mb: 2, mt: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By Title"
            type="search"
            placeholder="Travel Service Title"
            fullWidth
            defaultValue=""
            onChange={(e) => handleSearchByTitle(e.target.value)}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By location"
            type="search"
            placeholder="Type Location"
            fullWidth
            defaultValue=""
            onChange={(e) => handleSearchByServiceArea(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={6}>
          <div className="text-right md:pr-10 mb-4 flex items-center justify-end h-full">
            <button onClick={handleOpenModal} className="add-new-btn">
              Add New Package
            </button>
          </div>
        </Grid>
      </Grid> */}
      <SearchBar
        handleSearch={handleSearch}
        handleOpenModal={handleOpenModal}
        btnTitle="Add New Package"
      />

      {/* Modern Table Container */}
      <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          {loadingServices ? (
            loadingContent
          ) : (
            <table className="w-full">
              <thead className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.id}
                      className="px-6 py-4 text-center text-sm font-semibold uppercase tracking-wider"
                      style={{ width: column.width }}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {rows.map((row, i) => {
                  return (
                    <tr
                      key={i}
                      className="hover:bg-primary-50 transition-colors duration-200"
                    >
                      {columns.map((column) => {
                        let value = row[column.id];
                        return (
                          <td key={column.id} className="px-6 py-4 text-center">
                            {column.id === "action" ? (
                              <div className="flex gap-2 items-center justify-center">
                                <button
                                  onClick={() => handleViewPackage(row.id)}
                                  className="p-2 hover:bg-primary-100 rounded-lg transition-colors"
                                  title="View Details"
                                >
                                  <ViewDetailsIcon />
                                </button>
                                <button
                                  onClick={() => handleDeletePackage(row.id)}
                                  className="p-2 hover:bg-danger-100 rounded-lg transition-colors"
                                  title="Delete package"
                                >
                                  <DeleteButton />
                                </button>
                              </div>
                            ) : column.id === "price" ? (
                              <span className="font-semibold text-success-600">
                                ฿{value}
                              </span>
                            ) : column.id === "discount" ? (
                              <span className="inline-flex items-center justify-center w-12 h-12 bg-secondary-100 text-secondary-700 rounded-full font-semibold">
                                {value}%
                              </span>
                            ) : column.id === "period" ? (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-primary-100 text-primary-700">
                                {value} days
                              </span>
                            ) : column.id === "location" ? (
                              <span className="inline-flex items-center gap-1 text-sm text-neutral-700">
                                <span>📍</span> {value}
                              </span>
                            ) : column.id === "description" ? (
                              <span className="text-sm text-neutral-600 line-clamp-2">
                                {value}
                              </span>
                            ) : (
                              <span className="text-sm text-neutral-700 font-medium">
                                {value}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12">
                      <div className="flex flex-col items-center justify-center text-neutral-400">
                        <span className="text-6xl mb-4">🗺️</span>
                        <p className="text-lg font-medium text-neutral-500">
                          No Packages Found
                        </p>
                        <p className="text-sm text-neutral-400 mt-2">
                          Create your first sightseeing package.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Modern Pagination */}
        <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-4">
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
                color: "var(--text-primary)",
              },
              "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows":
                {
                  margin: 0,
                  fontWeight: 500,
                },
              "& .MuiTablePagination-select": {
                borderRadius: "8px",
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                padding: "4px 8px",
              },
              "& .MuiTablePagination-actions button": {
                borderRadius: "8px",
                "&:hover": {
                  backgroundColor: "var(--primary-bg-light)",
                },
              },
            }}
          />
        </div>
      </div>

      {/* <SightSeeingForm openModal={openModal} handleCloseModal={handleCloseModal} /> */}

      {/* Add requirement modal */}
      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        aria-labelledby="responsive-dialog-title"
      >
        <Box component="form" onSubmit={handleSubmit(handleAddTravelService)}>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            {packageDetails?.title ? "Update" : "Add New"} Package
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
              {/* Requirement Title */}
              {textField(
                "Package Title",
                "title",
                "Package Title",
                packageDetails?.title
              )}

              {/* Requirement Title */}
              {textField(
                "Location",
                "location",
                "Location",
                packageDetails?.location
              )}

              {/* Price */}
              {textField("Price", "price", "Price", packageDetails?.price)}

              {/* Discount */}
              {textField(
                "Discount",
                "discount",
                "Discount in %",
                packageDetails?.discount
              )}

              {/* Description */}
              {textField(
                "Description",
                "description",
                "Type Package Description...",
                packageDetails?.description
              )}

              {/* Period */}
              {textField(
                "Period (in Days)",
                "period",
                "Period",
                packageDetails?.period
              )}

              {/* Number Of Passengers */}
              {/* {textField(
                "Number Of Passengers",
                "NumberOfPassengers",
                "Number Of Passengers",
                packageDetails?.NumberOfPassengers
              )} */}

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
                          className="absolute top-0 right-0.5"
                        >
                          <CloseIcon
                            fontSize="small"
                            sx={{ stroke: "white", strokeWidth: 0.5 }}
                            className="bg-red-400 font-bold hover:bg-red-500 cursor-pointer text-white p-[0.1rem] rounded-full"
                          />
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
                      autoComplete="off"
                      autoCorrect="off"
                      fullWidth
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddAmenities();
                        }
                      }}
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
                          <Chip
                            key={i}
                            label={amenity}
                            onDelete={() => handleRemoveAmenity(i)}
                          />
                          // <div key={i} className="flex gap-1 text-sm">
                          //   <span>{amenity}</span>
                          //   <div
                          //     onClick={() => handleRemoveAmenity(i)}
                          //     className="bg-gray-200 hover:bg-gray-300 p-1 rounded-full h-5 w-5 flex items-center justify-center cursor-pointer"
                          //   >
                          //     x
                          //   </div>
                          // </div>
                        ))}
                    </div>
                  </div>
                </div>
              </Grid>

              {/* Add Places */}
              <Grid item xs={12}>
                <div className="flex md:flex-row flex-col">
                  <div className="flex-1 flex gap-2 items-center">
                    <TextField
                      ref={placesRef}
                      id="add-place"
                      label="Places"
                      type="text"
                      autoComplete="off"
                      autoCorrect="off"
                      placeholder="Add places name here"
                      fullWidth
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddPlace();
                        }
                      }}
                    />
                    <div onClick={handleAddPlace} className="input-add-btn">
                      Add
                    </div>
                  </div>
                  <div className="flex-1 p-4 ">
                    <h3 className="font-bold text-center">Added Places</h3>
                    <div className="flex flex-wrap gap-2">
                      {arrayData.places &&
                        arrayData?.places?.map((place, i) => (
                          <Chip
                            key={i}
                            label={place}
                            onDelete={() => handleRemovePlace(i)}
                          />
                          // <div key={i} className="flex gap-1">
                          //   <span>{place}</span>
                          //   <div
                          //     onClick={() => handleRemovePlace(i)}
                          //     className="bg-gray-200 hover:bg-gray-300 p-2 rounded-full h-6 w-6 flex items-center justify-center cursor-pointer"
                          //   >
                          //     x
                          //   </div>
                          // </div>
                        ))}
                    </div>
                  </div>
                </div>
              </Grid>

              {/* Add Hotels */}
              <Grid item xs={12}>
                <div className="flex md:flex-row flex-col">
                  <div className="flex-1 flex gap-2 items-center">
                    <TextField
                      ref={hotelsRef}
                      id="add-hotel"
                      label="Hotels"
                      type="text"
                      autoComplete="off"
                      autoCorrect="off"
                      placeholder="Add hotels name here"
                      fullWidth
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddHotels();
                        }
                      }}
                    />
                    <div onClick={handleAddHotels} className="input-add-btn">
                      Add
                    </div>
                  </div>
                  <div className="flex-1 p-4 ">
                    <h3 className="font-bold text-center">Added Hotels</h3>
                    <div className="flex flex-wrap gap-2">
                      {arrayData.hotels &&
                        arrayData?.hotels?.map((hotel, i) => (
                          <Chip
                            key={i}
                            label={hotel}
                            onDelete={() => handleRemoveHotels(i)}
                          />
                        ))}
                    </div>
                  </div>
                </div>
              </Grid>

              {/* Add Included */}
              <Grid item xs={12}>
                <div className="flex flex-col">
                  <div className=" flex gap-2 items-center">
                    <TextField
                      ref={includedRef}
                      label="Included"
                      type="text"
                      autoComplete="off"
                      autoCorrect="off"
                      placeholder="What are included?"
                      fullWidth
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddInclude();
                        }
                      }}
                    />
                    <div onClick={handleAddInclude} className="input-add-btn">
                      Add
                    </div>
                  </div>
                  <div className="flex-1 p-4 ">
                    <h3 className="font-bold text-center">Added Includes</h3>
                    <div className="flex flex-wrap gap-2">
                      {arrayData.included &&
                        arrayData?.included?.map((item, i) => (
                          <Chip
                            key={i}
                            label={item}
                            onDelete={() => handleRemoveInclude(i)}
                          />
                          // <div key={i} className="flex gap-1">
                          //   <span>{item}</span>
                          //   <div
                          //     onClick={() => handleRemoveInclude(i)}
                          //     className="bg-gray-200 hover:bg-gray-300 p-2 rounded-full h-6 w-6 flex items-center justify-center cursor-pointer"
                          //   >
                          //     x
                          //   </div>
                          // </div>
                        ))}
                    </div>
                  </div>
                </div>
              </Grid>

              {/* Add Pictures */}
              <Grid item xs={12}>
                <div className="flex flex-col">
                  <div className="">
                    <TextField
                      label="Select Image"
                      type="file"
                      onChange={handleUploadPictures}
                      defaultValue=""
                      placeholder=""
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </div>
                  <div className="flex-1 p-4">
                    <h3 className="font-bold text-center my-1">
                      Added Pictures
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {arrayData.pictures?.map((picture, i) => (
                        <div key={i} className="relative">
                          <img
                            src={picture}
                            alt=""
                            className="h-16 w-16 rounded opacity-80"
                          />
                          {/* <span
                            onClick={() => handleRemovePicture(i)}
                            className="bg-red-400 hover:bg-red-500 cursor-pointer text-white p-1 absolute top-0 right-0 h-5 w-5 rounded-full flex items-center justify-center"
                          >
                            x
                          </span> */}
                          <span
                            onClick={() => handleRemovePicture(i)}
                            className="absolute top-0 right-0.5"
                          >
                            <CloseIcon
                              fontSize="small"
                              sx={{ stroke: "white", strokeWidth: 0.5 }}
                              className="bg-red-400 font-bold hover:bg-red-500 cursor-pointer text-white p-[0.1rem] rounded-full"
                            />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* {fileError && <span className="text-red-500 text-sm">{fileError}</span>} */}
              </Grid>

              <Grid item xs={12} sm={6}></Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              type="submit"
              autoFocus
              sx={{
                backgroundColor: "var(--form-button-bg-color)",
                color: "white",
                "&:hover": {
                  backgroundColor: "var(--form-button-hover-bg-color)",
                },
              }}
            >
              {packageDetails?.title ? "Update" : "Add"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </div>
  );
};

export default TravelServices;
