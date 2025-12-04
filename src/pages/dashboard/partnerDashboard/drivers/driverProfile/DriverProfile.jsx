import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";

import CloseIcon from "@mui/icons-material/Close";
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
  Typography,
} from "@mui/material";
import { useForm } from "react-hook-form";
import { successNotification } from "../../../../../components/Notifications";
import PageHeading from "../../../../../components/PageHeading";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";
import {
  chatRoomsCollection,
  driversCollection,
  usersCollection,
} from "../../../../../firebase/firebase.config";
import { getFileUrl } from "../../../../../utils/utils";

const DriverProfile = ({ partnerDetails }) => {
  const { setRefetch } = useContext(PartnerContext);
  const [profileEditModal, setProfileEditModal] = useState(false);
  const { user, updateUserProfile } = useContext(AuthContext);
  const [error, setError] = useState({ for: "", text: "" });
  const [photoURL, setPhotoURL] = useState("");
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm();

  useEffect(() => {
    partnerDetails && setPhotoURL(partnerDetails?.driverInformation?.photoURL);
  }, [partnerDetails]);

  /* ===============================================================
                          Handle Update Profile start
  ===============================================================*/
  // Handle form submission
  const handleUpdateProfile = async (data) => {
    setError({ for: "", text: "" });
    const {
      fullName,
      address,
      phoneNumber,
      numberPlate,
      serviceArea,
      vehicleType,
      bankName,
      accountNumber,
      bankAddress,
    } = data;

    if (!photoURL) {
      return setError({ for: "profile", text: "Profile is required" });
    }

    const driverInformation = {
      email: partnerDetails.driverInformation.email,
      license: partnerDetails.driverInformation.license,
      fullName,
      photoURL,
      phoneNumber,
      address,
    };
    const vehicleInformation = { numberPlate, vehicleType };
    const paymentInformation = { bankName, accountNumber, bankAddress };

    const updatedInfo = {
      status: partnerDetails.status,
      verified: partnerDetails.verified,
      driverInformation,
      vehicleInformation,
      serviceArea,
      serviceCategory: partnerDetails.serviceCategory,
      paymentInformation,
    };

    // adding users data to the useres collection
    await updateDoc(doc(usersCollection, user?.uid), {
      displayName: fullName,
      photoURL,
    });

    await updateUserProfile(fullName, photoURL); //updating user name and photoURL
    await updateDoc(doc(driversCollection, user?.uid), updatedInfo).then(() => {
      successNotification("Profile updated successfully.", "success");
      setRefetch((p) => !p);
    });

    setProfileEditModal(false);

    await updateDoc(doc(chatRoomsCollection, "DriversSupport"), {
      [user.uid + "_DriversSupport"]: {
        userInfo: {
          uid: user?.uid,
          displayName: user?.displayName,
          photoURL: photoURL,
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

  return (
    <div>
      <PageHeading text={"Partner's Profile"} />
      <div className="border border-[var(--primary-bg)] rounded p-5 lg:mx-20 my-5 bg-blue-100 shadow-lg shadow-[#0000006d] pb-5">
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="inline-flex items-center gap-2 md:font-bold">
            <span className="md:block hidden">Service Category : </span>
            <div className="bg-[var(--primary-bg)] py-1  md:text-lg text-sm px-2 rounded text-white">
              {partnerDetails.serviceCategory}
            </div>
          </div>
          {partnerDetails?.uid === user?.uid && (
            <button
              onClick={() => setProfileEditModal(true)}
              className="text-[var(--primary-bg)] py-1 px-2 md:text-lg text-sm inline-block rounded border-2 border-[var(--primary-bg)]"
            >
              Edit Profile
            </button>
          )}
        </div>
        <img
          src={partnerDetails?.driverInformation?.photoURL}
          alt=""
          className="md:w-60 md:h-60 w-40 h-40 rounded-full border-4 border-[var(--primary-bg)] mx-auto"
        />

        {/* partner's details  */}
        <div className="flex md:flex-row flex-col flex-wrap gap-3 justify-between mt-3">
          <div className="mb-3 flex-1">
            <h5 className="font-bold text-lg mb-2 text-[var(--primary-bg)] border-b border-[var(--primary-bg)]">
              Personal Information:{" "}
            </h5>
            <div className="space-y-1">
              <p>
                <span className="font-bold">Name : </span>
                {partnerDetails?.driverInformation?.fullName}
              </p>
              <p>
                <span className="font-bold">Email : </span>
                {partnerDetails?.driverInformation?.email}
              </p>
              <p>
                <span className="font-bold">Phone Number : </span>
                {partnerDetails?.driverInformation?.phoneNumber}
              </p>
              <p>
                <span className="font-bold">Address : </span>
                {partnerDetails?.driverInformation?.address}
              </p>
            </div>
          </div>
          <div className="mb-3 flex-1">
            <h5 className="font-bold text-lg mb-2 text-[var(--primary-bg)] border-b border-[var(--primary-bg)]">
              Service Information:
            </h5>
            <div className="space-y-1">
              <p>
                <span className="font-bold">Service Area : </span>
                {partnerDetails?.serviceArea}
              </p>
              <p>
                <span className="font-bold">Vehicle Type : </span>
                {partnerDetails?.vehicleInformation?.vehicleType}
              </p>
              <p>
                <span className="font-bold">Vehicles : </span>
                {partnerDetails?.vehicleInformation?.numberPlate}
              </p>
            </div>
          </div>
          <div className="mb-3 flex-1">
            <h5 className="font-bold text-lg mb-2 text-[var(--primary-bg)] border-b border-[var(--primary-bg)]">
              Payment Information:{" "}
            </h5>
            <div className="space-y-1">
              <p>
                <span className="font-bold">Bank Name : </span>
                {partnerDetails?.paymentInformation?.bankName}
              </p>
              <p>
                <span className="font-bold">Account Number : </span>
                {partnerDetails?.paymentInformation?.accountNumber}
              </p>
              <p>
                <span className="font-bold">Bank Address : </span>
                {partnerDetails?.paymentInformation?.bankAddress}
              </p>
            </div>
          </div>
        </div>
        {/* driving license */}
        <span className="font-bold">Driving License : </span>
        <img
          src={partnerDetails?.driverInformation?.license}
          alt=""
          className="md:h-[60vh] md:w-3/4 mx-auto"
        />
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
            <Typography variant="h6" sx={{ my: 1, fontWeight: "bold" }}>
              Personal Information :
            </Typography>

            {/* personal information */}
            <Grid container spacing={3}>
              {/* Full Name */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Full Name"
                  type="text"
                  defaultValue={partnerDetails?.driverInformation?.fullName}
                  fullWidth
                  {...register("fullName", { required: true })}
                />
                {errors?.fullName && (
                  <span className="text-red-500">Full Name is required</span>
                )}
              </Grid>

              {/* Profile Picture */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Select Profile Picture"
                  type="file"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  onChange={handleUploadProfile}
                />
                {error?.for === "profile" && (
                  <span className="text-red-500">{error.text}</span>
                )}
              </Grid>

              {/* Phone */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Phone Number"
                  placeholder="12 345 6789"
                  type="tel"
                  defaultValue={partnerDetails?.driverInformation?.phoneNumber}
                  fullWidth
                  {...register("phoneNumber", { required: true })}
                />
                {errors.phoneNumber && (
                  <span className="text-red-500">{error}</span>
                )}
              </Grid>

              {/* Address */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Address"
                  type="text"
                  defaultValue={partnerDetails?.driverInformation?.address}
                  fullWidth
                  {...register("address", { required: true })}
                />
                {errors?.address && (
                  <span className="text-red-500">Address is required</span>
                )}
              </Grid>
            </Grid>
            {/* Service Information*/}
            <Typography variant="h6" sx={{ my: 1, fontWeight: "bold" }}>
              Service information :
            </Typography>
            <Grid container spacing={3}>
              {/* Service Area */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Which location will you provide the service?"
                  type="text"
                  defaultValue={partnerDetails?.serviceArea}
                  fullWidth
                  {...register("serviceArea", { required: true })}
                />
                {errors?.serviceArea && (
                  <span className="text-red-500">Service Area is required</span>
                )}
              </Grid>

              {/* Number Plate */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Number Plate"
                  type="text"
                  defaultValue={partnerDetails?.vehicleInformation?.numberPlate}
                  fullWidth
                  inputProps={{
                    min: 0,
                  }}
                  {...register("numberPlate", { required: true })}
                />
                {errors?.numberPlate && (
                  <span className="text-red-500">Number Plate is required</span>
                )}
              </Grid>

              {/* Vehicle Type */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Vehicle Type"
                  type="text"
                  defaultValue={partnerDetails?.vehicleInformation?.vehicleType}
                  fullWidth
                  {...register("vehicleType", { required: true })}
                />
                {errors?.vehicleType && (
                  <span className="text-red-500">Vehicle Type is required</span>
                )}
              </Grid>
            </Grid>
            {/* Payment Information*/}
            <Typography variant="h6" sx={{ my: 1, fontWeight: "bold" }}>
              Payment Information :{" "}
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Bank Name"
                  type="text"
                  defaultValue={partnerDetails?.paymentInformation?.bankName}
                  placeholder="You will get paid in this bank"
                  fullWidth
                  {...register("bankName", { required: true })}
                />
                {errors?.bankName && (
                  <span className="text-red-500">Bank Name is required</span>
                )}
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Account Number"
                  type="text"
                  defaultValue={
                    partnerDetails?.paymentInformation?.accountNumber
                  }
                  placeholder="Type the number carefully"
                  fullWidth
                  rows={6}
                  {...register("accountNumber", { required: true })}
                />
                {errors?.accountNumber && (
                  <span className="text-red-500">
                    Account Number is required
                  </span>
                )}
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Bank Address"
                  type="text"
                  defaultValue={partnerDetails?.paymentInformation?.bankAddress}
                  placeholder="Where is the branch located?"
                  fullWidth
                  {...register("bankAddress", { required: true })}
                />
                {errors?.bankAddress && (
                  <span className="text-red-500">Bank Address is required</span>
                )}
              </Grid>
            </Grid>
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

export default DriverProfile;
