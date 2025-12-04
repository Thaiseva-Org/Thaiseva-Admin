import { useContext } from "react";
import { useState } from "react";
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
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import { useForm } from "react-hook-form";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { v4 as uuid } from "uuid";

import { foodMenuCollection } from "../../../../../firebase/firebase.config";
import PageHeading from "../../../../../components/PageHeading";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import {
  askingForDelete,
  calculateDiscountPrice,
  deleteNotification,
  getFileUrl,
  successNotification,
} from "../../../../../utils/utils";
import LoadingContent from "../../../../../components/LoadingContent";
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";

const AddedMenu = () => {
  const { myFoodMenu, partnerDetails } = useContext(PartnerContext);
  const [openModal, setOpenModal] = useState(false); //Add service modal
  const { user } = useContext(AuthContext);
  const [error, setError] = useState({ for: "", text: "" });
  const [menuDetails, setMenuDetails] = useState({
    id: "",
    restaurantUid: "",
    restaurantName: "",
    menuName: "",
    price: "",
    description: "",
    coupon: "",
    location: {},
    address: "",
    keywords: "",
    pictures: [],
    ratings: "",
    numberOfReviews: "",
  });
  const [pictures, setPictures] = useState([]);

  const {
    handleSubmit,
    reset,
    register,
    formState: { errors },
  } = useForm();

  // Partners table header
  let columns = [
    { property: "menuName", label: "Menu Name", width: 130 },
    { property: "price", label: "Price", width: 50 },
    { property: "coupon", label: "Coupon", width: 50 },
    { property: "ratings", label: "Rating", width: 50 },
    { property: "numberOfReviews", label: "Reviews", width: 50 },
    { property: "status", label: "Status", width: 50 },
    { property: "action", label: "Action", width: 120 },
  ];

  // creating single row
  function createData(
    menuName,
    price,
    coupon,
    ratings,
    numberOfReviews,
    status,
    id
  ) {
    return {
      menuName,
      price,
      coupon,
      ratings,
      numberOfReviews,
      status,
      id,
    };
  }

  // calling createData function with partner's data
  const rows = myFoodMenu?.map((menu) => {
    return createData(
      menu.menuName,
      menu.price,
      menu.coupon,
      menu.ratings,
      menu.numberOfReviews,
      menu.status,
      menu.id
    );
  });

  // deleting menu
  const handleDelete = async (id) => {
    askingForDelete().then(async (result) => {
      if (result.isConfirmed) {
        await deleteDoc(doc(foodMenuCollection, id)).then(() => {
          deleteNotification("The package is deleted successfully.");
        });
      }
    });
  };

  /* =============================================================
              Add Menu functionalities start
  =============================================================*/
  const handleOpenModal = () => {
    reset();
    setOpenModal(true);
  };

  // opening AddPackagesModal the modal while cliking on right sign icon
  const handleCloseModal = () => {
    reset();
    setMenuDetails({
      id: "",
      restaurantUid: "",
      restaurantName: "",
      menuName: "",
      price: "",
      description: "",
      coupon: "",
      location: {},
      address: "",
      keywords: "",
      pictures: [],
      ratings: 0,
      numberOfReviews: 0,
    });
    setPictures([]);
    setOpenModal(false);
  };

  // storing the requrement in the database
  const handleAddMenu = async (data) => {
    const { menuName, price, description, keywords } = data;
    const { location, address, coupon, restaurantName } = partnerDetails;
    let id;

    if (menuDetails.id) {
      id = menuDetails.id;
    } else {
      id = uuid();
    }

    const menuInfo = {
      id,
      menuName,
      price: parseFloat(price),
      address,
      pictures,
      keywords,
      description,
      status: "Pending",
      restaurantUid: user?.uid,
      restaurantName,
      coupon,
      location,
      ratings: 0,
      numberOfReviews: 0,
    };

    await setDoc(doc(foodMenuCollection, id), menuInfo).then(() => {
      successNotification(
        `The Menu is ${
          menuDetails?.menuName ? "updated" : "added"
        } successfully`
      );
      setPictures([]);
    });

    setMenuDetails({
      id: "",
      restaurantUid: "",
      restaurantName: "",
      menuName: "",
      price: "",
      description: "",
      coupon: "",
      location: {},
      address: "",
      keywords: "",
      pictures: [],
      ratings: 0,
      numberOfReviews: 0,
    });
    setOpenModal(false);
  };

  /* =============================================================
              Add Menu functionalities end
  =============================================================*/

  // upadate package
  const handleViewmenuDetails = async (id) => {
    reset();
    const snapshot = await getDoc(doc(foodMenuCollection, id));
    if (snapshot.exists()) {
      const existingData = snapshot.data();
      if (existingData) {
        setMenuDetails(existingData);
        setPictures(existingData?.pictures);
      }
    }
    setOpenModal(true);
  };

  // upload pictures
  const handleUploadPictures = async (e) => {
    const { files } = e.target;
    const { error, message, url } = await getFileUrl(files);
    if (error) {
      setError({ for: "pictures", text: message });
    } else {
      setPictures((p) => [...p, (p[-1] = url)]);
      const picEle = document.getElementById("single-picture");
      picEle.value = "";
    }
  };

  // Remove picture
  const handleRemovePicture = (i) => {
    const newPictures = pictures.slice(0, i).concat(pictures.slice(i + 1));
    setPictures(newPictures);
  };

  // custom text field for common data
  const textField = (label, name, placeholder, defaultValue) => {
    return (
      <Grid item xs={12} sm={name === "description" ? 12 : 6}>
        <TextField
          label={label}
          type={name === "price" ? "number" : "text"}
          defaultValue={defaultValue && defaultValue}
          placeholder={placeholder}
          multiline={name === "description"}
          InputProps={{
            readOnly: name === "coupon",
          }}
          fullWidth
          {...register(name, { required: true })}
          rows={name === "description" ? 3 : ""}
        />
        {name === "coupon" && (
          <span className="text-orange-500 text-xs">
            You can change the coupon in your profile.
          </span>
        )}
        {errors?.name && (
          <span className="text-red-500">{label} is required</span>
        )}
      </Grid>
    );
  };

  return (
    <div>
      <PageHeading text="Added Menus" />

      <div className="flex items-center justify-between  md:pr-3 mb-2">
        <p className="my-2 font-bold">{myFoodMenu.length} menu added</p>
        <button
          onClick={handleOpenModal}
          className="py-1 px-2 rounded bg-[blue] text-white"
        >
          Add Menu
        </button>
      </div>
      <Paper sx={{ width: "100%", overflowX: "hidden" }}>
        <TableContainer sx={{ maxHeight: 440, maxWidth: "87vw" }}>
          {!myFoodMenu ? (
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
                        color: "blue",
                        fontWeight: "bold",
                      }}
                    >
                      {column.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, i) => {
                  return (
                    <TableRow hover role="checkbox" tabIndex={-1} key={i}>
                      {columns.map((column) => {
                        const value = row[column.property];

                        return (
                          <TableCell key={column.property} align="center">
                            {((value === "Pending" ||
                              value === "Approved" ||
                              value === "Denied") && (
                              <span
                                className={`${
                                  (value === "Pending" &&
                                    "bg-orange-300 text-black") ||
                                  (value === "Approved" && "bg-green-500") ||
                                  (value === "Denied" && "bg-red-600")
                                } text-white  py-1 px-2 rounded`}
                              >
                                {value}
                              </span>
                            )) ||
                              (column.property === "action" && (
                                <div className="flex gap-1 items-center justify-center">
                                  <button
                                    onClick={() => handleDelete(row.id)}
                                    className="bg-red-500 text-white p-1 rounded"
                                  >
                                    <DeleteForeverIcon />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleViewmenuDetails(row.id)
                                    }
                                    className="bg-orange-500 text-white p-1 rounded ml-1"
                                  >
                                    <EditIcon />
                                  </button>
                                </div>
                              )) ||
                              (column.property === "price" && `฿${value}`) ||
                              value}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Paper>

      {/* Add and Update Package modal */}
      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        aria-labelledby="responsive-dialog-title"
      >
        <Box component="form" onSubmit={handleSubmit(handleAddMenu)}>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            {menuDetails?.menuName ? "Update The Menu" : "Add New Menu"}
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

          {/* modal body */}
          <DialogContent dividers sx={{ p: { xs: 2, md: 2 } }}>
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              {/* Menu Name */}
              {textField(
                "Menu Name",
                "menuName",
                "Menu Name",
                menuDetails?.menuName
              )}
              {/* Price */}
              {textField("Price", "price", "Price", menuDetails?.price)}
              {/* Keywords */}
              {textField(
                "Keywords",
                "keywords",
                "Keywords",
                menuDetails?.keywords
              )}
              {/* coupon */}
              {textField(
                "Coupon Code",
                "coupon",
                "Coupon Code",
                partnerDetails?.coupon
              )}
              {/* Description */}
              {textField(
                "Description",
                "description",
                "Type Menu Description...",
                menuDetails?.description
              )}

              {/* Add images */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Select Image"
                  id="single-picture"
                  type="file"
                  onChange={handleUploadPictures}
                  InputLabelProps={{ shrink: true }}
                />
                {error.for === "pictures" && (
                  <span className="text-red-500 text-sm">{error?.text}</span>
                )}
              </Grid>

              <Grid item xs={12}>
                <h3 className="font-bold text-center">Added Pictures</h3>
                {pictures.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-end">
                    {pictures?.map((picture, i) => (
                      <div
                        key={i}
                        className="border p-2 rounded border-[blue] relative"
                      >
                        <img
                          src={picture}
                          alt=""
                          className="h-32 w-36 rounded object-cover"
                        />
                        <span
                          onClick={() => handleRemovePicture(i)}
                          className="cross-btn"
                        >
                          x
                        </span>
                      </div>
                    ))}
                  </div>
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
              {menuDetails?.menuName ? "Update" : "Add"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </div>
  );
};

export default AddedMenu;
