import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Box,
    Button,
    Grid,
    TextField,
    Typography,
    IconButton,
    Chip,
    FormControlLabel,
    Checkbox,
    Paper,
} from "@mui/material";
import {
    AddCircle as AddCircleIcon,
    Close as CloseIcon,
    Save as SaveIcon,
    ArrowBack as ArrowBackIcon,
    AutoFixHigh as AutoFixHighIcon,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import { useForm } from "react-hook-form";
import { v4 as uuid } from "uuid";
import { sightseeingDummyData } from "../../../../../utils/sightseeingDummyData";
import {
    doc,
    setDoc,
    getDoc,
    collection,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage, travelServicesCollection } from "../../../../../firebase/firebase.config";
import { successNotification } from "../../../../../utils/utils";
import { getEmptySightseeingPackage } from "../../../../../utils/sightseeingTransformation";
import PageHeading from "../../../../../components/PageHeading";
import DeleteButton from "../../../../../components/DeleteButton";

const FadeIn = ({ children, delay = 0 }) => (
    <div
        className="animate-fadeIn"
        style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
        <style>{`
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-fadeIn {
                animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
        `}</style>
        {children}
    </div>
);

const ProgressBar = ({ currentStep, totalSteps }) => {
    const progress = (currentStep / totalSteps) * 100;

    return (
        <div className="w-full max-w-5xl mx-auto mb-8 animate-fade-in">
            <div className="flex justify-between mb-2 px-1">
                <span className={`text-sm font-bold transition-colors duration-300 ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>1. Basics</span>
                <span className={`text-sm font-bold transition-colors duration-300 ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>2. Details</span>
                <span className={`text-sm font-bold transition-colors duration-300 ${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>3. Settings</span>
            </div>
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden shadow-inner">
                <div
                    className="h-full bg-blue-600 transition-all duration-500 ease-out relative overflow-hidden"
                    style={{ width: `${progress}%` }}
                >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
            </div>
        </div>
    );
};

const AddSightseeingPackage = () => {
    const navigate = useNavigate();
    const { packageId } = useParams();
    const isEdit = !!packageId;

    // Multi-step Wizard State
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 3;

    const handleNextStep = () => setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    const handleBackStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

    const [coverPhotoURL, setCoverPhotoURL] = useState("");
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
        excluded: [],
        pictures: [],
        places: [],
    });

    const amenitiesRef = useRef();
    const hotelsRef = useRef();
    const placesRef = useRef();
    const includedRef = useRef();
    const excludedRef = useRef();

    const [itinerary, setItinerary] = useState([]);
    const [hotelsIncluded, setHotelsIncluded] = useState([]);
    const [sights, setSights] = useState([]);
    const [specialRates, setSpecialRates] = useState({
        seasonalPricing: { enabled: false, note: "" },
        earlyBirdDiscount: { enabled: false, discountPercent: 0, description: "" }
    });

    const {
        handleSubmit,
        reset,
        register,
        formState: { errors },
        setValue,
    } = useForm();

    // Load data for edit mode
    useEffect(() => {
        const fetchPackageData = async () => {
            if (!isEdit) return;

            try {
                const snapshot = await getDoc(doc(collection(db, "sightseeingPackagesDetails"), packageId));
                if (snapshot.exists()) {
                    const existingData = snapshot.data();

                    setPackageDetails({
                        id: existingData.id || existingData.packageId,
                        title: existingData.title || existingData.packageName,
                        price: existingData.price || existingData.startingPrice,
                        description: existingData.description || existingData.about,
                        discount: existingData.discount || 0,
                        location: existingData.location || "",
                        period: existingData.period || existingData.duration?.days || 0,
                        timestamp: existingData.timestamp,
                        pricePerChild: existingData?.pricingStructure?.pricePerChild || 0,
                        extraAdultPrice: existingData?.pricingStructure?.extraAdultPrice || 0,
                        transportType: existingData?.transportType || "",
                        pickupFromHotel: existingData?.pickupDropDetails?.pickupFromHotel || false,
                        dropToAirport: existingData?.pickupDropDetails?.dropToAirport || false,
                    });

                    // Set form values for react-hook-form
                    setValue("title", existingData.title || existingData.packageName);
                    setValue("description", existingData.description || existingData.about);
                    setValue("price", existingData.price || existingData.startingPrice);
                    setValue("period", existingData.period || existingData.duration?.days);
                    setValue("location", existingData.location);
                    setValue("discount", existingData.discount);
                    setValue("pricePerChild", existingData?.pricingStructure?.pricePerChild);
                    setValue("extraAdultPrice", existingData?.pricingStructure?.extraAdultPrice);
                    setValue("transportType", existingData?.transportType);

                    setCoverPhotoURL(existingData.coverPhoto || existingData.thumbnailImage);

                    setArrayData({
                        amenities: existingData.amenities || [],
                        hotels: existingData.hotels || [],
                        included: existingData.included || [],
                        excluded: existingData.excluded || [],
                        pictures: existingData.pictures || existingData.packageImages || [],
                        places: existingData.places || [],
                    });

                    setItinerary(existingData.itinerary || []);
                    setHotelsIncluded(existingData.hotelsIncluded || []);
                    setSights(existingData.sights || []);
                    setSpecialRates(existingData.specialRates || {
                        seasonalPricing: { enabled: false, note: "" },
                        earlyBirdDiscount: { enabled: false, discountPercent: 0, description: "" }
                    });
                }
            } catch (error) {
                console.error("Error fetching package details:", error);
            }
        };

        fetchPackageData();
    }, [isEdit, packageId, setValue]);

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

    const handleAddAmenities = () => {
        const element = amenitiesRef.current.querySelector("input");
        if (!element.value) return;
        const newAmenities = [...arrayData.amenities, element.value];
        setArrayData((p) => ({ ...p, amenities: newAmenities }));
        element.value = "";
    };

    const handleRemoveAmenity = (i) => {
        const newAmenities = arrayData.amenities.slice(0, i).concat(arrayData.amenities.slice(i + 1));
        setArrayData((p) => ({ ...p, amenities: newAmenities }));
    };

    const handleAddInclude = () => {
        const element = includedRef.current.querySelector("input");
        if (!element.value) return;
        const newIncluded = [...arrayData.included, element.value];
        setArrayData((p) => ({ ...p, included: newIncluded }));
        element.value = "";
    };

    const handleRemoveInclude = (i) => {
        const newIncluded = arrayData.included.slice(0, i).concat(arrayData.included.slice(i + 1));
        setArrayData((p) => ({ ...p, included: newIncluded }));
    };

    const handleAddExclude = () => {
        const element = excludedRef.current.querySelector("input");
        if (!element.value) return;
        const newExcluded = [...arrayData.excluded, element.value];
        setArrayData((p) => ({ ...p, excluded: newExcluded }));
        element.value = "";
    };

    const handleRemoveExclude = (i) => {
        const newExcluded = arrayData.excluded.slice(0, i).concat(arrayData.excluded.slice(i + 1));
        setArrayData((p) => ({ ...p, excluded: newExcluded }));
    };

    const handleAutofill = () => {
        const randomPackage = sightseeingDummyData[Math.floor(Math.random() * sightseeingDummyData.length)];

        setValue("title", randomPackage.packageName);
        setValue("description", randomPackage.about);
        setValue("price", randomPackage.startingPrice);
        setValue("period", randomPackage.duration.days);
        setValue("location", randomPackage.location);
        setValue("discount", 0);
        setValue("pricePerChild", randomPackage.pricingStructure.pricePerChild);
        setValue("extraAdultPrice", randomPackage.pricingStructure.extraAdultPrice);
        setValue("transportType", randomPackage.transportType);

        setPackageDetails({
            id: "",
            title: randomPackage.packageName,
            price: randomPackage.startingPrice,
            description: randomPackage.about,
            discount: 0,
            location: randomPackage.location,
            period: randomPackage.duration.days,
            pricePerChild: randomPackage.pricingStructure.pricePerChild,
            extraAdultPrice: randomPackage.pricingStructure.extraAdultPrice,
            transportType: randomPackage.transportType,
            pickupFromHotel: randomPackage.pickupDropDetails.pickupFromHotel,
            dropToAirport: randomPackage.pickupDropDetails.dropToAirport,
        });

        setCoverPhotoURL(randomPackage.thumbnailImage);

        setArrayData({
            amenities: randomPackage.highlights,
            hotels: [],
            included: randomPackage.included,
            excluded: randomPackage.excluded,
            pictures: randomPackage.packageImages,
            places: randomPackage.sights.map(s => s.title),
        });

        setItinerary(randomPackage.itinerary);
        setHotelsIncluded(randomPackage.hotelsIncluded);
        setSights(randomPackage.sights);
        setSpecialRates(randomPackage.specialRates);

        toast.success("Form autofilled with dummy data!");
    };

    const handleUploadCoverPhoto = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fileRef = ref(storage, `${file.lastModified}-coverPhoto`);
        const coverPhotoTask = await uploadBytesResumable(fileRef, file);
        const photoURL = await getDownloadURL(coverPhotoTask.ref);
        if (photoURL) setCoverPhotoURL(photoURL);
    };

    const handleUploadPictures = async (e) => {
        let file = e.target.files[0];
        if (!file) return;
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
        const newPictures = arrayData.pictures.slice(0, i).concat(arrayData.pictures.slice(i + 1));
        setArrayData((p) => ({ ...p, pictures: newPictures }));
    };

    const handleSavePackage = async (data) => {
        const { title, price, description, discount, location, period } = data;

        if (!coverPhotoURL) {
            return toast.error("Please upload a cover image");
        }
        if (arrayData?.amenities?.length < 1) {
            return toast.error("Please provide at least 1 amenity");
        }

        const id = isEdit ? packageId : uuid();
        const timestamp = isEdit && packageDetails.timestamp ? packageDetails.timestamp : new Date();

        const travelInfo = {
            id,
            title,
            description,
            price: parseFloat(price),
            discount: parseFloat(discount || 0),
            location,
            period: parseFloat(period),
            coverPhoto: coverPhotoURL,
            timestamp,
            images: arrayData?.pictures || [],
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
            excluded: arrayData?.excluded || [],
            packageImages: arrayData?.pictures || [],
            pictures: arrayData?.pictures || [],

            itinerary: itinerary.length > 0 ? itinerary : baseStruct.itinerary,
            hotelsIncluded: hotelsIncluded,
            hotels: hotelsIncluded || [],

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

        try {
            await setDoc(doc(travelServicesCollection, id), travelInfo);
            await setDoc(doc(collection(db, "sightseeingPackagesDetails"), id), travelDetails, { merge: true });

            successNotification(`The Package is ${isEdit ? "updated" : "added"} successfully`);
            navigate("/dashboard/travel-services");
        } catch (error) {
            console.error("Error saving package:", error);
            alert("Failed to save package");
        }
    };

    const textField = (label, name, placeholder, defaultValue) => {
        return (
            <Grid item xs={12} sm={name === "description" ? 12 : 6}>
                <TextField
                    label={label}
                    type={["price", "discount", "period", "pricePerChild", "extraAdultPrice"].includes(name) ? "number" : "text"}
                    onWheel={(e) => e.target.blur()}
                    required={!["pricePerChild", "extraAdultPrice", "transportType", "discount"].includes(name)}
                    defaultValue={defaultValue || ""}
                    placeholder={placeholder}
                    multiline={name === "description"}
                    fullWidth
                    rows={name === "description" ? 3 : ""}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                    inputProps={{
                        min: name === "price" ? 1 : name === "discount" ? 0 : name === "period" ? 1 : undefined,
                        max: name === "discount" ? 100 : name === "period" ? 100 : undefined,
                    }}
                    {...register(name, { required: !["pricePerChild", "extraAdultPrice", "transportType", "discount"].includes(name) })}
                />
                {errors?.[name] && <span className="text-red-500">{label} is required</span>}
            </Grid>
        );
    };

    return (
        <div className="animate-fade-in pb-12">
            <div className="flex items-center gap-4 mb-6">
                <IconButton onClick={() => navigate("/dashboard/travel-services")} sx={{ bgcolor: 'white', boxShadow: 1 }}>
                    <ArrowBackIcon />
                </IconButton>
                <PageHeading
                    text={isEdit ? "Edit Sightseeing Package" : "Add New Sightseeing Package"}
                    subtitle={isEdit ? "Update existing package details" : "Create a new tour package"}
                />
            </div>

            <div className="max-w-5xl mx-auto">
                <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />

                <div className="absolute top-28 right-8 z-10">
                    {!isEdit && (
                        <Button
                            type="button"
                            variant="outlined"
                            startIcon={<AutoFixHighIcon />}
                            onClick={handleAutofill}
                            size="small"
                            sx={{
                                textTransform: 'none',
                                borderRadius: '12px',
                                bgcolor: 'white',
                                borderColor: '#e2e8f0',
                                color: '#64748b',
                                '&:hover': {
                                    borderColor: '#cbd5e1',
                                    bgcolor: '#f8fafc'
                                }
                            }}
                        >
                            Autofill Data
                        </Button>
                    )}
                </div>

                <Paper className="rounded-2xl shadow-xl border border-neutral-200 overflow-hidden bg-white/80 backdrop-blur-sm">
                    {/* Header removed as it's cleaner without the stepper header block */}

                    <Box component="form" onSubmit={handleSubmit(handleSavePackage)} className="p-6 md:p-8">
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
                                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                                                <Typography variant="subtitle1" fontWeight="bold" color="text.primary" sx={{ mb: 3 }}>Media Assets</Typography>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-3">
                                                        <label className="text-sm font-semibold text-gray-700">Cover Image</label>
                                                        <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-6 hover:bg-white transition-all text-center cursor-pointer min-h-[160px] flex flex-col items-center justify-center bg-gray-50/50">
                                                            <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleUploadCoverPhoto} />
                                                            {coverPhotoURL ? (
                                                                <img src={coverPhotoURL} alt="Cover" className="h-32 w-auto rounded-lg object-cover shadow-sm" />
                                                            ) : (
                                                                <div className="text-gray-400 flex flex-col items-center">
                                                                    <span className="text-4xl mb-2">🖼️</span>
                                                                    <span className="text-sm font-medium">Click to upload cover</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <label className="text-sm font-semibold text-gray-700">Gallery Images ({arrayData.pictures.length})</label>
                                                        <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-6 hover:bg-white transition-all text-center cursor-pointer min-h-[160px] flex flex-col items-center justify-center bg-gray-50/50">
                                                            <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleUploadPictures} />
                                                            <div className="text-gray-400 flex flex-col items-center">
                                                                <span className="text-4xl mb-2">📸</span>
                                                                <span className="text-sm font-medium">Click to add photos</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 overflow-x-auto py-2">
                                                            {arrayData.pictures.map((pic, i) => (
                                                                <div key={i} className="relative flex-shrink-0 group">
                                                                    <img src={pic} className="h-16 w-16 rounded-lg object-cover border shadow-sm" alt="gallery" />
                                                                    <div className="absolute -top-1 -right-1 bg-red-500 rounded-full cursor-pointer p-0.5 shadow-md hover:scale-110 transition-transform" onClick={(e) => { e.preventDefault(); handleRemovePicture(i); }}>
                                                                        <CloseIcon sx={{ fontSize: 12, color: 'white' }} />
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
                                <div className="w-full animate-fade-in space-y-8">

                                    {/* Itinerary */}
                                    <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                        <div className="bg-gray-50/80 p-5 border-b border-gray-200 flex justify-between items-center backdrop-blur-sm">
                                            <div>
                                                <Typography variant="h6" fontWeight="bold" className="flex items-center gap-2">📅 Daily Itinerary</Typography>
                                                <Typography variant="body2" color="text.secondary">Plan the trip structure day by day</Typography>
                                            </div>
                                            <Button variant="contained" startIcon={<AddCircleIcon />} onClick={addItineraryDay} sx={{ borderRadius: 20, textTransform: 'none', px: 3 }}>Add Day</Button>
                                        </div>
                                        <div className="p-6 bg-white min-h-[250px] space-y-6">
                                            {itinerary.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-12 text-gray-400 opacity-60 border-2 border-dashed border-gray-100 rounded-xl">
                                                    <span className="text-5xl mb-3">🗓️</span>
                                                    <p className="text-lg font-medium">No itinerary days added yet.</p>
                                                    <p className="text-sm">Click &quot;Add Day&quot; to start planning.</p>
                                                </div>
                                            ) : (
                                                itinerary.map((day, dIndex) => (
                                                    <div key={dIndex} className="border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow relative bg-white group">
                                                        <div className="absolute top-4 right-4 text-gray-300 group-hover:text-red-500 cursor-pointer transition-colors" onClick={() => {
                                                            const newItin = itinerary.filter((_, i) => i !== dIndex);
                                                            setItinerary(newItin);
                                                        }}>
                                                            <DeleteButton />
                                                        </div>

                                                        <div className="flex items-center gap-4 mb-6">
                                                            <div className="bg-primary-50 text-primary-700 w-20 text-center py-2 rounded-lg font-bold text-sm ring-1 ring-primary-200 shadow-sm">
                                                                Day {day.day}
                                                            </div>
                                                            <TextField
                                                                placeholder="Day Title (e.g. Arrival in Bangkok)"
                                                                variant="standard"
                                                                fullWidth
                                                                value={day.title}
                                                                onChange={(e) => updateItineraryDay(dIndex, 'title', e.target.value)}
                                                                InputProps={{ disableUnderline: true, style: { fontWeight: 700, fontSize: '1.25rem', color: '#1f2937' } }}
                                                            />
                                                        </div>

                                                        <div className="pl-8 border-l-2 border-dashed border-primary-100 ml-4 space-y-3">
                                                            {day.timeline.map((event, tIndex) => (
                                                                <div key={tIndex} className="flex gap-3 items-center group/item hover:bg-gray-50 p-2 rounded-lg -ml-2 transition-colors">
                                                                    <div className="w-2.5 h-2.5 rounded-full bg-primary-400 ring-4 ring-white shadow-sm"></div>
                                                                    <TextField placeholder="Time" size="small" sx={{ width: 100, "& .MuiOutlinedInput-root": { backgroundColor: 'white' } }} value={event.time} onChange={(e) => updateTimelineEvent(dIndex, tIndex, 'time', e.target.value)} />
                                                                    <TextField placeholder="Activity description" size="small" fullWidth sx={{ "& .MuiOutlinedInput-root": { backgroundColor: 'white' } }} value={event.activity} onChange={(e) => updateTimelineEvent(dIndex, tIndex, 'activity', e.target.value)} />
                                                                </div>
                                                            ))}
                                                            <Button size="small" startIcon={<AddCircleIcon />} onClick={() => addTimelineEvent(dIndex)} sx={{ mt: 2, ml: 2, textTransform: 'none' }}>Add Activity</Button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Highlights & Amenities */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm h-full">
                                            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>✨ Highlights</Typography>
                                            <div className="flex gap-2 mb-4">
                                                <TextField
                                                    ref={amenitiesRef}
                                                    size="small"
                                                    placeholder="Add highlight..."
                                                    fullWidth
                                                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddAmenities())}
                                                    sx={{
                                                        "& .MuiOutlinedInput-root": {
                                                            borderRadius: "999px",
                                                            backgroundColor: "#f3f4f6",
                                                            "& fieldset": { border: "none" },
                                                        }
                                                    }}
                                                />
                                                <Button
                                                    variant="contained"
                                                    onClick={handleAddAmenities}
                                                    sx={{
                                                        borderRadius: "999px",
                                                        minWidth: '50px',
                                                        boxShadow: 'none'
                                                    }}
                                                >
                                                    <AddCircleIcon />
                                                </Button>
                                            </div>
                                            <div className="flex flex-wrap gap-2 min-h-[80px] p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                {arrayData.amenities.map((item, i) => (
                                                    <Chip key={i} label={item} onDelete={() => handleRemoveAmenity(i)} className="bg-white border hover:shadow-sm" />
                                                ))}
                                                {arrayData.amenities.length === 0 && <span className="text-sm text-gray-400 italic w-full text-center my-auto">No highlights added yet.</span>}
                                            </div>
                                        </div>

                                        <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm h-full">
                                            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>✅ Included</Typography>
                                            <div className="flex gap-2 mb-4">
                                                <TextField
                                                    ref={includedRef}
                                                    size="small"
                                                    placeholder="Add included item..."
                                                    fullWidth
                                                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddInclude())}
                                                    sx={{
                                                        "& .MuiOutlinedInput-root": {
                                                            borderRadius: "999px",
                                                            backgroundColor: "#f3f4f6",
                                                            "& fieldset": { border: "none" },
                                                        }
                                                    }}
                                                />
                                                <Button
                                                    variant="contained"
                                                    onClick={handleAddInclude}
                                                    sx={{
                                                        borderRadius: "999px",
                                                        minWidth: '50px',
                                                        boxShadow: 'none'
                                                    }}
                                                >
                                                    <AddCircleIcon />
                                                </Button>
                                            </div>
                                            <div className="flex flex-wrap gap-2 min-h-[80px] p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                {arrayData.included.map((item, i) => (
                                                    <Chip key={i} label={item} onDelete={() => handleRemoveInclude(i)} className="bg-white border hover:shadow-sm" />
                                                ))}
                                                {arrayData.included.length === 0 && <span className="text-sm text-gray-400 italic w-full text-center my-auto">No inclusions added yet.</span>}
                                            </div>
                                        </div>

                                        <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm h-full">
                                            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>❌ Excluded</Typography>
                                            <div className="flex gap-2 mb-4">
                                                <TextField
                                                    ref={excludedRef}
                                                    size="small"
                                                    placeholder="Add excluded item..."
                                                    fullWidth
                                                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddExclude())}
                                                    sx={{
                                                        "& .MuiOutlinedInput-root": {
                                                            borderRadius: "999px",
                                                            backgroundColor: "#f3f4f6",
                                                            "& fieldset": { border: "none" },
                                                        }
                                                    }}
                                                />
                                                <Button
                                                    variant="contained"
                                                    color="error"
                                                    onClick={handleAddExclude}
                                                    sx={{
                                                        borderRadius: "999px",
                                                        minWidth: '50px',
                                                        boxShadow: 'none'
                                                    }}
                                                >
                                                    <AddCircleIcon />
                                                </Button>
                                            </div>
                                            <div className="flex flex-wrap gap-2 min-h-[80px] p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                {arrayData.excluded.map((item, i) => (
                                                    <Chip key={i} label={item} onDelete={() => handleRemoveExclude(i)} className="bg-white border hover:shadow-sm" />
                                                ))}
                                                {arrayData.excluded.length === 0 && <span className="text-sm text-gray-400 italic w-full text-center my-auto">No exclusions added yet.</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Places */}
                                    <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
                                        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>📍 Places / Sights</Typography>
                                        <div className="flex gap-2 mb-4">
                                            <TextField
                                                ref={placesRef}
                                                size="small"
                                                placeholder="Add place name..."
                                                fullWidth
                                                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPlace())}
                                                sx={{
                                                    "& .MuiOutlinedInput-root": {
                                                        borderRadius: "999px",
                                                        backgroundColor: "#f3f4f6",
                                                        "& fieldset": { border: "none" },
                                                    }
                                                }}
                                            />
                                            <Button
                                                variant="contained"
                                                onClick={handleAddPlace}
                                                sx={{
                                                    borderRadius: "999px",
                                                    minWidth: '80px',
                                                    boxShadow: 'none',
                                                    textTransform: 'none'
                                                }}
                                            >
                                                Add
                                            </Button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                            {arrayData.places.map((item, i) => (
                                                <Chip key={i} label={item} onDelete={() => handleRemovePlace(i)} variant="outlined" sx={{ bgcolor: 'white' }} />
                                            ))}
                                            {arrayData.places.length === 0 && <span className="text-sm text-gray-400 italic">No places added yet.</span>}
                                        </div>
                                    </div>

                                </div>
                            )}

                            {/* STEP 3: CONFIGURATION */}
                            {currentStep === 3 && (
                                <div className="w-full animate-fade-in space-y-8">

                                    {/* Advanced Pricing */}
                                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                        <Typography variant="h6" className="text-gray-800 font-bold mb-6 flex items-center gap-2">💰 Pricing & Discounts</Typography>
                                        <Grid container spacing={4}>
                                            {textField("Child Price", "pricePerChild", "Cost per child", packageDetails?.pricePerChild)}
                                            {textField("Extra Adult", "extraAdultPrice", "Cost per extra adult", packageDetails?.extraAdultPrice)}
                                            {textField("Discount (%)", "discount", "Global discount %", packageDetails?.discount)}

                                            <Grid item xs={12}>
                                                <div className="p-5 bg-yellow-50 rounded-xl border border-yellow-100">
                                                    <FormControlLabel control={<Checkbox checked={specialRates.earlyBirdDiscount.enabled} onChange={(e) => setSpecialRates({ ...specialRates, earlyBirdDiscount: { ...specialRates.earlyBirdDiscount, enabled: e.target.checked } })} />} label={<span className="font-bold text-gray-800">Enable Early Bird Discount</span>} />
                                                    {specialRates.earlyBirdDiscount.enabled && (
                                                        <div className="flex gap-4 mt-3 pl-8 animate-fade-in">
                                                            <TextField label="Discount %" size="small" type="number" sx={{ width: 120, "& .MuiOutlinedInput-root": { borderRadius: "12px", bgcolor: 'white' } }} value={specialRates.earlyBirdDiscount.discountPercent} onChange={(e) => setSpecialRates({ ...specialRates, earlyBirdDiscount: { ...specialRates.earlyBirdDiscount, discountPercent: parseFloat(e.target.value) } })} />
                                                            <TextField label="Condition Description" size="small" fullWidth sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px", bgcolor: 'white' } }} value={specialRates.earlyBirdDiscount.description} onChange={(e) => setSpecialRates({ ...specialRates, earlyBirdDiscount: { ...specialRates.earlyBirdDiscount, description: e.target.value } })} />
                                                        </div>
                                                    )}
                                                </div>
                                            </Grid>
                                        </Grid>
                                    </div>

                                    {/* Logistics */}
                                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                        <Typography variant="h6" className="text-gray-800 font-bold mb-6 flex items-center gap-2">🚐 Logistics & Transport</Typography>
                                        <Grid container spacing={4}>
                                            {textField("Transport Type", "transportType", "e.g. AC Bus, Private Van", packageDetails?.transportType)}
                                            <Grid item xs={12}>
                                                <div className="flex gap-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                                    <FormControlLabel control={<Checkbox checked={packageDetails.pickupFromHotel} onChange={(e) => setPackageDetails({ ...packageDetails, pickupFromHotel: e.target.checked })} />} label="Pickup from Hotel" />
                                                    <FormControlLabel control={<Checkbox checked={packageDetails.dropToAirport} onChange={(e) => setPackageDetails({ ...packageDetails, dropToAirport: e.target.checked })} />} label="Drop to Airport" />
                                                </div>
                                            </Grid>
                                        </Grid>
                                    </div>

                                    {/* Hotels Selection */}
                                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                        <div className="flex justify-between items-center mb-6">
                                            <Typography variant="h6" className="text-gray-800 font-bold flex items-center gap-2">🏨 Associated Hotels</Typography>
                                            <Button variant="outlined" startIcon={<AddCircleIcon />} onClick={addHotel}>Add Hotel</Button>
                                        </div>
                                        <div className="space-y-4">
                                            {hotelsIncluded.length === 0 && <p className="text-sm text-gray-400 italic text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">No hotels linked to this package.</p>}
                                            {hotelsIncluded.map((hotel, index) => (
                                                <div key={index} className="border border-gray-200 rounded-xl p-4 relative hover:bg-gray-50 transition-colors bg-white shadow-sm">
                                                    <div className="absolute top-2 right-2 cursor-pointer text-gray-300 hover:text-red-500" onClick={() => setHotelsIncluded(hotelsIncluded.filter((_, i) => i !== index))}>
                                                        <CloseIcon fontSize="small" />
                                                    </div>
                                                    <Grid container spacing={3} alignItems="center">
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

                        {/* Navigation Buttons */}
                        <div className="flex justify-between pt-8 mt-8 border-t border-gray-200">
                            <Button
                                onClick={currentStep === 1 ? () => navigate("/dashboard/travel-services") : handleBackStep}
                                variant="contained"
                                sx={{
                                    backgroundColor: "#e2e8f0",
                                    color: "#475569",
                                    textTransform: "none",
                                    fontWeight: 700,
                                    borderRadius: "12px",
                                    padding: "10px 24px",
                                    boxShadow: "none",
                                    "&:hover": { backgroundColor: "#cbd5e1", boxShadow: "none" }
                                }}
                            >
                                {currentStep === 1 ? "Cancel" : "Back"}
                            </Button>

                            {currentStep < 3 ? (
                                <Button
                                    onClick={handleNextStep}
                                    variant="contained"
                                    size="large"
                                    sx={{
                                        borderRadius: "24px",
                                        padding: "12px 32px",
                                        textTransform: "none",
                                        fontWeight: 700,
                                        fontSize: "1rem",
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                        // Removed undefined var primary-color
                                    }}
                                >
                                    Next Step
                                </Button>
                            ) : (
                                <Button
                                    variant="contained"
                                    type="submit"
                                    size="large"
                                    startIcon={<SaveIcon />}
                                    sx={{
                                        borderRadius: "24px",
                                        padding: "12px 32px",
                                        textTransform: "none",
                                        fontWeight: 700,
                                        fontSize: "1rem",
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                        // Removed undefined var success-color, let it default or use 'success' color prop
                                    }}
                                    color="success"
                                >
                                    {isEdit ? "Update Package" : "Publish Package"}
                                </Button>
                            )}
                        </div>
                    </Box>
                </Paper>
            </div>
        </div>
    );
};

export default AddSightseeingPackage;
