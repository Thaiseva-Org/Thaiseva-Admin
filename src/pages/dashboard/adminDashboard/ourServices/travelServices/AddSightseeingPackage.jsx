import ListingStatus from "../../../../../components/ListingStatus";
import { isListingActive, listingStatusFields } from "../../../../../utils/listing-status";
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
    Autocomplete,
    CircularProgress,
} from "@mui/material";
import { AddCircleIcon, CloseIcon, SaveIcon, ArrowBackIcon } from "@icons";
import { toast } from "react-toastify";
import { useForm } from "react-hook-form";
import { v4 as uuid } from "uuid";

import {
    doc,
    writeBatch,
    getDoc,
    getDocs,
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
        <div className="w-full max-w-5xl mx-auto animate-fade-in">
            <div className="flex justify-between mb-2 px-1">
                <span className={`text-sm font-bold transition-colors duration-300 ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>1. Basics</span>
                <span className={`text-sm font-bold transition-colors duration-300 ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>2. Details</span>
                <span className={`text-sm font-bold transition-colors duration-300 ${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>3. Configuration</span>
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
    const [isActive, setIsActive] = useState(true);
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 3;

    const handleNextStep = () => setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    const handleBackStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

    // Scroll to top on step change
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentStep]);

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
        maxBookingsPerWeek: 200,
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

    const [availableHotels, setAvailableHotels] = useState([]);
    const [hotelRoomsMap, setHotelRoomsMap] = useState({});

    useEffect(() => {
        const fetchAllHotels = async () => {
            try {
                console.warn("DEBUG: Fetching hotels from HotelDB...");
                const snapshot = await getDocs(collection(db, "HotelDB"));
                console.warn("DEBUG: Snapshot size:", snapshot.size);

                const list = snapshot.docs.map(doc => {
                    const data = doc.data();
                    console.warn("DEBUG: Doc Data:", doc.id, data);
                    // Handle both structures: direct fields or nested under 'hotel'
                    return {
                        id: doc.id,
                        hotelName: data.hotelName || data.hotel?.hotelName,
                        address: data.address || data.hotel?.address
                    };
                }).filter(h => h.hotelName); // Filter out invalid

                console.warn("DEBUG: Filtered List:", list);
                setAvailableHotels(list);
            } catch (err) {
                console.error("Failed to load hotels", err);
            }
        };
        fetchAllHotels();
    }, []);

    const fetchRoomsForHotel = async (hotelId) => {
        if (!hotelId || hotelRoomsMap[hotelId]) return;
        try {
            const snapshot = await getDocs(collection(db, "HotelDB", hotelId, "rooms"));
            const rooms = snapshot.docs.map(doc => doc.data());
            setHotelRoomsMap(prev => ({ ...prev, [hotelId]: rooms }));
        } catch (err) {
            console.error("Failed to load rooms for hotel", hotelId, err);
        }
    };

    const [itinerary, setItinerary] = useState([]);
    const [hotelsIncluded, setHotelsIncluded] = useState([]);
    const [uploadingHotelIndex, setUploadingHotelIndex] = useState(null);
    const [sights, setSights] = useState([]);
    const [specialRates, setSpecialRates] = useState({
        seasonalPricing: { enabled: false, note: "" },
    });

    const {
        handleSubmit,
        reset,
        register,
        formState: { errors },
        setValue,
    } = useForm({
        shouldUnregister: false // Keep values when fields unmount (step change)
    });

    // Load data for edit mode
    useEffect(() => {
        const fetchPackageData = async () => {
            if (!isEdit) return;

            try {
                const snapshot = await getDoc(doc(collection(db, "sightseeingPackagesDetails"), packageId));
                if (snapshot.exists()) {
                    const existingData = snapshot.data();
                    setIsActive(isListingActive(existingData));

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
                        maxBookingsPerWeek: existingData?.maxBookingsPerWeek || 200,
                    });

                    // Set form values for react-hook-form
                    setValue("title", existingData.title || existingData.packageName);
                    setValue("description", existingData.description || existingData.about);
                    setValue("price", existingData.price || existingData.startingPrice);
                    setValue("period", existingData.period || existingData.duration?.days);
                    setValue("location", existingData.location);
                    setValue("discount", existingData.discount);
                    setValue("pricePerChild", existingData?.pricingStructure?.pricePerChild || 0);
                    setValue("maxBookingsPerWeek", existingData?.maxBookingsPerWeek || 200);

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
            hotelId: "", hotelName: "", nights: 1, roomType: "", location: "", isManual: false, images: [], image: ""
        }]);
    };

    const updateHotel = (index, field, value) => {
        const newList = [...hotelsIncluded];
        newList[index][field] = value;
        setHotelsIncluded(newList);
    };

    const handleToggleHotelPartner = (index, isPartner) => {
        setHotelsIncluded(prev => {
            const newList = [...prev];
            newList[index] = {
                ...newList[index],
                isManual: !isPartner,
                hotelId: !isPartner ? (newList[index].hotelId || uuid()) : "",
                hotelName: !isPartner ? newList[index].hotelName : "",
                roomType: !isPartner ? newList[index].roomType : "",
                images: newList[index].images || [],
                image: newList[index].image || "",
            };
            return newList;
        });
    };

    const handleUploadHotelImage = async (hotelIndex, e) => {
        try {
            const file = e.target.files?.[0];
            if (!file) return;

            if (file.size > 10 * 1024 * 1024) {
                return toast.error("Hotel photo must be under 10MB");
            }

            setUploadingHotelIndex(hotelIndex);
            const fileRef = ref(storage, `hotel-images/${crypto.randomUUID()}`);
            const uploadTask = await uploadBytesResumable(fileRef, file);
            const photoURL = await getDownloadURL(uploadTask.ref);

            if (photoURL) {
                setHotelsIncluded(prev => {
                    const newList = [...prev];
                    const currentImages = Array.isArray(newList[hotelIndex]?.images) ? newList[hotelIndex].images : [];
                    newList[hotelIndex] = {
                        ...newList[hotelIndex],
                        images: [...currentImages, photoURL],
                        image: newList[hotelIndex].image || photoURL,
                    };
                    return newList;
                });
                toast.success("Hotel photo uploaded successfully");
            }
        } catch (error) {
            console.error("Hotel photo upload failed:", error);
            toast.error("Failed to upload hotel photo");
        } finally {
            setUploadingHotelIndex(null);
            if (e.target) e.target.value = "";
        }
    };

    const handleRemoveHotelImage = (hotelIndex, imageIndex) => {
        setHotelsIncluded(prev => {
            const newList = [...prev];
            const currentImages = (newList[hotelIndex]?.images || []).filter((_, i) => i !== imageIndex);
            newList[hotelIndex] = {
                ...newList[hotelIndex],
                images: currentImages,
                image: currentImages[0] || "",
            };
            return newList;
        });
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



    const handleUploadCoverPhoto = async (e) => {
        try {
            const file = e.target.files[0];
            if (!file) return;
            const fileRef = ref(storage, `images/${crypto.randomUUID()}`);
            const coverPhotoTask = await uploadBytesResumable(fileRef, file);
            const photoURL = await getDownloadURL(coverPhotoTask.ref);
            if (photoURL) setCoverPhotoURL(photoURL);
        } catch (error) {
            console.error("Cover photo upload failed:", error);
            toast.error("Failed to upload cover photo");
        }
    };

    const handleUploadPictures = async (e) => {
        try {
            let file = e.target.files[0];
            if (!file) return;
            const imageRef = ref(storage, `images/${crypto.randomUUID()}`);
            const imageTask = await uploadBytesResumable(imageRef, file);
            const imageURL = await getDownloadURL(imageTask.ref);
            if (imageURL) {
                setArrayData((p) => ({
                    ...p,
                    pictures: [...arrayData.pictures, imageURL],
                }));
            }
        } catch (error) {
            console.error("Gallery upload failed:", error);
            toast.error("Failed to upload gallery image");
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

        const numPrice = parseFloat(price);
        const numChildPrice = parseFloat(data.pricePerChild || 0);
        const numDiscount = parseFloat(discount || 0);
        const numPeriod = parseFloat(period);

        if (isNaN(numPrice) || numPrice <= 0) {
            return toast.error("Adult price must be greater than 0");
        }
        if (isNaN(numChildPrice) || numChildPrice < 0) {
            return toast.error("Child price cannot be negative");
        }
        if (isNaN(numDiscount) || numDiscount < 0 || numDiscount > 100) {
            return toast.error("Discount must be between 0% and 100%");
        }
        if (isNaN(numPeriod) || numPeriod <= 0) {
            return toast.error("Duration must be at least 1 day");
        }
        if (itinerary.length === 0) {
            return toast.error("Please add at least one day to the itinerary");
        }

        for (let i = 0; i < hotelsIncluded.length; i++) {
            const h = hotelsIncluded[i];
            if (h.isManual) {
                if (!h.hotelName?.trim()) {
                    return toast.error(`Please provide a hotel name for Hotel #${i + 1}`);
                }
                const hImages = h.images || (h.image ? [h.image] : []);
                if (!hImages || hImages.length === 0) {
                    return toast.error(`Please upload at least 1 image for "${h.hotelName}"`);
                }
            } else {
                if (!h.hotelId || !h.hotelName) {
                    return toast.error(`Please select a partner hotel for Hotel #${i + 1}`);
                }
            }
        }

        const id = isEdit ? packageId : uuid();
        const timestamp = isEdit && packageDetails.timestamp ? packageDetails.timestamp : new Date();

        const travelInfo = {
            ...listingStatusFields(isActive),
            id,
            title,
            description,
            price: numPrice,
            discount: numDiscount,
            location,
            period: numPeriod,
            maxBookingsPerWeek: parseInt(data.maxBookingsPerWeek || 200),
            coverPhoto: coverPhotoURL,
            timestamp,
            images: arrayData?.pictures || [],
        };

        const baseStruct = getEmptySightseeingPackage();

        const formattedHotels = hotelsIncluded.map(h => ({
            ...h,
            images: h.images || (h.image ? [h.image] : []),
            image: (h.images && h.images[0]) || h.image || "",
        }));

        const travelDetails = {
            ...baseStruct,
            ...travelInfo,
            packageId: id,
            packageName: title,
            about: description,
            startingPrice: numPrice,
            currency: "THB",
            duration: {
                days: numPeriod,
                nights: numPeriod - 1 > 0 ? numPeriod - 1 : 0
            },
            thumbnailImage: coverPhotoURL,

            highlights: arrayData?.amenities || [],
            amenities: arrayData?.amenities || [],
            included: arrayData?.included || [],
            excluded: arrayData?.excluded || [],
            packageImages: arrayData?.pictures || [],
            pictures: arrayData?.pictures || [],

            itinerary: itinerary.length > 0 ? itinerary : baseStruct.itinerary,
            hotelsIncluded: formattedHotels,
            hotels: formattedHotels,

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
                pricePerAdult: numPrice,
                pricePerChild: numChildPrice,
            },

            maxBookingsPerWeek: parseInt(data.maxBookingsPerWeek || 200),

            rating: { average: 5, totalReviews: 0 },
        };

        try {
            const batch = writeBatch(db);
            batch.set(doc(travelServicesCollection, id), travelInfo, { merge: true });
            batch.set(doc(db, "sightseeingPackagesDetails", id), travelDetails, { merge: true });
            await batch.commit();

            successNotification(`The Package is ${isEdit ? "updated" : "added"} successfully`);
            navigate("/dashboard/travel-services");
        } catch (error) {
            console.error("Error saving package:", error);
            alert("Failed to save package");
        }
    };

    const textField = (label, name, placeholder, defaultValue) => {
        const isRequired = !["pricePerChild", "discount"].includes(name);
        return (
            <Grid item xs={12} sm={name === "description" ? 12 : 6}>
                <TextField
                    label={
                        <span>
                            {label} {isRequired && <span className="text-red-500">*</span>}
                        </span>
                    }
                    type={["price", "discount", "period", "pricePerChild"].includes(name) ? "number" : "text"}
                    onWheel={(e) => e.target.blur()}
                    onKeyDown={(e) => {
                        if (["price", "discount", "period", "pricePerChild"].includes(name) && (e.key === "-" || e.key === "e")) {
                            e.preventDefault();
                        }
                    }}
                    defaultValue={defaultValue ?? ""}
                    placeholder={placeholder}
                    multiline={name === "description"}
                    fullWidth
                    rows={name === "description" ? 3 : ""}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                    inputProps={{
                        min: name === "price" || name === "period" ? 1 : 0,
                        max: name === "discount" ? 100 : name === "period" ? 100 : undefined,
                    }}
                    InputLabelProps={{ shrink: defaultValue !== undefined && defaultValue !== null && defaultValue !== "" ? true : undefined }}
                    {...register(name, {
                        required: isRequired,
                        min: {
                            value: name === "price" || name === "period" ? 1 : 0,
                            message: `${label} cannot be negative`,
                        },
                        ...(name === "discount" ? { max: { value: 100, message: "Discount cannot exceed 100%" } } : {}),
                    })}
                />
                {errors?.[name] && <span className="text-red-500">{errors[name].message || `${label} is required`}</span>}
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

            <div className="max-w-5xl mx-auto space-y-8">
                <ListingStatus active={isActive} onChange={setIsActive} label="Tour package visibility" />
                <p className="text-sm text-slate-500">Active tours are visible and bookable on the website.</p>
                <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />



                <Paper elevation={0} className="rounded-2xl bg-white shadow-sm border border-slate-100">
                    {/* Header removed as it's cleaner without the stepper header block */}

                    <Box
                        component="form"
                        onSubmit={(e) => e.preventDefault()}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                                e.preventDefault();
                            }
                        }}
                        className="px-6 py-10 md:px-8 md:py-12"
                    >
                        <Grid container spacing={4}>

                            {/* STEP 1: BASIC INFORMATION */}
                            {currentStep === 1 && (
                                <div className="w-full animate-fade-in space-y-6">
                                    <Grid container spacing={3}>
                                        {textField("Package Title", "title", "e.g., Grand Thailand Tour", packageDetails?.title)}
                                        {textField("Duration (Days)", "period", "e.g., 5", packageDetails?.period)}
                                        {textField("Location", "location", "e.g., Bangkok", packageDetails?.location)}



                                        <Grid item xs={12}>
                                            <TextField
                                                label="Short Description"
                                                multiline
                                                rows={3}
                                                fullWidth
                                                {...register("description", { required: true })}
                                                defaultValue={packageDetails?.description}
                                                InputLabelProps={{ shrink: !!packageDetails?.description ? true : undefined }}
                                                placeholder="A brief overview of the package..."
                                            />
                                        </Grid>

                                        {/* Visuals Section */}
                                        <Grid item xs={12}>
                                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                                                <Typography variant="subtitle1" fontWeight="bold" color="text.primary" sx={{ mb: 3 }}>Media Assets</Typography>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-3">
                                                        <label className="text-sm font-semibold text-gray-700">Cover Image <span className="text-red-500">*</span></label>
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
                                                        <label className="text-sm font-semibold text-gray-700">Gallery Images ({arrayData.pictures.length}) <span className="text-red-500">*</span></label>
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
                                                        <div className="absolute top-4 right-4 text-gray-300 group-hover:text-red-500 cursor-pointer transition-colors">
                                                            <DeleteButton handleDelete={() => {
                                                                const newItin = itinerary.filter((_, i) => i !== dIndex);
                                                                setItinerary(newItin);
                                                            }} />
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
                                        <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm h-full">
                                            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>🗺️ Places to Visit</Typography>
                                            <div className="flex gap-2 mb-4">
                                                <TextField
                                                    ref={placesRef}
                                                    size="small"
                                                    placeholder="Add place..."
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
                                                        minWidth: '50px',
                                                        boxShadow: 'none'
                                                    }}
                                                >
                                                    <AddCircleIcon />
                                                </Button>
                                            </div>
                                            <div className="flex flex-wrap gap-2 min-h-[80px] p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                {arrayData.places.map((item, i) => (
                                                    <Chip key={i} label={item} onDelete={() => handleRemovePlace(i)} className="bg-white border hover:shadow-sm" />
                                                ))}
                                                {arrayData.places.length === 0 && <span className="text-sm text-gray-400 italic w-full text-center my-auto">No places added yet.</span>}
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            )}

                            {/* STEP 3: CONFIGURATION */}
                            {currentStep === 3 && (
                                <div className="w-full animate-fade-in space-y-8">

                                    {/* Advanced Pricing */}
                                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                        <Typography variant="h6" className="text-gray-800 font-bold mb-6 flex items-center gap-2">⚙️ Booking Configuration</Typography>
                                        <Grid container spacing={4}>
                                            <Grid item xs={12}>
                                                <div className="p-4 bg-blue-50 text-blue-800 rounded-xl border border-blue-100 flex items-center gap-3">
                                                    <span className="text-2xl">ℹ️</span>
                                                    <div>
                                                        <Typography variant="subtitle1" fontWeight="bold">Global Weekly Limit Applied</Typography>
                                                        <Typography variant="body2">
                                                            All packages currently use the global weekly booking limit configured in the "Sightseeing Packages" main page settings.
                                                        </Typography>
                                                    </div>
                                                </div>
                                            </Grid>
                                        </Grid>
                                    </div>

                                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                        <Typography variant="h6" className="text-gray-800 font-bold mb-6 flex items-center gap-2">💰 Pricing & Discounts</Typography>
                                        <Grid container spacing={4}>
                                            {textField("Adult Price (Base)", "price", "Cost per adult", packageDetails?.price)}
                                            {textField("Child Price", "pricePerChild", "Cost per child", packageDetails?.pricePerChild)}
                                            {textField("Discount (%)", "discount", "Global discount %", packageDetails?.discount)}
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
                                                    <div className="absolute top-2 right-2 cursor-pointer text-gray-300 hover:text-red-500 z-10" onClick={() => setHotelsIncluded(hotelsIncluded.filter((_, i) => i !== index))}>
                                                        <CloseIcon fontSize="small" />
                                                    </div>

                                                    {/* Toggle Mode */}
                                                    <div className="mb-4 flex items-center gap-2">
                                                        <FormControlLabel
                                                             control={
                                                                 <Checkbox
                                                                     checked={!hotel.isManual}
                                                                     onChange={(e) => handleToggleHotelPartner(index, e.target.checked)}
                                                                     size="small"
                                                                 />
                                                             }
                                                             label={<span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">Use Partner Hotel</span>}
                                                         />
                                                    </div>

                                                    <Grid container spacing={3} alignItems="center">
                                                        <Grid item xs={6}>
                                                            {!hotel.isManual ? (
                                                                <Autocomplete
                                                                    options={availableHotels}
                                                                    getOptionLabel={(option) => option.hotelName || ""}
                                                                    value={availableHotels.find(h => h.id === hotel.hotelId) || null}
                                                                    onChange={(e, newVal) => {
                                                                        if (newVal) {
                                                                            updateHotel(index, 'hotelName', newVal.hotelName);
                                                                            updateHotel(index, 'hotelId', newVal.id);
                                                                            fetchRoomsForHotel(newVal.id);
                                                                        } else {
                                                                            updateHotel(index, 'hotelName', "");
                                                                            updateHotel(index, 'hotelId', "");
                                                                        }
                                                                    }}
                                                                    renderInput={(params) => <TextField {...params} label="Select Partner Hotel" variant="standard" fullWidth />}
                                                                />
                                                            ) : (
                                                                <TextField label="Hotel Name (Manual)" variant="standard" fullWidth value={hotel.hotelName} onChange={(e) => updateHotel(index, 'hotelName', e.target.value)} />
                                                            )}
                                                        </Grid>

                                                        <Grid item xs={3}>
                                                            <TextField label="Nights" type="number" variant="standard" fullWidth value={hotel.nights} onChange={(e) => updateHotel(index, 'nights', parseInt(e.target.value))} />
                                                        </Grid>

                                                        <Grid item xs={3}>
                                                            {!hotel.isManual && hotelRoomsMap[hotel.hotelId] ? (
                                                                <Autocomplete
                                                                    options={hotelRoomsMap[hotel.hotelId].map(r => r.name || r.roomName || "Standard")}
                                                                    freeSolo
                                                                    value={hotel.roomType}
                                                                    onChange={(e, val) => updateHotel(index, 'roomType', val)}
                                                                    renderInput={(params) => <TextField {...params} label="Room Type" variant="standard" fullWidth />}
                                                                />
                                                            ) : (
                                                                <TextField label="Room Type" variant="standard" fullWidth value={hotel.roomType} onChange={(e) => updateHotel(index, 'roomType', e.target.value)} />
                                                            )}
                                                        </Grid>
                                                    </Grid>

                                                    {/* Manual Hotel Photo Upload */}
                                                    {hotel.isManual && (
                                                        <div className="mt-4 pt-4 border-t border-gray-100">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                                                                    Hotel Photos <span className="text-red-500">*</span>
                                                                    <span className="text-gray-400 font-normal">
                                                                        (Upload at least 1 image for this manual hotel)
                                                                    </span>
                                                                </label>
                                                                {hotel.images?.length > 0 && (
                                                                    <span className="text-[11px] font-medium text-gray-400">
                                                                        {hotel.images.length} {hotel.images.length === 1 ? "photo" : "photos"} added
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-3">
                                                                {/* Upload Button */}
                                                                <label className="relative flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl cursor-pointer bg-gray-50 hover:bg-blue-50/30 transition-all group">
                                                                    <input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                        onChange={(e) => handleUploadHotelImage(index, e)}
                                                                        disabled={uploadingHotelIndex === index}
                                                                    />
                                                                    {uploadingHotelIndex === index ? (
                                                                        <div className="flex flex-col items-center justify-center text-blue-600">
                                                                            <CircularProgress size={20} className="mb-1" />
                                                                            <span className="text-[10px] font-medium text-gray-500">Uploading...</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex flex-col items-center justify-center text-gray-400 group-hover:text-blue-600 transition-colors">
                                                                            <span className="text-2xl mb-0.5">📸</span>
                                                                            <span className="text-[11px] font-medium">Add Photo</span>
                                                                        </div>
                                                                    )}
                                                                </label>

                                                                {/* Uploaded Photos Preview */}
                                                                {(hotel.images || (hotel.image ? [hotel.image] : [])).map((imgUrl, imgIdx) => (
                                                                    <div key={imgIdx} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 shadow-sm group">
                                                                        <img
                                                                            src={imgUrl}
                                                                            alt={`Hotel photo ${imgIdx + 1}`}
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                        <div
                                                                            className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 cursor-pointer shadow-md hover:scale-110 transition-transform"
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                handleRemoveHotelImage(index, imgIdx);
                                                                            }}
                                                                            title="Remove photo"
                                                                        >
                                                                            <CloseIcon sx={{ fontSize: 12 }} />
                                                                        </div>
                                                                        {imgIdx === 0 && (
                                                                            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-semibold text-center py-0.5">
                                                                                Cover
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}

                                                                {(!hotel.images || hotel.images.length === 0) && !hotel.image && (
                                                                    <span className="text-xs text-red-500 italic">
                                                                        * Photo required for non-partner hotels
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
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
                                type="button"
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
                                    type="button"
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
                                    type="button"
                                    onClick={handleSubmit(handleSavePackage)}
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
