import cropImageFile from "../../../../../components/websiteConfig/cropImageFile";
import { hotelPackagePricing } from "../../../../../utils/hotel-package-pricing";
import ListingStatus from "../../../../../components/ListingStatus";
import { isListingActive, listingStatusFields } from "../../../../../utils/listing-status";
import React, { useState, useRef, useContext, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
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
    Autocomplete,
} from "@react-google-maps/api";
import { Controller, useForm } from "react-hook-form";
import { MdLocationOn, MdPool, MdFitnessCenter, MdWifi, MdRestaurant, MdSpa, MdLocalParking, MdEdit, MdDelete, MdAdd, MdCheck, MdArrowForward, MdArrowBack, MdCloudUpload, MdAttachMoney, MdPeople, MdEmail, MdPhone, MdError, MdClose } from "@icons";
import { FaStar, FaBed, FaMinus, FaPlus } from "@icons";
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
import { doc, serverTimestamp, setDoc, addDoc, collection, updateDoc, getDocs, getDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "../../../../../firebase/firebase.config";
import { getFileUrl, successNotification } from "../../../../../utils/utils";
import CountryPhoneInput from "../../../../../components/CountryPhoneInput";

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

const center = { lat: 48.8584, lng: 2.2945 };

const AddHotelForm = ({ initialData: _propInitialData, isEdit: _propIsEdit, onClose }) => {
    const navigate = useNavigate();
    const routerLocation = useLocation();
    const { hotelId } = useParams();

    const initialData = _propInitialData || routerLocation.state;
    const isEdit = _propIsEdit || !!hotelId;

    const [fetchedHotel, setFetchedHotel] = useState(null);
    const [isLoadingHotel, setIsLoadingHotel] = useState(false);
    const effectiveInitialData = initialData || fetchedHotel;
    const resolvedHotelId = effectiveInitialData?.uid || effectiveInitialData?.id || effectiveInitialData?.hotel?.hotelId || effectiveInitialData?.hotel?.hotelUid || hotelId;

    const handleClose = onClose || (() => navigate("/dashboard/hotels"));
    const [isActive, setIsActive] = useState(() => isListingActive(effectiveInitialData || {}));
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 3;

    useEffect(() => {
        if (isEdit && !initialData && hotelId) {
            setIsLoadingHotel(true);
            const loadHotel = async () => {
                try {
                    const snap = await getDoc(doc(db, "HotelDB", hotelId));
                    if (snap.exists()) {
                        const data = snap.data();
                        setFetchedHotel({
                            ...data,
                            id: snap.id,
                            uid: snap.id,
                        });
                    } else {
                        toast.error("Hotel not found in database");
                    }
                } catch (err) {
                    console.error("Failed to fetch hotel details:", err);
                    toast.error("Failed to load hotel details");
                } finally {
                    setIsLoadingHotel(false);
                }
            };
            loadHotel();
        }
    }, [isEdit, initialData, hotelId]);

    const { handleSubmit, control, setValue, getValues, register, formState: { errors }, trigger } = useForm({
        shouldUnregister: false // Keep values when fields unmount (step change)
    });
    const [map, setMap] = useState(null);
    const [location, setLocation] = useState(null);
    const [searchBox, setSearchBox] = useState(null);
    const [logoURL, setLogoURL] = useState("");
    const [rating, setRating] = useState(0);
    const [selectedAmenities, setSelectedAmenities] = useState([]);
    const [addressInputValue, setAddressInputValue] = useState("");
    const [customAmenities, setCustomAmenities] = useState([]);
    const [newAmenityInput, setNewAmenityInput] = useState("");

    const [hotelGallery, setHotelGallery] = useState([]);
    const [petsAllowed, setPetsAllowed] = useState(false);
    const [nearbyAttractions, setNearbyAttractions] = useState([]);
    const [attractionInput, setAttractionInput] = useState("");

    const [logoError, setLogoError] = useState(false);
    const [locationError, setLocationError] = useState(false);
    const [submissionError, setSubmissionError] = useState("");



    const [roomTypes, setRoomTypes] = useState([]);
    const packagePricing = hotelPackagePricing(roomTypes);
    const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
    const [editingRoomId, setEditingRoomId] = useState(null);
    const initialRoomState = {
        roomName: "",
        totalRooms: 5, // default 5 rooms per type for auto-booking (editable)
        maxAdults: "",
        maxChildren: "",
        numberOfBeds: "",
        bedType: "King",
        bedDetails: [],
        photos: [],
        amenities: [],
        description: "",
        policies: {
            checkIn: "14:00",
            checkOut: "12:00",
            extraBed: "",
            extraBedPrice: "",
            extraBedMaxAdults: 1,
            extraBedMaxChildren: 0,
            paymentInfo: "Prepaid",
            refundable: true
        },
        foodInfo: {
            breakfastIncluded: false,
            breakfastType: "Continental"
        },
        pricing: {
            basePrice: "",
            discountPercent: "",
            taxIncluded: true,
            pricingBasedOnGuests: []
        }
    };
    const [newRoom, setNewRoom] = useState(initialRoomState);
    const [roomAmenityInput, setRoomAmenityInput] = useState("");

    const getDefaultRoomCapacity = (room) => {
        const bedDetails = room?.bedDetails || [];
        const totalBeds = bedDetails.reduce((acc, bed) => acc + (Number(bed.count) || 0), 0);

        const baseCapacity = bedDetails.reduce((acc, bed) => {
            const count = Number(bed.count) || 0;
            const isSingle = (bed.type || "").toLowerCase() === "single";

            return {
                adults: acc.adults + (isSingle ? count : count * 2),
                children: acc.children + count,
            };
        }, { adults: 0, children: 0 });

        if (totalBeds === 0) {
            return {
                maxAdults: 0,
                maxChildren: 0,
                extraBedMaxAdults: room?.policies?.extraBed === "Available" ? 1 : 0,
                extraBedMaxChildren: 0,
            };
        }

        return {
            maxAdults: baseCapacity.adults,
            maxChildren: baseCapacity.children,
            extraBedMaxAdults: room?.policies?.extraBed === "Available" ? 1 : 0,
            extraBedMaxChildren: 0,
        };
    };

    useEffect(() => {
        if (isEdit && effectiveInitialData) {
            setIsActive(isListingActive(effectiveInitialData));
            const h = effectiveInitialData.hotel || effectiveInitialData;

            setValue("hotelName", h.hotelName || effectiveInitialData.hotelName || "");
            setValue("email", effectiveInitialData.email || h.email || "");
            setValue("phoneNumber", h.phoneNumber || effectiveInitialData.phoneNumber || "");
            setValue("address", h.address || effectiveInitialData.address || "");
            setValue("country", h.country || effectiveInitialData.country || "Thailand");
            setValue("description", h.description || effectiveInitialData.description || "");
            setValue("policies", h.policies || effectiveInitialData.policies || "");

            setLogoURL(h.images?.logo || effectiveInitialData.images?.logo || h.logoURL || effectiveInitialData.logoURL || "");
            setHotelGallery(h.images?.gallery || effectiveInitialData.images?.gallery || []);
            setPetsAllowed(h.petsAllowed ?? effectiveInitialData.petsAllowed ?? false);
            setNearbyAttractions(h.nearbyAttractions || effectiveInitialData.nearbyAttractions || []);

            const features = h.features || effectiveInitialData.features || h.amenities || effectiveInitialData.amenities || [];
            const predefinedIds = ['pool', 'gym', 'wifi', 'parking', 'restaurant', 'spa'];
            const foundPredefined = Array.isArray(features) ? features.filter(f => predefinedIds.includes(f)) : [];
            const foundCustom = Array.isArray(features) ? features.filter(f => !predefinedIds.includes(f)) : [];

            setSelectedAmenities(foundPredefined);
            setCustomAmenities(foundCustom);
            setRating(h.rating ?? effectiveInitialData.rating ?? 0);

            if (effectiveInitialData.rooms && Array.isArray(effectiveInitialData.rooms)) {
                setRoomTypes(effectiveInitialData.rooms);
            }

            const loc = h.location || effectiveInitialData.location;
            if (loc) {
                setLocation(loc);
                if (map) map.panTo(loc);
            }
            const addr = h.address || effectiveInitialData.address;
            if (addr) setAddressInputValue(addr);

            // Fetch Rooms from Subcollection if editing
            const targetHid = resolvedHotelId;
            if (targetHid) {
                const fetchSubRooms = async () => {
                    try {
                        const roomsRef = collection(db, "HotelDB", targetHid, "rooms");
                        const roomSnap = await getDocs(roomsRef);
                        if (!roomSnap.empty) {
                            const dbRooms = roomSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                            setRoomTypes(dbRooms);
                        }
                    } catch (err) {
                        console.error("Error fetching rooms:", err);
                    }
                };
                fetchSubRooms();
            }
        }
    }, [isEdit, effectiveInitialData, resolvedHotelId, setValue, map]);

    const handleRoomPhotoUpload = async (e) => {
        const original = e.target.files?.[0];
        e.target.value = '';
        if (!original) return;
        let file;
        try { file = await cropImageFile(original, { width: 1200, height: 750 }); }
        catch (error) { toast.error(error.message); return; }
        if (!file) return;
        const result = await getFileUrl([file]);
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
        const original = e.target.files?.[0];
        e.target.value = '';
        if (!original) return;
        let file;
        try { file = await cropImageFile(original, { width: 1200, height: 750 }); }
        catch (error) { toast.error(error.message); return; }
        if (!file) return;
        const result = await getFileUrl([file]);
        if (result?.error) {
            toast.error(result.message);
        } else {
            setHotelGallery(prev => [...prev, result.url]);
        }
    };

    const removeGalleryImage = (index) => {
        setHotelGallery(prev => prev.filter((_, i) => i !== index));
    };

    const openAddRoomModal = () => {
        setEditingRoomId(null);
        setNewRoom(initialRoomState);
        setIsRoomModalOpen(true);
    };

    const handleEditRoom = (room) => {
        setEditingRoomId(room.id);

        let inferredBedDetails = room.bedDetails || [];
        if (inferredBedDetails.length === 0 && room.bedType) {
            inferredBedDetails = [{ type: room.bedType, count: Number(room.numberOfBeds) || 1 }];
        }

        const capacityFromBeds = getDefaultRoomCapacity({
            ...room,
            bedDetails: inferredBedDetails,
        });

        setNewRoom({
            ...initialRoomState,
            ...room,
            roomName: room.roomName || room.packageName || "",
            bedDetails: inferredBedDetails,
            // Prefer saved adults/children; fall back to beds or legacy numberOfGuests
            maxAdults:
                room.maxAdults !== undefined && room.maxAdults !== null && room.maxAdults !== ""
                    ? Number(room.maxAdults)
                    : (room.numberOfGuests != null && room.numberOfGuests !== ""
                        ? Number(room.numberOfGuests)
                        : capacityFromBeds.maxAdults),
            maxChildren:
                room.maxChildren !== undefined && room.maxChildren !== null && room.maxChildren !== ""
                    ? Number(room.maxChildren)
                    : capacityFromBeds.maxChildren,
            pricing: { ...initialRoomState.pricing, ...room.pricing },
            policies: {
                ...initialRoomState.policies,
                ...room.policies,
                extraBedPrice: room.policies?.extraBed === "Available" ? (Number(room.policies?.extraBedPrice) || "") : "",
                extraBedMaxAdults: room.policies?.extraBed === "Available" ? 1 : 0,
                extraBedMaxChildren: 0,
            },
            foodInfo: { ...initialRoomState.foodInfo, ...room.foodInfo },
        });
        setIsRoomModalOpen(true);
    };

    const handleAddRoom = () => {
        if (!newRoom.roomName || newRoom.pricing.basePrice === "" || newRoom.pricing.basePrice === null || newRoom.pricing.basePrice === undefined) {
            toast.error("Please fill in Room Name and Base Price");
            return;
        }
        const basePriceNum = Number(newRoom.pricing.basePrice);
        if (isNaN(basePriceNum) || basePriceNum <= 0) {
            toast.error("Room Base Price must be greater than 0");
            return;
        }

        const isExtraBedAvail = newRoom.policies.extraBed === "Available";
        let extraBedPriceFinal = 0;
        if (isExtraBedAvail) {
            const extraBedNum = Number(newRoom.policies.extraBedPrice);
            if (newRoom.policies.extraBedPrice === "" || isNaN(extraBedNum) || extraBedNum <= 0) {
                toast.error("Extra Bed Price must be greater than 0");
                return;
            }
            extraBedPriceFinal = extraBedNum;
        }

        const discountPercentNum = Math.min(99, Math.max(0, Number(newRoom.pricing.discountPercent) || 0));
        const priceAfterDiscount = Math.max(1, Math.round(basePriceNum * (1 - discountPercentNum / 100)));
        const defaultCapacity = getDefaultRoomCapacity(newRoom);
        const resolvedMaxAdults = newRoom.maxAdults === "" ? defaultCapacity.maxAdults : Number(newRoom.maxAdults);
        const resolvedMaxChildren = newRoom.maxChildren === "" ? defaultCapacity.maxChildren : Number(newRoom.maxChildren);
        const resolvedExtraBedMaxAdults = isExtraBedAvail ? 1 : 0;
        const resolvedExtraBedMaxChildren = 0;

        const totalBeds = (newRoom.bedDetails || []).reduce((acc, curr) => acc + (Number(curr.count) || 0), 0) || Number(newRoom.numberOfBeds) || 0;
        const typeSummary = (newRoom.bedDetails || []).map(b => `${b.count} ${b.type}`).join(", ") || newRoom.bedType || "King";
        // Default 5 rooms per type for auto-booking (editable)
        const inventoryQty = Math.max(1, Math.floor(Number(newRoom.totalRooms) || 5));

        const finalRoom = {
            // Always string id - numeric ids break Firestore paths / queries
            id: editingRoomId
                ? String(editingRoomId)
                : (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
            ...newRoom,
            packageName: newRoom.roomName,
            totalRooms: inventoryQty,
            quantity: inventoryQty,
            amenities: newRoom.amenities || [],
            maxAdults: resolvedMaxAdults,
            maxChildren: resolvedMaxChildren,
            // Keep numberOfGuests in sync for older package/booking readers; do not use as a separate max-guest field
            numberOfGuests: resolvedMaxAdults + resolvedMaxChildren,
            numberOfBeds: totalBeds,
            bedType: typeSummary,
            bedDetails: newRoom.bedDetails || [],
            allowExtraBed: isExtraBedAvail,
            hasExtraBed: isExtraBedAvail,
            extraBedPrice: extraBedPriceFinal,
            policies: {
                ...newRoom.policies,
                extraBed: isExtraBedAvail ? "Available" : "",
                extraBedPrice: extraBedPriceFinal,
                extraBedMaxAdults: resolvedExtraBedMaxAdults,
                extraBedMaxChildren: resolvedExtraBedMaxChildren,
            },
            pricing: {
                ...newRoom.pricing,
                basePrice: basePriceNum,
                discountPercent: discountPercentNum,
                pricePerNightAfterDiscount: priceAfterDiscount,
                priceForStay: {
                    nights: 1,
                    totalAmount: priceAfterDiscount
                }
            }
        };

        if (editingRoomId) {
            setRoomTypes(prev => prev.map(r => r.id === editingRoomId ? finalRoom : r));
            successNotification("Room updated successfully!");
        } else {
            setRoomTypes(prev => [...prev, finalRoom]);
            successNotification("Room staged! Please proceed to 'Configuration' and 'Submit' to save.");
        }

        setNewRoom(initialRoomState);
        setEditingRoomId(null);
        setIsRoomModalOpen(false);
    };

    const handleDeleteRoom = (id) => {
        setRoomTypes(prev => prev.filter(r => r.id !== id));
    };

    /** Inventory total = sum of each room type's count (no separate hotel-level total). */
    const sumRoomInventory = (rooms) =>
        (rooms || []).reduce((sum, r) => {
            const n = Number(r.totalRooms ?? r.quantity ?? 0);
            return sum + (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
        }, 0);

    const onSubmit = async (data) => {
        if (!logoURL) { setLogoError(true); return; }
        if (!location && !addressInputValue) { setLocationError(true); return; }

        setSubmissionError("");

        const effectiveData = effectiveInitialData;
        const targetHotelId = isEdit
            ? (resolvedHotelId || effectiveData?.uid || effectiveData?.id || effectiveData?.hotel?.hotelId || effectiveData?.hotel?.hotelUid || hotelId)
            : (doc(hotelsCollection).id);

        if (isEdit && !targetHotelId) {
            toast.error("Hotel identifier not found. Cannot update.");
            return;
        }

        try {
            const existingAvailabilityConfig =
                effectiveData?.availabilityConfig ||
                effectiveData?.hotel?.availabilityConfig;
            const derivedTotalRooms = sumRoomInventory(roomTypes);
            const availabilityConfig = {
                autoBookingEnabled: true,
                defaultRoomInventory: 5,
                notifyOnFull: true,
                notifyOnFreed: true,
                timezone: "Asia/Bangkok",
                ...(existingAvailabilityConfig || {}),
            };

            const hotelObjectPayload = {
                hotelId: targetHotelId,
                hotelUid: targetHotelId,
                hotelName: data.hotelName || "",
                country: data.country || "Thailand",
                currency: "THB",
                startingPrice: packagePricing.startingPrice,
                discount: packagePricing.discount,
                totalRooms: derivedTotalRooms,
                address: addressInputValue || data.address || "",
                description: data.description || "",
                policies: data.policies || "",
                images: {
                    logo: logoURL || "",
                    gallery: hotelGallery || []
                },
                petsAllowed: petsAllowed,
                nearbyAttractions: nearbyAttractions || [],
                features: [...selectedAmenities, ...customAmenities],
                phoneNumber: data.phoneNumber || "",
                email: data.email || "",
                rating: rating || 0,
                numberOfReviews: isEdit ? (effectiveData?.hotel?.numberOfReviews || effectiveData?.numberOfReviews || 0) : 0,
                ...listingStatusFields(isActive),
                updatedAt: new Date().toISOString(),
                location: location || null
            };

            const finalPayload = {
                ...listingStatusFields(isActive),
                uid: targetHotelId,
                id: targetHotelId,
                hotelUid: targetHotelId,
                hotelName: data.hotelName || "",
                country: data.country || "Thailand",
                currency: "THB",
                startingPrice: packagePricing.startingPrice,
                discount: packagePricing.discount,
                totalRooms: derivedTotalRooms,
                address: addressInputValue || data.address || "",
                description: data.description || "",
                policies: data.policies || "",
                images: {
                    logo: logoURL || "",
                    gallery: hotelGallery || []
                },
                logoURL: logoURL || "",
                petsAllowed: petsAllowed,
                nearbyAttractions: nearbyAttractions || [],
                features: [...selectedAmenities, ...customAmenities],
                phoneNumber: data.phoneNumber || "",
                email: data.email || "",
                rating: rating || 0,
                location: location || null,
                hotel: hotelObjectPayload,
                updatedAt: serverTimestamp()
            };

            const hotelDocRef = doc(db, "HotelDB", targetHotelId);

            if (isEdit) {
                await setDoc(hotelDocRef, finalPayload, { merge: true });

                // Synchronize user doc if possible, but don't fail the hotel update if user doc doesn't exist
                try {
                    await setDoc(doc(db, "users", targetHotelId), {
                        status: "Verified",
                        isVerified: true
                    }, { merge: true });
                } catch (userErr) {
                    console.warn("User doc update skipped or failed:", userErr);
                }
            } else {
                await setDoc(hotelDocRef, finalPayload);
            }

            if (!isEdit || existingAvailabilityConfig) {
                try {
                    await setDoc(
                        doc(db, "HotelDB", targetHotelId, "availability", "config"),
                        {
                            ...availabilityConfig,
                            recordType: "config",
                            hotelUid: targetHotelId,
                            updatedAt: serverTimestamp(),
                        },
                        { merge: true }
                    );
                } catch (availErr) {
                    console.warn("Availability config save warning:", availErr);
                }
            }

            // Save Rooms to Sub-collection
            const roomsSubCollectionRef = collection(db, "HotelDB", targetHotelId, "rooms");
            const keepIds = new Set(roomTypes.map((r) => String(r.id)));

            if (isEdit) {
                try {
                    const existingSnap = await getDocs(roomsSubCollectionRef);
                    const deletePromises = existingSnap.docs
                        .filter((d) => !keepIds.has(d.id))
                        .map(async (d) => {
                            const batch = writeBatch(db);
                            batch.delete(d.ref);
                            batch.delete(doc(db, 'hotelPackageDetails', d.id));
                            await batch.commit();
                        });
                    await Promise.all(deletePromises);
                } catch (delErr) {
                    console.warn("Room type cleanup failed", delErr);
                }
            }

            const roomPromises = roomTypes.map(async (room) => {
                const roomId = String(room.id || (crypto.randomUUID ? crypto.randomUUID() : Date.now()));
                const roomDocRef = doc(roomsSubCollectionRef, roomId);
                const isExtraBed = room.policies?.extraBed === "Available" || room.hasExtraBed === true || room.allowExtraBed === true;
                const extraBedSinglePrice = isExtraBed ? Math.max(1, Number(room.policies?.extraBedPrice ?? room.extraBedPrice ?? 0)) : 0;
                const roomPayload = {
                    ...listingStatusFields(isListingActive(room)),
                    id: roomId,
                    packageName: room.roomName || room.packageName || room.name || "Room",
                    hotelName: data.hotelName,
                    updatedAt: serverTimestamp(),
                    ...room,
                    ...listingStatusFields(isListingActive(room)),
                    hotelUid: targetHotelId,
                    allowExtraBed: isExtraBed,
                    hasExtraBed: isExtraBed,
                    extraBedPrice: extraBedSinglePrice,
                    policies: {
                        ...(room.policies || {}),
                        extraBed: isExtraBed ? "Available" : "",
                        extraBedPrice: extraBedSinglePrice,
                        extraBedMaxAdults: isExtraBed ? 1 : 0,
                        extraBedMaxChildren: 0,
                    }
                };
                const batch = writeBatch(db);
                batch.set(roomDocRef, roomPayload, { merge: true });
                batch.set(doc(db, 'hotelPackageDetails', roomId), roomPayload, { merge: true });
                await batch.commit();
            });

            await Promise.all(roomPromises);

            successNotification(isEdit ? "Hotel & Rooms updated successfully!" : "New Hotel & Rooms Added!");
            handleClose();

        } catch (error) {
            console.error("Submission Error:", error);
            setSubmissionError("Failed to save hotel. " + error.message);
            toast.error("Failed to save hotel: " + error.message);
        }
    };

    const onMapLoad = (mapInstance) => {
        setMap(mapInstance);
        const loc = effectiveInitialData?.hotel?.location || effectiveInitialData?.location;
        if (isEdit && loc) {
            mapInstance.panTo(loc);
        }
    };

    const onMapClick = (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setLocation({ lat, lng });
        setAddressInputValue(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
        setLocationError(false);
    };

    const handlePlacesChanged = () => {
        if (!searchBox) return;
        const place = searchBox.getPlace();
        if (place && place.geometry) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            setLocation({ lat, lng });
            setAddressInputValue(place.formatted_address);
            if (map) map.panTo({ lat, lng });
        }
    };

    const handleUploadLogo = async (e) => {
        const original = e.target.files?.[0];
        e.target.value = '';
        if (!original) return;
        let file;
        try { file = await cropImageFile(original, { width: 800, height: 800 }); }
        catch (error) { toast.error(error.message); return; }
        if (!file) return;
        const result = await getFileUrl([file]);
        if (result?.error) {
            toast.error(result.message);
        } else {
            setLogoURL(result.url);
            setLogoError(false);
        }
    };

    const handleNext = async () => {
        const stepsValidation = [
            ['hotelName', 'email', 'phoneNumber'], // Step 1 fields
            [], // Step 2 (Rooms are validated separately or checked on next)
            []  // Step 3
        ];

        const isValid = await trigger(stepsValidation[currentStep - 1]);
        if (isValid) {
            if (currentStep === 1) {
                if (!logoURL) { setLogoError(true); return; }
                if (!location && !addressInputValue) { setLocationError(true); return; }
            }
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        setCurrentStep(prev => prev - 1);
    };

    // Render Steps
    const renderStep1 = () => (
        <FadeIn>
            <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-6">
                        <Controller
                            name="hotelName"
                            control={control}
                            rules={{ required: "Hotel Name is required" }}
                            render={({ field }) => (
                                <TextField {...field} label={<span>Hotel Name <span className="text-red-500">*</span></span>} fullWidth error={!!errors.hotelName} helperText={errors.hotelName?.message}
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }} />
                            )}
                        />
                    </div>
                    <div className="md:col-span-6">
                        <Controller
                            name="email"
                            control={control}
                            rules={{ required: "Email is required", pattern: { value: /^\S+@\S+$/i, message: "Invalid email" } }}
                            render={({ field }) => (
                                <TextField {...field} label={<span>Email Address <span className="text-red-500">*</span></span>} fullWidth error={!!errors.email} helperText={errors.email?.message}
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }} />
                            )}
                        />
                    </div>
                    <div className="md:col-span-6">
                        <Controller
                            name="phoneNumber"
                            control={control}
                            rules={{ required: "Phone is required" }}
                            render={({ field }) => (
                                <CountryPhoneInput {...field} label="Phone Number" required error={!!errors.phoneNumber} helperText={errors.phoneNumber?.message} />
                            )}
                        />
                    </div>
                    <div className="md:col-span-6">
                        <Controller
                            name="country"
                            control={control}
                            defaultValue="Thailand"
                            render={({ field }) => (
                                <TextField {...field} label="Country" fullWidth
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }} />
                            )}
                        />
                    </div>
                </div>

                {/* Address & Map */}
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700">Location <span className="text-red-500">*</span></label>
                    <Autocomplete onLoad={(ref) => setSearchBox(ref)} onPlaceChanged={handlePlacesChanged}>
                        <TextField
                            fullWidth
                            placeholder="Search for a location..."
                            value={addressInputValue}
                            onChange={(e) => setAddressInputValue(e.target.value)}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><MdLocationOn className="text-gray-400" /></InputAdornment>
                            }}
                            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                        />
                    </Autocomplete>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Controller
                        name="address"
                        control={control}
                        render={({ field }) => (
                            <TextField {...field} label={<span>Full Address <span className="text-red-500">*</span></span>} multiline rows={3} fullWidth
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }} />
                        )}
                    />
                    <Controller
                        name="description"
                        control={control}
                        render={({ field }) => (
                            <TextField {...field} label={<span>Description <span className="text-red-500">*</span></span>} multiline rows={3} fullWidth
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }} />
                        )}
                    />
                </div>

                {/* Amenities & Features */}
                <div className="space-y-4">
                    <label className="block text-sm font-bold text-gray-700">Hotel Amenities</label>
                    <div className="flex flex-wrap gap-3">
                        {amenitiesList.map(amenity => (
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

                <div className="space-y-4">
                    <label className="block text-sm font-bold text-gray-700">Custom Amenities</label>
                    <div className="flex gap-2">
                        <TextField
                            value={newAmenityInput}
                            onChange={(e) => setNewAmenityInput(e.target.value)}
                            placeholder="Add custom amenity..."
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
                            type="button"
                            onClick={handleAddCustomAmenity}
                            variant="contained"
                            sx={{ borderRadius: "999px", textTransform: "none", minWidth: "100px" }}
                        >
                            Add
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {customAmenities.map((amenity, index) => (
                            <Chip
                                key={index}
                                label={amenity}
                                onDelete={() => removeCustomAmenity(index)}
                                sx={{ borderRadius: "8px", fontWeight: 600 }}
                            />
                        ))}
                    </div>
                </div>

                {/* Rating & Etc */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Star Rating</label>
                        <StarRating rating={rating} setRating={setRating} />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-700">Pets Allowed?</span>
                        <input type="checkbox" checked={petsAllowed} onChange={(e) => setPetsAllowed(e.target.checked)} className="w-5 h-5" />
                    </div>
                </div>

                {/* Nearby Attractions */}
                <div className="space-y-4">
                    <label className="block text-sm font-bold text-gray-700">Nearby Attractions</label>
                    <div className="flex gap-2">
                        <TextField
                            value={attractionInput}
                            onChange={(e) => setAttractionInput(e.target.value)}
                            placeholder="e.g. Pattaya Beach - 200m"
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
                            type="button"
                            onClick={handleAddAttraction}
                            variant="contained"
                            sx={{ borderRadius: "999px", textTransform: "none", minWidth: "100px" }}
                        >
                            Add
                        </Button>
                    </div>
                    {nearbyAttractions.length > 0 && (
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
                    )}
                </div>

                {/* Photos */}
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Main Logo / Cover <span className="text-red-500">*</span></label>
                        <div className={`border-2 border-dashed rounded-3xl p-1 text-center hover:bg-gray-50 transition-colors cursor-pointer relative bg-gray-50/50 h-58 sm:h-64 flex flex-col items-center justify-center overflow-hidden ${logoError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}>
                            <input
                                type="file"
                                onChange={handleUploadLogo}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            {logoURL ? (
                                <div className="absolute inset-0 w-full h-full">
                                    <img src={logoURL} alt="Hotel Logo" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-20">
                                        <MdCloudUpload className="text-white text-4xl mb-2" />
                                        <span className="text-white font-bold text-sm">Change Image</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setLogoURL("");
                                        }}
                                        className="absolute top-2 right-2 z-30 bg-white/90 p-2 rounded-full text-red-500 shadow-md hover:scale-110 transition-transform"
                                    >
                                        <MdDelete size={20} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-blue-50 text-blue-500 ${logoError ? 'bg-red-50 text-red-400' : ''}`}>
                                        {logoError ? <MdError size={24} /> : <MdCloudUpload size={24} />}
                                    </div>
                                    <div className="space-y-1">
                                        <p className={`font-bold text-sm ${logoError ? 'text-red-500' : 'text-gray-700'}`}>
                                            {logoError ? "Image Required" : "Click to upload"}
                                        </p>
                                        <p className="text-xs text-gray-400">SVG, PNG, JPG or GIF (max. 800x400px)</p>
                                    </div>
                                </div>
                            )}
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
                </div>

                {/* Map */}
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
                    {roomTypes.map((room) => (
                        <div key={room.id} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm relative hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-bold text-gray-900">{room.name || room.roomName || "Unnamed Room"}</h3>
                                <div className="flex gap-2">
                                    <IconButton size="small" onClick={() => handleEditRoom(room)} className="text-gray-400 hover:text-blue-500"><MdEdit /></IconButton>
                                    <IconButton size="small" onClick={() => handleDeleteRoom(room.id)} className="text-gray-400 hover:text-red-500"><MdDelete /></IconButton>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Base Price</label>
                                    <div className="mt-1 bg-gray-50 rounded-xl px-3 py-2 text-gray-900 font-bold border border-gray-100">
                                        $ {room.pricing?.basePrice || room.price || 0}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Adults</label>
                                    <div className="mt-1 bg-gray-50 rounded-xl px-3 py-2 text-gray-900 font-bold border border-gray-100">
                                        {room.maxAdults ?? 0}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Children</label>
                                    <div className="mt-1 bg-gray-50 rounded-xl px-3 py-2 text-gray-900 font-bold border border-gray-100">
                                        {room.maxChildren ?? 0}
                                    </div>
                                </div>
                                {room.policies?.extraBed === "Available" && (
                                    <div className="col-span-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Extra Bed (Single Price)</label>
                                        <div className="mt-1 bg-blue-50 rounded-xl px-3 py-2 text-blue-900 font-bold border border-blue-100">
                                            ฿ {room.policies?.extraBedPrice || 0}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    <div
                        onClick={openAddRoomModal}
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

                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">Hotel Details</h3>
                            <div className="space-y-2">
                                <p><span className="font-semibold text-gray-900">Name:</span> {getValues("hotelName")}</p>
                                <p><span className="font-semibold text-gray-900">Email:</span> {getValues("email")}</p>
                                <p><span className="font-semibold text-gray-900">Phone:</span> {getValues("phoneNumber")}</p>
                                <p><span className="font-semibold text-gray-900">Address:</span> {addressInputValue || getValues("address")}</p>
                                <p><span className="font-semibold text-gray-900">Description:</span> {getValues("description")}</p>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">Configuration</h3>
                            <div className="space-y-2">
                                <p><span className="font-semibold text-gray-900">Room Types:</span> {roomTypes.length}</p>
                                {roomTypes.some(r => r.policies?.extraBed === "Available") && (
                                    <p><span className="font-semibold text-gray-900">Extra Beds:</span> Yes (Available in some rooms)</p>
                                )}
                                <p><span className="font-semibold text-gray-900">Amenities:</span> {[...selectedAmenities, ...customAmenities].length} selected</p>
                                <p><span className="font-semibold text-gray-900">Pets Allowed:</span> {petsAllowed ? "Yes" : "No"}</p>
                                <p><span className="font-semibold text-gray-900">Package Starting Price:</span> THB {packagePricing.startingPrice}</p>
                                <p><span className="font-semibold text-gray-900">Room Discount:</span> {packagePricing.discount}%</p>
                                <p><span className="font-semibold text-gray-900">Price After Discount:</span> THB {Number((packagePricing.startingPrice * (1 - packagePricing.discount / 100)).toFixed(2))}</p>
                                <p><span className="font-semibold text-gray-900">Images:</span> {hotelGallery.length + (logoURL ? 1 : 0)} uploaded</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </FadeIn>
    );

    if (isLoadingHotel) {
        return (
            <Box className="bg-[#f8f9fa] min-h-screen p-6 font-sans relative flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-gray-600 font-medium">Loading hotel details...</p>
                </div>
            </Box>
        );
    }

    return (
        <Box className="bg-[#f8f9fa] min-h-screen p-6 font-sans relative">
            <ToastContainer
                position="top-center"
                autoClose={3000}
                style={{ zIndex: 99999 }}
            />

            <div className="max-w-5xl mx-auto">
                {/* Header added here */}
                <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e293b' }}>
                        {isEdit ? "Edit Hotel Details" : "Add New Hotel"}
                    </Typography>

                </Box>

                <ListingStatus active={isActive} onChange={setIsActive} label="Hotel visibility" />
                <p className="text-sm text-slate-500 mb-4">Active hotels are visible and bookable on the website.</p>
                <ProgressBar currentStep={currentStep} totalSteps={totalSteps} isEdit={isEdit} />

                <form
                    onSubmit={(e) => e.preventDefault()}
                    className="bg-white rounded-[32px] p-8 shadow-sm"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                            e.preventDefault();
                        }
                    }}
                >
                    {currentStep === 1 && renderStep1()}
                    {currentStep === 2 && renderStep2()}
                    {currentStep === 3 && renderStep3()}

                    {/* Alert removed as requested */}

                    <div className="flex justify-between items-center mt-6 pt-6">
                        {currentStep > 1 ? (
                            <Button
                                type="button"
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
                                type="button"
                                onClick={handleClose}
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
                                type="button"
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
                                type="button"
                                onClick={handleSubmit(onSubmit, (errs) => {
                                    console.warn("Form validation errors:", errs);
                                    const errorFields = Object.keys(errs);
                                    if (errorFields.length > 0) {
                                        toast.error(`Please fix validation errors: ${errorFields.join(", ")}`);
                                        if (['hotelName', 'email', 'phoneNumber', 'address', 'country'].some(f => errorFields.includes(f))) {
                                            setCurrentStep(1);
                                        }
                                    }
                                })}
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
                                {isEdit ? "Update Hotel" : "Submit Hotel"}
                            </Button>
                        )}
                    </div>
                </form>

                <Dialog
                    open={isRoomModalOpen}
                    onClose={() => setIsRoomModalOpen(false)}
                    PaperProps={{
                        style: { borderRadius: '24px', padding: '16px', maxWidth: '800px', width: '100%' }
                    }}
                >
                    <DialogTitle sx={{ fontWeight: 800, fontSize: '1.5rem', textAlign: 'center' }}>{editingRoomId ? "Edit Room" : "Add New Room"}</DialogTitle>
                    <DialogContent>
                            <ListingStatus active={isListingActive(newRoom)} onChange={(active) => setNewRoom((room) => ({ ...room, ...listingStatusFields(active) }))} label="Room visibility" />
                        {(() => {
                            const defaultCapacity = getDefaultRoomCapacity(newRoom);

                            return (
                        <div className="space-y-6 mt-2">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                <div className="md:col-span-6">
                                    <TextField
                                        label="Room Name"
                                        fullWidth
                                        value={newRoom.roomName}
                                        onChange={(e) => setNewRoom({ ...newRoom, roomName: e.target.value })}
                                        variant="outlined"
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                                    />
                                </div>
                                <div className="md:col-span-3">
                                    <TextField
                                        label="Base Price (฿)"
                                        type="number"
                                        fullWidth
                                        inputProps={{ min: 1 }}
                                        value={newRoom.pricing.basePrice}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === "") {
                                                setNewRoom({ ...newRoom, pricing: { ...newRoom.pricing, basePrice: "" } });
                                            } else {
                                                const num = Number(val);
                                                if (num > 0) {
                                                    setNewRoom({ ...newRoom, pricing: { ...newRoom.pricing, basePrice: num } });
                                                }
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "-" || e.key === "+" || e.key === "e") {
                                                e.preventDefault();
                                            }
                                        }}
                                        helperText="Must be greater than 0"
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                                    />
                                </div>
                                <div className="md:col-span-3">
                                    <TextField
                                        label="Discount (%)"
                                        type="number"
                                        fullWidth
                                        inputProps={{ min: 0, max: 99 }}
                                        value={newRoom.pricing.discountPercent}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === "") {
                                                setNewRoom({ ...newRoom, pricing: { ...newRoom.pricing, discountPercent: "" } });
                                            } else {
                                                const num = Math.min(99, Math.max(0, Number(val)));
                                                setNewRoom({ ...newRoom, pricing: { ...newRoom.pricing, discountPercent: num } });
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "-" || e.key === "+" || e.key === "e") {
                                                e.preventDefault();
                                            }
                                        }}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                <div className="md:col-span-6">
                                    <TextField
                                        label="Description"
                                        fullWidth
                                        multiline
                                        rows={2}
                                        value={newRoom.description}
                                        onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                                        variant="outlined"
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <TextField
                                        label="Adults"
                                        type="number"
                                        fullWidth
                                        inputProps={{ min: 0 }}
                                        value={newRoom.maxAdults === "" || newRoom.maxAdults === null || newRoom.maxAdults === undefined ? "" : newRoom.maxAdults}
                                        onChange={(e) => {
                                            const raw = e.target.value;
                                            setNewRoom((prev) => ({
                                                ...prev,
                                                maxAdults: raw === "" ? "" : Math.max(0, Number(raw)),
                                            }));
                                        }}
                                        onBlur={(e) => {
                                            // If left empty, seed from bed config on blur (still fully editable after)
                                            if (e.target.value === "") {
                                                setNewRoom((prev) => ({
                                                    ...prev,
                                                    maxAdults: defaultCapacity.maxAdults,
                                                }));
                                            }
                                        }}
                                        placeholder={String(defaultCapacity.maxAdults)}
                                        helperText={`Suggested: ${defaultCapacity.maxAdults} (from beds)`}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <TextField
                                        label="Children"
                                        type="number"
                                        fullWidth
                                        inputProps={{ min: 0 }}
                                        value={newRoom.maxChildren === "" || newRoom.maxChildren === null || newRoom.maxChildren === undefined ? "" : newRoom.maxChildren}
                                        onChange={(e) => {
                                            const raw = e.target.value;
                                            setNewRoom((prev) => ({
                                                ...prev,
                                                maxChildren: raw === "" ? "" : Math.max(0, Number(raw)),
                                            }));
                                        }}
                                        onBlur={(e) => {
                                            if (e.target.value === "") {
                                                setNewRoom((prev) => ({
                                                    ...prev,
                                                    maxChildren: defaultCapacity.maxChildren,
                                                }));
                                            }
                                        }}
                                        placeholder={String(defaultCapacity.maxChildren)}
                                        helperText={`Suggested: ${defaultCapacity.maxChildren} (from beds)`}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                                    />
                                </div>
                                <div className="md:col-span-2 flex items-center justify-center border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => setNewRoom({ ...newRoom, foodInfo: { ...newRoom.foodInfo, breakfastIncluded: !newRoom.foodInfo.breakfastIncluded } })}>
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs font-bold text-gray-500 mb-1 select-none">Breakfast?</span>
                                        <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${newRoom.foodInfo.breakfastIncluded ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                                            {newRoom.foodInfo.breakfastIncluded && <MdCheck className="text-white" />}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border border-gray-200 rounded-2xl p-5 bg-gray-50/30">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <label className="text-base font-extrabold text-gray-800 block">Bed Configuration</label>
                                        <p className="text-xs text-gray-400 mt-0.5">Define sleeping arrangements for this room</p>
                                    </div>
                                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                                        Multi-select allowed
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                    {['Single', 'Double', 'Queen', 'King', 'Twin'].map(type => {
                                        const saved = (newRoom.bedDetails || []).find(b => b.type === type);
                                        const isSelected = !!saved;
                                        const count = saved ? saved.count : 0;

                                        const updateCount = (newCount) => {
                                            if (newCount <= 0) {
                                                setNewRoom(prev => ({
                                                    ...prev,
                                                    bedDetails: (prev.bedDetails || []).filter(b => b.type !== type)
                                                }));
                                            } else {
                                                setNewRoom(prev => ({
                                                    ...prev,
                                                    bedDetails: isSelected
                                                        ? prev.bedDetails.map(b => b.type === type ? { ...b, count: newCount } : b)
                                                        : [...(prev.bedDetails || []), { type, count: newCount }]
                                                }));
                                            }
                                        };

                                        return (
                                            <div
                                                key={type}
                                                onClick={() => !isSelected && updateCount(1)}
                                                className={`
                                                    relative flex flex-col justify-between
                                                    cursor-pointer rounded-2xl border transition-all duration-300 select-none group overflow-hidden
                                                    ${isSelected
                                                        ? 'border-blue-500 bg-blue-50/30 shadow-md ring-1 ring-blue-500/20'
                                                        : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
                                                    }
                                                    h-[140px] p-4
                                                `}
                                            >
                                                <div className="flex justify-between items-start w-full">
                                                    <div className={`
                                                        w-10 h-10 rounded-xl flex items-center justify-center transition-colors
                                                        ${isSelected ? 'bg-blue-500 text-white shadow-blue-200' : 'bg-gray-100 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-500'}
                                                    `}>
                                                        <FaBed size={18} />
                                                    </div>
                                                    <div className={`
                                                        w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300
                                                        ${isSelected ? 'border-blue-500 bg-blue-500 scale-100' : 'border-gray-200 bg-transparent scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100'}
                                                    `}>
                                                        <MdCheck className="text-white text-xs font-bold" />
                                                    </div>
                                                </div>

                                                <div className="mt-2">
                                                    <span className={`block font-bold text-lg mb-1 ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                                                        {type}
                                                    </span>

                                                    {isSelected ? (
                                                        <div className="flex items-center bg-white rounded-lg border border-blue-200 shadow-sm w-fit mt-2" onClick={e => e.stopPropagation()}>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateCount(count - 1)}
                                                                className="w-8 h-8 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-l-lg transition-colors active:bg-blue-100"
                                                            >
                                                                <FaMinus size={10} />
                                                            </button>
                                                            <div className="w-8 h-8 flex items-center justify-center border-x border-blue-100 font-bold text-blue-900 bg-blue-50/30 text-sm">
                                                                {count}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateCount(count + 1)}
                                                                className="w-8 h-8 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-r-lg transition-colors active:bg-blue-100"
                                                            >
                                                                <FaPlus size={10} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-gray-400 font-medium mt-3 group-hover:text-blue-400 transition-colors">Tap to add</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Room Amenities</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {[
                                        "Air Conditioning", "TV", "Mini Bar", "Balcony", "Coffee Maker",
                                        "Safe", "Hairdryer", "Iron", "Desk", "Bathtub", "Kitchenette"
                                    ].map(amenity => (
                                        <div
                                            key={amenity}
                                            onClick={() => {
                                                const current = newRoom.amenities || [];
                                                const updated = current.includes(amenity)
                                                    ? current.filter(a => a !== amenity)
                                                    : [...current, amenity];
                                                setNewRoom({ ...newRoom, amenities: updated });
                                            }}
                                            className={`px-3 py-1 rounded-full text-sm font-medium cursor-pointer border select-none transition-colors ${(newRoom.amenities || []).includes(amenity)
                                                ? "bg-blue-100 border-blue-200 text-blue-600"
                                                : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                                                }`}
                                        >
                                            {amenity}
                                        </div>
                                    ))}
                                    {(newRoom.amenities || []).filter(a => ![
                                        "Air Conditioning", "TV", "Mini Bar", "Balcony", "Coffee Maker",
                                        "Safe", "Hairdryer", "Iron", "Desk", "Bathtub", "Kitchenette"
                                    ].includes(a)).map(amenity => (
                                        <div
                                            key={amenity}
                                            className="px-3 py-1 rounded-full text-sm font-medium border select-none transition-colors bg-purple-100 border-purple-200 text-purple-600 flex items-center gap-1"
                                        >
                                            {amenity}
                                            <button onClick={() => setNewRoom(prev => ({ ...prev, amenities: prev.amenities.filter(item => item !== amenity) }))} className="text-purple-400 hover:text-purple-800">
                                                <MdClose size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2 items-center">
                                    <TextField
                                        size="small"
                                        placeholder="Add custom amenity..."
                                        value={roomAmenityInput}
                                        onChange={(e) => setRoomAmenityInput(e.target.value)}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" }, flex: 1 }}
                                    />
                                    <Button
                                        onClick={() => {
                                            if (roomAmenityInput.trim()) {
                                                setNewRoom(prev => ({ ...prev, amenities: [...(prev.amenities || []), roomAmenityInput.trim()] }));
                                                setRoomAmenityInput("");
                                            }
                                        }}
                                        variant="contained"
                                        sx={{ borderRadius: "12px", textTransform: "none" }}
                                    >
                                        Add
                                    </Button>
                                </div>
                            </div>

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
                                    <div className="flex items-center gap-4 p-2 border border-gray-200 rounded-xl h-[56px] relative">
                                        <span className="text-sm font-bold text-gray-600 pl-2">Extra Bed Available?</span>
                                        <input
                                            type="checkbox"
                                            checked={newRoom.policies.extraBed === "Available"}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setNewRoom({
                                                    ...newRoom,
                                                    policies: {
                                                        ...newRoom.policies,
                                                        extraBed: checked ? "Available" : "",
                                                        extraBedPrice: checked ? (newRoom.policies.extraBedPrice > 0 ? newRoom.policies.extraBedPrice : "") : 0,
                                                    }
                                                });
                                            }}
                                            className="w-5 h-5 text-blue-600 rounded absolute right-4"
                                        />
                                    </div>
                                    {newRoom.policies.extraBed === "Available" ? (
                                        <TextField
                                            label="Extra Bed Price (฿)"
                                            type="number"
                                            fullWidth
                                            inputProps={{ min: 1 }}
                                            value={newRoom.policies.extraBedPrice}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === "") {
                                                    setNewRoom({ ...newRoom, policies: { ...newRoom.policies, extraBedPrice: "" } });
                                                } else {
                                                    const num = Number(val);
                                                    if (num > 0) {
                                                        setNewRoom({ ...newRoom, policies: { ...newRoom.policies, extraBedPrice: num } });
                                                    }
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "-" || e.key === "+" || e.key === "e") {
                                                    e.preventDefault();
                                                }
                                            }}
                                            helperText="Single flat price for extra bed"
                                            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                                        />
                                    ) : (
                                        <div />
                                    )}
                                    <div className="col-span-2">
                                        <TextField
                                            label="Additional Notes"
                                            fullWidth
                                            multiline
                                            rows={2}
                                            value={newRoom.policies.notes || ""}
                                            onChange={(e) => setNewRoom({ ...newRoom, policies: { ...newRoom.policies, notes: e.target.value } })}
                                            placeholder="Special instructions, pet policy for this room, etc."
                                            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
                                        />
                                    </div>
                                </div>
                            </div>

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
                            );
                        })()}
                    </DialogContent>
                    <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
                        <Button type="button" onClick={() => setIsRoomModalOpen(false)} sx={{ color: 'gray', fontWeight: 600 }}>Cancel</Button>
                        <Button
                            type="button"
                            onClick={handleAddRoom}
                            variant="contained"
                            sx={{
                                borderRadius: '12px',
                                background: '#3b82f6',
                                fontWeight: 600,
                                px: 4
                            }}
                        >
                            {editingRoomId ? "Update Room" : "Add Room"}
                        </Button>
                    </DialogActions>
                </Dialog>
            </div>
        </Box >
    );
};

export default AddHotelForm;
