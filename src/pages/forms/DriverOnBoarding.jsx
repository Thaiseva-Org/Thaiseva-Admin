import {
  Box,
  Button,
  Grid,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useRef, useState } from "react";
import axios from "axios";
import { useForm, Controller } from "react-hook-form";
import { MdLocationOn } from "react-icons/md";
import {
  chatRoomsCollection,
  chatsCollection,
  driversCollection,
  usersCollection,
} from "../../firebase/firebase.config";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useContext } from "react";
import { AuthContext } from "../../contextAPIs/AuthProvider";
import { useNavigate } from "react-router-dom";
import SubTitle from "../../components/SubTitle";
import { getFileUrl } from "../../utils/utils";

const DriverOnBoarding = () => {
  const { createUser, updateUserProfile } = useContext(AuthContext);
  const [error, setError] = useState({ for: "", text: "" });
  const [photoURL, setPhotoURL] = useState("");
  const [license, setLicense] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);

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
    const {
      email,
      password,
      fullName,
      confirm,
      address,
      phoneNumber,
      numberPlate,
      serviceArea,
      vehicleType,
      bankName,
      accountNumber,
      bankAddress,
    } = data;

    const accountInfo = { email, password };
    const driverInformation = {
      email,
      fullName,
      phoneNumber,
      address,
      photoURL,
      license,
    };
    const vehicleInformation = { numberPlate, vehicleType };
    const paymentInformation = { bankName, accountNumber, bankAddress };

    const serviceInfo = {
      accountInfo,
      status: "Pending",
      verified: false,
      driverInformation,
      serviceArea,
      serviceCategory: "Driving",
      vehicleInformation,
      paymentInformation,
    };

    if (password !== confirm) {
      return setError({ for: "password", text: "Password doesn't matched" });
    } else if (!photoURL) {
      return setError({ for: "profile", text: "Profile is required" });
    } else if (!license) {
      return setError({ for: "license", text: "Driving license is required" });
    }

    // creating the user into Firebase authentication
    await createUser(email, password)
      .then(async (res) => {
        const createdUser = res.user;

        if (createdUser) {
          // adding users data to the useres collection
          await setDoc(doc(usersCollection, createdUser.uid), {
            email: email,
            displayName: fullName,
            role: "Partner",
            status: "Pending",
            serviceCategory: "Driving",
            createdAt: new Date(),
            uid: createdUser.uid,
          }).catch((error) => {
            console.log(error);
          });
          serviceInfo.uid = createdUser.uid; // adding unique uid

          navigate("/dashboard");
          await updateUserProfile(fullName, photoURL); //updating user name and photoURL
          await setDoc(doc(driversCollection, createdUser.uid), serviceInfo);

          const hasRoom = await getDoc(
            doc(chatRoomsCollection, "DriversSupport")
          );

          if (!hasRoom.exists()) {
            // creating conversation for thaiseva admin
            await setDoc(doc(chatRoomsCollection, "DriversSupport"), {
              [createdUser.uid + "_DriversSupport"]: {
                userInfo: {
                  uid: createdUser?.uid,
                  displayName: createdUser?.displayName,
                  photoURL: createdUser?.photoURL,
                  phoneNumber,
                },
                isRead: true,
                date: serverTimestamp(),
              },
            });
          } else {
            // creating conversation for thaiseva admin
            await updateDoc(doc(chatRoomsCollection, "DriversSupport"), {
              [createdUser.uid + "_DriversSupport"]: {
                userInfo: {
                  uid: createdUser?.uid,
                  displayName: createdUser?.displayName,
                  photoURL: createdUser?.photoURL,
                  phoneNumber,
                },
                isRead: true,
                date: serverTimestamp(),
              },
            });
          }

          await setDoc(
            doc(chatsCollection, createdUser.uid + "_DriversSupport"),
            { messages: [] }
          );
        }
      })
      .catch((error) => console.log(error));
  };

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

  // upload profile
  const handleUploadProfile = async (e) => {
    const { files } = e.target;
    setError({ for: "", text: "" });
    const result = await getFileUrl(files);
    if (result?.error) {
      setError({ for: "profile", text: result.message });
    } else {
      setPhotoURL(result.url);
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
        {errors?.name && (
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
          fullWidth
          InputLabelProps={{ shrink: true }}
          onChange={
            name === "profile" ? handleUploadProfile : handleUploadLicense
          }
        />

        {error?.for === name && (
          <span className="text-red-500">{error.text}</span>
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
        <h3 className="text-center text-[var(--form-heading-color)] font-bold text-2xl mb-3">
          Driving Partner Onboarding Form
        </h3>

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
              {error.for === "password" && (
                <span className="text-red-500 text-sm">{error.text}</span>
              )}
            </Grid>
          </Grid>

          <div className="h-2"></div>

          {/* Driver Information*/}
          <SubTitle text="Driver Information :" />

          <Grid container spacing={3} sx={{ py: 1 }}>
            {/* Full Name */}
            {textField("Full Name", "fullName", "your full name...")}

            {/* Profile Picture */}
            {fileField("Profile Picture", "profile")}

            {/* Phone */}
            {textField("Phone Number", "phoneNumber", "+66 XX XXX XXXX")}

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

            {/* Driving License */}
            {fileField("Driving License", "drivingLicense")}
          </Grid>

          <div className="h-2"></div>

          {/* Service Information*/}
          <SubTitle text="Service & Vehicle information :" />

          <Grid container spacing={3} sx={{ py: 1 }}>
            {/* Vehicle Type */}
            {textField(
              "Vehicle Type",
              "vehicleType",
              "Type the vehicle's model"
            )}

            {/* Number plate */}
            {textField(
              "Vehicle registration number",
              "numberPlate",
              "XX 1234 ..."
            )}

            {/* Service Area */}
            {textField(
              "Which location will you provide the service?",
              "serviceArea",
              "City Name, District Name"
            )}
          </Grid>

          <div className="h-2"></div>

          {/* Payment Information*/}
          <SubTitle text="Payment Information :" />

          <Grid container spacing={3} sx={{ py: 1 }}>
            {/* Bank Name */}
            {textField(
              "Bank Name",
              "bankName",
              "You will get paid in this bank"
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
              "Where is the branch located?"
            )}
          </Grid>
          <Box textAlign="center" sx={{ my: 2 }}>
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

export default DriverOnBoarding;
