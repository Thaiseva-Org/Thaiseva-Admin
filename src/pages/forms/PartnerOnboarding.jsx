import { AccountCircle, ArrowBack, Business, Email, Lock, Map, Person, Visibility, VisibilityOff, AccountBalance, CreditCard, LocationCity, Category, ListAlt, CloseIcon } from "@icons";
import {
  Box,
  Button,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Paper,
  Container,
  Avatar,
  Chip
} from "@mui/material";
import {
  GoogleMap,
  MarkerF,
  StandaloneSearchBox,
} from "@react-google-maps/api";
import axios from "axios";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useContext, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { MdCloudUpload, MdLocationOn } from "@icons";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { logo } from "../../assets";
import { AuthContext } from "../../contextAPIs/AuthProvider";
import {
  db,
  serviceCategoriesDoc,
  usersCollection,
  partnersCollection, firebaseConfig,
} from "../../firebase/firebase.config";
import { getFileUrl } from "../../utils/utils";
import CountryPhoneInput from "../../components/CountryPhoneInput";

const center = { lat: 48.8584, lng: 2.2945 };

const PartnerOnboarding = ({ isModal = false, onClose = () => {}, onSuccess = () => {} }) => {
  const [partnerStatus, setPartnerStatus] = useState("Verified");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createUser, updateUserProfile } = useContext(AuthContext);
  const [serviceCategory, setServiceCategory] = useState("Others");
  const [profileURL, setProfileURL] = useState("");
  const [map, setMap] = useState(null);
  const [location, setLocation] = useState(null);
  const [searchBox, setSearchBox] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const inputRef = useRef(null);

  // Dynamic Service Logic
  const [serviceCategories, setServiceCategories] = useState([]);
  const [subServices, setSubServices] = useState([]);
  const [selectedSubServices, setSelectedSubServices] = useState([]);

  // Mock sub-services mapping
  const serviceOptions = {
    "Theme Park / Attractions": ["Theme Park", "Water Park", "Zoo", "Museum", "Aquarium", "Adventure Park"],
    "Transportation": ["Sedan", "Van", "SUV", "Luxury Bus", "Motorbike", "Boat/Yacht"],
    "Cleaning": ["Home Cleaning", "Deep Cleaning", "Office Cleaning", "Sanitization"],
    "Guide": ["English Speaking", "Chinese Speaking", "Russian Speaking", "Hindi Speaking", "Historical Expert", "Shopping Guide"],
    "Restaurant": ["Thai Cuisine", "International", "Seafood", "Halal", "Street Food", "Fine Dining"],
    "Hotel": ["Resort", "Hostel", "Boutique", "Villa", "homestay"],
    "Others": [],
  };

  const {
    handleSubmit,
    register,
    setValue,
    control,
    formState: { errors },
  } = useForm();

  useEffect(() => {
    // Fill categories from DB + default ones
    const fetchServiceCategories = async () => {
      await getDoc(serviceCategoriesDoc).then((snapshot) => {
        const data = snapshot.data();
        const fetched = data?.categories?.map((cat) => cat.title) || [];
        const combined = Array.from(new Set([...fetched, ...Object.keys(serviceOptions)]));
        setServiceCategories(combined);
      });
    };
    fetchServiceCategories();
  }, []);

  useEffect(() => {
    if (serviceCategory && serviceOptions[serviceCategory]) {
      setSubServices(serviceOptions[serviceCategory]);
    } else {
      setSubServices([]);
    }
    setSelectedSubServices([]);
    setValue("serviceDetails", "");
  }, [serviceCategory]);

  const handleSubServiceChange = (event) => {
    const {
      target: { value },
    } = event;
    const val = typeof value === 'string' ? value.split(',') : value;
    setSelectedSubServices(val);
    setValue("serviceDetails", val.join(', '));
  };

  // Auto-fill logic
  const extractAreaFromAddress = (address) => {
    if (!address) return;
    const parts = address.split(',');
    if (parts.length >= 2) {
      // Take parts that are likely city and province
      const area = parts.slice(Math.max(parts.length - 3, 0), parts.length).join(', ').trim();
      setValue("serviceArea", area);
    } else {
      setValue("serviceArea", address);
    }
  };

  const onSubmit = async (data) => {
    setError("");
    const {
      email,
      password,
      confirm,
      fullName,
      address,
      serviceArea,
      bankName,
      accountNumber,
      phoneNumber,
      bankAddress,
      serviceDetails
    } = data;

    if (password != confirm) {
      return setError({ for: "password", text: "Password does not match." });
    } else if (!profileURL) {
      return setError({ for: "profile", text: "Provide a valid profile photo" });
    } else if (!/^\+?\d{8,15}$/.test(phoneNumber || "")) {
      return setError({ for: "phone", text: "Invalid Number" });
    }

    const accountInfo = { email };
    const personalInformation = {
      fullName,
      email,
      phoneNumber,
      address,
      photoURL: profileURL,
      location,
    };
    const serviceInformation = { serviceArea, serviceDetails, subServices: selectedSubServices };
    const paymentInformation = { bankName, accountNumber, bankAddress };

    const currentStatus = isModal ? partnerStatus : "Pending";

    const partnerInfo = {
      serviceCategory,
      verified: currentStatus === "Verified",
      status: currentStatus,
      accountInfo,
      personalInformation,
      serviceInformation,
      paymentInformation,
      timestamp: serverTimestamp(),
    };

    setIsSubmitting(true);
    try {
      let createdUser = null;

      if (isModal) {
        // Create partner through temporary auth instance so administrator session stays active
        const tempAppName = `partner_creator_${Date.now()}`;
        const tempApp = initializeApp(firebaseConfig, tempAppName);
        const tempAuth = getAuth(tempApp);

        try {
          const res = await createUserWithEmailAndPassword(tempAuth, email, password);
          createdUser = res.user;
          if (fullName || profileURL) {
            await updateProfile(createdUser, {
              displayName: fullName,
              photoURL: profileURL,
            });
          }
        } finally {
          await deleteApp(tempApp);
        }
      } else {
        const res = await createUser(email, password);
        createdUser = res.user;
        if (fullName || profileURL) {
          await updateUserProfile(fullName, profileURL);
        }
      }

      if (createdUser) {
        partnerInfo.uid = createdUser.uid;

        await setDoc(doc(usersCollection, createdUser.uid), {
          email: email,
          displayName: fullName,
          photoURL: profileURL,
          role: "Partner",
          status: currentStatus,
          serviceCategory,
          phoneNo: phoneNumber,
          createdAt: serverTimestamp(),
          uid: createdUser.uid,
        });

        await setDoc(doc(partnersCollection, createdUser.uid), partnerInfo);

        if (isModal) {
          Swal.fire({
            title: "Partner Added!",
            text: `Partner "${fullName}" was successfully registered with status: ${currentStatus}.`,
            icon: "success",
            confirmButtonColor: "#3b82f6",
          });
          if (onSuccess) onSuccess();
        } else {
          Swal.fire({
            title: "Registration Successful!",
            text: "Your partner request has been submitted successfully. Please wait for admin approval.",
            icon: "success",
            confirmButtonColor: "#3b82f6",
            confirmButtonText: "Go to Dashboard",
          }).then(() => {
            navigate("/dashboard");
          });
        }
      }
    } catch (error) {
      console.log(error);
      if (error.code === "auth/email-already-in-use") {
        if (isModal) {
          Swal.fire({
            title: "Email Already Registered",
            text: "This email address is already associated with an account.",
            icon: "warning",
            confirmButtonColor: "#3b82f6",
          });
        } else {
          Swal.fire({
            title: "Email Already Registered",
            text: "This email address is already associated with an account. Please log in instead.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Go to Login",
            cancelButtonText: "Close",
            confirmButtonColor: "#3b82f6",
          }).then((result) => {
            if (result.isConfirmed) {
              navigate("/login");
            }
          });
        }
        setError({
          for: "email",
          text: "This email is already in use.",
        });
      } else if (error.code === "auth/weak-password") {
        setError({
          for: "password",
          text: "Password is too weak (min 6 characters).",
        });
      } else {
        setError({
          for: "other",
          text: error.message || "An unexpected error occurred. Please try again.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onMapLoad = (map) => setMap(map);

  const onMapClick = async (e) => {
    const address = await reverseGeocode(e.latLng.lat(), e.latLng.lng());
    setValue("address", address);
    extractAreaFromAddress(address);
    setLocation({
      lat: e.latLng.lat(),
      lng: e.latLng.lng(),
    });
  };

  const onSearchLoad = (searchBox) => setSearchBox(searchBox);

  const onPlacesChanged = async () => {
    const places = searchBox.getPlaces();
    if (places.length === 0) return;

    const location = places[0].geometry.location;
    const address = await reverseGeocode(location.lat(), location.lng());
    setLocation({
      lat: location.lat(),
      lng: location.lng(),
    });
    setValue("address", address);
    extractAreaFromAddress(address);
    map.setCenter(location);
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const address = await reverseGeocode(lat, lon);
          setValue("address", address);
          extractAreaFromAddress(address);
        },
        (error) => console.error("Error getting location: ", error)
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  const reverseGeocode = async (lat, lon) => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${import.meta.env.VITE_Google_Api_Key
        }`
      );
      if (response.data.status === "OK") {
        return response.data.results[0].formatted_address;
      } else {
        return "Unable to get location";
      }
    } catch (error) {
      console.error("Error fetching address: ", error);
      return "Error fetching address";
    }
  };

  const handleUploadProfile = async (e) => {
    const { files } = e.target;
    setError("");
    const result = await getFileUrl(files);
    if (result.error) {
      setError({ for: "profile", text: result.message });
    } else {
      setProfileURL(result.url);
    }
  };

  const handleChangeServiceCategory = (e) => {
    setServiceCategory(e.target.value);
  };

  const textField = (label, name, placeholder, type = "text", icon = null) => (
    <Grid item xs={12} sm={6}>
      <TextField
        label={label}
        type={type}
        placeholder={placeholder}
        fullWidth
        variant="filled"
        {...register(name, { required: true })}
        InputProps={{
          startAdornment: icon ? (
            <InputAdornment position="start" className="text-gray-500">
              {icon}
            </InputAdornment>
          ) : null,
          disableUnderline: true,
          style: { borderRadius: "12px" }
        }}
        sx={{
          "& .MuiFilledInput-root": {
            backgroundColor: "#f9fafb",
            border: "1px solid #e5e7eb",
            "&:hover": { backgroundColor: "#f3f4f6" },
            "&.Mui-focused": {
              backgroundColor: "#ffffff",
              border: "1px solid #3b82f6",
              boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.1)"
            },
            borderRadius: "12px",
            transition: "all 0.2s ease-in-out"
          },
        }}
      />
      {errors[name] && (
        <span className="text-red-500 text-xs mt-1 ml-1 block">*{label} is required</span>
      )}
    </Grid>
  );

  const formElement = (
    <form onSubmit={handleSubmit(onSubmit, (errors) => console.error(errors))} className={isModal ? "p-6 space-y-8" : "p-8 md:p-12 space-y-10"}>
            {/* Admin Status Selection in Modal Mode */}
            {isModal && (
              <section className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <span className="text-sm font-bold text-gray-800 block">Initial Partnership Status</span>
                    <span className="text-xs text-gray-500">Set whether this partner is instantly verified or pending review</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPartnerStatus("Verified")}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${partnerStatus === "Verified" ? "bg-green-600 text-white shadow-md scale-105" : "bg-white text-gray-700 border hover:bg-gray-50"}`}
                    >
                      ✅ Verified (Active)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPartnerStatus("Pending")}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${partnerStatus === "Pending" ? "bg-amber-600 text-white shadow-md scale-105" : "bg-white text-gray-700 border hover:bg-gray-50"}`}
                    >
                      ⏳ Pending Review
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Section 1: Account Credentials */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600">
                  <Lock fontSize="small" />
                </div>
                <Typography variant="h6" className="font-bold text-gray-800">
                  Account Credentials
                </Typography>
              </div>

              <Grid container spacing={3}>
                {textField("Email Address", "email", "example@mail.com", "email", <Email fontSize="small" />)}

                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    fullWidth
                    variant="filled"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start" className="text-gray-500">
                          <Lock fontSize="small" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                            {!showPassword ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                      disableUnderline: true,
                      style: { borderRadius: "12px" }
                    }}
                    sx={{
                      "& .MuiFilledInput-root": {
                        backgroundColor: "#f9fafb",
                        border: "1px solid #e5e7eb",
                        "&:hover": { backgroundColor: "#f3f4f6" },
                        "&.Mui-focused": {
                          backgroundColor: "#ffffff",
                          border: "1px solid #3b82f6",
                          boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.1)"
                        },
                        borderRadius: "12px",
                        transition: "all 0.2s ease-in-out"
                      },
                    }}
                    {...register("password", { required: true, minLength: 6 })}
                  />
                  {error?.for === "password" && (
                    <span className="text-red-500 text-xs mt-1 block">{error.text}</span>
                  )}
                  {errors.password && <span className="text-red-500 text-xs mt-1 block">Min 6 chars required</span>}

                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Confirm Password"
                    type={showConfirmPassword ? "text" : "password"}
                    fullWidth
                    variant="filled"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start" className="text-gray-500">
                          <Lock fontSize="small" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" size="small">
                            {!showConfirmPassword ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                      disableUnderline: true,
                      style: { borderRadius: "12px" }
                    }}
                    sx={{
                      "& .MuiFilledInput-root": {
                        backgroundColor: "#f9fafb",
                        border: "1px solid #e5e7eb",
                        "&:hover": { backgroundColor: "#f3f4f6" },
                        "&.Mui-focused": {
                          backgroundColor: "#ffffff",
                          border: "1px solid #3b82f6",
                          boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.1)"
                        },
                        borderRadius: "12px",
                        transition: "all 0.2s ease-in-out"
                      },
                    }}
                    {...register("confirm", { required: true })}
                  />
                  {errors.confirm && <span className="text-red-500 text-xs mt-1 block">*Required</span>}
                </Grid>
              </Grid>

              <div className="mt-4 p-4 bg-orange-50 rounded-xl border border-orange-100 flex gap-3 text-sm text-orange-800">
                <div className="min-w-fit mt-0.5">⚠️</div>
                <p>Securely save these credentials. You will need them to log in to your dashboard later.</p>
              </div>
            </section>

            <hr className="border-gray-100" />

            {/* Section 2: Personal Details */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-green-50 p-2.5 rounded-xl text-green-600">
                  <Person fontSize="small" />
                </div>
                <Typography variant="h6" className="font-bold text-gray-800">
                  Personal Details
                </Typography>
              </div>

              <Grid container spacing={3}>
                {textField("Full Name", "fullName", "John Doe", "text", <AccountCircle fontSize="small" />)}

                <Grid item xs={12} sm={6}>
                  <input
                    type="file"
                    id="profile-upload"
                    className="hidden"
                    onChange={handleUploadProfile}
                    accept="image/*"
                  />
                  <label
                    htmlFor="profile-upload"
                    className={`h-[56px] flex items-center justify-between px-4 w-full border rounded-xl cursor-pointer transition-all duration-200 ${profileURL ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 bg-gray-50 hover:bg-white hover:border-blue-500 hover:shadow-sm text-gray-500'}`}
                  >
                    <div className="flex items-center gap-2">
                      <MdCloudUpload className={profileURL ? 'text-green-600' : 'text-gray-400'} size={20} />
                      <span className="text-sm font-medium truncate max-w-[150px]">
                        {profileURL ? "Photo Uploaded" : "Upload Profile Photo"}
                      </span>
                    </div>
                    {profileURL && <span className="text-xs bg-white px-2 py-0.5 rounded-md border border-green-200">Change</span>}
                  </label>
                  {error?.for === "profile" && <span className="text-red-500 text-xs mt-1 block">{error.text}</span>}
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Controller
                    name="phoneNumber"
                    control={control}
                    rules={{ required: true }}
                    defaultValue=""
                    render={({ field }) => (
                      <CountryPhoneInput
                        {...field}
                        label="Phone Number"
                        placeholder="012 345 6789"
                        required
                      />
                    )}
                  />
                  {errors.phoneNumber && <span className="text-red-500 text-xs mt-1 block">*Required</span>}
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Controller
                    name="address"
                    control={control}
                    rules={{ required: true }}
                    defaultValue=""
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Address"
                        fullWidth
                        variant="filled"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start" className="text-gray-500">
                              <Map fontSize="small" />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton onClick={getCurrentLocation} title="Use Current Location" size="small">
                                <MdLocationOn className="text-blue-600" />
                              </IconButton>
                            </InputAdornment>
                          ),
                          disableUnderline: true,
                          style: { borderRadius: "12px" }
                        }}
                        sx={{
                          "& .MuiFilledInput-root": {
                            backgroundColor: "#f9fafb",
                            border: "1px solid #e5e7eb",
                            "&:hover": { backgroundColor: "#f3f4f6" },
                            "&.Mui-focused": {
                              backgroundColor: "#ffffff",
                              border: "1px solid #3b82f6",
                              boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.1)"
                            },
                            borderRadius: "12px",
                            transition: "all 0.2s ease-in-out"
                          },
                        }}
                      />
                    )}
                  />
                  {error?.for === "address" && (
                    <span className="text-red-500 text-xs mt-1 block">{error.text}</span>
                  )}
                  {errors.address && <span className="text-red-500 text-xs mt-1 block">*Required</span>}
                </Grid>
              </Grid>

              {/* Map Widget */}
              <div className="mt-8 rounded-2xl overflow-hidden shadow-sm border border-gray-200">
                <div className="h-[250px] relative">
                  <div className="absolute top-4 left-4 right-4 z-10 max-w-sm mx-auto">
                    <StandaloneSearchBox onLoad={onSearchLoad} onPlacesChanged={onPlacesChanged}>
                      <div className="bg-white p-1 rounded-xl shadow-lg border border-gray-100 flex items-center">
                        <div className="pl-3 text-gray-400"><Map fontSize="small" /></div>
                        <input
                          type="text"
                          placeholder="Type to search location..."
                          className="w-full px-3 py-2 rounded-lg outline-none text-sm text-gray-700 bg-transparent placeholder-gray-400"
                          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                        />
                      </div>
                    </StandaloneSearchBox>
                  </div>
                  <GoogleMap
                    id="map"
                    center={center}
                    zoom={15}
                    onLoad={onMapLoad}
                    onClick={onMapClick}
                    mapContainerStyle={{ width: "100%", height: "100%" }}
                    options={{
                      disableDefaultUI: true,
                      zoomControl: true,
                    }}
                  >
                    {location && <MarkerF position={location} />}
                  </GoogleMap>
                </div>
                <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 text-center border-t border-gray-200">
                  Click on the map or use search to set your precise location
                </div>
              </div>
            </section>

            <hr className="border-gray-100" />

            {/* Section 3: Service Details */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-purple-50 p-2.5 rounded-xl text-purple-600">
                  <Business fontSize="small" />
                </div>
                <Typography variant="h6" className="font-bold text-gray-800">
                  Service Details
                </Typography>
              </div>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth variant="filled">
                    <InputLabel>Service Category</InputLabel>
                    <Select
                      value={serviceCategory}
                      onChange={handleChangeServiceCategory}
                      disableUnderline
                      startAdornment={
                        <InputAdornment position="start" className="text-gray-500 ml-1">
                          <Category fontSize="small" />
                        </InputAdornment>
                      }
                      sx={{
                        backgroundColor: "#f9fafb",
                        border: "1px solid #e5e7eb",
                        borderRadius: "12px",
                        "&:hover": { backgroundColor: "#f3f4f6" },
                        "&.Mui-focused": {
                          backgroundColor: "#ffffff",
                          border: "1px solid #3b82f6",
                          boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.1)"
                        },
                        "& .MuiSelect-select": { paddingLeft: 1 },
                        transition: "all 0.2s ease-in-out"
                      }}
                    >
                      {serviceCategories.map((item) => (
                        <MenuItem value={item} key={item}>
                          {item}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {subServices.length > 0 ? (
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth variant="filled">
                      <InputLabel>Specific Services / Types</InputLabel>
                      <Select
                        multiple
                        value={selectedSubServices}
                        onChange={handleSubServiceChange}
                        disableUnderline
                        startAdornment={
                          <InputAdornment position="start" className="text-gray-500 ml-1">
                            <ListAlt fontSize="small" />
                          </InputAdornment>
                        }
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => (
                              <Chip key={value} label={value} size="small" sx={{ height: 24 }} />
                            ))}
                          </Box>
                        )}
                        sx={{
                          backgroundColor: "#f9fafb",
                          border: "1px solid #e5e7eb",
                          borderRadius: "12px",
                          "&:hover": { backgroundColor: "#f3f4f6" },
                          "&.Mui-focused": {
                            backgroundColor: "#ffffff",
                            border: "1px solid #3b82f6",
                            boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.1)"
                          },
                          transition: "all 0.2s ease-in-out"
                        }}
                      >
                        {subServices.map((sub) => (
                          <MenuItem key={sub} value={sub}>
                            {sub}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {/* Hidden input to register with form */}
                    <input type="hidden" {...register("serviceDetails")} />
                  </Grid>
                ) : (
                  textField("Service Description / Details", "serviceDetails", "e.g. specialized in luxury tours", "text", <ListAlt fontSize="small" />)
                )}

                {textField("Service Area (Auto-filled from map)", "serviceArea", "e.g. Bangkok, Sukhumvit", "text", <LocationCity fontSize="small" />)}
              </Grid>
            </section>

            <hr className="border-gray-100" />

            {/* Section 4: Payment Information */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-teal-50 p-2.5 rounded-xl text-teal-600">
                  <CreditCard fontSize="small" />
                </div>
                <Typography variant="h6" className="font-bold text-gray-800">
                  Payment Information
                </Typography>
              </div>

              <Grid container spacing={3}>
                {textField("Bank Name", "bankName", "e.g. Kasikorn Bank", "text", <AccountBalance fontSize="small" />)}
                {textField("Account Number", "accountNumber", "xxxxxxxxxx", "number", <CreditCard fontSize="small" />)}
                {textField("Bank Branch", "bankAddress", "e.g. Siam Paragon", "text", <LocationCity fontSize="small" />)}
              </Grid>
            </section>

            {error?.for === "other" && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-center border border-red-100 font-medium">
                {error.text}
              </div>
            )}

            <div className="pt-4 flex items-center justify-end gap-3">
              {isModal && (
                <Button
                  type="button"
                  variant="outlined"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="rounded-xl px-6 py-3 font-semibold normal-case border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                variant="contained"
                disabled={isSubmitting}
                fullWidth={!isModal}
                size="large"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl hover:shadow-2xl transition-all duration-300 py-3.5 px-8 text-base font-bold rounded-xl normal-case text-white"
              >
                {isSubmitting ? "Registering Partner..." : isModal ? "Create Partner Account" : "Submit Application"}
              </Button>
            </div>
            {!isModal && (
              <p className="text-center text-gray-400 text-sm mt-4">
                By clicking Submit, you agree to our Terms & Conditions
              </p>
            )}
          </form>
  );

  if (isModal) {
    return (
      <div className="bg-white flex flex-col max-h-[88vh]">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-500 to-indigo-600 flex items-center justify-center text-white text-xl shadow-md">
              🤝
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 m-0">Add New Partner</h2>
              <p className="text-xs text-gray-500 m-0">Register a local service partner directly from the admin portal</p>
            </div>
          </div>
          <IconButton onClick={onClose} size="small" className="hover:bg-gray-100 text-gray-500">
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>

        {/* Scrollable Form */}
        <div className="overflow-y-auto flex-1">
          {formElement}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 bg-[#f8fafc] font-sans">
      <Container maxWidth="md">
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/login')}
          className="mb-8 text-gray-500 hover:text-blue-600 normal-case font-semibold tracking-wide hover:bg-transparent px-0 transition-colors duration-200"
          disableRipple
        >
          Back to Login
        </Button>

        <Paper
          elevation={0}
          className="rounded-3xl overflow-hidden border border-gray-100 shadow-xl bg-white"
        >
          {/* Header */}
          <div className="bg-white p-8 md:p-10 border-b border-gray-100 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600"></div>

            {/* Logo Section */}
            <div className="mb-6 relative group cursor-pointer transform hover:scale-105 transition-transform duration-300">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-100 to-violet-100 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition duration-500"></div>
              <div className="relative">
                <img src={logo} alt="Thaiseva" className="h-20 md:h-24 w-auto object-contain drop-shadow-sm" />
              </div>
            </div>

            <Typography variant="h4" className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-700 mb-2 text-center tracking-tight">
              Partner Registration
            </Typography>
            <Typography variant="body1" className="text-gray-500 text-center max-w-md mx-auto leading-relaxed">
              Join Thaiseva's premium network and scale your business with our trusted platform.
            </Typography>
          </div>

          {formElement}
        </Paper>
        <div className="text-center mt-8 text-gray-400 text-xs pb-4">
          © {new Date().getFullYear()} Thaiseva. All rights reserved.
        </div>
      </Container>
    </div>
  );
};

export default PartnerOnboarding;
