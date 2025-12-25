import { Visibility, VisibilityOff } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
} from "@mui/material";
import {
  GoogleMap,
  MarkerF,
  Autocomplete,
} from "@react-google-maps/api";
import axios from "axios";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useContext, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { MdLocationOn } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { logo } from "../../assets";
import SubTitle from "../../components/SubTitle";
import { AuthContext } from "../../contextAPIs/AuthProvider";
import {
  hotelsCollection,
  usersCollection,
} from "../../firebase/firebase.config";
import {
  formatPhoneNumber,
  getFileUrl,
  successNotification,
} from "../../utils/utils";

const center = { lat: 48.8584, lng: 2.2945 };

const HotelOnboarding = () => {
  const { createUser, updateUserProfile } = useContext(AuthContext);
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [map, setMap] = useState(null);
  const [location, setLocation] = useState(null);
  const [searchBox, setSearchBox] = useState(null);
  const [logoURL, setLogoURL] = useState("");
  const [license, setLicense] = useState("");
  const [error, setError] = useState({ for: "", text: "" });
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const showError = (msg) => {
    // console.log("Error");
    // toast.error(msg, {
    //   position: "top-right",
    //   autoClose: 5000,
    //   hideProgressBar: false,
    //   closeOnClick: true,
    //   pauseOnHover: true,
    //   draggable: true,
    //   progress: undefined,
    //   theme: "colored",
    //   transition: Bounce,
    // });
  };

  const {
    handleSubmit,
    // reset,
    setValue,
    control,
    register,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setError({ for: "", text: "" });
    setPasswordError("");
    const {
      email,
      password,
      hotelName,
      confirm,
      phoneNumber,
      address,
      bankName,
      accountNumber,
      bankAddress,
      country,
    } = data;

    const accountInfo = { email, password };
    const hotelInformation = {
      email,
      hotelName,
      address,
      phoneNumber,
      location: location,
      logoURL,
      license,
      country,
    };
    const paymentInformation = { bankName, accountNumber, bankAddress };

    const hotelInfo = {
      accountInfo,
      status: "Pending",
      verified: false,
      serviceCategory: "Hotel",
      hotelInformation,
      timestamp: serverTimestamp(),
      paymentInformation,
    };

    if (password !== confirm) {
      setPasswordError("Password doesn't match"); // Set the error state
      showError("Password doesn't match"); // Show toast notification
      return; // Prevent further execution
    } else if (!logoURL) {
      setError({ for: "logo", text: "Logo is required" });
      showError("Logo is required"); // Show toast notification
      return; // Prevent further execution
    } else if (!license) {
      setError({ for: "license", text: "License is required" });
      showError("License is required"); // Show toast notification
      return; // Prevent further execution
    } else if (!location) {
      setError({
        for: "location",
        text: "Please select your hotel's location",
      });
      showError("Please select your hotel's location"); // Show toast notification
      return; // Prevent further execution
    } else if (!country) {
      // Validate the country field
      setError({ for: "country", text: "Country is required" });
      showError("Country is required");
      return; // Prevent further execution
    }

    // creating the user into Firebase authentication
    await createUser(email, password)
      .then(async (res) => {
        const createdUser = res.user;

        if (createdUser) {
          hotelInfo.uid = createdUser.uid; // adding unique uid

          // adding users data to the useres collection
          await setDoc(doc(usersCollection, createdUser.uid), {
            displayName: hotelName,
            email: email,
            role: "Partner",
            serviceCategory: "Hotel",
            status: "Pending",
            photoURL: logoURL,
            phoneNo: phoneNumber,
            createdAt: new Date(),
            uid: createdUser.uid,
          });

          navigate("/dashboard");

          await updateUserProfile(hotelName, logoURL);

          await setDoc(doc(hotelsCollection, createdUser.uid), hotelInfo).then(
            () => successNotification("Account created successfully")
          );

          // const isRoom = await getDoc(doc(chatRoomsCollection, "HotelSupport"));

          // if (!isRoom.exists()) {
          //   // creating conversation for thaiseva admin
          //   await setDoc(doc(chatRoomsCollection, "HotelSupport"), {
          //     [createdUser.uid + "_HotelSupport"]: {
          //       userInfo: {
          //         uid: createdUser?.uid,
          //         displayName: createdUser?.displayName,
          //         photoURL: createdUser?.photoURL,
          //         phoneNumber,
          //       },
          //       isRead: true,
          //       date: serverTimestamp(),
          //     },
          //   });
          // } else {
          //   // creating conversation for thaiseva admin
          //   await updateDoc(doc(chatRoomsCollection, "HotelSupport"), {
          //     [createdUser.uid + "_HotelSupport"]: {
          //       userInfo: {
          //         uid: createdUser?.uid,
          //         displayName: createdUser?.displayName,
          //         photoURL: createdUser?.photoURL,
          //         phoneNumber,
          //       },
          //       isRead: true,
          //       date: serverTimestamp(),
          //     },
          //   });
          // }

          // await setDoc(
          //   doc(chatsCollection, createdUser.uid + "_HotelSupport"),
          //   { messages: [] }
          // );
        }
      })
      .catch((error) => {
        if (error.code === "auth/email-already-in-use") {
          showError("Email already exists. Please use a different email.");
        } else {
          // <-- Ensure this line has a semicolon at the end of the previous line
          console.error(error); // Log other errors for debugging
        }
      });
  };

  /* ========================================================
              Google maps functionalities Started
 ======================================================== */
  const onMapLoad = (map) => {
    setMap(map);
  };

  const onMapClick = async (e) => {
    const address = await reverseGeocode(e.latLng.lat(), e.latLng.lng());
    setValue("address", address);
    setLocation({
      lat: e.latLng.lat(),
      lng: e.latLng.lng(),
    });
  };

  const onSearchLoad = (searchBox) => {
    setSearchBox(searchBox);
  };

  const onPlacesChanged = async () => {
    if (!searchBox) return;
    const place = searchBox.getPlace();

    if (!place || !place.geometry) return;

    const location = place.geometry.location;
    // Use formatted_address from Place result if available, otherwise reverse geocode
    const address = place.formatted_address || await reverseGeocode(location.lat(), location.lng());

    setLocation({
      lat: location.lat(),
      lng: location.lng(),
    });
    setValue("address", address);
    if (map) map.setCenter(location);
  };
  /* ========================================================
              Google maps functionalities Ended
 ======================================================== */

  // location auto pickup
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const address = await reverseGeocode(lat, lon);
          setValue("address", address);
        },
        (error) => {
          console.error("Error getting location: ", error);
        }
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

  // upload pictures
  const handleUploadLogo = async (e) => {
    const { files } = e.target;
    setError({ for: "", text: "" });
    const result = await getFileUrl(files);
    if (result?.error) {
      setError({ for: "logo", text: result.message });
    } else {
      setLogoURL(result.url);
    }
  };

  // upload licence
  const handleUploadLicense = async (e) => {
    const { files } = e.target;
    setError({ for: "", text: "" });
    const result = await getFileUrl(files);
    if (result?.error) {
      setError({ for: "license", text: result.message });
    } else {
      setLicense(result.url);
    }
  };

  // custom text field for common data
  const textField = (label, name, placeholder) => {
    return (
      <Grid item xs={12} sm={6} md={4}>
        <TextField
          label={label}
          type={
            name === "phoneNumber" || name === "accountNumber"
              ? "number"
              : "text"
          }
          placeholder={placeholder}
          defaultValue=""
          fullWidth
          {...register(name, { required: true })}
        />
        {errors?.name === name && (
          <span className="text-red-500">{label} is required</span>
        )}
      </Grid>
    );
  };

  // custom file field for profile and license
  const fileField = (label, name) => {
    return (
      <Grid item xs={12} sm={6} md={4}>
        <TextField
          label={"Select " + label}
          type="file"
          onChange={name === "logo" ? handleUploadLogo : handleUploadLicense}
          fullWidth
          InputLabelProps={{ shrink: true }}
        />
        {error?.for === name && (
          <span className="text-red-500 text-sm">{error?.text}</span>
        )}
      </Grid>
    );
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center md:px-10 p-2 py-12 bg-gradient-to-r from-[var(--main-bg-gradient-color-1)] to-[var(--main-bg-gradient-color-2)]">
      {/* form container */}
      <Paper
        elevation={3}
        sx={{
          p: { xs: 2, sm: 3, md: 4, lg: 5 },
          mx: "auto",
          width: { lg: "80%" },
        }}
      >
        <div className="flex w-full max-lg:flex-col justify-between items-center mb-8">
          <img src={logo} alt="Thaiseva" className="w-[200px]" />
          <h3 className="text-center text-[var(--form-heading-color)] font-extrabold text-2xl">
            Hotel Onboarding Form
          </h3>
        </div>

        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          {/* Account Information*/}
          <SubTitle text="Account Information :" />

          <Grid container spacing={3} sx={{ py: 1 }}>
            {/* Email */}
            {textField("Email", "email", "mymail123@gmail.com")}

            {/* Password */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Password"
                placeholder="********"
                type={showPassword ? "text" : "password"}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => {
                          setShowPassword(!showPassword);
                        }}
                      >
                        {!showPassword ? <Visibility /> : <VisibilityOff />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                defaultValue=""
                fullWidth
                {...register("password", {
                  required: true,
                  minLength: 6,
                  maxLength: 20,
                  pattern: /(?=.*[A-Z])(?=.*[!@#$&%*])(?=.*[0-9])(?=.*[a-z])/,
                })}
              />

              {errors.password?.type === "minLength" && (
                <p className="text-red-400">
                  Password must have minimum six characters.
                </p>
              )}
              {errors.password?.type === "maxLength" && (
                <span className="text-red-400">
                  Password must be less than 20 characters.
                </span>
              )}
              {errors.password?.type === "pattern" && (
                // Password must have
                <p className="text-red-400">
                  at least one uppercase letter, one special character, and one
                  number.
                </p>
              )}
            </Grid>

            {/* Confirm Password */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Confirm Password"
                placeholder="********"
                type={showConfirmPassword ? "text" : "password"}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => {
                          setShowConfirmPassword(!showConfirmPassword);
                        }}
                      >
                        {!showConfirmPassword ? (
                          <Visibility />
                        ) : (
                          <VisibilityOff />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                defaultValue=""
                fullWidth
                {...register("confirm", { required: true })}
              />
              {passwordError && (
                <span className="text-red-500 text-sm">{passwordError}</span>
              )}
            </Grid>
          </Grid>

          <Alert severity="warning" sx={{ mt: 1 }}>
            Please ensure to securely note down these credentials, as they will
            be required for future login and access purposes.
          </Alert>

          <div className="h-2"></div>

          {/* Hotel Information*/}
          <SubTitle text="Hotel Information :" />

          <Grid container spacing={3} sx={{ py: 1 }}>
            {/* Restaurent Name */}
            {textField("Hotel Name", "hotelName", "your hotel name...")}

            {/* Hotel Logo */}
            {fileField("Hotel's Logo", "logo")}

            {/* Phone */}
            {/* <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Phone Number"
                type="number"
                placeholder="+66 XX XXX XXXX"
                defaultValue=""
                fullWidth
                {...register("phoneNumber", { required: true })}
              />
              {errors?.name && (
                <span className="text-red-500">Phone Number is required</span>
              )}
            </Grid> */}
            {/* {textField("Phone Number", "phoneNumber", "+66 XX XXX XXXX")} */}
            <Grid item xs={12} sm={6} md={4}>
              <Controller
                name="phoneNumber"
                control={control}
                defaultValue=""
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Phone Number"
                    type="tel"
                    placeholder="012 1234 1234"
                    value={field.value}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value);
                      field.onChange(formatted);
                    }}
                    fullWidth
                  />
                )}
              />
            </Grid>

            {/* Location */}
            <Grid item xs={12} sm={6} md={4}>
              <Controller
                name="address"
                control={control}
                defaultValue=""
                render={({ field }) => (
                  <TextField
                    {...field} // Spread the field from Controller into TextField
                    label="Location"
                    placeholder="Where is your hotel located?"
                    ref={(e) => {
                      field.ref(e); // Assign the ref from React Hook Form
                      inputRef.current = e; // You can also keep a custom ref if needed
                    }}
                    type="text"
                    InputProps={{
                      endAdornment: (
                        <button
                          type="button"
                          onClick={getCurrentLocation}
                          className="ml-2 text-white bg-[var(--form-button-bg-color)] hover:bg-[var(--form-button-hover-bg-color)] active:bg-[var(--form-button-active-bg-color)] font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                          title="Click Here to pick your current location automatically!"
                        >
                          <MdLocationOn size={20} />
                        </button>
                      ),
                    }}
                    fullWidth
                  />
                )}
              />
            </Grid>
            {/* {textField("Location", "address", "Where is your hotel located?")} */}

            {textField("Country", "country", "Country")}

            {/* Hotel License */}
            {fileField("Hotel License", "license")}
          </Grid>
          <div className="w-[80%] h-[350px] my-2 relative m-auto">
            <div className="absolute top-2 left-1/3 z-10 ">
              <Autocomplete
                onLoad={onSearchLoad}
                onPlaceChanged={onPlacesChanged}
              >
                <input
                  type="text"
                  placeholder="Search for a location"
                  className="location-input border border-blue-500"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault(); // Prevent form submission
                      onPlacesChanged(); // Trigger the search logic
                    }
                  }}
                />
              </Autocomplete>
            </div>
            <GoogleMap
              id="map"
              center={center}
              zoom={15}
              onLoad={onMapLoad}
              onClick={onMapClick}
              mapContainerStyle={{ width: "100%", height: "100%" }}
            >
              {location && <MarkerF position={location} />}
            </GoogleMap>
          </div>
          {error?.for === "location" && (
            <span className="text-red-500">{error?.text}</span>
          )}

          <div className="h-2"></div>

          {/* Payment Information*/}
          <SubTitle text="Payment Information :" />

          <Grid container spacing={3}>
            {/* Bank Name */}
            {textField(
              "Bank Name",
              "bankName",
              "you will get paid in this bank"
            )}

            {/* Account Number */}
            {textField(
              "Account Number",
              "accountNumber",
              "Type the number carefully"
            )}

            {/* Bank Address */}
            {textField(
              "Bank Address",
              "bankAddress",
              "Where is branch located?"
            )}
          </Grid>

          <Box textAlign="center" sx={{ my: 2 }} className="pt-5">
            <Button
              type="submit"
              variant="contained"
              sx={{
                backgroundColor: "var(--form-button-bg-color)",
                color: "white",
                transition: "opacity 0.3s ease",
                "&:hover": {
                  backgroundColor: "var(--form-button-hover-bg-color)",
                },
              }}
            >
              Submit
            </Button>
          </Box>
        </Box>
      </Paper>
      <ToastContainer />
    </div>
  );
};

export default HotelOnboarding;
