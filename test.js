import { useEffect, useState } from "react";
import PageHeading from "../../../../../components/PageHeading";
import { db, storage } from "../../../../../firebase/firebase.config";
import {
  deleteDoc,
  doc,
  getDocs,
  collection,
  updateDoc,
} from "firebase/firestore";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
} from "@mui/material";
import ViewDetailsIcon from "../../../../../components/ViewDetailsIcon";
import SubTitle from "../../../../../components/SubTitle";
import CloseIcon from "@mui/icons-material/Close";
import LoadingContent from "../../../../../components/LoadingContent";
import DeleteButton from "../../../../../components/DeleteButton";
import { successNotification } from "../../../../../components/Notifications";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

const Restaurants = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [viewDetailsModal, setViewDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [restaurantDetails, setRestaurantDetails] = useState({});
  const [matchedRestaurants, setMatchedRestaurants] = useState([]);
  const [originalRestaurants, setOriginalRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acceptedRes, setAcceptedRes] = useState([]);
  const [searchName, setSearchName] = useState("");
  const [searchAddress, setSearchAddress] = useState("");
  const [isEditing, setIsEditing] = useState(false); // New state for edit mode
  const [selectedImage, setSelectedImage] = useState(null); // New state for selected image
  const [imagePreview, setImagePreview] = useState(""); 

  useEffect(() => {
    const fetchAcceptedAndRequestedRes = async () => {
      try {
        setLoading(true);
        const acceptedSnapshot = await getDocs(
          collection(db, "acceptedRestaurants")
        );
        const requestedSnapshot = await getDocs(
          collection(db, "restroRequests")
        );

        const restaurantDataArray = [];

        const extractRestaurantData = (doc) => {
          const restaurantID = doc.id;
          const data = doc.data();

          return {
            uid: restaurantID,
            name: data.name || "Unnamed",
            email: data.emailId || "No email provided",
            address: data.location || data.address || "No address provided",
            isVerified: data.isVerified || false,
            phone: data.phoneNumber || "No phone number provided",
            description: data.description || "No description provided",
            status: data.status || "Unknown status",
            imageUrl: data.imageUrl || "No image",
            ownerId: data.ownerId || "No ownerId",
          };
        };

        acceptedSnapshot.docs.forEach((doc) => {
          const restaurantData = extractRestaurantData(doc);
          restaurantDataArray.push(restaurantData);
        });

        requestedSnapshot.docs.forEach((doc) => {
          const restaurantData = extractRestaurantData(doc);
          restaurantDataArray.push(restaurantData);
        });

        setMatchedRestaurants(restaurantDataArray);
        setOriginalRestaurants(restaurantDataArray);
        setAcceptedRes(acceptedSnapshot.docs.map((doc) => doc.id));
      } catch (error) {
        console.error("Error fetching restaurants:", error);
        setError("Failed to load restaurant data.");
      } finally {
        setLoading(false);
      }
    };

    fetchAcceptedAndRequestedRes();
  }, []);

  const columns = [
    { id: "name", label: "Name", width: 120 },
    { id: "phone", label: "Phone", width: 80 },
    { id: "email", label: "Email", width: 80 },
    { id: "address", label: "Address", width: 100 },
    { id: "status", label: "Status", width: 100 },
    { id: "action", label: "Action", width: 120 },
  ];

  const createData = (name, phone, email, address, isVerified, uid) => {
    return { name, phone, email, address, isVerified, uid };
  };

  const rows = matchedRestaurants.map((restaurant) => {
    return createData(
      restaurant?.name,
      restaurant?.phone,
      restaurant?.email,
      restaurant?.address,
      restaurant?.status,
      restaurant.uid
    );
  });

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleClose = () => {
    setRestaurantDetails({});
    setViewDetailsModal(false);
    setIsEditing(false); // Reset edit mode on close
  };

  const handleViewDetails = (id) => {
    const restaurant = matchedRestaurants.find((res) => res.uid === id);
    if (restaurant) {
      setRestaurantDetails(restaurant);
      setViewDetailsModal(true);
      setIsEditing(false); // Ensure edit mode is off when viewing details
    }
  };

  const handleShowDelete = (id) => {
    const restaurant = matchedRestaurants.find((res) => res.uid === id);
    if (restaurant) {
      setRestaurantDetails(restaurant);
      setShowDeleteModal(true);
    }
  };

  const handleDeleteRestaurant = async () => {
    try {
      if (restaurantDetails?.uid) {
        await deleteDoc(doc(db, "acceptedRestaurants", restaurantDetails?.uid));
        successNotification(`${restaurantDetails.name} Deleted Successfully`);

        const updatedRestaurants = matchedRestaurants.filter(
          (restaurant) => restaurant.uid !== restaurantDetails?.uid
        );
        setMatchedRestaurants(updatedRestaurants);
        setOriginalRestaurants(updatedRestaurants);
        setShowDeleteModal(false);
      } else {
        console.error("No restaurant ID to delete.");
      }
    } catch (error) {
      console.error("Error deleting restaurant:", error);
    }
  };

  const handleSearchByName = (value) => {
    setSearchName(value);
    filterRestaurants(value, searchAddress);
  };

  const handleSearchByLocation = (value) => {
    setSearchAddress(value);
    filterRestaurants(searchName, value);
  };

  const filterRestaurants = (name, address) => {
    const filteredRestaurants = originalRestaurants.filter((restaurant) => {
      const matchesName = restaurant.name
        .toLowerCase()
        .includes(name.toLowerCase());
      const matchesAddress = restaurant.address
        .toLowerCase()
        .includes(address.toLowerCase());
      return matchesName && matchesAddress;
    });

    setMatchedRestaurants(filteredRestaurants);
  };

  // const handleEditRestaurant = async () => {
  //   const { uid, name, email, phone, address, description, ownerId } =
  //     restaurantDetails;
  //   const updatedData = {
  //     name,
  //     emailId: email,
  //     phoneNumber: phone,
  //     ownerId,
  //     address,
  //     description,
  //     isVerified: restaurantDetails.status === "Verified",
  //   };

  //   // alert(isVerified)
  //   try {
  //     if (restaurantDetails.status === "Verified") {
  //       // Update in acceptedRestaurants
  //       await updateDoc(doc(db, "acceptedRestaurants", uid), updatedData);
  //     } else {
  //       // Update in restroRequests
  //       await updateDoc(doc(db, "restroRequests", uid), updatedData);
  //     }

  //     await updateDoc(
  //       doc(db, `restaurants/${ownerId}/restaurantDetails`, uid),
  //       updatedData
  //     );

  //     successNotification(`${restaurantDetails.name} Updated Successfully`);
  //     setIsEditing(false); // Exit edit mode
  //   } catch (error) {
  //     console.error("Error updating restaurant:", error);
  //   }
  // };



  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file)); // Preview the image
  };

  const handleEditRestaurant = async () => {
    const { uid, name, email, phone, address, description, ownerId } = restaurantDetails;
    const updatedData = {
      name,
      emailId: email,
      phoneNumber: phone,
      ownerId,
      address,
      description,
      isVerified: restaurantDetails.status === "Verified",
    };

    try {
      let imageUrl = restaurantDetails.imageUrl; // Keep the original image URL if no new image is uploaded

      // If a new image is selected, upload it to Firebase Storage
      if (selectedImage) {
        const imageRef = ref(storage, `restaurantImages/${uid}/${selectedImage.name}`);
        const snapshot = await uploadBytes(imageRef, selectedImage);
        imageUrl = await getDownloadURL(snapshot.ref); // Get the new image URL
        updatedData.imageUrl = imageUrl; // Update the image URL in Firestore
      }

      // Update the restaurant data in the appropriate collection
      if (restaurantDetails.status === "Verified") {
        await updateDoc(doc(db, "acceptedRestaurants", uid), updatedData);
      } else {
        await updateDoc(doc(db, "restroRequests", uid), updatedData);
      }

      // Update in the `/restaurants/{ownerId}/restaurantDetails/{uid}` path as well
      await updateDoc(doc(db, `restaurants/${ownerId}/restaurantDetails`, uid), updatedData);

      successNotification(`${restaurantDetails.name} Updated Successfully`);
      setIsEditing(false); // Exit edit mode
      setSelectedImage(null); // Reset the selected image state
    } catch (error) {
      console.error("Error updating restaurant:", error);
    }
  };




  if (loading) {
    return <LoadingContent />;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="overflow-x-hidden">
      <PageHeading text="Restaurants" />
      <Grid container spacing={0.5} sx={{ mb: 2, mt: 0.5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By Restaurant Name"
            type="search"
            placeholder="Restaurant Name"
            fullWidth
            value={searchName}
            onChange={(e) => handleSearchByName(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By Address"
            type="search"
            placeholder="Type Address"
            fullWidth
            value={searchAddress}
            onChange={(e) => handleSearchByLocation(e.target.value)}
          />
        </Grid>
      </Grid>

      <Paper sx={{ width: "100%", overflow: "hidden" }}>
        <TableContainer sx={{ maxHeight: 450 }}>
          <Table stickyHeader aria-label="sticky table">
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    style={{ width: column.width, fontWeight: "bold" }}
                  >
                    {column.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row) => {
                  return (
                    <TableRow hover role="checkbox" tabIndex={-1} key={row.uid}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.phone}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>{row.address}</TableCell>
                      <TableCell
                        className={`!font-bold ${
                          row.isVerified === "Verified"
                            ? "!text-green-600"
                            : "!text-red-600"
                        } `}
                      >
                        {row.isVerified === "Verified"
                          ? "Accepted"
                          : "Not Accepted"}
                      </TableCell>
                      <TableCell>
                      <div className="flex items-center gap-4">
                        <ViewDetailsIcon
                          onClick={() => handleViewDetails(row.uid)}
                        />
                        <DeleteButton
                          title="Delete this restaurant"
                          handleDelete={() => handleShowDelete(row.uid)}
                          id={row.uid}
                        />
                      </div>
                    </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 100]}
          component="div"
          count={rows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* View Details Modal */}
      <Dialog
        open={viewDetailsModal}
        onClose={handleClose}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Restaurant Details
          <IconButton
            onClick={handleClose}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <SubTitle text="Basic Info" />
          {isEditing ? (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Restaurant Name"
                  fullWidth
                  value={restaurantDetails.name}
                  onChange={(e) =>
                    setRestaurantDetails({
                      ...restaurantDetails,
                      name: e.target.value,
                    })
                  }
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Email"
                  fullWidth
                  value={restaurantDetails.email}
                  onChange={(e) =>
                    setRestaurantDetails({
                      ...restaurantDetails,
                      email: e.target.value,
                    })
                  }
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Phone Number"
                  fullWidth
                  value={restaurantDetails.phone}
                  onChange={(e) =>
                    setRestaurantDetails({
                      ...restaurantDetails,
                      phone: e.target.value,
                    })
                  }
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Address"
                  fullWidth
                  value={restaurantDetails.address}
                  onChange={(e) =>
                    setRestaurantDetails({
                      ...restaurantDetails,
                      address: e.target.value,
                    })
                  }
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={4}
                  value={restaurantDetails.description}
                  onChange={(e) =>
                    setRestaurantDetails({
                      ...restaurantDetails,
                      description: e.target.value,
                    })
                  }
                />
              </Grid>

              {/* Image Upload Field */}
              <Grid item xs={12}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                />
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Selected Preview"
                    style={{ width: "100%", marginTop: "10px" }}
                  />
                )}
              </Grid>
            </Grid>
          ) : (
            // Non-edit view, remains the same
            <div className="grid grid-cols-3 items-center ">
              <div className="col-span-1 flex justify-start mb-4">
                <img
                  src={restaurantDetails?.imageUrl || "/placeholder-image.png"}
                  alt={restaurantDetails?.name || "No Image"}
                  className="w-[87%] aspect-square object-cover rounded-lg"
                />
              </div>
              <div className="col-span-2 grid grid-cols-1 gap-2">
                {/* Name */}
                <div className="flex w-full">
                  <p className="font-bold text-gray-800 w-1/4">Name:</p>
                  <p className="text-gray-600 w-3/4">
                    {restaurantDetails?.name || "N/A"}
                  </p>
                </div>

                {/* Email */}
                <div className="flex w-full">
                  <p className="font-bold text-gray-800 w-1/4">Email:</p>
                  <p className="text-gray-600 w-3/4">
                    {restaurantDetails?.email || "N/A"}
                  </p>
                </div>

                {/* Phone */}
                <div className="flex w-full">
                  <p className="font-bold text-gray-800 w-1/4">Phone:</p>
                  <p className="text-gray-600 w-3/4">
                    {restaurantDetails?.phone || "N/A"}
                  </p>
                </div>

                {/* Address */}
                <div className="flex w-full">
                  <p className="font-bold text-gray-800 w-1/4">Address:</p>
                  <p className="text-gray-600 w-3/4">
                    {restaurantDetails?.address || "N/A"}
                  </p>
                </div>

                {/* Description */}
                <div className="flex w-full">
                  <p className="font-bold text-gray-800 w-1/4">Description:</p>
                  <p className="text-gray-600 w-3/4">
                    {restaurantDetails?.description || "N/A"}
                  </p>
                </div>

                {/* Verified Status */}
                <div className="flex w-full">
                  <p className="font-bold text-gray-800 w-1/4">Verified:</p>
                  <p
                    className={`w-3/4 font-bold ${
                      restaurantDetails?.status === "Verified"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {restaurantDetails?.status === "Verified" ? "Yes" : "No"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? "Cancel" : "Edit"}
          </Button>
          {isEditing && (
            <Button onClick={handleEditRestaurant} color="primary">
              Save Changes
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Restaurants;
