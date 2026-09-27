import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useContext, useState } from "react";

import { CloseIcon } from "@icons";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
} from "@mui/material";
import {
  GoogleMap,
  MarkerF,
  StandaloneSearchBox,
} from "@react-google-maps/api";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { successNotification } from "../../../../../components/Notifications";
import PageHeading from "../../../../../components/PageHeading";
import CountryPhoneInput from "../../../../../components/CountryPhoneInput";
import StaticMap from "../../../../../components/StaticMap";
import SubTitle from "../../../../../components/SubTitle";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";
import {
  chatRoomsCollection,
  hotelsCollection,
  usersCollection,
} from "../../../../../firebase/firebase.config";
import { getFileUrl, item } from "../../../../../utils/utils";

const HotelProfile = ({ partnerDetails }) => {
  const { setRefetch } = useContext(PartnerContext);
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
    partnerDetails && setProfileImg(partnerDetails?.hotelInformation?.logoURL);
    partnerDetails && setLocation(partnerDetails?.hotelInformation?.location);
  }, [partnerDetails]);

  /* ===============================================================
                          Handle Update Profile start
  ===============================================================*/
  // Handle form submission
  const handleUpdateProfile = async (data) => {
    setError("");
    const {
      hotelName,
      address,
      phoneNumber,
      bankName,
      accountNumber,
      bankAddress,
    } = data;

    const hotelInformation = {
      email: partnerDetails.hotelInformation.email,
      license: partnerDetails.hotelInformation.license,
      location,
      hotelName,
      logoURL: profileImg,
      phoneNumber,
      address,
    };
    const paymentInformation = { bankName, accountNumber, bankAddress };

    const updatedInfo = {
      status: partnerDetails.status,
      verified: partnerDetails.verified,
      hotelInformation,
      serviceCategory: partnerDetails.serviceCategory,
      paymentInformation,
    };

    // updating the hotel name in the user's collection
    await updateDoc(doc(usersCollection, user?.uid), {
      displayName: hotelName,
      phoneNo: phoneNumber,
    }).catch((error) => console.log(error));

    await updateUserProfile(hotelName, profileImg); //updating user name and photoURL

    await updateDoc(doc(hotelsCollection, user?.uid), updatedInfo).then(() => {
      setRefetch((prev) => !prev);
      successNotification("Profile is updated successfully.");
      // successNotification("Profile is updated successfully.", "success");
    });

    await updateDoc(doc(chatRoomsCollection, "HotelSupport"), {
      [user.uid + "_HotelSupport"]: {
        userInfo: {
          uid: user?.uid,
          displayName: user?.displayName,
          photoURL: profileImg,
          phoneNumber,
        },
        isRead: true,
        date: serverTimestamp(),
      },
    });

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
        {name === "phoneNumber" ? (
          <CountryPhoneInput label={label} defaultValue={defaultValue || ""} required {...register(name, { required: true })} />
        ) : (
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
        )}
        {errors?.name && (
          <span className="text-red-500">{label} is required</span>
        )}
      </Grid>
    );
  };

  return (
    <div>
      <PageHeading text={"Partner's Profile"} />
      <div className="banner-layout">
        <div className="banner-section-title">
          <div className="inline-flex items-center gap-2">
            <span className="md:block hidden">Service Category : </span>
            <div className="bg-[var(--primary-bg)] py-1  md:text-lg text-sm px-2 rounded text-white">
              {partnerDetails.serviceCategory}
            </div>
          </div>
          {partnerDetails?.uid === user?.uid && (
            <button
              onClick={() => setProfileEditModal(true)}
              // className="text-[var(--primary-bg)] py-1 px-2 md:text-lg text-sm inline-block rounded border-2 border-[var(--primary-bg)]"
              className="add-new-btn"
            >
              Edit Profile
            </button>
          )}
        </div>
        <img
          src={partnerDetails?.hotelInformation?.logoURL}
          alt=""
          className="md:w-60 md:h-60 w-40 h-40 rounded-full border-4 border-[var(--primary-bg)] mx-auto"
        />

        {/* partner's details  */}
        <div className="flex md:flex-row flex-col flex-wrap gap-3 justify-between mt-3">
          <div className="mb-3 flex-1">
            <h5 className="font-bold text-lg mb-2 text-[var(--primary-bg)] border-b border-[var(--primary-bg)]">
              Hotel Information:
            </h5>
            <div className="space-y-1">
              {item("Hotel Name", partnerDetails?.hotelInformation?.hotelName)}
              {item("Email", partnerDetails?.hotelInformation?.email)}
              {item(
                "Phone Number",
                partnerDetails?.hotelInformation?.phoneNumber
              )}
              {item("Address", partnerDetails?.hotelInformation?.address)}
            </div>
          </div>
          <div className="mb-3 flex-1">
            <h5 className="font-bold text-lg mb-2 text-[var(--primary-bg)] border-b border-[var(--primary-bg)]">
              Payment Information:{" "}
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

        {/* Hotel license */}
        <span className="font-bold">Hotel License : </span>
        <img
          src={partnerDetails?.hotelInformation?.license}
          alt=""
          className="md:h-[60vh] md:w-3/4 mx-auto"
        />

        <div className=" md:w-3/4 mx-auto mt-4">
          <h4 className="font-bold">Your Hotel Location: </h4>
          <StaticMap location={location} />
        </div>

        {/* invoices */}
        {/* <PartnerInvoices
          partnerUid={partnerDetails.uid}
          paymentTo={{
            partnerName: partnerDetails?.hotelInformation?.hotelName,
            partnerPhone: partnerDetails?.hotelInformation?.phoneNumber,
            partnerEmail: partnerDetails?.hotelInformation?.email,
            partnerAddress: partnerDetails?.hotelInformation?.address,
          }}
          category={partnerDetails?.serviceCategory}
        /> */}
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
              {/* Hotel Name */}
              {textField(
                "Hotel Name",
                "hotelName",
                partnerDetails?.hotelInformation?.hotelName
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

              {/* Phone */}
              {textField(
                "Phone Number",
                "phoneNumber",
                partnerDetails?.hotelInformation?.phoneNumber
              )}

              {/* Address */}
              {textField(
                "Address",
                "address",
                partnerDetails?.hotelInformation?.address
              )}
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
                    className="location-input border border-[var(--primary-bg)]"
                  />
                </StandaloneSearchBox>
              </div>
              <GoogleMap
                id="map"
                center={partnerDetails?.hotelInformation?.location}
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
            <button
              // variant="contained"
              type="submit"
              autoFocus
              className="add-new-btn"
              // sx={{
              //   bgcolor: "var(--primary-bg)",
              //   color: "white",
              //   hover: "none",
              // }}
            >
              Update
            </button>
          </DialogActions>
        </Box>
      </Dialog>
    </div>
  );
};

export default HotelProfile;
