import { Box, Button, Grid, Paper, TextField } from "@mui/material";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  restaurentsCollection,
  usersCollection,
} from "../../firebase/firebase.config";
import { doc, setDoc } from "firebase/firestore";
import { useContext } from "react";
import { AuthContext } from "../../contextAPIs/AuthProvider";
import { useNavigate } from "react-router-dom";
import SubTitle from "../../components/SubTitle";
import { getFileUrl, successNotification } from "../../utils/utils";
import {
  GoogleMap,
  MarkerF,
  StandaloneSearchBox,
} from "@react-google-maps/api";

const center = { lat: 48.8584, lng: 2.2945 };

const RestaurantOnboarding = () => {
  const { createUser, updateUserProfile } = useContext(AuthContext);
  const [logoURL, setLogoURL] = useState("");
  const [license, setLicense] = useState("");
  const [map, setMap] = useState(null);
  const [location, setLocation] = useState(null);
  const [searchBox, setSearchBox] = useState(null);
  const [passwordError, setPasswordError] = useState("");
  const [error, setError] = useState({ for: "", text: "" });
  const navigate = useNavigate();

  const {
    handleSubmit,
    // reset,
    register,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setPasswordError("");
    const {
      email,
      password,
      restaurantName,
      phoneNumber,
      address,
      confirm,
      bankName,
      accountNumber,
      bankAddress,
      coupon,
      keywords,
    } = data;

    const accountInfo = { email, password };
    const restaurantInformation = {
      email,
      restaurantName,
      phoneNumber,
      address,
      logoURL,
      license,
      coupon,
      location,
      keywords,
    };
    const paymentInformation = { bankName, accountNumber, bankAddress };

    const restaurantInfo = {
      accountInfo,
      status: "Pending",
      serviceCategory: "Restaurant",
      ...restaurantInformation,
      paymentInformation,
    };

    if (password !== confirm) {
      return setPasswordError("Password doesn't matched");
    } else if (!logoURL) {
      return setError({ for: "logo", text: "Logo is required" });
    } else if (!license) {
      return setError({ for: "license", text: "License is required" });
    } else if (!location) {
      return setError({
        for: "location",
        text: "Please select your restaurant's location",
      });
    }

    // creating the user into Firebase authentication
    await createUser(email, password)
      .then(async (res) => {
        const createdUser = res.user;

        if (createdUser) {
          // adding users data to the useres collection
          await setDoc(doc(usersCollection, createdUser.uid), {
            email: email,
            displayName: restaurantName,
            role: "Partner",
            status: "Pending",
            serviceCategory: "Restaurant",
            createdAt: new Date(),
            uid: createdUser.uid,
          });

          navigate("/dashboard");

          await updateUserProfile(restaurantName, logoURL); //updating user name and logoURL

          restaurantInfo.uid = createdUser.uid;
          await setDoc(
            doc(restaurentsCollection, createdUser.uid),
            restaurantInfo
          ).then(() =>
            successNotification("The account is created successfully.")
          );
        }
      })
      .catch((error) => console.log(error));
  };

  /* ========================================================
              Google maps functionalities Started
 ======================================================== */
  const onMapLoad = (map) => {
    setMap(map);
  };

  const onMapClick = (e) => {
    setLocation({
      lat: e.latLng.lat(),
      lng: e.latLng.lng(),
    });
  };

  const onSearchLoad = (searchBox) => {
    setSearchBox(searchBox);
  };

  const onPlacesChanged = () => {
    const places = searchBox.getPlaces();

    if (places.length === 0) return;

    const location = places[0].geometry.location;

    setLocation({
      lat: location.lat(),
      lng: location.lng(),
    });
    map.setCenter(location);
  };
  /* ========================================================
            Google maps functionalities Ended
======================================================== */

  // uploading the restaurant logo to get the url
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

  // upload pictures
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
          type={name === "phoneNumber" ? "tel" : "text"}
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
          onChange={name === "logo" ? handleUploadLogo : handleUploadLicense}
        />
        {error?.for === name && (
          <span className="text-red-500 text-sm">{error?.text}</span>
        )}
      </Grid>
    );
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center md:px-10 p-2 py-12 bg-[blue]">
      {/* form container */}
      <Paper
        elevation={3}
        sx={{
          p: { xs: 2, sm: 3, md: 4, lg: 5 },
          mx: "auto",
          width: { lg: "80%" },
        }}
      >
        <h3 className="text-center text-[blue] font-bold text-2xl">
          Restaurant Onboarding Form
        </h3>

        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          {/* Account Information*/}
          <SubTitle text="Account & Restaurant Information:" />

          <Grid container spacing={3} sx={{ py: 1 }}>
            {/* Email */}
            {textField("Email", "email", "example@gmail.com")}

            {/* Password */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Password"
                type="password"
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
                type="password"
                defaultValue=""
                fullWidth
                {...register("confirm", { required: true })}
              />
              {passwordError && (
                <span className="text-red-500 text-sm">{passwordError}</span>
              )}
            </Grid>
            {textField(
              "Restaurent Name",
              "restaurantName",
              "Enter The Restaurant Name"
            )}
            {fileField("Restaurant Logo", "logo", logoURL)}
            {textField("Phone Number", "phoneNumber", "12 345 6789")}
            {textField(
              "Location",
              "address",
              "Where is your restaurant located?"
            )}
            {fileField("Restaurant License", "license", license)}
            {textField("Keywords", "keywords", "Italian, Cheese, Korean")}
            {textField("Coupon", "coupon", "THAISEVA10")}
          </Grid>

          <SubTitle text="Payment Information :" />
          <Grid container spacing={3}>
            {textField("Bank Name", "bankName", "Enter The Bank Name")}
            {textField("Account Number", "accountNumber", "Account Number")}
            {textField("Bank Address", "bankAddress", "Bank Address")}
          </Grid>
          <SubTitle text="Select your Restaurant location: " />
          {error?.for === "location" && (
            <span className="text-red-500">{error?.text}</span>
          )}
          <div className="w-full h-[400px] my-4 relative">
            <div className="absolute top-2 left-1/3 z-10 ">
              <StandaloneSearchBox
                onLoad={onSearchLoad}
                onPlacesChanged={onPlacesChanged}
              >
                <input
                  type="text"
                  placeholder="Search for a location"
                  className="location-input border border-blue-500"
                />
              </StandaloneSearchBox>
            </div>
            <GoogleMap
              id="map"
              center={center}
              zoom={14}
              onLoad={onMapLoad}
              onClick={onMapClick}
              mapContainerStyle={{ width: "100%", height: "100%" }}
            >
              {location && <MarkerF position={location} />}
            </GoogleMap>
          </div>
          <Box textAlign="center" sx={{ my: 2 }}>
            <Button type="submit" variant="contained" color="primary">
              Submit
            </Button>
          </Box>
        </Box>
      </Paper>
    </div>
  );
};

export default RestaurantOnboarding;
