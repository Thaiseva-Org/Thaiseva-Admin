import { doc, updateDoc } from "firebase/firestore";
import { useContext, useState } from "react";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useForm } from "react-hook-form";

import {
  GoogleMap,
  MarkerF,
  StandaloneSearchBox,
} from "@react-google-maps/api";
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import { useEffect } from "react";
import {
  restaurentsCollection,
  usersCollection,
} from "../../../../../firebase/firebase.config";
import {
  getFileUrl,
  item,
  successNotification,
} from "../../../../../utils/utils";
import PageHeading from "../../../../../components/PageHeading";
import StaticMap from "../../../../../components/StaticMap";
import SubTitle from "../../../../../components/SubTitle";

const RestaurantProfile = () => {
  const { partnerDetails, setRefetch } = useContext(PartnerContext);
  const [profileEditModal, setProfileEditModal] = useState(false);
  const { user, updateUserProfile } = useContext(AuthContext);
  const [profileImg, setProfileImg] = useState("");
  const [error, setError] = useState("");
  const [map, setMap] = useState(null);
  const [location, setLocation] = useState(null);
  const [searchBox, setSearchBox] = useState(null);
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm();

  useEffect(() => {
    partnerDetails && setProfileImg(partnerDetails?.logoURL);
    partnerDetails && setLocation(partnerDetails?.location);
  }, [partnerDetails]);

  /* ===============================================================
                          Handle Update Profile start
  ===============================================================*/
  // Handle form submission
  const handleUpdateProfile = async (data) => {
    setError("");
    const {
      restaurantName,
      keywords,
      address,
      phoneNumber,
      bankName,
      accountNumber,
      coupon,
      bankAddress,
    } = data;

    const restaurantInfo = {
      email: partnerDetails.email,
      license: partnerDetails.license,
      location,
      keywords,
      restaurantName,
      logoURL: profileImg,
      phoneNumber,
      coupon,
      address,
      serviceCategory: partnerDetails?.serviceCategory,
    };
    const paymentInformation = { bankName, accountNumber, bankAddress };

    const updatedInfo = {
      status: partnerDetails.status,
      ...restaurantInfo,
      paymentInformation,
    };

    // updating the restaurant name in the user's collection
    await updateDoc(doc(usersCollection, user?.uid), {
      displayName: restaurantName,
    });

    await updateUserProfile(restaurantName, profileImg); //updating user name and photoURL

    await updateDoc(doc(restaurentsCollection, user?.uid), updatedInfo).then(
      () => {
        setRefetch((prev) => !prev);
        successNotification("Profile is updated successfully.", "success");
      }
    );

    setProfileEditModal(false);
  };
  /* ===============================================================
                          Handle Update Profile End
  ===============================================================*/

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

  // upload pictures
  const handleUploadPictures = async (e) => {
    const { files } = e.target;
    setError("");
    const result = await getFileUrl(files);
    if (result?.error) {
      setError(result.message);
    } else {
      setProfileImg(result.url);
    }
  };

  // custom text field for common data
  const textField = (label, name, defaultValue) => {
    return (
      <Grid item xs={12} sm={name === "description" ? 12 : 6}>
        <TextField
          label={label}
          type={
            name === "discount" || name === "NumberOfPassengers"
              ? "number"
              : "text"
          }
          defaultValue={defaultValue && defaultValue}
          multiline={name === "description"}
          fullWidth
          {...register(name, { required: true })}
          rows={name === "description" ? 3 : ""}
          InputLabelProps={{ shrink: true }}
        />
        {errors?.name && (
          <span className="text-red-500">{label} is required</span>
        )}
      </Grid>
    );
  };

  return (
    <div>
      <PageHeading text={"Partner's Profile"} />
      <div className="border border-[blue] rounded p-5 lg:mx-20 my-5 bg-blue-100 shadow-lg shadow-[#0000006d] pb-5">
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="inline-flex items-center gap-2 md:font-bold">
            <span className="md:block hidden">Service Category : </span>
            <div className="bg-[blue] py-1  md:text-lg text-sm px-2 rounded text-white">
              {partnerDetails.serviceCategory}
            </div>
          </div>
          <button
            onClick={() => setProfileEditModal(true)}
            className="text-[blue] py-1 px-2 md:text-lg text-sm inline-block rounded border-2 border-[blue]"
          >
            Edit Profile
          </button>
        </div>
        <img
          src={partnerDetails?.logoURL}
          alt=""
          className="md:w-60 md:h-60 w-40 h-40 rounded-full border-4 border-blue-500 mx-auto"
        />

        {/* partner's details  */}
        <div className="flex md:flex-row flex-col flex-wrap gap-3 justify-between mt-3">
          <div className="mb-3 flex-1">
            <h5 className="font-bold text-lg mb-2 text-[blue] border-b border-blue-500">
              Restaurant Information:
            </h5>
            <div className="space-y-1">
              {item("Restaurant Name", partnerDetails?.restaurantName)}
              {item("Email", partnerDetails?.email)}
              {item("Phone Number", partnerDetails?.phoneNumber)}
              {item("Address", partnerDetails?.address)}
              {item("Keywords", partnerDetails?.keywords)}
              {item("Current Coupon", partnerDetails?.coupon)}
            </div>
          </div>
          <div className="mb-3 flex-1">
            <h5 className="font-bold text-lg mb-2 text-[blue] border-b border-blue-500">
              Payment Information:
            </h5>
            <div className="space-y-1">
              {item("Bank Name", partnerDetails?.paymentInformation?.bankName)}
              {item(
                "Account Number",
                partnerDetails?.paymentInformation?.accountNumber
              )}
              {item(
                "Bank Address",
                partnerDetails?.paymentInformation?.bankAddress
              )}
            </div>
          </div>
        </div>
        {/* driving license */}
        <span className="font-bold">Restaurant License : </span>
        <img
          src={partnerDetails?.license}
          alt=""
          className="md:h-[60vh] md:w-3/4 mx-auto"
        />

        <div className=" md:w-3/4 mx-auto mt-4">
          <h4 className="font-bold">Your Restaurant Location: </h4>
          <StaticMap location={location} />
        </div>
      </div>

      {/* Update profile modal details */}
      <Dialog
        open={profileEditModal}
        onClose={() => setProfileEditModal(false)}
        aria-labelledby="responsive-dialog-title"
      >
        <Box component="form" onSubmit={handleSubmit(handleUpdateProfile)}>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            Update Profile
          </DialogTitle>
          <IconButton
            aria-label="close"
            onClick={() => setProfileEditModal(false)}
            sx={{
              position: "absolute",
              right: 0,
              top: 0,
              color: "gray",
            }}
          >
            <CloseIcon />
          </IconButton>

          {/* modal body */}
          <DialogContent dividers sx={{ p: { xs: 2, md: 2 } }}>
            <SubTitle text="Personal Information" />

            {/* personal information */}
            <Grid container spacing={3}>
              {/* Restaurant Name */}
              {textField(
                "Restaurant Name",
                "restaurantName",
                partnerDetails?.restaurantName
              )}

              {/* Profile Picture */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Select Profile Picture"
                  type="file"
                  onChange={handleUploadPictures}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
                {error?.includes("file") && (
                  <span className="text-sm text-red-500">{error}</span>
                )}
              </Grid>

              {textField(
                "Phone Number",
                "phoneNumber",
                partnerDetails?.phoneNumber
              )}
              {textField("Address", "address", partnerDetails?.address)}
              {textField("Keywords", "keywords", partnerDetails?.keywords)}
              {textField("Coupon", "coupon", partnerDetails?.coupon)}
            </Grid>

            {/* Payment Information*/}
            <SubTitle text="Payment Information" />
            <Grid container spacing={3}>
              {textField(
                "Bank Name",
                "bankName",
                partnerDetails?.paymentInformation?.bankName
              )}
              {textField(
                "Account Number",
                "accountNumber",
                partnerDetails?.paymentInformation?.accountNumber
              )}
              {textField(
                "Bank Address",
                "bankAddress",
                partnerDetails?.paymentInformation?.bankAddress
              )}
            </Grid>

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
                center={partnerDetails?.location}
                zoom={14}
                onLoad={onMapLoad}
                onClick={onMapClick}
                mapContainerStyle={{ width: "100%", height: "100%" }}
              >
                {location && <MarkerF position={location} />}
              </GoogleMap>
            </div>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              type="submit"
              autoFocus
              sx={{ bgcolor: "blue", color: "white", hover: "none" }}
            >
              Update
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </div>
  );
};

export default RestaurantProfile;
