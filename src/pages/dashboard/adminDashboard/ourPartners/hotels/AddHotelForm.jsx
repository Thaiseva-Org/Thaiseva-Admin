import React, { useState, useRef, useContext } from "react";
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
import { MdLocationOn, MdPool, MdFitnessCenter, MdWifi, MdRestaurant, MdSpa, MdLocalParking, MdEdit, MdDelete, MdAdd, MdCheck, MdArrowForward, MdArrowBack, MdCloudUpload, MdAttachMoney, MdPeople, MdEmail, MdPhone, MdError } from "react-icons/md";
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
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
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

const ProgressBar = ({ currentStep, totalSteps }) => {
    const progress = (currentStep / totalSteps) * 100;

    return (
        <div className="w-full max-w-5xl mx-auto mb-8">
            <div className="flex justify-between mb-2">
                <span className={`text-sm font-bold ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>1. Hotel Details</span>
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

const AddHotelForm = () => {
    const navigate = useNavigate();
    const onClose = () => navigate("/dashboard/hotels");
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

    // Validation State for Custom Fields
    const [logoError, setLogoError] = useState(false);
    const [locationError, setLocationError] = useState(false);
    const [submissionError, setSubmissionError] = useState("");

    // Room Management State
    const [roomTypes, setRoomTypes] = useState([
        { id: 1, name: "Deluxe Ocean View", price: 350, guests: 4, rooms: ["101", "102"], amenities: ['wifi', 'bar'] }
    ]);
    const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
    const [newRoom, setNewRoom] = useState({ name: "", price: "", guests: "", amenities: [] });

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

    // --- Room Management Logic ---
    const handleAddRoom = () => {
        if (!newRoom.name || !newRoom.price) {
            toast.error("Please fill in Room Name and Price");
            return;
        }
        setRoomTypes(prev => [...prev, {
            id: Date.now(),
            ...newRoom,
            rooms: [],
            amenities: []
        }]);
        setNewRoom({ name: "", price: "", guests: "", amenities: [] });
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
    const onSubmit = async (data) => {
        const { email, hotelName, phoneNumber, address, country } = data;

        try {
            const secondaryApp = initializeApp(firebaseConfig, "Secondary");
            const secondaryAuth = getAuth(secondaryApp);
            let createdUser;

            try {
                const res = await createUserWithEmailAndPassword(secondaryAuth, email, "TempPass123!");
                createdUser = res.user;
                await updateProfile(createdUser, { displayName: hotelName, photoURL: logoURL });
                await signOut(secondaryAuth);
            } finally {
                await deleteApp(secondaryApp);
            }

            if (createdUser) {
                const hotelInfo = {
                    status: "Verified",
                    verified: true,
                    serviceCategory: "Hotel",
                    hotelInformation: {
                        email, hotelName, address, phoneNumber, location, logoURL, country,
                        description: data.description || "",
                        rating,
                        amenities: selectedAmenities,
                        roomTypes
                    },
                    timestamp: serverTimestamp(),
                    uid: createdUser.uid,
                };

                await setDoc(doc(usersCollection, createdUser.uid), {
                    displayName: hotelName,
                    email,
                    role: "Partner",
                    serviceCategory: "Hotel",
                    status: "Verified",
                    photoURL: logoURL,
                    phoneNo: phoneNumber,
                    createdAt: new Date(),
                    uid: createdUser.uid,
                });

                await setDoc(doc(hotelsCollection, createdUser.uid), hotelInfo);
                successNotification("Hotel added successfully");
                if (onClose) onClose();
            }
        } catch (error) {
            if (error.code === "auth/email-already-in-use") {
                toast.error("Email already exists.");
            } else {
                console.error(error);
                toast.error("An error occurred.");
            }
        }
    };

    // --- Render Steps ---

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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                </div>

                {/* Address / Location */}
                <div className="space-y-2">
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
                    {locationError && (
                        <p className="text-xs text-red-500 font-bold ml-4 animate-pulse">
                            * Please select a valid location.
                        </p>
                    )}
                </div>

                {/* Hidden Address Fields populated by map */}
                <div className="hidden">
                    <TextField {...register("address", { required: true })} />
                    <TextField {...register("country", { required: true })} />
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700">Description</label>
                    <TextField
                        {...register("description")}
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
                </div>

                {/* Star Rating & Amenities */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Star Rating</label>
                        <StarRating rating={rating} setRating={setRating} />
                    </div> */}
                    <div className="space-y-2">
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
                    </div>
                </div>

                {/* Exterior Photos (Logo Upload) */}
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700">Exterior Photos <span className="text-red-500">*</span></label>
                    <div className={`border-2 border-dashed rounded-3xl p-12 text-center hover:bg-gray-50 transition-colors cursor-pointer relative bg-gray-50/50 ${logoError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}>
                        <input
                            type="file"
                            onChange={handleUploadLogo}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center justify-center gap-2">
                            <div className={`w-12 h-12 mb-2 ${logoError ? 'text-red-400' : 'text-gray-400'}`}>
                                {logoError ? <MdError size={48} /> : <MdCloudUpload size={48} />}
                            </div>
                            <p className={`font-bold text-sm ${logoError ? 'text-red-500' : 'text-blue-500'}`}>
                                {logoError ? "Logo is Required!" : "Click to upload"} <span className="text-gray-500 font-normal">or drag and drop</span>
                            </p>
                            <p className="text-xs text-gray-400">SVG, PNG, JPG or GIF (MAX. 800x400px)</p>
                            {logoURL && <p className="text-green-500 text-sm mt-2 font-bold">Logo Uploaded!</p>}
                        </div>
                    </div>
                </div>

                {/* Map Preview */}
                <div className="h-48 w-full rounded-3xl overflow-hidden border border-gray-200 mt-4">
                    <GoogleMap
                        mapContainerStyle={{ height: "100%", width: "100%" }}
                        center={location || center}
                        zoom={15}
                        onLoad={onMapLoad}
                        onClick={onMapClick}
                    >
                        {location && <MarkerF position={location} />}
                    </GoogleMap>
                </div>
            </div>
        </FadeIn>
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
            <div className="space-y-6 animate-fadeIn text-center py-12">
                <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <MdCheck size={40} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Configuration Complete!</h2>
                <p className="text-gray-500 max-w-md mx-auto">
                    You have successfully set up the hotel details and room types. Click 'Submit' to finalize.
                </p>
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

                {/* Add Room Modal */}
                <Dialog
                    open={isRoomModalOpen}
                    onClose={() => setIsRoomModalOpen(false)}
                    PaperProps={{
                        style: { borderRadius: '24px', padding: '16px', maxWidth: '500px', width: '100%' }
                    }}
                >
                    <DialogTitle sx={{ fontWeight: 800, fontSize: '1.5rem', textAlign: 'center' }}>Add New Room</DialogTitle>
                    <DialogContent>
                        <div className="space-y-4 mt-2">
                            <TextField
                                label="Room Name"
                                fullWidth
                                value={newRoom.name}
                                onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                                variant="outlined"
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <TextField
                                    label="Price ($)"
                                    type="number"
                                    fullWidth
                                    value={newRoom.price}
                                    onChange={(e) => setNewRoom({ ...newRoom, price: e.target.value })}
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                                />
                                <TextField
                                    label="Max Guests"
                                    type="number"
                                    fullWidth
                                    value={newRoom.guests}
                                    onChange={(e) => setNewRoom({ ...newRoom, guests: e.target.value })}
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                                />
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
