import React, { useState, useRef, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    Box,
    Button,
    Grid,
    TextField,
    InputAdornment,
    IconButton,
    Typography,
    Paper,
    Chip,
    Avatar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from "@mui/material";
import {
    GoogleMap,
    MarkerF,
    StandaloneSearchBox,
} from "@react-google-maps/api";
import { Controller, useForm } from "react-hook-form";
import { MdLocationOn, MdPool, MdFitnessCenter, MdWifi, MdRestaurant, MdSpa, MdLocalParking, MdEdit, MdDelete, MdAdd, MdCheck, MdArrowForward, MdArrowBack, MdCloudUpload, MdAttachMoney, MdPeople, MdEmail, MdPhone, MdError, MdClose } from "react-icons/md";
import { FaStar } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import {
    hotelsCollection,
    usersCollection,
    firebaseConfig,
} from "../../../../../firebase/firebase.config";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc, addDoc, collection, updateDoc } from "firebase/firestore";
import { db } from "../../../../../firebase/firebase.config"; // Ensure db is imported if used directly or use collections
import { getFileUrl, successNotification } from "../../../../../utils/utils";
import axios from "axios";

// --- Components ---

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

const ProgressBar = ({ currentStep, totalSteps, isEdit }) => {
    const progress = (currentStep / totalSteps) * 100;

    return (
        <div className="w-full max-w-5xl mx-auto mb-8">
            <div className="flex justify-between mb-2">
                <span className={`text-sm font-bold ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>1. {isEdit ? "Edit Details" : "Hotel Details"}</span>
                <span className={`text-sm font-bold ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>2. Room Types</span>
                <span className={`text-sm font-bold ${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>3. Configuration</span>
            </div>
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                    className="h-full bg-blue-600 transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
    );
};

// Star rating component handling user rating (e.g., 4*5* rating)
const StarRating = ({ rating, setRating }) => {
    return (
        <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`text-3xl focus:outline-none transition-transform hover:scale-110 ${star <= rating ? "text-blue-500" : "text-gray-300 hover:text-blue-200"
                        }`}
                >
                    <FaStar />
                </button>
            ))}
        </div>
    );
};

const AmenityChip = ({ icon: Icon, label, selected, onClick }) => (
    <div
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all duration-200 border select-none ${selected
            ? "bg-blue-50 border-blue-200 text-blue-600"
            : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
            }`}
    >
        <Icon className={`text-lg ${selected ? "text-blue-500" : "text-gray-400"}`} />
        <span className="text-sm font-medium">{label}</span>
    </div>
);

// --- Main Component ---

const center = { lat: 48.8584, lng: 2.2945 };

const AddHotelForm = ({ initialData, isEdit, onClose }) => {
    const navigate = useNavigate();
    // Use onClose prop if provided, otherwise fallback to navigate
    const handleClose = onClose || (() => navigate("/dashboard/hotels"));
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 3;

    // Form State
    const { handleSubmit, control, setValue, register, formState: { errors }, trigger } = useForm();
    const [map, setMap] = useState(null);
    const [location, setLocation] = useState(null);
    const [searchBox, setSearchBox] = useState(null);
    const [logoURL, setLogoURL] = useState("");
    const [rating, setRating] = useState(0);
    const [selectedAmenities, setSelectedAmenities] = useState([]);
    const [addressInputValue, setAddressInputValue] = useState("");
    const [customAmenities, setCustomAmenities] = useState([]);
    const [newAmenityInput, setNewAmenityInput] = useState("");

    // New Fields for Gold Standard
    const [hotelGallery, setHotelGallery] = useState([]);
    const [petsAllowed, setPetsAllowed] = useState(false);
    const [nearbyAttractions, setNearbyAttractions] = useState([]);
    const [attractionInput, setAttractionInput] = useState("");
    const [hotelDiscount, setHotelDiscount] = useState(0);

    // Validation State for Custom Fields
    const [logoError, setLogoError] = useState(false);
    const [locationError, setLocationError] = useState(false);
    const [submissionError, setSubmissionError] = useState("");

    // Room Management State
    const [roomTypes, setRoomTypes] = useState([
        { id: 1, name: "Deluxe Ocean View", price: 350, guests: 4, rooms: ["101", "102"], amenities: ['wifi', 'bar'] }
    ]);
    const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
    // Updated Room State for Gold Standard
    const [newRoom, setNewRoom] = useState({
        roomName: "",
        packageName: "",
        maxGuests: 2,
        numberOfBeds: 1,
        bedType: "King",
        photos: [],
        amenities: [],
        description: "",
        policies: {
            checkIn: "14:00",
            checkOut: "12:00",
            extraBed: "",
            paymentInfo: "Prepaid",
            refundable: true
        },
        foodInfo: {
            breakfastIncluded: false,
            breakfastType: "Continental"
        },
        pricing: {
            basePrice: 0,
            discountPercent: 0,
            taxIncluded: true,
            pricingBasedOnGuests: []
        }
    });

    // Populate Form for Edit Mode
    useEffect(() => {
        if (isEdit && initialData) {
            // Handle both legacy and Gold Standard structures if needed. 
            // Assuming Gold Standard for now based on recent updates.
            const h = initialData.hotel || initialData; // Fallback if structure varies

            setValue("hotelName", h.hotelName);
            setValue("email", initialData.email || ""); // Email might be at root or inside hotel info
            setValue("phoneNumber", h.phoneNumber);
            setValue("address", h.address);
            setValue("country", h.country);
            setValue("description", h.description);

            setLogoURL(h.images?.logo || h.logoURL || "");
            setHotelGallery(h.images?.gallery || []);
            setPetsAllowed(h.petsAllowed || false);
            setNearbyAttractions(h.nearbyAttractions || []);
            setHotelDiscount(h.discount || 0);

            // Amenities
            const features = h.features || h.amenities || [];
            // Separate predefined vs custom might be tricky without the original list logic, 
            // but we can just put matches in selectedAmenities and rest in custom?
            // For simplicity, let's put all in custom if they don't match IDs, or just rely on IDs.
            // Simplified:
            const predefinedIds = ['pool', 'gym', 'wifi', 'parking', 'restaurant', 'spa'];
            const foundPredefined = features.filter(f => predefinedIds.includes(f));
            const foundCustom = features.filter(f => !predefinedIds.includes(f));

            setSelectedAmenities(foundPredefined);
            setCustomAmenities(foundCustom);
            setRating(h.rating || 0);

            // Rooms
            if (initialData.rooms) {
                setRoomTypes(initialData.rooms);
            }

            if (h.images?.logo) setLogoURL(h.images.logo);

            // Restore location if available, otherwise it relies on address geocoding
            if (h.location) {
                setLocation(h.location);
                if (map) map.panTo(h.location);
            }
            // Ensure email is set from correct path
            setValue("email", h.email || initialData.email || "");

            setAddressInputValue(h.address || "");
        }
    }, [isEdit, initialData, setValue]);

    const handleRoomPhotoUpload = async (e) => {
        const { files } = e.target;
        const result = await getFileUrl(files);
        if (!result?.error) {
            setNewRoom(prev => ({ ...prev, photos: [...prev.photos, result.url] }));
        }
    };

    const amenitiesList = [
        { id: 'pool', label: 'Pool', icon: MdPool },
        { id: 'gym', label: 'Gym', icon: MdFitnessCenter },
        { id: 'wifi', label: 'Free Wi-Fi', icon: MdWifi },
        { id: 'parking', label: 'Parking', icon: MdLocalParking },
        { id: 'restaurant', label: 'Restaurant', icon: MdRestaurant },
        { id: 'spa', label: 'Spa', icon: MdSpa },
    ];

    const toggleAmenity = (id) => {
        setSelectedAmenities(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleAddCustomAmenity = () => {
        if (newAmenityInput.trim()) {
            setCustomAmenities(prev => [...prev, newAmenityInput.trim()]);
            setNewAmenityInput("");
        }
    };

    const removeCustomAmenity = (index) => {
        setCustomAmenities(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddAttraction = () => {
        if (attractionInput.trim()) {
            setNearbyAttractions(prev => [...prev, attractionInput.trim()]);
            setAttractionInput("");
        }
    };

    const removeAttraction = (index) => {
        setNearbyAttractions(prev => prev.filter((_, i) => i !== index));
    };

    const handleUploadGallery = async (e) => {
        const { files } = e.target;
        // Assuming getFileUrl handles multiple files or we loop. 
        // For simplicity reusing getFileUrl which seems to handle single file based on previous usage, 
        // but let's assume we might need to loop if multiple allowed.
        // For now, let's allow adding one by one or improve getFileUrl later. 
        // Adapting to single upload per click for consistent UX with logo.
        const result = await getFileUrl(files);
        if (result?.error) {
            toast.error(result.message);
        } else {
            setHotelGallery(prev => [...prev, result.url]);
        }
    };

    const removeGalleryImage = (index) => {
        setHotelGallery(prev => prev.filter((_, i) => i !== index));
    };

    // --- Room Management Logic ---
    const handleAddRoom = () => {
        // Validate Essentials
        if (!newRoom.roomName || !newRoom.pricing.basePrice) {
            toast.error("Please fill in Room Name and Base Price");
            return;
        }

        // Calculate final price automatically
        const priceAfterDiscount = Number(newRoom.pricing.basePrice) * (1 - (Number(newRoom.pricing.discountPercent) || 0) / 100);

        const finalRoom = {
            id: Date.now(),
            ...newRoom,
            amenities: newRoom.amenities || [], // Ensure array
            pricing: {
                ...newRoom.pricing,
                pricePerNightAfterDiscount: priceAfterDiscount,
                priceForStay: {
                    nights: 1,
                    totalAmount: priceAfterDiscount
                }
            }
        };

        setRoomTypes(prev => [...prev, finalRoom]);

        // Reset Form
        setNewRoom({
            roomName: "",
            packageName: "",
            maxGuests: 2,
            numberOfBeds: 1,
            bedType: "King",
            photos: [],
            amenities: [],
            description: "",
            policies: {
                checkIn: "14:00",
                checkOut: "12:00",
                extraBed: "",
                paymentInfo: "Prepaid",
                refundable: true
            },
            foodInfo: {
                breakfastIncluded: false,
                breakfastType: "Continental"
            },
            pricing: {
                basePrice: 0,
                discountPercent: 0,
                taxIncluded: true,
                pricingBasedOnGuests: []
            }
        });
        setIsRoomModalOpen(false);
        toast.success("Room type added!");
    };



    const handleDeleteRoom = (id) => {
        setRoomTypes(prev => prev.filter(room => room.id !== id));
        toast.info("Room type removed");
    };

    // --- Google Maps Logic ---
    const onMapLoad = (map) => setMap(map);

    const reverseGeocode = async (lat, lon) => {
        try {
            const response = await axios.get(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${import.meta.env.VITE_Google_Api_Key}`
            );
            if (response.data.status === "OK") {
                const result = response.data.results[0];
                const address = result.formatted_address;
                const countryComponent = result.address_components.find(c => c.types.includes("country"));
                const country = countryComponent ? countryComponent.long_name : "";
                return { address, country };
            }
            return { address: "Unable to get location", country: "" };
        } catch (error) {
            console.error("Error fetching address: ", error);
            return { address: "Error fetching address", country: "" };
        }
    };

    const geocodeAddress = async (addressText) => {
        try {
            const response = await axios.get(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressText)}&key=${import.meta.env.VITE_Google_Api_Key}`
            );
            if (response.data.status === "OK") {
                const result = response.data.results[0];
                const loc = result.geometry.location;
                const formattedAddress = result.formatted_address;
                const countryComponent = result.address_components.find(c => c.types.includes("country"));
                const country = countryComponent ? countryComponent.long_name : "";

                setLocation({ lat: loc.lat, lng: loc.lng });
                setValue("address", formattedAddress);
                setValue("country", country);
                if (map) map.panTo({ lat: loc.lat, lng: loc.lng });

                return true;
            }
            return false;
        } catch (error) {
            console.error("Geocoding error:", error);
            return false;
        }
    };

    const onMapClick = async (e) => {
        const { address, country } = await reverseGeocode(e.latLng.lat(), e.latLng.lng());
        setValue("address", address);
        setValue("country", country);
        setAddressInputValue(address);
        setLocation({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        setLocationError(false);
    };

    const onPlacesChanged = async () => {
        const places = searchBox.getPlaces();
        if (places.length === 0) return;
        const loc = places[0].geometry.location;
        const { address, country } = await reverseGeocode(loc.lat(), loc.lng());
        setLocation({ lat: loc.lat(), lng: loc.lng() });
        setValue("address", address);
        setValue("country", country);
        setAddressInputValue(address);
        map.setCenter(loc);
        setLocationError(false);
    };

    const handleUploadLogo = async (e) => {
        const { files } = e.target;
        const result = await getFileUrl(files);
        if (result?.error) {
            toast.error(result.message);
        } else {
            setLogoURL(result.url);
            setLogoError(false);
        }
    };

    // --- Navigation Logic ---
    const handleNext = async () => {
        setSubmissionError(""); // Clear previous errors

        let isValid = false;
        if (currentStep === 1) {
            // 1. Check Address
            if (!location && addressInputValue) {
                const success = await geocodeAddress(addressInputValue);
                if (!success) {
                    setLocationError(true);
                    setSubmissionError("Could not find the entered location.");
                    return;
                }
                setLocationError(false);
            }

            // 2. Trigger Form Validation
            isValid = await trigger(["hotelName", "email", "phoneNumber", "address", "country", "description"]);

            // 3. Check Custom Fields
            if (!logoURL) {
                setLogoError(true);
                isValid = false;
            }
            if (!location && !addressInputValue) {
                setLocationError(true);
                isValid = false;
            }

            if (!isValid) {
                // Construct detailed error message
                let errorMsg = "Please fix the following errors:";
                if (errors.hotelName) errorMsg += "\n• Missing Hotel Name";
                if (errors.email) errorMsg += "\n• Invalid Email";
                if (errors.phoneNumber) errorMsg += "\n• Missing Phone Number";
                if (!logoURL) errorMsg += "\n• Missing Hotel Logo";
                if (!location && !addressInputValue) errorMsg += "\n• Missing Location";

                setSubmissionError(errorMsg);
                toast.error("Please fill in all required fields.");
            }
        } else if (currentStep === 2) {
            isValid = true;
            if (roomTypes.length === 0) {
                toast.warn("We recommend adding at least one room type");
            }
        }

        if (isValid) {
            setCurrentStep(prev => Math.min(prev + 1, totalSteps));
        }
    };

    const handleBack = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
        setSubmissionError("");
    };

    // --- Submission Logic ---
    // --- Submission Logic ---
    const onSubmit = async (data) => {
        setIsSubmitting(true);
        setSubmissionError("");

        try {
            // Calculate starting price
            const lowestPrice = roomTypes.length > 0
                ? Math.min(...roomTypes.map(r => r.pricing.pricePerNightAfterDiscount))
                : 0;

            // Construct Final Payload (Gold Standard)
            const finalPayload = {
                hotel: {
                    hotelId: crypto.randomUUID(), // Generate a UUID
                    hotelUid: user.uid,
                    hotelName: data.hotelName,
                    email: data.email,
                    country: data.country,
                    location: location, // Save { lat, lng }
                    currency: "THB",
                    startingPrice: lowestPrice,
                    discount: hotelDiscount,
                    address: data.address,
                    description: data.description || "",
                    images: {
                        logo: logoURL,
                        gallery: hotelGallery
                    },
                    petsAllowed,
                    nearbyAttractions,
                    features: [...selectedAmenities, ...customAmenities],
                    phoneNumber: data.phoneNumber,
                    rating,
                    numberOfReviews: 0,
                    status: "Approved",
                    updatedAt: new Date().toISOString()
                },
                rooms: roomTypes
            };

            if (isEdit && initialData?.uid) {
                await updateDoc(doc(db, "hotels", initialData.uid), {
                    ...finalPayload,
                    updatedAt: serverTimestamp()
                });
                toast.success("Hotel Updated Successfully!");
            } else {
                await addDoc(collection(db, "hotels"), {
                    ...finalPayload,
                    timestamp: serverTimestamp()
                });
                toast.success("Hotel Added Successfully!");
            }

            console.log("Gold Standard Output:", finalPayload);
            reset();
            if (handleClose) handleClose();

        } catch (error) {
            console.error("Error saving hotel: ", error);
            setSubmissionError("Failed to submit. Please try again.");
            toast.error("Error submitting form");
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderStep1 = () => (
        <FadeIn>
            <div className="space-y-6">
                {/* Hotel Name */}
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700">Hotel Name</label>
                    <TextField
                        {...register("hotelName", { required: "Hotel Name is required" })}
                        placeholder="Enter the name of the hotel"
                        fullWidth
                        error={!!errors.hotelName}
                        helperText={errors.hotelName?.message}
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                borderRadius: "9999px",
                                backgroundColor: "#f3f4f6",
                                "& fieldset": { border: "none" },
                                "&:hover": { backgroundColor: "#e5e7eb" },
                                "&.Mui-focused": { backgroundColor: "#fff", boxShadow: "0 0 0 2px #3b82f6" },
                                "& input": { padding: "14px 24px" }
                            }
                        }}
                    />
                </div>

                {/* Contact Info */}
                < div className="grid grid-cols-1 md:grid-cols-2 gap-6" >
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Email</label>
                        <TextField
                            {...register("email", {
                                required: "Email is required",
                                pattern: { value: /^\S+@\S+$/i, message: "Invalid email" }
                            })}
                            placeholder="contact@hotel.com"
                            fullWidth
                            error={!!errors.email}
                            helperText={errors.email?.message}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><MdEmail className="text-gray-400" /></InputAdornment>
                            }}
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: "9999px",
                                    backgroundColor: "#f3f4f6",
                                    "& fieldset": { border: "none" },
                                    "&:hover": { backgroundColor: "#e5e7eb" },
                                    "&.Mui-focused": { backgroundColor: "#fff", boxShadow: "0 0 0 2px #3b82f6" },
                                }
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Phone Number</label>
                        <TextField
                            {...register("phoneNumber", { required: "Phone Number is required" })}
                            placeholder="+1 234 567 890"
                            fullWidth
                            error={!!errors.phoneNumber}
                            helperText={errors.phoneNumber?.message}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><MdPhone className="text-gray-400" /></InputAdornment>
                            }}
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: "9999px",
                                    backgroundColor: "#f3f4f6",
                                    "& fieldset": { border: "none" },
                                    "&:hover": { backgroundColor: "#e5e7eb" },
                                    "&.Mui-focused": { backgroundColor: "#fff", boxShadow: "0 0 0 2px #3b82f6" },
                                }
                            }}
                        />
                    </div>
                </div >

                {/* Address / Location */}
                < div className="space-y-2" >
                    <label className="block text-sm font-bold text-gray-700">Address / Location</label>
                    <StandaloneSearchBox onLoad={setSearchBox} onPlacesChanged={onPlacesChanged}>
                        <TextField
                            fullWidth
                            placeholder="Search for address or location"
                            value={addressInputValue}
                            onChange={(e) => setAddressInputValue(e.target.value)}
                            error={locationError}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <MdLocationOn className={`text-xl mr-2 ${locationError ? 'text-red-500' : 'text-gray-400'}`} />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: "9999px",
                                    backgroundColor: locationError ? "#fef2f2" : "#f3f4f6",
                                    "& fieldset": { border: locationError ? "1px solid #ef4444" : "none" },
                                    "&:hover": { backgroundColor: "#e5e7eb" },
                                    "&.Mui-focused": { backgroundColor: "#fff", boxShadow: locationError ? "0 0 0 2px #ef4444" : "0 0 0 2px #3b82f6" },
                                    "& input": { padding: "14px 24px" }
                                }
                            }}
                        />
                    </StandaloneSearchBox>
                    {
                        locationError && (
                            <p className="text-xs text-red-500 font-bold ml-4 animate-pulse">
                                * Please select a valid location.
                            </p>
                        )
                    }
                </div >

                {/* Hidden Address Fields populated by map */}
                < div className="hidden" >
                    <TextField {...register("address", { required: true })} />
                    <TextField {...register("country", { required: true })} />
                </div >

                {/* Description */}
                < div className="space-y-2" >
                    <label className="block text-sm font-bold text-gray-700">Description</label>
                    <TextField
                        {...register("description", { required: "Description is required" })}
                        placeholder="Provide a detailed description of the hotel..."
                        multiline
                        rows={4}
                        fullWidth
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                borderRadius: "24px",
                                backgroundColor: "#f3f4f6",
                                "& fieldset": { border: "none" },
                                "&:hover": { backgroundColor: "#e5e7eb" },
                                "&.Mui-focused": { backgroundColor: "#fff", boxShadow: "0 0 0 2px #3b82f6" },
                                "& textarea": { padding: "12px" }
                            }
                        }}
                    />
                    {
                        errors.description && (
                            <p className="text-xs text-red-500 font-bold ml-4 mt-1">
                                {errors.description.message}
                            </p>
                        )
                    }
                </div >

                {/* Star Rating & Amenities */}
                < div className="grid grid-cols-1 md:grid-cols-2 gap-8" >
                    {/* <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Star Rating</label>
                        <StarRating rating={rating} setRating={setRating} />
                    </div> */}
                    < div className="space-y-2" >
                        <label className="block text-sm font-bold text-gray-700">Property Amenities</label>
                        <div className="flex flex-wrap gap-2">
                            {amenitiesList.map((amenity) => (
                                <AmenityChip
                                    key={amenity.id}
                                    icon={amenity.icon}
                                    label={amenity.label}
                                    selected={selectedAmenities.includes(amenity.id)}
                                    onClick={() => toggleAmenity(amenity.id)}
                                />
                            ))}
                        </div>

                        {/* Custom Amenities Input */}
                        <div className="flex gap-2 mt-4">
                            <TextField
                                value={newAmenityInput}
                                onChange={(e) => setNewAmenityInput(e.target.value)}
                                placeholder="Add other amenity..."
                                size="small"
                                fullWidth
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: "999px",
                                        backgroundColor: "#f3f4f6",
                                        "& fieldset": { border: "none" },
                                    }
                                }}
                            />
                            <Button
                                onClick={handleAddCustomAmenity}
                                variant="contained"
                                sx={{ borderRadius: "999px", textTransform: "none", minWidth: "100px" }}
                            >
                                Add
                            </Button>
                        </div>

                        {/* Custom Amenities List */}
                        {
                            customAmenities.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {customAmenities.map((amenity, index) => (
                                        <div key={index} className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-600">
                                            <span className="text-sm font-medium">{amenity}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeCustomAmenity(index)}
                                                className="hover:text-red-500"
                                            >
                                                <MdClose />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )
                        }
                    </div >
                </div >

                {/* New Fields: Pets, Discount */}
                < div className="grid grid-cols-1 md:grid-cols-2 gap-6" >
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Pets Allowed</label>
                        <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                            <span className={`font-bold ${petsAllowed ? "text-green-600" : "text-gray-500"}`}>
                                {petsAllowed ? "Yes" : "No"}
                            </span>
                            <input
                                type="checkbox"
                                checked={petsAllowed}
                                onChange={(e) => setPetsAllowed(e.target.checked)}
                                className="w-6 h-6 rounded text-blue-600 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Global Discount (%)</label>
                        <TextField
                            type="number"
                            value={hotelDiscount}
                            onChange={(e) => setHotelDiscount(Number(e.target.value))}
                            fullWidth
                            inputProps={{ min: 0, max: 100 }}
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: "24px",
                                    backgroundColor: "#f3f4f6",
                                    "& fieldset": { border: "none" },
                                }
                            }}
                        />
                    </div>
                </div >

                {/* Nearby Attractions */}
                < div className="space-y-2" >
                    <label className="block text-sm font-bold text-gray-700">Nearby Attractions</label>
                    <div className="flex gap-2">
                        <TextField
                            value={attractionInput}
                            onChange={(e) => setAttractionInput(e.target.value)}
                            placeholder="E.g. Pattaya Beach - 200m"
                            fullWidth
                            size="small"
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: "999px",
                                    backgroundColor: "#f3f4f6",
                                    "& fieldset": { border: "none" },
                                }
                            }}
                        />
                        <Button
                            onClick={handleAddAttraction}
                            variant="contained"
                            sx={{ borderRadius: "999px", textTransform: "none", minWidth: "100px" }}
                        >
                            Add
                        </Button>
                    </div>
                    {
                        nearbyAttractions.length > 0 && (
                            <div className="flex flex-col gap-2 mt-2">
                                {nearbyAttractions.map((attraction, index) => (
                                    <div key={index} className="flex justify-between items-center px-4 py-2 rounded-xl bg-gray-50 border border-gray-200">
                                        <span className="text-sm font-medium text-gray-700">{attraction}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeAttraction(index)}
                                            className="text-gray-400 hover:text-red-500"
                                        >
                                            <MdDelete />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )
                    }
                </div >

                {/* Exterior Photos (Logo & Gallery) */}
                < div className="space-y-6" >
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Main Logo / Cover <span className="text-red-500">*</span></label>
                        <div className={`border-2 border-dashed rounded-3xl p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer relative bg-gray-50/50 ${logoError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}>
                            <input
                                type="file"
                                onChange={handleUploadLogo}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="flex flex-col items-center justify-center gap-2">
                                <div className={`w-10 h-10 ${logoError ? 'text-red-400' : 'text-gray-400'}`}>
                                    {logoError ? <MdError size={40} /> : <MdCloudUpload size={40} />}
                                </div>
                                <p className={`font-bold text-sm ${logoError ? 'text-red-500' : 'text-blue-500'}`}>
                                    {logoError ? "Required!" : "Upload Logo"}
                                </p>
                                {logoURL && <p className="text-green-500 text-xs font-bold">Uploaded!</p>}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Gallery Photos</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {hotelGallery.map((url, idx) => (
                                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group shadow-sm">
                                    <img src={url} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removeGalleryImage(idx)}
                                        className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <MdDelete size={16} />
                                    </button>
                                </div>
                            ))}
                            <div className="relative aspect-square rounded-xl border-2 border-dashed border-gray-300 hover:bg-gray-50 transition-colors flex flex-col items-center justify-center cursor-pointer">
                                <input
                                    type="file"
                                    onChange={handleUploadGallery}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <MdAdd className="text-3xl text-gray-400" />
                                <span className="text-xs text-gray-400 font-bold mt-1">Add Photo</span>
                            </div>
                        </div>
                    </div>
                </div >

                {/* Map Preview */}
                < div className="h-48 w-full rounded-3xl overflow-hidden border border-gray-200 mt-4" >
                    <GoogleMap
                        mapContainerStyle={{ height: "100%", width: "100%" }}
                        center={location || center}
                        zoom={15}
                        onLoad={onMapLoad}
                        onClick={onMapClick}
                    >
                        {location && <MarkerF position={location} />}
                    </GoogleMap>
                </div >
            </div >
        </FadeIn >
    );

    const renderStep2 = () => (
        <FadeIn>
            <div className="space-y-6">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900">Configure Rooms</h2>
                    <p className="text-gray-500">Define all available room types, their pricing, and specific amenities.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Existing Room Cards */}
                    {roomTypes.map((room) => (
                        <div key={room.id} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm relative hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-bold text-gray-900">{room.name}</h3>
                                <div className="flex gap-2">
                                    <IconButton size="small" onClick={() => handleDeleteRoom(room.id)} className="text-gray-400 hover:text-red-500"><MdDelete /></IconButton>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Base Price</label>
                                    <div className="mt-1 bg-gray-50 rounded-xl px-3 py-2 text-gray-900 font-bold border border-gray-100">
                                        $ {room.price}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Max Guests</label>
                                    <div className="mt-1 bg-gray-50 rounded-xl px-3 py-2 text-gray-900 font-bold border border-gray-100">
                                        {room.guests}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Add New Room Card */}
                    <div
                        onClick={() => setIsRoomModalOpen(true)}
                        className="border-2 border-dashed border-gray-200 rounded-3xl p-6 flex flex-col items-center justify-center text-center min-h-[250px] hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer group"
                    >
                        <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <MdAdd size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Add Another Room Type</h3>
                    </div>
                </div>
            </div>
        </FadeIn>
    );

    const renderStep3 = () => (
        <FadeIn>
            <div className="space-y-6 animate-fadeIn py-8">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <MdCheck size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Preview Configuration</h2>
                    <p className="text-gray-500">Review the final data structure before submitting.</p>
                </div>

                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200 overflow-y-auto max-h-[500px] text-xs font-mono">
                    <pre>
                        {JSON.stringify({
                            hotel: {
                                hotelName,
                                address,
                                description: getValues("description"),
                                features: [...selectedAmenities, ...customAmenities],
                                petsAllowed,
                                nearbyAttractions,
                                images: { logo: logoURL, gallery: hotelGallery }
                            },
                            rooms: roomTypes
                        }, null, 2)}
                    </pre>
                </div>
            </div>
        </FadeIn>
    );

    return (
        <Box className="bg-[#f8f9fa] min-h-screen p-6 font-sans relative">
            {/* Local Toast Container with High Z-Index */}
            <ToastContainer
                position="top-center"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                style={{ zIndex: 99999 }}
            />

            <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900">Add New Hotel</h1>
                </div>

                <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />

                <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-[32px] p-8 shadow-sm">
                    {currentStep === 1 && renderStep1()}
                    {currentStep === 2 && renderStep2()}
                    {currentStep === 3 && renderStep3()}

                    {/* Inline Error Message Area */}
                    {submissionError && (
                        <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium whitespace-pre-line animate-pulse">
                            <div className="flex items-center gap-2 mb-1 text-red-700 font-bold">
                                <MdError size={20} />
                                <span>Action Required</span>
                            </div>
                            {submissionError}
                        </div>
                    )}

                    <div className="flex justify-between items-center mt-6 pt-6">
                        {currentStep > 1 ? (
                            <Button
                                onClick={handleBack}
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
                                Back
                            </Button>
                        ) : (
                            <Button
                                onClick={onClose}
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
                                Cancel
                            </Button>
                        )}

                        {currentStep < 3 ? (
                            <Button
                                onClick={handleNext}
                                variant="contained"
                                sx={{
                                    backgroundColor: "#3b82f6",
                                    color: "white",
                                    borderRadius: "24px",
                                    padding: "12px 32px",
                                    textTransform: "none",
                                    fontWeight: 700,
                                    fontSize: "1rem",
                                    boxShadow: "0 4px 6px -1px rgba(59, 130, 246, 0.5)",
                                    "&:hover": { backgroundColor: "#2563eb" }
                                }}
                            >
                                {currentStep === 2 ? "Next: Configuration" : "Next: Add Rooms"}
                            </Button>
                        ) : (
                            <Button
                                type="submit"
                                variant="contained"
                                sx={{
                                    backgroundColor: "#22c55e",
                                    color: "white",
                                    borderRadius: "24px",
                                    padding: "12px 32px",
                                    textTransform: "none",
                                    fontWeight: 700,
                                    fontSize: "1rem",
                                    boxShadow: "0 4px 6px -1px rgba(34, 197, 94, 0.5)",
                                    "&:hover": { backgroundColor: "#16a34a" }
                                }}
                            >
                                Submit Hotel
                            </Button>
                        )}
                    </div>
                </form>

                {/* Add Room Modal - Updated for Gold Standard */}
                <Dialog
                    open={isRoomModalOpen}
                    onClose={() => setIsRoomModalOpen(false)}
                    PaperProps={{
                        style: { borderRadius: '24px', padding: '16px', maxWidth: '800px', width: '100%' }
                    }}
                >
                    <DialogTitle sx={{ fontWeight: 800, fontSize: '1.5rem', textAlign: 'center' }}>Add New Room</DialogTitle>
                    <DialogContent>
                        <div className="space-y-6 mt-2">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <TextField
                                    label="Room Name"
                                    fullWidth
                                    value={newRoom.roomName}
                                    onChange={(e) => setNewRoom({ ...newRoom, roomName: e.target.value })}
                                    variant="outlined"
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                                />
                                <TextField
                                    label="Package Name"
                                    fullWidth
                                    value={newRoom.packageName}
                                    onChange={(e) => setNewRoom({ ...newRoom, packageName: e.target.value })}
                                    placeholder="e.g. Standard, Deluxe"
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                                />
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <TextField
                                    label="Max Guests"
                                    type="number"
                                    fullWidth
                                    value={newRoom.maxGuests}
                                    onChange={(e) => setNewRoom({ ...newRoom, maxGuests: Number(e.target.value) })}
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                                />
                                <TextField
                                    label="Num Beds"
                                    type="number"
                                    fullWidth
                                    value={newRoom.numberOfBeds}
                                    onChange={(e) => setNewRoom({ ...newRoom, numberOfBeds: Number(e.target.value) })}
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                                />
                                <TextField
                                    label="Bed Type"
                                    select
                                    fullWidth
                                    value={newRoom.bedType}
                                    onChange={(e) => setNewRoom({ ...newRoom, bedType: e.target.value })}
                                    SelectProps={{ native: true }}
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                                >
                                    <option value="Single">Single</option>
                                    <option value="Double">Double</option>
                                    <option value="Queen">Queen</option>
                                    <option value="King">King</option>
                                </TextField>
                                <TextField
                                    label="Base Price"
                                    type="number"
                                    fullWidth
                                    value={newRoom.pricing.basePrice}
                                    onChange={(e) => setNewRoom({ ...newRoom, pricing: { ...newRoom.pricing, basePrice: Number(e.target.value) } })}
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <TextField
                                    label="Discount (%)"
                                    type="number"
                                    fullWidth
                                    value={newRoom.pricing.discountPercent}
                                    onChange={(e) => setNewRoom({ ...newRoom, pricing: { ...newRoom.pricing, discountPercent: Number(e.target.value) } })}
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                                />
                                <div className="flex items-center gap-4 p-2 border border-gray-200 rounded-xl">
                                    <span className="text-sm font-bold text-gray-600 pl-2">Breakfast Included?</span>
                                    <input
                                        type="checkbox"
                                        checked={newRoom.foodInfo.breakfastIncluded}
                                        onChange={(e) => setNewRoom({ ...newRoom, foodInfo: { ...newRoom.foodInfo, breakfastIncluded: e.target.checked } })}
                                        className="w-5 h-5 text-blue-600 rounded"
                                    />
                                </div>
                            </div>

                            {/* Policies */}
                            <div>
                                <h4 className="font-bold text-gray-700 mb-2">Policies</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <TextField
                                        label="Check-In"
                                        type="time"
                                        fullWidth
                                        value={newRoom.policies.checkIn}
                                        onChange={(e) => setNewRoom({ ...newRoom, policies: { ...newRoom.policies, checkIn: e.target.value } })}
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                                    />
                                    <TextField
                                        label="Check-Out"
                                        type="time"
                                        fullWidth
                                        value={newRoom.policies.checkOut}
                                        onChange={(e) => setNewRoom({ ...newRoom, policies: { ...newRoom.policies, checkOut: e.target.value } })}
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                                    />
                                </div>
                            </div>

                            {/* Photos */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Room Photos</label>
                                <div className="flex gap-2 flex-wrap">
                                    {newRoom.photos.map((photo, idx) => (
                                        <img key={idx} src={photo} alt="Room" className="w-16 h-16 rounded-xl object-cover border border-gray-200" />
                                    ))}
                                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-blue-300 flex items-center justify-center cursor-pointer hover:bg-blue-50 text-blue-400">
                                        <MdAdd />
                                        <input type="file" onChange={handleRoomPhotoUpload} className="hidden" />
                                    </label>
                                </div>
                            </div>

                        </div>
                    </DialogContent>
                    <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
                        <Button onClick={() => setIsRoomModalOpen(false)} sx={{ color: 'gray', fontWeight: 600 }}>Cancel</Button>
                        <Button
                            onClick={handleAddRoom}
                            variant="contained"
                            sx={{
                                borderRadius: '12px',
                                background: '#3b82f6',
                                fontWeight: 600,
                                px: 4
                            }}
                        >
                            Add Room
                        </Button>
                    </DialogActions>
                </Dialog>
            </div>
        </Box>
    );
};

export default AddHotelForm;
