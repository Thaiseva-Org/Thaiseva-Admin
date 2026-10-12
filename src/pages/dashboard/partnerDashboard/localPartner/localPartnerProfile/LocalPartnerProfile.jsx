import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
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
import { CloseIcon } from "@icons";
import { useForm } from "react-hook-form";
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import {
  chatRoomsCollection,
  partnersCollection,
  usersCollection,
} from "../../../../../firebase/firebase.config";
import PageHeading from "../../../../../components/PageHeading";
import CountryPhoneInput from "../../../../../components/CountryPhoneInput";
import { useEffect } from "react";
import SubTitle from "../../../../../components/SubTitle";
import { getFileUrl, successNotification } from "../../../../../utils/utils";
import ServiceCategoryBtn from "../../../../../components/ServiceCategoryBtn";
import StaticMap from "../../../../../components/StaticMap";
import {
  GoogleMap,
  MarkerF,
  StandaloneSearchBox,
} from "@react-google-maps/api";

const LocalPartnerProfile = () => {
  const { partnerDetails, setRefetch } = useContext(PartnerContext);
  const [profileEditModal, setProfileEditModal] = useState(false);
  const { user, updateUserProfile } = useContext(AuthContext);
  const [profileImg, setProfileImg] = useState("");
  const [map, setMap] = useState(null);
  const [location, setLocation] = useState(null);
  const [searchBox, setSearchBox] = useState(null);
  const [error, setError] = useState("");

  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm();

  useEffect(() => {
    partnerDetails &&
      setProfileImg(partnerDetails?.personalInformation?.photoURL);
    partnerDetails &&
      setLocation(partnerDetails?.personalInformation?.location);
  }, [partnerDetails]);

  /* ===============================================================
                          Handle Update Profile start
  ===============================================================*/
  // Handle form submission
  const handleUpdateProfile = async (data) => {
    setError("");
    const {
      fullName,
      address,
      phoneNumber,
      serviceArea,
      educationalBackground,
      numberPlate,
      bankName,
      accountNumber,
      bankAddress,
    } = data;

    if (!/^\+?\d{8,15}$/.test(phoneNumber || "")) {
      return setError("Invalid phone number");
    }

    const personalInformation = {
      email: user?.email,
      fullName,
      phoneNumber,
      address,
      photoURL: profileImg,
      location,
    };

    const serviceInformation = {
      serviceArea,
    };

    const paymentInformation = { bankName, accountNumber, bankAddress };

    // modifing service information based on service category
    if (
      partnerDetails?.serviceCategory === "Official Work" ||
      partnerDetails?.serviceCategory === "Legal Administrative"
    ) {
      serviceInformation.educationalBackground = educationalBackground;
    } else if (
      partnerDetails?.serviceCategory === "Logistics and Transportation" ||
      partnerDetails?.serviceCategory === "Order Pick Up"
    ) {
      serviceInformation.numberPlate = numberPlate;
      serviceInformation.vechicleNames = partnerDetails?.vechicleNames;
    }

    const updatedInfo = {
      personalInformation,
      serviceInformation,
      paymentInformation,
    };

    // adding users data to the useres collection
    await updateDoc(doc(usersCollection, user?.uid), {
      displayName: fullName,
      phoneNo: phoneNumber,
      photoURL: profileImg,
    });
    updateUserProfile(fullName, profileImg);

    await updateDoc(doc(partnersCollection, user?.uid), updatedInfo);
    successNotification("Profile Updated successfully");
    setRefetch((prev) => !prev);
    setProfileEditModal(false);

    await updateDoc(doc(chatRoomsCollection, "LocalPartnerSupport"), {
      [user.uid + "_LocalPartnerSupport"]: {
        userInfo: {
          uid: user?.uid,
          displayName: fullName,
          photoURL: profileImg,
          phoneNumber,
        },
        isRead: true,
        date: serverTimestamp(),
      },
    });
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
    const result = await getFileUrl(files, "partner");
    if (result?.error) {
      setError(result.message);
    } else {
      setProfileImg(result.url);
    }
  };

  const item = (label, value) => {
    return (
      <p>
        <span className="font-bold">{label} : </span>
        {value}
      </p>
    );
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
          <ServiceCategoryBtn value={partnerDetails?.serviceCategory} />
          <button
            onClick={() => setProfileEditModal(true)}
            className="add-new-btn"
          >
            Edit Profile
          </button>
        </div>
        <img
          src={partnerDetails?.personalInformation?.photoURL}
          alt=""
          className="md:w-60 md:h-60 w-40 h-40 rounded-full border-4 border-[var(--primary-bg)] mx-auto"
        />

        {/* partner's details  */}
        <div className="flex md:flex-row flex-col flex-wrap gap-3 justify-between mt-3">
          <div className="mb-3 flex-1">
            <h5 className="font-bold text-lg mb-2 text-[var(--primary-bg)] border-b border-[var(--primary-bg)] ">
              Personal Information:
            </h5>
            <div className="space-y-1">
              {item("Name", partnerDetails?.personalInformation?.fullName)}
              {item("Email", partnerDetails?.personalInformation?.email)}
              {item(
                "Phone Number",
                partnerDetails?.personalInformation?.phoneNumber
              )}
              {item("Address", partnerDetails?.personalInformation?.address)}
            </div>
          </div>
          <div className="mb-3 flex-1">
            <h5 className="font-bold text-lg mb-2 text-[var(--primary-bg)] border-b border-[var(--primary-bg)] ">
              Service Information:
            </h5>
            <div className="space-y-1">
              {item(
                "Service Area",
                partnerDetails?.serviceInformation?.serviceArea
              )}

              {partnerDetails?.serviceInformation?.educationalBackground &&
                item(
                  "Institute",
                  partnerDetails?.serviceInformation?.educationalBackground
                )}

              {partnerDetails?.serviceInformation?.numberPlate &&
                item(
                  "Number Plate",
                  partnerDetails?.serviceInformation?.numberPlate
                )}

              {partnerDetails?.serviceInformation?.vechicleNames && (
                <>
                  <h4 className="font-bold">Name of Vehicles: </h4>
                  <div className="flex flex-wrap gap-1">
                    {partnerDetails?.serviceInformation?.vechicleNames?.map(
                      (item) => (
                        <span
                          key={item}
                          className="bg-white py-1 px-2 rounded border border-[var(--primary-bg)]"
                        >
                          {item}
                        </span>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="mb-3 flex-1">
            <h5 className="font-bold text-lg mb-2 text-[var(--primary-bg)] border-b border-[var(--primary-bg)] ">
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

        <div className=" md:w-3/4 mx-auto mt-4">
          <h4 className="font-bold">Your Location: </h4>
          <StaticMap location={location} />
        </div>
      </div>

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
            <SubTitle text="Personal Information :" />

            {/* personal information */}
            <Grid container spacing={3}>
              {/* Full Name */}
              {textField(
                "Full Name",
                "fullName",
                partnerDetails?.personalInformation?.fullName
              )}

              {/* Profile Picture */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Select Profile Picture"
                  type="file"
                  placeholder=""
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  onChange={handleUploadPictures}
                />
                {error.includes("file") && (
                  <span className="text-sm text-red-500">{error}</span>
                )}
              </Grid>

              {/* Phone */}
              {textField(
                "Phone Number",
                "phoneNumber",
                partnerDetails?.personalInformation?.phoneNumber
              )}

              {/* Address */}
              {textField(
                "Address",
                "address",
                partnerDetails?.personalInformation?.address
              )}
            </Grid>
            {/* Service Information*/}
            <SubTitle text="Service information :" />
            <Grid container spacing={3}>
              {/* Service Area */}
              {textField(
                "Which location will you provide the service?",
                "serviceArea",
                partnerDetails?.serviceInformation?.serviceArea
              )}

              {/* Number of Vehicles */}
              {(partnerDetails?.serviceCategory ===
                "Logistics and Transportation" ||
                partnerDetails?.serviceCategory === "Order Pick Up") &&
                textField(
                  "Number of Vehicles",
                  "numberPlate",
                  partnerDetails?.serviceInformation?.numberPlate
                )}

              {/* Educational Background */}
              {(partnerDetails?.serviceCategory === "Legal Administrative" ||
                partnerDetails?.serviceCategory === "Official Work") &&
                textField(
                  "Institution Name",
                  "educationalBackground",
                  partnerDetails?.serviceInformation?.educationalBackground
                )}
            </Grid>
            {/* Payment Information*/}
            <SubTitle text="Payment Information :" />

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
                    className="location-input border border-[var(--primary-bg)] "
                  />
                </StandaloneSearchBox>
              </div>
              <GoogleMap
                id="map"
                center={partnerDetails?.personalInformation?.location}
                zoom={14}
                onLoad={onMapLoad}
                onClick={onMapClick}
                mapContainerStyle={{ width: "100%", height: "100%" }}
              >
                {location && <MarkerF position={location} />}
              </GoogleMap>
            </div>
            {error.includes("phone") && (
              <p className="my-2 text-red-500 text-center">{error}</p>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              type="submit"
              autoFocus
              sx={{
                bgcolor: "var(--button-bg-color)",
                color: "white",
                hover: "none",
              }}
              className="add-new-btn"
            >
              Update
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </div>
  );
};

export default LocalPartnerProfile;
