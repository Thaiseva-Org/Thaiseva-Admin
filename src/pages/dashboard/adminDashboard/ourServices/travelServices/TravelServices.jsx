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
  Checkbox,
  FormControlLabel,
  FormGroup,
  Collapse,
  Typography,
  Card,
  CardContent,
  Stack,
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

import { getEmptySightseeingPackage } from "../../../../../utils/sightseeingTransformation";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';

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
    pricePerChild: 0,
    extraAdultPrice: 0,
    transportType: "",
    pickupFromHotel: false,
    dropToAirport: false,
  });
  const [arrayData, setArrayData] = useState({
    amenities: [],
    hotels: [],
    included: [],
    pictures: [],
    places: [],
  });
  const [openModal, setOpenModal] = useState(false);
  const amenitiesRef = useRef();
  const hotelsRef = useRef();
  const placesRef = useRef();
  const includedRef = useRef();

  // Multi-step Wizard State
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  const handleNextStep = () => setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  const handleBackStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));


  // Expanded states for new sections
  const [expandedSections, setExpandedSections] = useState({
    itinerary: false,
    hotels: false,
    reviews: false,
    sights: false,
    specialRates: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const [itinerary, setItinerary] = useState([]);
  const [hotelsIncluded, setHotelsIncluded] = useState([]);
  const [sights, setSights] = useState([]);
  const [specialRates, setSpecialRates] = useState({
    seasonalPricing: { enabled: false, note: "" },
    earlyBirdDiscount: { enabled: false, discountPercent: 0, description: "" }
  });

  const addItineraryDay = () => {
    setItinerary([...itinerary, { day: itinerary.length + 1, title: "", timeline: [] }]);
  };

  const updateItineraryDay = (index, field, value) => {
    const newItinerary = [...itinerary];
    newItinerary[index][field] = value;
    setItinerary(newItinerary);
  };

  const addTimelineEvent = (dayIndex) => {
    const newItinerary = [...itinerary];
    newItinerary[dayIndex].timeline.push({ time: "", activity: "" });
    setItinerary(newItinerary);
  };

  const updateTimelineEvent = (dayIndex, eventIndex, field, value) => {
    const newItinerary = [...itinerary];
    newItinerary[dayIndex].timeline[eventIndex][field] = value;
    setItinerary(newItinerary);
  };

  const addHotel = () => {
    setHotelsIncluded([...hotelsIncluded, {
      hotelId: uuid(), hotelName: "", nights: 1, roomType: "", location: ""
    }]);
  };

  const updateHotel = (index, field, value) => {
    const newList = [...hotelsIncluded];
    newList[index][field] = value;
    setHotelsIncluded(newList);
  };

  const addSight = () => {
    setSights([...sights, { sightId: uuid(), title: "", description: "" }]);
  };

  const updateSight = (index, field, value) => {
    const newList = [...sights];
    newList[index][field] = value;
    setSights(newList);
  };
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
    console.log(121);

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

  const handleSearch = (text) => {
    const matchingObjects = travelServices.filter(
      (item) =>
        item.location.toLowerCase().includes(text.toLowerCase()) ||
        item.title.toLowerCase().includes(text.toLowerCase())
    );

    setMatchedTravelServices(matchingObjects);
  };

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(event.target.value);
    setPage(0);
  };

  const handleOpenModal = () => {
    reset();
    setOpenModal(true);
  };

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
      pricePerChild: 0,
      extraAdultPrice: 0,
      transportType: "",
      pickupFromHotel: false,
      dropToAirport: false,
    });
    setItinerary([]);
    setHotelsIncluded([]);
    setSights([]);
    setSpecialRates({
      seasonalPricing: { enabled: false, note: "" },
      earlyBirdDiscount: { enabled: false, discountPercent: 0, description: "" }
    });
    setCoverPhotoURL("");
    setArrayData({
      amenities: [],
      hotels: [],
      included: [],
      pictures: [],
      places: [],
    });
    setOpenModal(true);
    setCurrentStep(1);
  };

  const handleAddTravelService = async (data) => {
    const { title, price, description, discount, location, period } = data;
    if (!coverPhotoURL) {
      return alert("Please provide cover image");
    }
    if (arrayData?.amenities?.length < 3) {
      return alert("Please provide at least 3 amenities");
    }
    if (arrayData?.pictures?.length < 3) {
      return alert("Please provide at least 3 pictures");
    }
    if (
      confirm(
        `Are you sure to ${packageDetails?.title ? "update" : "add"
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

      const baseStruct = getEmptySightseeingPackage();

      const travelDetails = {
        ...baseStruct,
        ...travelInfo,
        packageId: id,
        packageName: title,
        about: description,
        startingPrice: parseFloat(price),
        currency: "THB",
        duration: {
          days: parseFloat(period),
          nights: parseFloat(period) - 1 > 0 ? parseFloat(period) - 1 : 0
        },
        thumbnailImage: coverPhotoURL,

        highlights: arrayData?.amenities || [],
        amenities: arrayData?.amenities || [],
        included: arrayData?.included || [],
        packageImages: arrayData?.pictures || [],
        pictures: arrayData?.pictures || [],

        // Use new rich data states if populated, else fallback to legacy mapping
        itinerary: itinerary.length > 0 ? itinerary : baseStruct.itinerary,
        hotelsIncluded: hotelsIncluded.length > 0 ? hotelsIncluded : (arrayData?.hotels?.map(h => ({
          hotelId: uuid(),
          hotelName: h,
          nights: 1,
          roomType: "Standard",
          location: location,
          images: [],
          amenities: []
        })) || []),
        hotels: arrayData?.hotels || [],

        sights: sights.length > 0 ? sights : (arrayData?.places?.map(s => ({
          sightId: uuid(),
          title: s,
          description: "",
          images: [],
          location: { latitude: 0, longitude: 0 }
        })) || []),
        places: arrayData?.places || [],

        specialRates: specialRates,

        pricingStructure: {
          pricePerAdult: parseFloat(price),
          pricePerChild: parseFloat(data.pricePerChild || 0),
          extraAdultPrice: parseFloat(data.extraAdultPrice || 0)
        },

        transportType: data.transportType || "",
        pickupDropDetails: {
          pickupFromHotel: packageDetails.pickupFromHotel,
          dropToAirport: packageDetails.dropToAirport,
          availablePickupTimes: [],
          availableDropTimes: []
        },

        rating: { average: 5, totalReviews: 0 },
      };

      await setDoc(doc(travelServicesCollection, id), travelInfo);

      await setDoc(
        doc(collection(db, "sightseeingPackagesDetails"), id),
        travelDetails,
        { merge: true }
      ).then(() => reset());

      setPackageDetails({
        id: "",
        title: "",
        price: 0,
        description: "",
        discount: 0,
        location: "",
        period: 0,
        pricePerChild: 0,
        extraAdultPrice: 0,
        transportType: "",
        pickupFromHotel: false,
        dropToAirport: false,
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
        `The Package is ${packageDetails?.title ? "updated" : "Added"
        } successfully`
      );
      setOpenModal(false);
      setRefetch((p) => !p);
    }
  };

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
        pricePerChild: existingData?.pricingStructure?.pricePerChild || 0,
        extraAdultPrice: existingData?.pricingStructure?.extraAdultPrice || 0,
        transportType: existingData?.transportType || "",
        pickupFromHotel: existingData?.pickupDropDetails?.pickupFromHotel || false,
        dropToAirport: existingData?.pickupDropDetails?.dropToAirport || false,
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
      setItinerary(existingData?.itinerary || []);
      setHotelsIncluded(existingData?.hotelsIncluded || []);
      setSights(existingData?.sights || []);
      setSpecialRates(existingData?.specialRates || {
        seasonalPricing: { enabled: false, note: "" },
        earlyBirdDiscount: { enabled: false, discountPercent: 0, description: "" }
      });
    }
    setCurrentStep(1);
    setOpenModal(true);
  };

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

  const handleAddHotels = () => {
    const element = hotelsRef.current.querySelector("input");
    if (!element.value) return;
    const newHotels = [...arrayData.hotels, element.value];
    setArrayData((p) => ({ ...p, hotels: newHotels }));
    element.value = "";
  };

  const handleRemoveHotels = (i) => {
    const { amenity } = arrayData; // unused variable from original logic
    const newHotels = arrayData.hotels
      .slice(0, i)
      .concat(arrayData.hotels.slice(i + 1));
    setArrayData((p) => ({ ...p, hotels: newHotels }));
  };

  const handleAddAmenities = () => {
    const element = amenitiesRef.current.querySelector("input");
    if (!element.value) return;
    const newAmenities = [...arrayData.amenities, element.value];
    setArrayData((p) => ({ ...p, amenities: newAmenities }));
    element.value = "";
  };

  const handleRemoveAmenity = (i) => {
    const newAmenities = arrayData.amenities
      .slice(0, i)
      .concat(arrayData.amenities.slice(i + 1));
    setArrayData((p) => ({ ...p, amenities: newAmenities }));
  };

  const handleAddInclude = () => {
    const element = includedRef.current.querySelector("input");
    if (!element.value) return;
    const newAmenities = [...arrayData.included, element.value];
    setArrayData((p) => ({ ...p, included: newAmenities }));
    element.value = "";
  };

  const handleRemoveInclude = (i) => {
    const newIncluded = arrayData.included
      .slice(0, i)
      .concat(arrayData.included.slice(i + 1));
    setArrayData((p) => ({ ...p, included: newIncluded }));
  };

  const handleUploadCoverPhoto = async (e) => {
    const file = e.target.files[0];
    const fileRef = ref(storage, `${file.lastModified}-coverPhoto`);
    const coverPhotoTask = await uploadBytesResumable(fileRef, file);
    const photoURL = await getDownloadURL(coverPhotoTask.ref);
    if (photoURL) setCoverPhotoURL(photoURL);
  };

  const handleUploadPictures = async (e) => {
    let file = e.target.files[0];
    const imageRef = ref(storage, `${file.lastModified}-placePhoto`);
    const imageTask = await uploadBytesResumable(imageRef, file);
    const imageURL = await getDownloadURL(imageTask.ref);
    if (imageURL) {
      setArrayData((p) => ({
        ...p,
        pictures: [...arrayData.pictures, imageURL],
      }));
    }
  };

  const handleRemovePicture = (i) => {
    const newPictures = arrayData.pictures
      .slice(0, i)
      .concat(arrayData.pictures.slice(i + 1));
    setArrayData((p) => ({ ...p, pictures: newPictures }));
  };

  const handleAddPlace = () => {
    const element = placesRef.current.querySelector("input");
    if (!element.value) return;
    const newPlace = [...arrayData.places, element.value];
    setArrayData((p) => ({ ...p, places: newPlace }));
    element.value = "";
  };

  const handleRemovePlace = (i) => {
    const newPlaces = arrayData.places.slice(0, i).concat(arrayData.places.slice(i + 1));
    setArrayData((p) => ({ ...p, places: newPlaces }));
  };

  const textField = (label, name, placeholder, defaultValue) => {
    return (
      <Grid item xs={12} sm={name === "description" ? 12 : 6}>
        <TextField
          label={label}
          type={
            ["price", "discount", "period", "pricePerChild", "extraAdultPrice"].includes(name) ? "number" : "text"
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
          required={!["pricePerChild", "extraAdultPrice", "transportType"].includes(name)}
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
          {...register(name, { required: !["pricePerChild", "extraAdultPrice", "transportType"].includes(name) })}
        />
        {errors?.[name] && (
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
      </div >

      <div className="flex gap-4 items-center justify-between">
        <div className="flex-grow">
          <SearchBar
            handleSearch={handleSearch}
            handleOpenModal={handleOpenModal}
            btnTitle="Add New Package"
          />
        </div>
      </div>

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
      </div >

      <div className="flex gap-4 items-center justify-between">
        <div className="flex-grow">
          <SearchBar
            handleSearch={handleSearch}
            handleOpenModal={handleOpenModal}
            btnTitle="Add New Package"
          />
        </div>
      </div>

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

      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        aria-labelledby="responsive-dialog-title"
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "16px",
            backgroundImage: "none"
          }
        }}
      >
        <Box component="form" onSubmit={handleSubmit(handleAddTravelService)}>
          <DialogTitle sx={{ m: 0, p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb' }} id="customized-dialog-title">
            <div>
              <Typography variant="h5" component="div" fontWeight="bold" color="primary">
                {packageDetails?.title ? "Edit Package" : "Create New Package"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {currentStep === 1 && "Start with the basics"}
                {currentStep === 2 && "Add detailed itinerary & content"}
                {currentStep === 3 && "Configure pricing & logistics"}
              </Typography>
            </div>
            <IconButton
              aria-label="close"
              onClick={handleCloseModal}
              sx={{
                color: (theme) => theme.palette.grey[500],
                backgroundColor: 'white',
                '&:hover': { backgroundColor: '#f3f4f6' }
              }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent dividers sx={{ p: { xs: 2, md: 4 } }}>

            {/* Visual Stepper */}
            <div className="mb-8">
              <div className="flex items-center justify-between relative z-10">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex flex-col items-center flex-1 cursor-pointer" onClick={() => step < currentStep ? setCurrentStep(step) : null}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg mb-2 transition-all duration-300 border-2 
                            ${currentStep >= step ? 'bg-primary-600 text-white border-primary-600 shadow-md' : 'bg-white text-gray-400 border-gray-200'}`}>
                      {step}
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${currentStep >= step ? 'text-primary-800' : 'text-gray-400'}`}>
                      {step === 1 ? "Basics" : step === 2 ? "Details" : "Settings"}
                    </span>
                  </div>
                ))}

                {/* Connecting Lines */}
                <div className="absolute top-5 left-0 w-full h-[2px] bg-gray-200 -z-10 transform -translate-y-1/2 px-16">
                  <div
                    className="h-full bg-primary-200 transition-all duration-500 ease-out"
                    style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <Grid container spacing={4}>

              {/* STEP 1: BASIC INFORMATION */}
              {currentStep === 1 && (
                <div className="w-full animate-fade-in space-y-6">
                  <Grid container spacing={3}>
                    {textField("Package Title", "title", "e.g., Grand Thailand Tour", packageDetails?.title)}
                    {textField("Duration (Days)", "period", "e.g., 5", packageDetails?.period)}
                    {textField("Location", "location", "e.g., Bangkok", packageDetails?.location)}
                    {textField("Base Price (Adult)", "price", "0", packageDetails?.price)}

                    <Grid item xs={12}>
                      <TextField
                        label="Short Description"
                        multiline
                        rows={3}
                        fullWidth
                        {...register("description", { required: true })}
                        defaultValue={packageDetails?.description}
                        placeholder="A brief overview of the package..."
                      />
                    </Grid>

                    {/* Visuals Section */}
                    <Grid item xs={12}>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" sx={{ mb: 2 }}>Media Assets</Typography>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-600">Cover Image</label>
                            <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-4 hover:bg-gray-50 transition-colors text-center cursor-pointer min-h-[120px] flex flex-col items-center justify-center">
                              <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleUploadCoverPhoto} />
                              {coverPhotoURL ? (
                                <img src={coverPhotoURL} alt="Cover" className="h-24 w-auto rounded object-cover shadow-sm" />
                              ) : (
                                <div className="text-gray-400 flex flex-col items-center">
                                  <span className="text-3xl mb-1">🖼️</span>
                                  <span className="text-xs">Click to upload cover</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-600">Gallery ({arrayData.pictures.length})</label>
                            <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-4 hover:bg-gray-50 transition-colors text-center cursor-pointer min-h-[120px] flex flex-col items-center justify-center">
                              <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleUploadPictures} />
                              <div className="text-gray-400 flex flex-col items-center">
                                <span className="text-3xl mb-1">📸</span>
                                <span className="text-xs">Click to add photos</span>
                              </div>
                            </div>
                            <div className="flex gap-2 overflow-x-auto py-2">
                              {arrayData.pictures.map((pic, i) => (
                                <div key={i} className="relative flex-shrink-0">
                                  <img src={pic} className="h-12 w-12 rounded object-cover border" alt="gallery" />
                                  <div className="absolute -top-1 -right-1 bg-red-500 rounded-full cursor-pointer p-0.5" onClick={() => handleRemovePicture(i)}>
                                    <CloseIcon sx={{ fontSize: 10, color: 'white' }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Grid>
                  </Grid>
                </div>
              )}

              {/* STEP 2: RICH DETAILS */}
              {currentStep === 2 && (
                <div className="w-full animate-fade-in space-y-6">

                  {/* Itinerary */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                      <div>
                        <Typography variant="subtitle1" fontWeight="bold">📅 Daily Itinerary</Typography>
                        <Typography variant="caption" color="text.secondary">Plan the trip day by day</Typography>
                      </div>
                      <Button size="small" variant="contained" startIcon={<AddCircleIcon />} onClick={addItineraryDay} sx={{ borderRadius: 20, textTransform: 'none' }}>Add Day</Button>
                    </div>
                    <div className="p-4 bg-white min-h-[200px] max-h-[400px] overflow-y-auto space-y-4">
                      {itinerary.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-gray-400 opacity-60">
                          <span className="text-4xl mb-2">🗓️</span>
                          <p className="text-sm">No itinerary days added yet. Click "Add Day" to start.</p>
                        </div>
                      ) : (
                        itinerary.map((day, dIndex) => (
                          <div key={dIndex} className="border border-gray-100 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow relative bg-white">
                            <div className="absolute top-4 right-4 text-gray-300 hover:text-red-500 cursor-pointer" onClick={() => {
                              const newItin = itinerary.filter((_, i) => i !== dIndex);
                              setItinerary(newItin);
                            }}>
                              <DeleteButton />
                            </div>

                            <div className="flex items-center gap-3 mb-3">
                              <div className="bg-primary-50 text-primary-700 w-16 text-center py-1 rounded font-bold text-xs ring-1 ring-primary-100">
                                Day {day.day}
                              </div>
                              <TextField
                                placeholder="Day Title (e.g. Arrival in Bangkok)"
                                variant="standard"
                                fullWidth
                                value={day.title}
                                onChange={(e) => updateItineraryDay(dIndex, 'title', e.target.value)}
                                InputProps={{ disableUnderline: true, style: { fontWeight: 600, fontSize: '1.1rem' } }}
                              />
                            </div>

                            <div className="pl-6 border-l-2 border-dashed border-gray-200 ml-3 space-y-2">
                              {day.timeline.map((event, tIndex) => (
                                <div key={tIndex} className="flex gap-2 items-center group">
                                  <div className="w-2 h-2 rounded-full bg-primary-300"></div>
                                  <TextField placeholder="09:00" size="small" sx={{ width: 80, "& .MuiOutlinedInput-root": { backgroundColor: '#f9fafb' } }} value={event.time} onChange={(e) => updateTimelineEvent(dIndex, tIndex, 'time', e.target.value)} />
                                  <TextField placeholder="Activity description" size="small" fullWidth sx={{ "& .MuiOutlinedInput-root": { backgroundColor: '#f9fafb' } }} value={event.activity} onChange={(e) => updateTimelineEvent(dIndex, tIndex, 'activity', e.target.value)} />
                                </div>
                              ))}
                              <Button size="small" startIcon={<AddCircleIcon />} onClick={() => addTimelineEvent(dIndex)} sx={{ mt: 1, textTransform: 'none', color: 'gray' }}>Add Activity</Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Highlights & Amenities */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-gray-200 rounded-xl p-4 bg-white">
                      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>✨ Highlights</Typography>
                      <div className="flex gap-2 mb-2">
                        <TextField ref={amenitiesRef} size="small" placeholder="Add highlight..." fullWidth onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddAmenities())} />
                        <Button variant="contained" size="small" onClick={handleAddAmenities} sx={{ minWidth: '40px' }}>+</Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 min-h-[50px]">
                        {arrayData.amenities.map((item, i) => (
                          <Chip key={i} label={item} size="small" onDelete={() => handleRemoveAmenity(i)} className="bg-primary-50 text-primary-700" />
                        ))}
                        {arrayData.amenities.length === 0 && <span className="text-xs text-gray-400 italic mt-2">No highlights added.</span>}
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-xl p-4 bg-white">
                      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>✅ Included</Typography>
                      <div className="flex gap-2 mb-2">
                        <TextField ref={includedRef} size="small" placeholder="Add included item..." fullWidth onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddInclude())} />
                        <Button variant="contained" size="small" onClick={handleAddInclude} sx={{ minWidth: '40px' }}>+</Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 min-h-[50px]">
                        {arrayData.included.map((item, i) => (
                          <Chip key={i} label={item} size="small" onDelete={() => handleRemoveInclude(i)} className="bg-success-50 text-success-700" />
                        ))}
                        {arrayData.included.length === 0 && <span className="text-xs text-gray-400 italic mt-2">No inclusions added.</span>}
                      </div>
                    </div>
                  </div>

                  {/* Places */}
                  <div className="border border-gray-200 rounded-xl p-4 bg-white">
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>📍 Places / Sights</Typography>
                    <div className="flex gap-2 mb-2">
                      <TextField ref={placesRef} size="small" placeholder="Add place name..." fullWidth onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPlace())} />
                      <Button variant="contained" size="small" onClick={handleAddPlace}>Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {arrayData.places.map((item, i) => (
                        <Chip key={i} label={item} onDelete={() => handleRemovePlace(i)} variant="outlined" />
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* STEP 3: CONFIGURATION */}
              {currentStep === 3 && (
                <div className="w-full animate-fade-in space-y-6">

                  {/* Advanced Pricing */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <Typography variant="h6" className="text-gray-800 font-bold mb-4 flex items-center gap-2">💰 Pricing & Discounts</Typography>
                    <Grid container spacing={3}>
                      {textField("Child Price", "pricePerChild", "Cost per child", packageDetails?.pricePerChild)}
                      {textField("Extra Adult", "extraAdultPrice", "Cost per extra adult", packageDetails?.extraAdultPrice)}
                      {textField("Discount (%)", "discount", "Global discount %", packageDetails?.discount)}

                      <Grid item xs={12}>
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                          <FormControlLabel control={<Checkbox checked={specialRates.earlyBirdDiscount.enabled} onChange={(e) => setSpecialRates({ ...specialRates, earlyBirdDiscount: { ...specialRates.earlyBirdDiscount, enabled: e.target.checked } })} />} label={<span className="font-bold text-gray-700">Early Bird Discount</span>} />
                          {specialRates.earlyBirdDiscount.enabled && (
                            <div className="flex gap-3 mt-2 pl-8">
                              <TextField label="%" size="small" type="number" sx={{ width: 100, bgcolor: 'white' }} value={specialRates.earlyBirdDiscount.discountPercent} onChange={(e) => setSpecialRates({ ...specialRates, earlyBirdDiscount: { ...specialRates.earlyBirdDiscount, discountPercent: parseFloat(e.target.value) } })} />
                              <TextField label="Condition Description" size="small" fullWidth sx={{ bgcolor: 'white' }} value={specialRates.earlyBirdDiscount.description} onChange={(e) => setSpecialRates({ ...specialRates, earlyBirdDiscount: { ...specialRates.earlyBirdDiscount, description: e.target.value } })} />
                            </div>
                          )}
                        </div>
                      </Grid>
                    </Grid>
                  </div>

                  {/* Logistics */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <Typography variant="h6" className="text-gray-800 font-bold mb-4">🚐 Logistics & Transport</Typography>
                    <Grid container spacing={3}>
                      {textField("Transport Type", "transportType", "e.g. AC Bus, Private Van", packageDetails?.transportType)}
                      <Grid item xs={12}>
                        <div className="flex gap-6">
                          <FormControlLabel control={<Checkbox checked={packageDetails.pickupFromHotel} onChange={(e) => setPackageDetails({ ...packageDetails, pickupFromHotel: e.target.checked })} />} label="Pickup from Hotel" />
                          <FormControlLabel control={<Checkbox checked={packageDetails.dropToAirport} onChange={(e) => setPackageDetails({ ...packageDetails, dropToAirport: e.target.checked })} />} label="Drop to Airport" />
                        </div>
                      </Grid>
                    </Grid>
                  </div>

                  {/* Hotels Selection */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <Typography variant="h6" className="text-gray-800 font-bold">🏨 Associated Hotels</Typography>
                      <Button size="small" variant="outlined" startIcon={<AddCircleIcon />} onClick={addHotel} sx={{ borderRadius: 20 }}>Add Hotel</Button>
                    </div>
                    <div className="space-y-3">
                      {hotelsIncluded.length === 0 && <p className="text-sm text-gray-400 italic text-center py-4">No hotels linked to this package.</p>}
                      {hotelsIncluded.map((hotel, index) => (
                        <div key={index} className="border border-gray-100 rounded-lg p-3 relative hover:bg-gray-50 transition-colors">
                          <div className="absolute top-2 right-2 cursor-pointer text-gray-300 hover:text-red-500" onClick={() => setHotelsIncluded(hotelsIncluded.filter((_, i) => i !== index))}>
                            <CloseIcon fontSize="small" />
                          </div>
                          <Grid container spacing={2} alignItems="center">
                            <Grid item xs={6}><TextField label="Hotel Name" variant="standard" fullWidth value={hotel.hotelName} onChange={(e) => updateHotel(index, 'hotelName', e.target.value)} /></Grid>
                            <Grid item xs={3}><TextField label="Nights" type="number" variant="standard" fullWidth value={hotel.nights} onChange={(e) => updateHotel(index, 'nights', parseInt(e.target.value))} /></Grid>
                            <Grid item xs={3}><TextField label="Room Type" variant="standard" fullWidth value={hotel.roomType} onChange={(e) => updateHotel(index, 'roomType', e.target.value)} /></Grid>
                          </Grid>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </Grid>
          </DialogContent>

          <DialogActions sx={{ p: 3, backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb', justifyContent: 'space-between' }}>
            <Button
              onClick={currentStep === 1 ? handleCloseModal : handleBackStep}
              color="inherit"
              sx={{ color: 'text.secondary', fontWeight: 'bold' }}
            >
              {currentStep === 1 ? "Cancel" : "Back"}
            </Button>

            {currentStep < 3 ? (
              <Button
                onClick={handleNextStep}
                variant="contained"
                sx={{
                  borderRadius: '8px',
                  px: 4,
                  py: 1,
                  backgroundColor: "var(--primary-color)",
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                }}>
                Next Step
              </Button>
            ) : (
              <Button
                variant="contained"
                type="submit"
                sx={{
                  borderRadius: '8px',
                  px: 4,
                  py: 1,
                  backgroundColor: "var(--success-color)", // Using success color for final action
                  color: "white",
                  "&:hover": {
                    filter: 'brightness(110%)'
                  },
                }}
              >
                {packageDetails?.title ? "Update Package" : "Publish Package"}
              </Button>
            )}
          </DialogActions>
        </Box>
      </Dialog>
    </div>
  );
};

export default TravelServices;
