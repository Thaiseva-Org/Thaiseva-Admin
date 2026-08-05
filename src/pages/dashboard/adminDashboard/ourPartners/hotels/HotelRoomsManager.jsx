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
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
} from "@mui/material";
import { deleteDoc, doc, setDoc, onSnapshot, query, where, serverTimestamp } from "firebase/firestore";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { v4 as uuid } from "uuid";

import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import DeleteButton from "../../../../../components/DeleteButton";
import LoadingContent from "../../../../../components/LoadingContent";
import UpdateButton from "../../../../../components/UpdateButton";
import {
    db,
    hotelPackageDetails,
    hotelPackages,
    storage,
} from "../../../../../firebase/firebase.config";
import { Checkbox, FormControlLabel } from "@mui/material";
import {
    calculateDiscountPrice,
    successNotification,
} from "../../../../../utils/utils";

const HotelRoomsManager = ({ hotelUid, hotelName, hotelPhone, hotelLocation }) => {
    const [myRooms, setMyRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addServiceModal, setOpenModal] = useState(false);
    const [coverPhotoURL, setCoverPhotoURL] = useState("");
    const amenitiesRef = useRef();
    const [roomDetails, setRoomDetails] = useState({
        id: "",
        packageName: "",
        price: "",
        description: "",
        discount: 0,
        location: {},
        period: "",
        bookingInfo: {},
        maxAdults: "",
        maxChildren: "",
        address: "",
        ratings: "",
        numberOfReviews: "",
        totalRooms: "",
        extraBedPrice: 0,
        hasExtraBed: false,
    });
    const [arrayData, setArrayData] = useState({
        amenities: [],
        included: [],
        pictures: [],
        places: [],
    });
    const [pricingOverrides, setPricingOverrides] = useState([]);
    const [newOverride, setNewOverride] = useState({
        startDate: "",
        endDate: "",
        price: "",
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

    useEffect(() => {
        if (!hotelUid) return;
        setLoading(true);
        const unSub = onSnapshot(
            query(hotelPackageDetails, where("hotelUid", "==", hotelUid)),
            (result) => {
                if (result.docs.length > 0) {
                    const list = result.docs.map((doc) => doc.data());
                    setMyRooms(list);
                } else {
                    setMyRooms([]);
                }
                setLoading(false);
            }
        );
        return () => unSub();
    }, [hotelUid]);

    let columns = [
        { property: "packageName", label: "Package Name", width: "18%" },
        { property: "price", label: "Price", width: "12%" },
        { property: "discount", label: "Discount", width: "10%" },
        { property: "discountPrice", label: "Discount Price", width: "12%" },
        { property: "maxAdults", label: "Adults", width: "10%" },
        { property: "maxChildren", label: "Children", width: "10%" },
        { property: "extraBedPrice", label: "Extra Bed", width: "10%" },
        { property: "action", label: "Action", width: "15%" },
    ];

    const handleDelete = async (id) => {
        if (confirm("Are you sure to delete this package?")) {
            try {
                await deleteDoc(doc(hotelPackages, id)).catch(() => { });
                await deleteDoc(doc(hotelPackageDetails, id));
                if (hotelUid) {
                    await deleteDoc(doc(db, "HotelDB", hotelUid, "rooms", id)).catch(() => { });
                }
                alert("The package is deleted successfully.");
            } catch (e) {
                console.error(e);
                alert("Failed to delete package.");
            }
        }
    };

    const handleCloseModal = () => {
        reset({
            packageName: "",
            price: "",
            address: "",
            description: "",
            discount: "",
            period: "",
            maxAdults: "",
            maxChildren: "",
            totalRooms: "",
            extraBedPrice: 0,
            hasExtraBed: false,
        });
        setRoomDetails({
            id: "",
            packageName: "",
            price: "",
            description: "",
            discount: "",
            location: {},
            period: "",
            bookingInfo: {},
            maxAdults: "",
            maxChildren: "",
            address: "",
            ratings: "",
            numberOfReviews: "",
            totalRooms: "",
            extraBedPrice: 0,
            hasExtraBed: false,
        });
        setCoverPhotoURL("");
        setArrayData({
            amenities: [],
            pictures: [],
        });
        setPricingOverrides([]);
        setNewOverride({ startDate: "", endDate: "", price: "" });
        setOpenModal(false);
    };

    const handleAddRoom = async (data) => {
        const {
            packageName,
            price,
            description,
            discount,
            period,
            maxAdults,
            maxChildren,
            totalRooms,
            extraBedPrice,
            hasExtraBed,
            address,
        } = data;

        let id;

        if (roomDetails.id) {
            id = roomDetails.id;
        } else {
            id = uuid();
        }

        const adults = Math.max(0, parseInt(maxAdults, 10) || 0);
        const children = Math.max(0, parseInt(maxChildren, 10) || 0);

        const packageInfo = {
            id,
            packageName,
            price: parseFloat(price),
            discount: parseFloat(discount),
            period,
            address,
            name: hotelName,
            coverPhoto: coverPhotoURL,
            rating: "0",

            hotelUid: hotelUid,
            numberOfReviews: 0,
        };

        const inventoryQty = Math.max(1, parseInt(totalRooms, 10) || 5);
        const packageDetails = {
            ...packageInfo,
            description,
            maxAdults: adults,
            maxChildren: children,
            // Keep legacy total for older booking/package readers
            numberOfGuests: adults + children,
            totalRooms: inventoryQty,
            quantity: inventoryQty,
            roomName: packageName,
            amenities: arrayData?.amenities,
            pictures: arrayData?.pictures,
            location: hotelLocation,
            phoneNumber: hotelPhone,
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
                pricePerNightAfterDiscount: calculateDiscountPrice(
                    parseFloat(price) || 0,
                    parseFloat(discount) || 0
                ),
            },
            pricingOverrides: pricingOverrides,
            status: "Approved", // Default status as per requirement
            updatedAt: serverTimestamp(),
        };

        if (!roomDetails.id) {
            packageDetails.createdAt = serverTimestamp();
        }

        // Dual-write: HotelDB rooms (availability/booking) + legacy package details
        await setDoc(doc(hotelPackageDetails, id), packageDetails, { merge: true });
        if (hotelUid) {
            await setDoc(
                doc(db, "HotelDB", hotelUid, "rooms", id),
                {
                    ...packageDetails,
                    id,
                    hotelUid,
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

        handleCloseModal();
    };

    const handleEditRoom = (room) => {
        const adults =
            room.maxAdults !== undefined && room.maxAdults !== null && room.maxAdults !== ""
                ? room.maxAdults
                : (room.numberOfGuests ?? "");
        const children =
            room.maxChildren !== undefined && room.maxChildren !== null && room.maxChildren !== ""
                ? room.maxChildren
                : 0;

        setRoomDetails({
            id: room.id,
            packageName: room.packageName,
            price: room.price,
            address: room.address,
            description: room.description,
            discount: room.discount,
            location: room.location,
            period: room.period,
            maxAdults: adults,
            maxChildren: children,
            ratings: room.ratings,
            numberOfReviews: room.numberOfReviews,
            totalRooms: room.totalRooms,
            extraBedPrice: room.extraBedPrice || 0,
            hasExtraBed: room.hasExtraBed || false,
        });
        setCoverPhotoURL(room.coverPhoto);
        setArrayData({
            amenities: room.amenities || [],
            pictures: room.pictures || [],
        });

        reset({
            packageName: room.packageName,
            price: room.price,
            address: room.address,
            description: room.description,
            discount: room.discount,
            period: room.period,
            maxAdults: adults,
            maxChildren: children,
            totalRooms: room.totalRooms,
            extraBedPrice: room.extraBedPrice || 0,
            hasExtraBed: room.hasExtraBed || false,
        });

        setPricingOverrides(room.pricingOverrides || []);
        setOpenModal(true);
    };

    const handleAddOverride = () => {
        if (!newOverride.startDate || !newOverride.endDate || !newOverride.price) {
            alert("Please fill all fields for dynamic pricing");
            return;
        }
        if (new Date(newOverride.startDate) >= new Date(newOverride.endDate)) {
            alert("Start date must be before end date");
            return;
        }

        // Check for overlaps
        const hasOverlap = pricingOverrides.some(override => {
            const start1 = new Date(override.startDate);
            const end1 = new Date(override.endDate);
            const start2 = new Date(newOverride.startDate);
            const end2 = new Date(newOverride.endDate);
            return start1 < end2 && start2 < end1;
        });

        if (hasOverlap) {
            alert("This date range overlaps with an existing override");
            return;
        }

        setPricingOverrides([...pricingOverrides, newOverride]);
        setNewOverride({ startDate: "", endDate: "", price: "" });
    };

    const handleRemoveOverride = (index) => {
        const newOverrides = [...pricingOverrides];
        newOverrides.splice(index, 1);
        setPricingOverrides(newOverrides);
    };

    const handleAddAmenities = () => {
        const element = amenitiesRef.current.querySelector("input");
        if (!element.value) {
            return;
        }
        const newAmenities = [...arrayData.amenities, element.value];
        setArrayData((p) => ({ ...p, amenities: newAmenities }));
        element.value = "";
    };

    const handleRemoveAmenity = (i) => {
        const { amenities } = arrayData;
        const newAmenities = arrayData.amenities
            .slice(0, i)
            .concat(amenities.slice(i + 1));
        setArrayData((p) => ({ ...p, amenities: newAmenities }));
    };

    const handleUploadCoverPhoto = async (e) => {
        const file = e.target.files[0];
        const fileRef = ref(storage, `${file.lastModified}-coverPhoto`);
        const coverPhotoTask = await uploadBytesResumable(fileRef, file);
        const photoURL = await getDownloadURL(coverPhotoTask.ref);
        if (photoURL) {
            setCoverPhotoURL(photoURL);
        }
    };

    const handleUploadPictures = async (e) => {
        let file = e.target.files[0];
        const imageRef = ref(storage, `${file.lastModified}-roomPhoto`);
        const imageTask = await uploadBytesResumable(imageRef, file);
        const imageURL = await getDownloadURL(imageTask.ref);
        if (imageURL) {
            setPicture((p) => ({ ...p, url: imageURL }));
        }
    };

    const handleAddPicture = () => {
        setArrayData((p) => ({ ...p, pictures: [...p.pictures, picture] }));
        setPicture({ label: "", url: "" });
    };

    const handleRemovePicture = (i) => {
        const { pictures } = arrayData;
        const newPictures = arrayData.pictures
            .slice(0, i)
            .concat(pictures.slice(i + 1));
        setArrayData((p) => ({ ...p, pictures: newPictures }));
    };

    const textField = (label, name, placeholder) => {
        const isNumber = ["price", "discount", "maxAdults", "maxChildren", "period", "extraBedPrice", "totalRooms"].includes(name);
        const registration = register(name, { required: true });
        const value = watch(name);
        return (
            <Grid item xs={12} sm={name === "description" ? 12 : 6}>
                <TextField
                    label={label}
                    type={isNumber ? "number" : "text"}
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

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Room Types</h3>
                <button
                    onClick={() => setOpenModal(true)}
                    className="add-new-btn"
                >
                    Add Room
                </button>
            </div>
            <Paper sx={{ width: "100%", overflowX: "hidden" }}>
                <TableContainer>
                    {loading ? (
                        <LoadingContent />
                    ) : (
                        <Table stickyHeader aria-label="sticky table">
                            <TableHead>
                                <TableRow>
                                    {columns.map((column) => (
                                        <TableCell
                                            key={column.property}
                                            align="center"
                                            style={{
                                                width: column.width,
                                                color: "var(--primary-bg)",
                                                fontWeight: "bold",
                                            }}
                                        >
                                            {column.label}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {myRooms.map((row, i) => {
                                    return (
                                        <TableRow hover role="checkbox" tabIndex={-1} key={i}>
                                            {columns.map((column) => {
                                                const value = row[column.property];

                                                return (
                                                    <TableCell key={column.property} align="center">

                                                        {(column.property === "discountPrice" &&
                                                            `฿ ${calculateDiscountPrice(
                                                                row["price"],
                                                                row["discount"]
                                                            )}`) ||
                                                            (column.property === "action" && (
                                                                <div className="flex gap-1 justify-center">
                                                                    <DeleteButton
                                                                        title={"delete room"}
                                                                        handleDelete={handleDelete}
                                                                        id={row.id}
                                                                    />
                                                                    <UpdateButton
                                                                        title={"edit room"}
                                                                        handleEdit={() => handleEditRoom(row)}
                                                                    />
                                                                </div>
                                                            )) ||
                                                            (column.property === "price" && `฿ ${value}`) ||
                                                            (column.property === "discount" &&
                                                                `${value} %`) ||
                                                            (column.property === "maxAdults" &&
                                                                (row.maxAdults ?? row.numberOfGuests ?? "-")) ||
                                                            (column.property === "maxChildren" &&
                                                                (row.maxChildren ?? 0)) ||
                                                            (column.property === "ratings" &&
                                                                (value != 0 ? `${value}` : "-")) ||
                                                            (column.property === "numberOfReviews" &&
                                                                (value !== 0 ? `${value}` : "-")) ||
                                                            (column.property === "extraBedPrice" &&
                                                                (row.hasExtraBed ? `฿ ${value}` : "-")) ||
                                                            value}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    );
                                })}
                                {myRooms.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} align="center">
                                            No rooms found. Add a room to get started.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </TableContainer>
            </Paper>

            <Dialog
                open={addServiceModal}
                onClose={handleCloseModal}
                aria-labelledby="responsive-dialog-title"
                maxWidth="md"
                fullWidth
            >
                <Box component="form" onSubmit={handleSubmit(handleAddRoom)}>
                    <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', gap: 2 }} id="customized-dialog-title">
                        {roomDetails?.packageName ? "Update" : "Add New"} Package
                    </DialogTitle>
                    <IconButton
                        aria-label="close"
                        onClick={handleCloseModal}
                        sx={{
                            position: "absolute",
                            right: 0,
                            top: 0,
                            color: "gray",
                        }}
                    >
                        <CloseIcon />
                    </IconButton>

                    <DialogContent dividers sx={{ p: { xs: 2, md: 2 } }}>
                        <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
                            {textField(
                                "Package Name",
                                "packageName",
                                "Package Name"
                            )}

                            {textField("Price", "price", "Price")}

                            {textField("Address", "address", "Address")}

                            {textField(
                                "Discount",
                                "discount",
                                "Discount in %"
                            )}

                            {textField(
                                "Description",
                                "description",
                                "Type Package Description..."
                            )}

                            {textField("Period", "period", "Period")}

                            {textField(
                                "Adults",
                                "maxAdults",
                                "e.g. 2"
                            )}

                            {textField(
                                "Children",
                                "maxChildren",
                                "e.g. 1"
                            )}

                            {textField(
                                "Total Rooms Available",
                                "totalRooms",
                                "Total inventory count"
                            )}

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
                                "Eg: 50"
                            )}

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
                                    <div className="flex-1">
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
                                    </div>
                                </div>
                            </Grid>

                            <Grid item xs={12}>
                                <div className="flex md:flex-row flex-col">
                                    <div className="flex-1 flex gap-2 items-center">
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
                                    </div>
                                    <div className="flex-1 p-4 ">
                                        <h3 className="font-bold text-center">Added Amenities</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {arrayData.amenities &&
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
                                                ))}
                                        </div>
                                    </div>
                                </div>
                            </Grid>

                            <Grid item xs={12}>
                                <div className="flex flex-col gap-2">
                                    <div className="flex gap-2">
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
                                    </div>
                                    {picture.label && (
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
                                            <div
                                                onClick={handleAddPicture}
                                                className="bg-[blue] text-white h-fit w-fit cursor-pointer px-2 py-2 rounded-md flex items-center justify-center"
                                            >
                                                Add
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex-1 px-3">
                                        <h3 className="font-bold text-center">Added Pictures</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {arrayData.pictures?.map((picture, i) => (
                                                <div
                                                    key={i}
                                                    className="border p-2 rounded border-[blue] relative"
                                                >
                                                    {picture.label && <h4>{picture?.label}</h4>}
                                                    {picture.url && (
                                                        <img
                                                            src={picture?.url}
                                                            alt=""
                                                            className="h-20 w-24 rounded"
                                                        />
                                                    )}
                                                    <span
                                                        onClick={() => handleRemovePicture(i)}
                                                        className="cross-btn"
                                                    >
                                                        x
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </Grid>

                            <Grid item xs={12}>
                                <div className="border rounded-lg p-4 mt-4 bg-gray-50">
                                    <h3 className="font-bold mb-3">Dynamic Date-Range Pricing</h3>
                                    <div className="flex flex-wrap gap-3 items-end mb-4">
                                        <TextField
                                            label="Start Date"
                                            type="date"
                                            value={newOverride.startDate}
                                            onChange={(e) => setNewOverride({ ...newOverride, startDate: e.target.value })}
                                            InputLabelProps={{ shrink: true }}
                                            size="small"
                                        />
                                        <TextField
                                            label="End Date"
                                            type="date"
                                            value={newOverride.endDate}
                                            onChange={(e) => setNewOverride({ ...newOverride, endDate: e.target.value })}
                                            InputLabelProps={{ shrink: true }}
                                            size="small"
                                        />
                                        <TextField
                                            label="Price"
                                            type="number"
                                            value={newOverride.price}
                                            onChange={(e) => setNewOverride({ ...newOverride, price: e.target.value })}
                                            size="small"
                                            placeholder="Override Price"
                                        />
                                        <Button
                                            variant="contained"
                                            onClick={handleAddOverride}
                                            size="medium"
                                            sx={{ bgcolor: "blue", color: "white" }}
                                        >
                                            Add Range
                                        </Button>
                                    </div>

                                    {pricingOverrides.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-semibold text-gray-600">Active Overrides:</h4>
                                            {pricingOverrides.map((override, index) => (
                                                <div key={index} className="flex items-center justify-between bg-white p-2 rounded border shadow-sm">
                                                    <div className="text-sm">
                                                        <span className="font-medium">{override.startDate}</span> to <span className="font-medium">{override.endDate}</span>
                                                        <span className="mx-2 text-gray-400">|</span>
                                                        <span className="text-green-600 font-bold">฿{override.price}</span>
                                                    </div>
                                                    <IconButton size="small" onClick={() => handleRemoveOverride(index)} color="error">
                                                        <CloseIcon fontSize="small" />
                                                    </IconButton>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Grid>

                            <Grid item xs={12} sm={6}></Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            variant="contained"
                            type="submit"
                            autoFocus
                            sx={{ bgcolor: "blue", color: "white", hover: "none" }}
                        >
                            {roomDetails?.packageName ? "Update" : "Add"}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </div>
    );
};

export default HotelRoomsManager;
