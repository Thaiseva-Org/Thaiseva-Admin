import { useEffect, useMemo, useState } from "react";
import {
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@mui/material";
import { CloseIcon } from "@icons";
import {
  GoogleMap,
  MarkerF,
  StandaloneSearchBox,
} from "@react-google-maps/api";
import axios from "axios";
import { getFileUrl } from "../../utils/utils";

const DEFAULT_CENTER = { lat: 13.7563, lng: 100.5018 }; // Bangkok center

const DEFAULT_CITIES = [
  "Bangkok",
  "Phuket",
  "Pattaya",
  "Chiang Mai",
  "Krabi",
  "Koh Samui",
  "Hua Hin",
  "Ayutthaya",
  "Chiang Rai",
  "Kanchanaburi",
];

const QUICK_INSTRUCTION_TAGS = [
  { label: "👗 Modest Dress Code", text: "Modest attire required: Please ensure shoulders and knees are covered." },
  { label: "🪪 20+ Age Check", text: "Age requirement 20+: Physical passport or photo ID required at door." },
  { label: "🎟️ Advance Booking", text: "Advance table/ticket reservations strongly recommended, especially on weekends." },
  { label: "🅿️ Onsite Parking", text: "Customer parking space available on premises." },
  { label: "📸 Photography Allowed", text: "Personal photography allowed (no flash or commercial tripods)." },
  { label: "👟 Remove Footwear", text: "Please remove shoes/footwear before stepping into sacred or interior areas." },
  { label: "💵 Cash / PromptPay", text: "Cash or Thai PromptPay preferred for local vendors and stalls." },
  { label: "♿ Wheelchair Accessible", text: "Wheelchair accessible entrances and facilities available." },
];

export default function AddAttractionModal({
  open,
  onClose,
  isUpdate,
  attraction,
  categories = [],
  existingCities = [],
  onSave,
}) {
  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    categoryName: "",
    description: "",
    imageUrl: "",
    address: "",
    city: "Bangkok",
    latitude: 13.7563,
    longitude: 100.5018,
    openingHours: "",
    contactNumber: "",
    websiteUrl: "",
    visitorInstructions: "",
    isFeatured: false,
  });

  // Custom city input state
  const [isAddingCity, setIsAddingCity] = useState(false);
  const [customCityName, setCustomCityName] = useState("");

  // Instruction guide panel toggle (General setup guide)
  const [showGuide, setShowGuide] = useState(false);

  // Dedicated Space Guidelines & Rules tips panel toggle
  const [showSpaceGuideTips, setShowSpaceGuideTips] = useState(false);

  const handleAddInstructionTag = (tagText) => {
    setFormData((prev) => {
      const current = prev.visitorInstructions ? prev.visitorInstructions.trim() : "";
      if (!current) {
        return { ...prev, visitorInstructions: tagText };
      }
      if (current.includes(tagText)) {
        return prev;
      }
      return { ...prev, visitorInstructions: `${current}\n• ${tagText}` };
    });
  };

  const [map, setMap] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [markerPosition, setMarkerPosition] = useState(null);
  const [searchBox, setSearchBox] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Combined unique cities list
  const allCities = useMemo(() => {
    const set = new Set([...DEFAULT_CITIES, ...existingCities]);
    if (formData.city && formData.city.trim() && formData.city !== "__ADD_NEW__") {
      set.add(formData.city.trim());
    }
    return Array.from(set).sort();
  }, [existingCities, formData.city]);

  useEffect(() => {
    if (attraction && isUpdate) {
      setFormData({
        name: attraction.name || "",
        categoryId: attraction.categoryId || (categories[0]?.id || ""),
        categoryName: attraction.categoryName || (categories[0]?.name || ""),
        description: attraction.description || "",
        imageUrl: attraction.imageUrl || "",
        address: attraction.address || "",
        city: attraction.city || "Bangkok",
        latitude: Number(attraction.latitude) || DEFAULT_CENTER.lat,
        longitude: Number(attraction.longitude) || DEFAULT_CENTER.lng,
        openingHours: attraction.openingHours || "",
        contactNumber: attraction.contactNumber || "",
        websiteUrl: attraction.websiteUrl || "",
        visitorInstructions: attraction.visitorInstructions || "",
        isFeatured: Boolean(attraction.isFeatured),
      });
      if (attraction.latitude && attraction.longitude) {
        const pos = {
          lat: Number(attraction.latitude),
          lng: Number(attraction.longitude),
        };
        setMarkerPosition(pos);
        setMapCenter(pos);
      }
      setIsAddingCity(false);
      setCustomCityName("");
      setShowSpaceGuideTips(false);
    } else {
      setFormData({
        name: "",
        categoryId: categories[0]?.id || "",
        categoryName: categories[0]?.name || "",
        description: "",
        imageUrl: "",
        address: "",
        city: "Bangkok",
        latitude: DEFAULT_CENTER.lat,
        longitude: DEFAULT_CENTER.lng,
        openingHours: "",
        contactNumber: "",
        websiteUrl: "",
        visitorInstructions: "",
        isFeatured: false,
      });
      setMarkerPosition(null);
      setMapCenter(DEFAULT_CENTER);
      setIsAddingCity(false);
      setCustomCityName("");
      setShowSpaceGuideTips(false);
    }
    setError("");
  }, [attraction, isUpdate, categories, open]);

  const reverseGeocode = async (lat, lon) => {
    try {
      const apiKey = import.meta.env.VITE_Google_Api_Key;
      if (!apiKey) return "Location pinned on map";
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}`
      );
      if (response.data.status === "OK" && response.data.results?.[0]) {
        return response.data.results[0].formatted_address;
      }
      return "Unable to get formatted address";
    } catch (err) {
      console.warn("Geocode error:", err);
      return "Pinned on map";
    }
  };

  const handleMapClick = async (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setMarkerPosition({ lat, lng });
    const formattedAddress = await reverseGeocode(lat, lng);
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      address: formattedAddress || prev.address,
    }));
  };

  const handlePlacesChanged = async () => {
    const places = searchBox?.getPlaces();
    if (!places || places.length === 0) return;
    const place = places[0];
    if (!place.geometry || !place.geometry.location) return;

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const pos = { lat, lng };

    setMarkerPosition(pos);
    setMapCenter(pos);
    if (map) {
      map.setCenter(pos);
    }

    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      address: place.formatted_address || prev.address,
      name: prev.name ? prev.name : place.name || "",
    }));
  };

  const handleUploadImage = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingImage(true);
    setError("");
    try {
      const result = await getFileUrl(files);
      if (result.error) {
        setError(result.message || "Failed to upload image");
      } else {
        setFormData((prev) => ({ ...prev, imageUrl: result.url }));
      }
    } catch (err) {
      console.error("Image upload failed:", err);
      setError("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCategoryChange = (e) => {
    const catId = e.target.value;
    const selected = categories.find((c) => c.id === catId);
    setFormData((prev) => ({
      ...prev,
      categoryId: catId,
      categoryName: selected ? selected.name : "",
    }));
  };

  const handleCitySelectChange = (e) => {
    const val = e.target.value;
    if (val === "__ADD_NEW__") {
      setIsAddingCity(true);
      setCustomCityName("");
    } else {
      setFormData((prev) => ({ ...prev, city: val }));
    }
  };

  const handleApplyCustomCity = () => {
    const trimmed = customCityName.trim();
    if (trimmed) {
      // Capitalize first letter of each word nicely
      const formatted = trimmed
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
      setFormData((prev) => ({ ...prev, city: formatted }));
      setIsAddingCity(false);
      setCustomCityName("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Please provide an attraction name.");
      return;
    }
    if (!formData.categoryId) {
      setError("Please select a category.");
      return;
    }
    if (!formData.address.trim()) {
      setError("Please provide or pin an address on the map.");
      return;
    }
    if (!formData.imageUrl) {
      setError("Please upload a cover image for this attraction.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onSave(formData, isUpdate ? attraction?.id : null);
      onClose();
    } catch (err) {
      console.error("Save attraction error:", err);
      setError(err.message || "Failed to save attraction");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategoryObj = categories.find((c) => c.id === formData.categoryId);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        },
      }}
    >
      {/* Header with modern gradient accent */}
      <DialogTitle
        sx={{
          p: 0,
          background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
          color: "white",
        }}
      >
        <div className="px-6 py-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl shadow-md shadow-blue-500/20 text-white">
              {isUpdate ? "✏️" : "📍"}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {isUpdate ? "Update Attraction Details" : "Add New Prime Attraction"}
              </h2>
              <p className="text-xs text-slate-300 font-normal mt-0.5">
                Curate destination info, media, and coordinates for GoThai discovery.
              </p>
            </div>
          </div>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              color: "rgba(255, 255, 255, 0.7)",
              "&:hover": { color: "white", backgroundColor: "rgba(255, 255, 255, 0.1)" },
            }}
          >
            <CloseIcon />
          </IconButton>
        </div>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent
          sx={{
            p: { xs: 2.5, md: 3.5 },
            backgroundColor: "#F8FAFC",
            maxHeight: "75vh",
            overflowY: "auto",
          }}
        >
          {error && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fade-in">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Quick Guide & Instruction Toggle Banner */}
          <div className="mb-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200/80 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="text-lg">📘</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    GoThai Attraction Setup Guide
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Follow best practices for high traveler engagement and smooth booking integration.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide((prev) => !prev)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-white px-3 py-1.5 rounded-lg border border-blue-200 shadow-xs cursor-pointer transition"
              >
                {showGuide ? "Hide Guide ▲" : "View Instructions ▼"}
              </button>
            </div>

            {showGuide && (
              <div className="mt-3 pt-3 border-t border-blue-200/60 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700 animate-fade-in">
                <div className="bg-white/80 p-3 rounded-xl border border-blue-100 space-y-1">
                  <span className="font-bold text-blue-900 flex items-center gap-1">
                    <span>🏙️</span> City & Custom Destinations:
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Select any standard Thai hub or click <b>"+ Add New City"</b>. Custom cities are instantly saved to the database and become dynamic filter tags across GoThai.
                  </p>
                </div>

                <div className="bg-white/80 p-3 rounded-xl border border-blue-100 space-y-1">
                  <span className="font-bold text-blue-900 flex items-center gap-1">
                    <span>📍</span> Interactive Map Geocoding:
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Search the venue inside Google Maps or tap on the map to automatically pin precise GPS coordinates. GoThai Taxis use this pin for routing.
                  </p>
                </div>

                <div className="bg-white/80 p-3 rounded-xl border border-blue-100 space-y-1">
                  <span className="font-bold text-blue-900 flex items-center gap-1">
                    <span>🕒</span> Operating Hours & Contacts:
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Format as <code>10:00 AM - 10:00 PM</code> or <code>Open 24 Hours</code>. Add WhatsApp numbers with international codes for VIP reservations.
                  </p>
                </div>

                <div className="bg-white/80 p-3 rounded-xl border border-blue-100 space-y-1">
                  <span className="font-bold text-blue-900 flex items-center gap-1">
                    <span>📜</span> Visitor Guidelines & Tips:
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Specify temple dress codes (covered knees/shoulders), club age restrictions (20+ with passport), or recommended booking lead times.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {/* Card 1: Category & City Classification */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🏷️</span> Classification & Status
                </span>
                {selectedCategoryObj && (
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white shadow-xs"
                    style={{ backgroundColor: selectedCategoryObj.badgeColor || "#2563EB" }}
                  >
                    {selectedCategoryObj.emoji} {selectedCategoryObj.name}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.categoryId || ""}
                    onChange={handleCategoryChange}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.emoji || "📍"} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* City / Destination Selector with Add City Option */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      City / Destination <span className="text-rose-500">*</span>
                    </label>
                    {!isAddingCity && (
                      <button
                        type="button"
                        onClick={() => setIsAddingCity(true)}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                      >
                        + Add Custom City
                      </button>
                    )}
                  </div>

                  {!isAddingCity ? (
                    <select
                      value={formData.city}
                      onChange={handleCitySelectChange}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    >
                      {allCities.map((c) => (
                        <option key={c} value={c}>
                          📍 {c}
                        </option>
                      ))}
                      <option value="__ADD_NEW__" className="font-semibold text-blue-600">
                        ✨ + Add New City / Destination...
                      </option>
                    </select>
                  ) : (
                    /* Dedicated Space to Add New City */
                    <div className="p-3 bg-blue-50/70 border-2 border-blue-300 rounded-xl space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-blue-900">
                          ✨ Add New Destination / City
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingCity(false);
                            setCustomCityName("");
                          }}
                          className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Type city name (e.g. Kanchanaburi, Pai, Sukhothai)..."
                          value={customCityName}
                          onChange={(e) => setCustomCityName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleApplyCustomCity();
                            }
                          }}
                          className="w-full bg-white border border-blue-400 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={handleApplyCustomCity}
                          disabled={!customCityName.trim()}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition shadow-xs"
                        >
                          Add City
                        </button>
                      </div>
                      <p className="text-[10px] text-blue-700 leading-tight">
                        💡 This custom destination will be saved to your attraction and added to your GoThai city filters.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Attraction Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. ICONSIAM, Spaceplus Bangkok, Wat Arun..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the experience, signature features, vibes, or offerings for GoThai travelers..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>
            </div>

            {/* Card 2: Interactive Location & Google Map */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🗺️</span> Geolocation & Street Address
                </span>
                <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  {Number(formData.latitude).toFixed(4)}, {Number(formData.longitude).toFixed(4)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Formatted Street Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Search Google Maps or click the pin below to auto-fill address..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>

              <div className="relative rounded-xl overflow-hidden border border-slate-300 h-[240px] shadow-inner bg-slate-100">
                <div className="absolute top-3 left-3 z-10 w-[85%] max-w-sm">
                  <StandaloneSearchBox
                    onLoad={(sb) => setSearchBox(sb)}
                    onPlacesChanged={handlePlacesChanged}
                  >
                    <input
                      type="text"
                      placeholder="🔍 Search Google Maps place..."
                      className="w-full bg-white/95 backdrop-blur-sm px-3.5 py-2 text-xs rounded-lg shadow-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 placeholder:text-slate-400"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handlePlacesChanged();
                        }
                      }}
                    />
                  </StandaloneSearchBox>
                </div>
                <GoogleMap
                  mapContainerStyle={{ width: "100%", height: "100%" }}
                  center={mapCenter}
                  zoom={14}
                  onLoad={(m) => setMap(m)}
                  onClick={handleMapClick}
                >
                  {markerPosition && <MarkerF position={markerPosition} />}
                </GoogleMap>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <span>💡</span> Click anywhere on the map above to drop a precise pin and fetch reverse geocoded address.
              </p>
            </div>

            {/* Card 3: Operating Details & Contacts */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🕒</span> Hours, Contacts & Official Links
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Operating Hours <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10:00 AM - 10:00 PM, Open 24 Hours"
                    value={formData.openingHours}
                    onChange={(e) => setFormData({ ...formData, openingHours: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Contact Phone / WhatsApp <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +66 2 495 7000"
                    value={formData.contactNumber}
                    onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Official Website / Booking Link <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="url"
                  placeholder="e.g. https://www.iconsiam.com"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>
            </div>

            {/* Card 4: Dedicated Space for Guidelines & Visitor Instructions */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📜</span> Space Guidelines & Visitor Instructions
                  </span>
                  <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                    Official rules, dress codes, entry policies, and tips for tourists visiting this space.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSpaceGuideTips((prev) => !prev)}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200/80 transition shrink-0 cursor-pointer flex items-center gap-1 self-start sm:self-auto"
                >
                  <span>💡</span>
                  <span>{showSpaceGuideTips ? "Hide Space Playbook ▲" : "Instruction Guide for Spaces ▼"}</span>
                </button>
              </div>

              {/* Collapsible Instruction Guide for Different Space Types */}
              {showSpaceGuideTips && (
                <div className="p-4 bg-gradient-to-br from-indigo-50/90 via-purple-50/70 to-blue-50/70 border border-indigo-200/90 rounded-2xl space-y-3 animate-fade-in text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                      <span>📘</span> Space Guidelines Playbook (Best Practices for Thailand)
                    </span>
                    <span className="text-[10px] text-indigo-700 bg-white/90 px-2.5 py-0.5 rounded-full font-semibold border border-indigo-200 shadow-2xs">
                      GoThai Verified Standards
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div className="bg-white/95 p-3 rounded-xl border border-indigo-100/80 shadow-2xs space-y-1">
                      <p className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                        <span>⛩️</span> Temples & Sacred Spaces:
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Specify modest attire (shoulders and knees covered, no translucent fabric). Note if footwear must be removed before entering the sanctuary.
                      </p>
                    </div>

                    <div className="bg-white/95 p-3 rounded-xl border border-indigo-100/80 shadow-2xs space-y-1">
                      <p className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                        <span>🍸</span> Nightclubs, Rooftops & Lounges:
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        State legal minimum age (20+ strictly enforced; tourists must carry physical original passport or Thai ID). Note dress codes (no flip-flops/sleeveless tops).
                      </p>
                    </div>

                    <div className="bg-white/95 p-3 rounded-xl border border-indigo-100/80 shadow-2xs space-y-1">
                      <p className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                        <span>🛍️</span> Night Markets & Plazas:
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Mention payment methods (cash/PromptPay vs card), peak crowd hours, luggage deposit spots, and closest public transit stations (BTS/MRT).
                      </p>
                    </div>

                    <div className="bg-white/95 p-3 rounded-xl border border-indigo-100/80 shadow-2xs space-y-1">
                      <p className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                        <span>🏖️</span> Viewpoints, Parks & Islands:
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Include National Park entry fees (e.g. 200-400 THB), boat transfer times, recommended footwear for trails, and optimal sunset arrival hours.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick-Insert Preset Tag Chips */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                    <span>⚡</span> Quick-Insert Guidelines (Click to add):
                  </span>
                  {formData.visitorInstructions && (
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, visitorInstructions: "" }))}
                      className="text-[11px] text-rose-500 hover:text-rose-700 underline font-normal cursor-pointer"
                    >
                      Clear text
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_INSTRUCTION_TAGS.map((tag) => (
                    <button
                      key={tag.label}
                      type="button"
                      onClick={() => handleAddInstructionTag(tag.text)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center gap-1 active:scale-95"
                    >
                      <span>+</span>
                      <span>{tag.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dedicated Space: Generous Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Visitor Guidelines & Space Rules
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formData.visitorInstructions?.length || 0} characters
                  </span>
                </div>
                <textarea
                  rows={4}
                  placeholder="e.g.&#10;• Dress Code: Modest attire required (cover shoulders and knees).&#10;• Age Policy: 20+ strictly enforced; must present physical passport at gate.&#10;• Reservations: Advance VIP table booking recommended on Fridays & Saturdays.&#10;• Payment: Credit cards accepted; food vendors take cash only."
                  value={formData.visitorInstructions}
                  onChange={(e) => setFormData({ ...formData, visitorInstructions: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs leading-relaxed font-normal text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition font-sans"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  💡 This space guidance will be displayed to travelers on GoThai when booking or viewing this attraction.
                </p>
              </div>

              {/* Live Preview: How it appears on GoThai User App */}
              {formData.visitorInstructions?.trim() && (
                <div className="p-3.5 bg-gradient-to-r from-amber-50/90 to-orange-50/70 border border-amber-200/80 rounded-xl space-y-1.5 animate-fade-in">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-amber-600 text-xs">📱</span>
                    <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                      GoThai App Live Preview: Space Guidelines
                    </span>
                  </div>
                  <div className="p-2.5 bg-white/95 rounded-lg border border-amber-200/60 text-xs text-slate-700 whitespace-pre-line leading-relaxed shadow-2xs font-sans">
                    {formData.visitorInstructions}
                  </div>
                </div>
              )}
            </div>

            {/* Card 5: Media & Photos */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🖼️</span> Cover Photo & Media
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Attraction Cover Image <span className="text-rose-500">*</span>
                </label>

                {formData.imageUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 group">
                    <img
                      src={formData.imageUrl}
                      alt="Cover Preview"
                      className="w-full h-48 object-cover group-hover:scale-102 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
                      <label className="px-3.5 py-2 bg-white/90 hover:bg-white text-slate-800 text-xs font-semibold rounded-lg shadow cursor-pointer transition">
                        Change Photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUploadImage}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, imageUrl: "" }))}
                        className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow cursor-pointer transition"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl bg-slate-50/70 hover:bg-blue-50/30 transition cursor-pointer group">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl mb-2 group-hover:scale-110 transition">
                      📷
                    </div>
                    <span className="text-xs font-semibold text-slate-700">
                      Click to upload cover photo
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      PNG, JPG, or WEBP (Landscape recommended)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadImage}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                )}

                {uploadingImage && (
                  <div className="flex items-center space-x-2 text-xs text-blue-600 font-medium mt-3 bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                    <CircularProgress size={15} color="inherit" />
                    <span>Uploading photo to GoThai Storage...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>

        {/* Modal Footer with Action Buttons */}
        <DialogActions
          sx={{
            px: 3.5,
            py: 2.5,
            backgroundColor: "white",
            borderTop: "1px solid #E2E8F0",
            display: "flex",
            justifyContent: "flex-end",
            gap: 1.5,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              submitting ||
              uploadingImage ||
              !formData.name.trim() ||
              !formData.address.trim() ||
              !formData.imageUrl
            }
            className={`px-6 py-2.5 rounded-xl text-xs font-semibold text-white shadow-md transition flex items-center space-x-2 cursor-pointer ${
              submitting || uploadingImage || !formData.name.trim() || !formData.address.trim() || !formData.imageUrl
                ? "bg-slate-400 cursor-not-allowed opacity-60"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25 active:scale-98"
            }`}
          >
            {submitting ? (
              <>
                <CircularProgress size={14} color="inherit" />
                <span>Saving...</span>
              </>
            ) : (
              <span>{isUpdate ? "Save Changes" : "Create Attraction"}</span>
            )}
          </button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
