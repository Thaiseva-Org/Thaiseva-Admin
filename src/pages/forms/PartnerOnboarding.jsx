import { Visibility, VisibilityOff } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
} from "@mui/material";
import {
  GoogleMap,
  MarkerF,
  StandaloneSearchBox,
} from "@react-google-maps/api";
import axios from "axios";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useContext, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { MdLocationOn } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { logo } from "../../assets";
import SubTitle from "../../components/SubTitle";
import { AuthContext } from "../../contextAPIs/AuthProvider";
import {
  db,
  serviceCategoriesDoc,
  usersCollection,
} from "../../firebase/firebase.config";
import { formatPhoneNumber, getFileUrl } from "../../utils/utils";
const partnersCollection = collection(db, "partners");

const center = { lat: 48.8584, lng: 2.2945 };

const PartnerOnboarding = () => {
  const { createUser, updateUserProfile } = useContext(AuthContext);
  const [serviceCategory, setServiceCategory] = useState("Others");
  const [profileURL, setProfileURL] = useState("");
  // const [vechicleNames, setVechicleNames] = useState([]);
  const [map, setMap] = useState(null);
  const [location, setLocation] = useState(null);
  const [searchBox, setSearchBox] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const {
    handleSubmit,
    // reset,
    register,
    setValue,
    control,
    formState: { errors },
  } = useForm();

  // let vechicleTypes = [];

  // if (serviceCategory === "Logistics and Transportation") {
  //   vechicleTypes = ["Truck", "Van", "Others"];
  // } else if (serviceCategory === "Order Pick Up") {
  //   vechicleTypes = ["Toyota", "Honda", "Ford", "Nissan", "Others"];
  // }

  /* ===============================================================
                          Handle form submission start
  ===============================================================*/
  // Handle form submission
  const onSubmit = async (data) => {
    setError("");
    const {
      email,
      password,
      confirm,
      fullName,
      address,
      serviceArea,
      // educationalBackground,
      // numberPlate,
      bankName,
      accountNumber,
      phoneNumber,
      bankAddress,
    } = data;

    // validating patner's info
    if (password != confirm) {
      return setError({ for: "password", text: "Password does not match." });
    } else if (!profileURL) {
      return setError({ for: "profile", text: "Provide a valid profile" });
    } else if (phoneNumber?.length < 11 || phoneNumber?.length > 11) {
      return setError({ for: "phone", text: "Invalid Number" });
    }

    const accountInfo = { email, password };

    const personalInformation = {
      fullName,
      email,
      phoneNumber,
      address,
      photoURL: profileURL,
      location,
    };

    const serviceInformation = {
      serviceArea,
    };

    const paymentInformation = { bankName, accountNumber, bankAddress };

    // modifing service information based on service category
    // if (
    //   serviceCategory === "Official Work" ||
    //   serviceCategory === "Legal Administrative"
    // ) {
    //   serviceInformation.educationalBackground = educationalBackground;
    // } else if (
    //   serviceCategory === "Logistics and Transportation" ||
    //   serviceCategory === "Order Pick Up"
    // ) {
    //   serviceInformation.numberPlate = numberPlate;
    //   serviceInformation.vechicleNames = vechicleNames;
    // }

    const partnerInfo = {
      serviceCategory,
      verified: false,
      status: "Pending",
      accountInfo,
      personalInformation,
      serviceInformation,
      paymentInformation,
      timestamp: serverTimestamp(),
    };

    // creating the user into Firebase authentication
    await createUser(email, password)
      .then(async (res) => {
        const createdUser = res.user;

        if (createdUser) {
          // adding partner's data to the partners collection
          partnerInfo.uid = createdUser.uid;

          // adding users data to the useres collection
          await setDoc(doc(usersCollection, createdUser.uid), {
            email: email,
            displayName: fullName,
            photoURL: profileURL,
            role: "Partner",
            status: "Pending",
            serviceCategory,
            phoneNo: phoneNumber,
            createdAt: serverTimestamp(),
            uid: createdUser.uid,
          }).catch((error) => {
            console.log(error);
          });
          navigate("/dashboard");
          // navigate("/partner-onboarding/message");
          await updateUserProfile(fullName, profileURL); //updating user name and photoURL
          await setDoc(doc(partnersCollection, createdUser.uid), partnerInfo);

          // const hasRoom = await getDoc(
          //   doc(chatRoomsCollection, "LocalPartnerSupport")
          // );

          // if (!hasRoom.exists()) {
          //   // creating conversation for thaiseva admin
          //   await setDoc(doc(chatRoomsCollection, "LocalPartnerSupport"), {
          //     [createdUser.uid + "_LocalPartnerSupport"]: {
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
          //   await updateDoc(doc(chatRoomsCollection, "LocalPartnerSupport"), {
          //     [createdUser.uid + "_LocalPartnerSupport"]: {
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
          //   doc(chatsCollection, createdUser.uid + "_LocalPartnerSupport"),
          //   { messages: [] }
          // );
        }
      })
      .catch((error) => {
        console.log(error);
        if (error.code === "auth/email-already-in-use") {
          setError({
            for: "email",
            text: "This email is already in use. Please log in.",
          });
        } else if (error.code === "auth/weak-password") {
          setError({
            for: "password",
            text: "Password is too weak.",
          });
        } else if (error.code === "auth/network-request-failed") {
          setError({
            for: "other",
            text: "Network error. Please check your internet connection.",
          });
        } else {
          setError({
            for: "other",
            text: "An unexpected error occurred. Please try again.",
          });
        }
      });
  };
  /* ===============================================================
                          Handle form submission end
  ===============================================================*/

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
    const places = searchBox.getPlaces();

    if (places.length === 0) return;

    const location = places[0].geometry.location;
    const address = await reverseGeocode(location.lat(), location.lng());
    setLocation({
      lat: location.lat(),
      lng: location.lng(),
    });
    setValue("address", address);
    map.setCenter(location);
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
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${
          import.meta.env.VITE_Google_Api_Key
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

  // uploading profile photo
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

  // setting selected vechicle into the select input
  // const handleChangeVechicleNames = (event) => {
  //   const {
  //     target: { value },
  //   } = event;
  //   setVechicleNames(
  //     // On autofill we get a stringified value.
  //     typeof value === "string" ? value.split(",") : value
  //   );
  // };

  // handling service category change
  const handleChangeServiceCategory = (e) => {
    setServiceCategory(e.target.value);
    // setVechicleNames([]);
  };

  const [serviceCategories, setServiceCategories] = useState([]);

  useEffect(() => {
    const fetchServiceCategories = async () => {
      await getDoc(serviceCategoriesDoc).then((snapshot) => {
        const data = snapshot.data();
        setServiceCategories([
          ...data.categories.map((cat) => cat.title),
          "Others",
        ]);
      });
    };
    fetchServiceCategories();
  }, []);

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
          fullWidth
          {...register(name, { required: true })}
        />
        {errors?.for === name && (
          <span className="text-red-500">{label} is required</span>
        )}
        {error?.for === "phone" && name === "phoneNumber" && (
          <span className="text-red-500">{error.text}</span>
        )}
        {error?.for === "email" && name === "email" && (
          <span className="text-red-500 text-sm">{error.text}</span>
        )}
      </Grid>
    );
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center md:px-10 p-2 py-12 bg-gradient-to-r from-[var(--main-bg-gradient-color-1)] to-[var(--main-bg-gradient-color-2)]">
      {/* form container */}
      <Paper
        elevation={3}
        sx={{ p: { xs: 2, sm: 3, md: 4, lg: 5 }, mx: "auto", width: "80%" }}
      >
        <div className="flex w-full max-lg:flex-col justify-between items-center mb-8">
          <img src={logo} alt="Thaiseva" className="w-[200px]" />
          <h3 className="text-center text-[var(--form-heading-color)] font-extrabold text-2xl">
            Local Assistance Onboarding Form
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
                defaultValue=""
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
              {error?.for === "password" && (
                <span className="text-red-500 text-sm">{error.text}</span>
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
              {error?.for === "password" && (
                <span className="text-red-500 text-sm">{error.text}</span>
              )}
            </Grid>
          </Grid>

          <Alert severity="warning" sx={{ mt: 1 }}>
            Please ensure to securely note down these credentials, as they will
            be required for future login and access purposes.
          </Alert>

          <div className="h-2"></div>

          {/* Driver Information*/}
          <SubTitle text="Partner Information :" />

          <Grid container spacing={3} sx={{ py: 1 }}>
            {/* Full Name */}
            {textField("Full Name", "fullName", "your full name...")}

            {/* Profile Picture */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Select Profile Picture"
                type="file"
                fullWidth
                InputLabelProps={{ shrink: true }}
                onChange={handleUploadProfile}
              />
              {error?.for === "profile" && (
                <span className="text-red-500 text-sm">{error.text}</span>
              )}
            </Grid>

            {/* Phone */}
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
                    placeholder="012 345 6789"
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

            {/* Address */}
            <Grid item xs={12} sm={6} md={4}>
              <Controller
                name="address"
                control={control}
                defaultValue=""
                render={({ field }) => (
                  <TextField
                    {...field} // Spread the field from Controller into TextField
                    label="Address"
                    placeholder="your location..."
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
              {error?.for === "address" && (
                <span className="text-red-500">{error.text}</span>
              )}
            </Grid>
          </Grid>

          <div className="w-[80%] h-[350px] my-2 relative m-auto">
            <div className="absolute top-2 left-1/3 z-10 ">
              <StandaloneSearchBox
                onLoad={onSearchLoad}
                onPlacesChanged={onPlacesChanged}
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
              </StandaloneSearchBox>
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

          {/* <div className="h-2"></div> */}

          {/* Service Information*/}
          <SubTitle text="Service details that you will provide :" />

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth>
                <InputLabel id="service-category-label">
                  Service Category
                </InputLabel>
                <Select
                  labelId="service-category-label"
                  label="Service Category"
                  defaultValue="Others"
                  onChange={handleChangeServiceCategory}
                >
                  {serviceCategories.map((item) => (
                    <MenuItem value={item} key={item}>
                      {item}
                    </MenuItem>
                  ))}
                  {/* <MenuItem value="Official Work">Official Work</MenuItem>
                  <MenuItem value="Legal Administrative">
                    Legal Administrative
                  </MenuItem>
                  <MenuItem value="Logistics and Transportation">
                    Logistics and Transportation
                  </MenuItem>
                  <MenuItem value="Order Local Sim">Order Local Sim</MenuItem>
                  <MenuItem value="Home Services">Home Services</MenuItem>
                  <MenuItem value="Order Pick Up">Order Pick Up</MenuItem>
                  <MenuItem value="Others">Others</MenuItem> */}
                </Select>
              </FormControl>
            </Grid>

            {textField(
              "Which location will you provide the service?",
              "serviceArea",
              "City Name, District Name"
            )}

            {/* {(serviceCategory === "Logistics and Transportation" ||
              serviceCategory === "Order Pick Up") &&
              textField("Number of Vehicles", "numberPlate", "Number Plate")}

            {(serviceCategory === "Logistics and Transportation" ||
              serviceCategory === "Order Pick Up") && (
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth>
                  <InputLabel id="vehicle-types-label">
                    Type of Vehicles
                  </InputLabel>
                  <Select
                    labelId="vehicle-types-label"
                    multiple
                    fullWidth
                    value={vechicleNames}
                    onChange={handleChangeVechicleNames}
                    input={
                      <OutlinedInput
                        label="Type of Vehicles"
                        id="vehicle-types"
                      />
                    }
                    renderValue={(selected) => (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} />
                        ))}
                      </Box>
                    )}
                  >
                    {vechicleTypes.map((name) => (
                      <MenuItem key={name} value={name}>
                        {name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {(serviceCategory === "Legal Administrative" ||
              serviceCategory === "Official Work") &&
              textField(
                "Institution Name",
                "educationalBackground",
                "Where did you complete graduation?"
              )} */}
          </Grid>

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

          <Box
            textAlign="center"
            sx={{ my: 2 }}
            className="pt-5 flex flex-col justify-center items-center"
          >
            {errors?.for === "other" && (
              <span className="text-red-500 mt-2">{error.text}</span>
            )}
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
    </div>
  );
};

export default PartnerOnboarding;
