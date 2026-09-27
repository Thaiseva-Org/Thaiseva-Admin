/* eslint-disable react-hooks/exhaustive-deps */
import { CloseIcon } from "@icons";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useContext, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { v4 as uuid } from "uuid";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";
import {
  db,
  hotelPackageDetails,
  storage,
} from "../../../../../firebase/firebase.config";
import { successNotification } from "../../../../../utils/utils";

const CreateRoom = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  // console.log(user.displayName);
  const { partnerDetails } = useContext(PartnerContext);
  const [coverPhotoURL, setCoverPhotoURL] = useState("");
  const amenitiesRef = useRef();
  const [currency, setCurrency] = useState("THB");
  const location = useLocation();
  const data = location.state;
  const [roomDetails, setRoomDetails] = useState({
    id: "",
    packageName: "",
    price: "",
    description: "",
    discount: "",
    // location: {},
    // period: "",
    bookingInfo: {},
    maxAdults: "",
    maxChildren: "",
    // address: "",
    ratings: "",
    numberOfReviews: "",
    country: "",
    extraBedPrice: 0,
    hasExtraBed: false,
  });
  const [arrayData, setArrayData] = useState({
    amenities: [],
    included: [],
    pictures: [],
    places: [],
  });
  const [picture, setPicture] = useState({ label: "", url: "" });

  const {
    handleSubmit,
    reset,
    register,
    setValue,
    watch,
    formState: { errors },
  } = useForm();

  /* =============================================================
              Add Packages functionalities start
  =============================================================*/

  // useEffect(() => {
  //   console.log("Hotel")
  //   console.log(partnerDetails?.country)
  // }, [])

  // storing the requrement in the database
  const handleAddRoom = async (data) => {
    if (
      confirm(
        `Are you sure to ${roomDetails?.packageName ? "update" : "add"
        } this package.`
      )
    ) {
      // const location = partnerDetails?.hotelInformation?.location;
      const phoneNumber = partnerDetails?.hotelInformation?.phoneNumber;
      const name = partnerDetails?.hotelInformation?.hotelName;
      const {
        packageName,
        price,
        description,
        discount,
        // period,
        maxAdults,
        maxChildren,
        // address,
        extraBedPrice,
        hasExtraBed,
      } = data;

      let id;

      if (roomDetails.id) {
        id = roomDetails.id;
      } else {
        id = uuid();
      }

      const adults = Math.max(0, parseInt(maxAdults, 10) || 0);
      const children = Math.max(0, parseInt(maxChildren, 10) || 0);

      // Fetching the country from the hotels object
      const hotelCountry = partnerDetails?.country || "Thailand";

      const packageInfo = {
        id,
        packageName,
        price: parseFloat(price),
        discount: parseFloat(discount),
        // period,
        // address,
        name,
        coverPhoto: coverPhotoURL,
        rating: "0",
        status: "Pending",
        hotelUid: user?.uid,
        hotelName: user?.displayName,
        numberOfReviews: 0,
        country: hotelCountry,
      };

      const inventoryQty = Math.max(
        1,
        parseInt(data.totalRooms, 10) || Number(roomDetails.totalRooms) || 5
      );
      const packageDetails = {
        ...packageInfo,
        description,
        maxAdults: adults,
        maxChildren: children,
        numberOfGuests: adults + children,
        totalRooms: inventoryQty,
        quantity: inventoryQty,
        roomName: packageName,
        amenities: arrayData?.amenities,
        pictures: arrayData?.pictures,
        // location,
        currency,
        phoneNumber,
        duration: 30,
        extraBedPrice: hasExtraBed ? parseFloat(extraBedPrice || 0) : 0,
        hasExtraBed: !!hasExtraBed,
        allowExtraBed: !!hasExtraBed,
        policies: {
          extraBed: hasExtraBed ? "Available" : "",
          extraBedPrice: hasExtraBed ? parseFloat(extraBedPrice || 0) : 0,
        },
        pricing: {
          basePrice: parseFloat(price) || 0,
          discountPercent: parseFloat(discount) || 0,
          pricePerNightAfterDiscount:
            parseFloat(price) * (1 - (parseFloat(discount) || 0) / 100) || 0,
        },
        updatedAt: serverTimestamp(),
        // createdAt only when creating a new package
        ...(!roomDetails.id ? { createdAt: serverTimestamp() } : {}),
      };
      // console.log(packageDetails, packageInfo);

      // await setDoc(doc(hotelPackages, id), packageInfo);
      await setDoc(doc(hotelPackageDetails, id), packageDetails, { merge: true });
      // Dual-write so availability / website booking see this room type
      if (user?.uid) {
        await setDoc(
          doc(db, "HotelDB", user.uid, "rooms", id),
          {
            ...packageDetails,
            id,
            hotelUid: user.uid,
            packageName,
            roomName: packageName,
          },
          { merge: true }
        );
      }
      successNotification(
        `The Package is ${roomDetails?.packageName ? "updated" : "added"
        } successfully`
      );

      setRoomDetails({
        id: "",
        packageName: "",
        price: "",
        description: "",
        discount: 0,
        // location: {},
        // period: "",
        bookingInfo: {},
        maxAdults: "",
        maxChildren: "",
        // address: "",
        ratings: "",
        numberOfReviews: "",
      });

      setCoverPhotoURL("");
      setArrayData({
        amenities: [],
        pictures: [],
      });
      navigate("/dashboard/added-rooms", { replace: true });
    }
  };

  /* =============================================================
              Add Packages functionalities end
  =============================================================*/

  // fetch package
  const fetchRoomDetails = async (id) => {
    reset();
    // console.log(id);
    const snapshot = await getDoc(doc(hotelPackageDetails, id));
    // console.log(snapshot);
    if (snapshot.exists()) {
      const existingData = snapshot.data();
      // console.log(data);
      const {
        id,
        packageName,
        price,
        // address,
        description,
        discount,
        // location,
        // period,
        numberOfGuests,
        maxAdults,
        maxChildren,
        ratings,
        numberOfReviews,
        extraBedPrice,
        hasExtraBed,
      } = existingData;

      const adults =
        maxAdults !== undefined && maxAdults !== null && maxAdults !== ""
          ? maxAdults
          : (numberOfGuests ?? "");
      const children =
        maxChildren !== undefined && maxChildren !== null && maxChildren !== ""
          ? maxChildren
          : 0;

      setRoomDetails({
        id,
        packageName,
        price,
        // address,
        description,
        discount,
        // location,
        // period,
        maxAdults: adults,
        maxChildren: children,
        ratings,
        numberOfReviews,
        extraBedPrice: extraBedPrice || 0,
        hasExtraBed: hasExtraBed || false,
      });
      setValue("packageName", packageName);
      setValue("description", description);
      setValue("price", price);
      setValue("discount", discount);
      // setValue("address", address);
      // setValue("period", period);
      setValue("maxAdults", adults);
      setValue("maxChildren", children);
      setValue(
        "totalRooms",
        existingData.totalRooms ?? existingData.quantity ?? 5
      );
      setValue("extraBedPrice", extraBedPrice || 0);
      setValue("hasExtraBed", hasExtraBed || false);

      setCoverPhotoURL(existingData?.coverPhoto);
      setArrayData((p) => ({
        ...p,
        amenities: existingData?.amenities || [],
        pictures: existingData?.pictures || [],
      }));
    }
  };

  // handleing add amenities
  const handleAddAmenities = () => {
    const element = amenitiesRef.current.querySelector("input");
    if (!element.value) {
      return;
    }
    const newAmenities = [...arrayData.amenities, element.value];
    setArrayData((p) => ({ ...p, amenities: newAmenities }));
    element.value = "";
  };

  // handling remove amenities
  const handleRemoveAmenity = (i) => {
    const { amenities } = arrayData;
    const newAmenities = arrayData.amenities
      .slice(0, i)
      .concat(amenities.slice(i + 1));
    setArrayData((p) => ({ ...p, amenities: newAmenities }));
  };

  // upload cover photo
  const handleUploadCoverPhoto = async (e) => {
    const file = e.target.files[0];

    const fileRef = ref(storage, `${file.lastModified}-coverPhoto`); // firebase storage to store license img
    //  // Uploading the profile image to storage
    const coverPhotoTask = await uploadBytesResumable(fileRef, file);

    // Get the download URL
    const photoURL = await getDownloadURL(coverPhotoTask.ref);

    if (photoURL) {
      setCoverPhotoURL(photoURL);
    }
  };

  // upload pictures
  const handleUploadPictures = async (e) => {
    let file = e.target.files[0];

    const imageRef = ref(storage, `${file.lastModified}-roomPhoto`); // firebase storage to store license img
    //  // Uploading the profile image to storage
    const imageTask = await uploadBytesResumable(imageRef, file);

    // Get the download URL
    const imageURL = await getDownloadURL(imageTask.ref);

    // console.log(imageURL);
    if (imageURL) {
      setPicture((p) => ({ ...p, url: imageURL }));
    }
    // handleAddPicture();
  };

  const [showAddImageModal, setShowAddImageModal] = useState(false);

  // adding picture with label
  // const handleAddPicture = () => {
  //   setArrayData((p) => ({ ...p, pictures: [...p.pictures, picture] }));
  //   setPicture({ label: "", url: "" });
  // };

  // adding picture with label
  const handleAddPictureFormSubmit = (e) => {
    e.preventDefault();
    setArrayData((p) => ({ ...p, pictures: [...p.pictures, picture] }));
    setPicture({ label: "", url: "" });
    setShowAddImageModal(false);
  };

  // Remove picture
  const handleRemovePicture = (i) => {
    const { pictures } = arrayData;
    const newPictures = arrayData.pictures
      .slice(0, i)
      .concat(pictures.slice(i + 1));
    setArrayData((p) => ({ ...p, pictures: newPictures }));
  };

  const textField = (label, name, placeholder) => {
    const value = watch(name); // Watch current value of the field
    const isNumber = ["price", "discount", "maxAdults", "maxChildren", "totalRooms", "period", "extraBedPrice"].includes(name);
    const registration = register(name, { required: true });
    return (
      <Grid item xs={12} sm={name === "description" ? 12 : 6}>
        <TextField
          label={label}
          type={isNumber ? "number" : "text"}
          onWheel={(e) => e.target.blur()}
          onKeyDown={(e) => {
            if (
              e.target.type === "number" &&
              ["+", "-", "e", "/"].includes(e.key)
            ) {
              e.preventDefault();
            }
          }}
          inputProps={{
            min: ["discount", "maxAdults", "maxChildren"].includes(name)
              ? 0
              : ["price", "period", "extraBedPrice", "totalRooms"].includes(name)
                ? 1
                : undefined,
            max: name === "discount" ? 100 : undefined,
          }}
          value={value ?? ""}
          name={registration.name}
          inputRef={registration.ref}
          onBlur={registration.onBlur}
          onChange={(e) => {
            registration.onChange(e);
            setValue(name, e.target.value, { shouldValidate: true, shouldDirty: true });
          }}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          multiline={name === "description"}
          fullWidth
          rows={name === "description" ? 3 : undefined}
        />
        {errors?.[name] && (
          <span className="text-red-500">{label} is required</span>
        )}
      </Grid>
    );
  };

  const hasExtraBed = watch("hasExtraBed");

  // const textField = (label, name, placeholder, defaultValue) => {
  //   return (
  //     <Grid item xs={12} sm={name === "description" ? 12 : 6}>
  //       <TextField
  //         label={label}
  //         type={
  //           ["price", "discount", "numberOfGuests", "period"].includes(name)
  //             ? "number"
  //             : "text"
  //         }
  //         inputProps={{
  //           min: ["discount"].includes(name)
  //             ? 0
  //             : ["price", "numberOfGuests", "period"].includes(name)
  //             ? 1
  //             : undefined,
  //           max: ["discount", "numberOfGuests"].includes(name)
  //             ? 100
  //             : undefined,
  //         }}
  //         defaultValue={defaultValue}
  //         placeholder={placeholder}
  //         multiline={name === "description"}
  //         fullWidth
  //         {...register(name, { required: true })}
  //         rows={name === "description" ? 3 : undefined}
  //       />
  //       {errors?.name && (
  //         <span className="text-red-500">{label} is required</span>
  //       )}
  //     </Grid>
  //   );
  // };

  useEffect(() => {
    if (data?.id) {
      fetchRoomDetails(data.id, null);
    }
  }, [data?.id]);

  return (
    <div className="banner-layout">
      <Dialog
        maxWidth="xl"
        open={showAddImageModal}
        onClose={() => setShowAddImageModal(false)}
      >
        <form onSubmit={handleAddPictureFormSubmit}>
          <DialogTitle>Add Picture</DialogTitle>
          <DialogContent
            sx={{ display: "flex", flexDirection: "column", gap: 4, pt: 4 }}
          >
            <TextField
              className="mt-4"
              sx={{
                marginTop: 2,
              }}
              onChange={(e) =>
                setPicture((prev) => ({ ...prev, label: e.target.value }))
              }
              required
              label="Label"
              value={picture.label}
            />
            {picture.url === "" ? (
              <>
                <label
                  htmlFor="image-uploader"
                  className="rounded-md text-teal-700
                font-medium w-[480px] flex h-[270px] items-center
                cursor-pointer border-dashed
                justify-center py-2 border- border border-gray-700"
                >
                  Upload Photo
                </label>
                <input
                  id="image-uploader"
                  type="file"
                  required
                  hidden
                  onChange={(e) => {
                    handleUploadPictures(e);
                  }}
                />
              </>
            ) : (
              <div
                className="rounded-md text-white text-xl
            font-medium w-[480px] flex h-[270px] items-center
            cursor-pointer border-dashed
            justify-center py-2"
                style={{
                  backgroundImage: `url('${picture.url}')`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                }}
              >
                {picture.label}
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <Button variant="text" onClick={() => setShowAddImageModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="contained">
              Add Image
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      <Box component="form" onSubmit={handleAddRoom}>
        <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
          {roomDetails?.packageName ? "Update" : "Add New"} Package
        </DialogTitle>

        {/* modal body */}
        <DialogContent dividers sx={{ p: { xs: 2, md: 2 } }}>
          <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
            {/* Package Name */}
            {textField(
              "Package Name",
              "packageName",
              "Eg: Luxury",
              roomDetails?.packageName
            )}

            {/* <div
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: "1em",
                gap: "1em",
                marginLeft: "1em",
              }}
            > */}
            {/* Price */}
            {textField("Price", "price", "Eg: 200", roomDetails?.price)}
            {/* <Select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                label="Select Currency"
              >
                <MenuItem value="USD">USD</MenuItem>
                <MenuItem value="THB">THB</MenuItem>
                <MenuItem value="INR">INR</MenuItem>
              </Select> */}
            {/* </div> */}

            {/* Adults / Children capacity (replaces maximum guests) */}
            {textField(
              "Adults",
              "maxAdults",
              "Eg: 2"
            )}
            {textField(
              "Children",
              "maxChildren",
              "Eg: 1"
            )}
            {textField(
              "Rooms of this type",
              "totalRooms",
              "Eg: 5"
            )}

            {/* Discount */}
            {textField("Discount", "discount", "Eg: 20", roomDetails?.discount)}

            {/* Extra Bed Option */}
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', ml: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      {...register("hasExtraBed")}
                      checked={!!hasExtraBed}
                      onChange={(e) => {
                        setValue("hasExtraBed", e.target.checked);
                      }}
                    />
                  }
                  label="Extra Bed Available"
                />
              </Box>
            </Grid>

            {hasExtraBed && textField(
              "Extra Bed Price",
              "extraBedPrice",
              "Eg: 50",
              roomDetails?.extraBedPrice
            )}

            {/* Description */}
            {textField(
              "Description",
              "description",
              "Type Package Description...",
              roomDetails?.description
            )}

            {/* Period */}
            {/* {textField(
              "For Duration (in days)",
              "period",
              "Eg: 1",
              roomDetails?.period
            )} */}

            {/* Requirement Title */}
            {/* {textField("Address", "address", "Address", roomDetails?.address)} */}

            {/* Cover Photo */}
            <Grid item xs={12}>
              <div className="flex md:flex-row flex-col gap-2 ">
                <div className="flex-1">
                  <TextField
                    label={"Select cover photo"}
                    type="file"
                    defaultValue=""
                    onChange={handleUploadCoverPhoto}
                    placeholder=""
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </div>
                <div className="flex-1 flex gap-2 items-center">
                  <TextField
                    ref={amenitiesRef}
                    label="Add Amenities"
                    type="text"
                    placeholder="Add Amenities"
                    autoComplete="off"
                    autoCorrect="off"
                    fullWidth
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddAmenities();
                      }
                    }}
                  />
                  <div onClick={handleAddAmenities} className="input-add-btn">
                    Add
                  </div>
                </div>
                {/* <div className="flex-1">
                  {coverPhotoURL && (
                    <div className="w-fit relative">
                      <img
                        src={coverPhotoURL}
                        alt=""
                        className="h-16 w-16 rounded opacity-80"
                      />
                      <span
                        onClick={() => setCoverPhotoURL("")}
                        className="cross-btn"
                      >
                        x
                      </span>
                    </div>
                  )}
                </div> */}
              </div>
            </Grid>

            {/* Add Amenities */}
            <Grid item xs={12}>
              <div className="flex md:flex-row flex-col">
                {/* <div className="flex-1 flex gap-2 items-center">
                  <TextField
                    ref={amenitiesRef}
                    label="Add Amenities"
                    type="text"
                    placeholder="Add Amenities"
                    fullWidth
                  />
                  <div onClick={handleAddAmenities} className="input-add-btn">
                    Add
                  </div>
                </div> */}
                <div className="flex-1">
                  {coverPhotoURL && (
                    <div className="w-fit relative">
                      <img
                        src={coverPhotoURL}
                        alt=""
                        className="h-[100%] w-[100%] rounded-lg opacity-80"
                      />
                      <span
                        onClick={() => setCoverPhotoURL("")}
                        className="absolute top-0 right-0.5"
                      >
                        <CloseIcon
                          fontSize="small"
                          sx={{ stroke: "white", strokeWidth: 0.5 }}
                          className="bg-red-400 font-bold hover:bg-red-500 cursor-pointer text-white p-[0.1rem] rounded-full"
                        />
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 p-4 pt-0 ">
                  {arrayData?.amenities?.length > 0 ? (
                    <h3 className="font-bold text-center">Added Amenities</h3>
                  ) : (
                    <></>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {/* {arrayData.amenities &&
                      arrayData?.amenities?.map((amenity, i) => (
                        <div key={i} className="flex gap-1 text-sm">
                          <span>{amenity}</span>
                          <div
                            onClick={() => handleRemoveAmenity(i)}
                            className="bg-gray-200 hover:bg-gray-300 p-1 rounded-full h-5 w-5 flex items-center justify-center cursor-pointer"
                          >
                            x
                          </div>
                        </div>
                      ))} */}
                    {arrayData.amenities?.map((amenity, i) => (
                      <Chip
                        key={i}
                        label={amenity}
                        onDelete={() => handleRemoveAmenity(i)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Grid>

            <button
              // sx={{ ml: 2, mt: 2 }}
              // variant="contained"
              type="button"
              onClick={() => {
                setShowAddImageModal(true);
              }}
              className="add-new-btn m-6 ml-4"
            >
              Add Room Images
            </button>

            {/* Add images */}
            <Grid item xs={12}>
              <div className="flex flex-col gap-2">
                {/* <div className="flex gap-2">
                  <div className="flex-1">
                    <TextField
                      label="Picture Title"
                      type="text"
                      value={picture.label}
                      placeholder="Name the Picture"
                      onChange={(e) =>
                        setPicture((p) => ({ ...p, label: e.target.value }))
                      }
                      fullWidth
                    />
                  </div>
                  <div className="flex-1">
                    <TextField
                      label="Select Image"
                      id="single-picture"
                      type="file"
                      onChange={handleUploadPictures}
                      defaultValue=""
                      placeholder=""
                      InputLabelProps={{ shrink: true }}
                    />
                  </div>
                </div> */}
                {/* {picture.label && (
                  <div className="flex gap-2 items-end">
                    <div className="border p-2 rounded border-[blue] relative">
                      {picture.label && <h4>{picture?.label}</h4>}
                      {picture.url && (
                        <img
                          src={picture?.url}
                          alt=""
                          className="h-20 w-24 rounded"
                        />
                      )}
                      <span
                        onClick={() => setPicture({ label: "", url: "" })}
                        className="cross-btn"
                      >
                        x
                      </span>
                    </div>
                  </div>
                )} */}
                <div className="flex-1 px-3">
                  <h3 className="font-bold text-center">
                    {arrayData?.pictures?.length > 0 ? "Added Pictures" : ""}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {arrayData.pictures?.map((picture, i) => (
                      <div
                        key={i}
                        className="border rounded border-black/20 relative"
                      >
                        {picture.url && (
                          <img
                            src={picture?.url}
                            alt=""
                            className="h-20 w-24 rounded"
                          />
                        )}
                        {picture.label && (
                          <h4 className="px-1 text-center">{picture?.label}</h4>
                        )}
                        <span
                          onClick={() => handleRemovePicture(i, picture)}
                          className="absolute top-0 right-0.5"
                        >
                          <CloseIcon
                            fontSize="small"
                            sx={{ stroke: "white", strokeWidth: 0.5 }}
                            className="bg-red-400 font-bold hover:bg-red-500 cursor-pointer text-white p-[0.1rem] rounded-full"
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Grid>

            <Grid item xs={12} sm={6}></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <button
            // variant="contained"
            type="submit"
            autoFocus
            onClick={handleSubmit(handleAddRoom)}
            className="add-new-btn"
          // sx={{ bgcolor: "blue", color: "white", hover: "none" }}
          >
            {roomDetails?.packageName ? "Update" : "Add"}
          </button>
        </DialogActions>
      </Box>
    </div>
  );
};

export default CreateRoom;
