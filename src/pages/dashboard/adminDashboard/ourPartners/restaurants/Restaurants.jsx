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
  Typography,
} from "@mui/material";
import ViewDetailsIcon from "../../../../../components/ViewDetailsIcon";
import SubTitle from "../../../../../components/SubTitle";
import StaticMap from "../../../../../components/StaticMap";
import CloseIcon from "@mui/icons-material/Close";
import LoadingContent from "../../../../../components/LoadingContent";
import DeleteButton from "../../../../../components/DeleteButton";
import { successNotification } from "../../../../../components/Notifications";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import SearchBar from "../../../../../components/SearchBar";

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
  // const [searchName, setSearchName] = useState("");
  // const [searchAddress, setSearchAddress] = useState("");
  const [isEditing, setIsEditing] = useState(false); // New state for edit mode
  const [selectedImage, setSelectedImage] = useState(null); // New state for selected image
  const [imagePreview, setImagePreview] = useState("");

  useEffect(() => {
    const fetchAcceptedAndRequestedRes = async () => {
      try {
        setLoading(true);
        const restaurantsSnapshot = await getDocs(
          collection(db, "restaurants")
        );

        const restaurantDataArray = [];

        const extractRestaurantData = (doc) => {
          const data = doc.data();

          return {
            uid: doc.id, // Use Firestore document ID
            name: data.name || "-",
            email: data.emailId || "-",
            address: data.location || data.address || "-",
            isVerified: data.isVerified || false,
            phone: data.phoneNumber || "-",
            description: data.description || "-",
            ordersCount: data.orders?.length || "-",
            status: data.status || "-",
            imageUrl: data.imageUrl || "-",
            ownerId: data.ownerId || "-",
            bankName: data.paymentInformation?.bankName || data.bankName || "-",
            accountNumber:
              data.paymentInformation?.accountNumber ||
              data.accountNumber ||
              "-",
            bankAddress:
              data.paymentInformation?.bankAddress || data.bankAddress || "-",
            location: data.location || data.restaurantLocation || null,
          };
        };

        restaurantsSnapshot.docs.forEach((doc) => {
          const restaurantData = extractRestaurantData(doc);
          restaurantDataArray.push(restaurantData);
        });

        setMatchedRestaurants(restaurantDataArray);
        setOriginalRestaurants(restaurantDataArray);
      } catch (error) {
        console.error("Error fetching restaurants:", error);
        setError("Failed to load restaurant data.");
      } finally {
        setLoading(false);
      }
    };

    fetchAcceptedAndRequestedRes();
  }, []);

  // const columns = [
  //   { id: "name", label: "Name", width: 120 },
  //   { id: "phone", label: "Phone", width: 80 },
  //   { id: "email", label: "Email", width: 80 },
  //   { id: "address", label: "Address", width: 100 },
  //   { id: "status", label: "Status", width: 100 },
  //   { id: "action", label: "Action", width: 120 },
  // ];
  const columns = [
    { id: "name", label: "Name", width: "15%" },
    { id: "phone", label: "Phone", width: "15%" },
    { id: "email", label: "Email", width: "15%" },
    { id: "address", label: "Address", width: "20%" },
    { id: "ordersCount", label: "Orders", width: "10%" },
    { id: "status", label: "Status", width: "15%" },
    { id: "action", label: "Action", width: "10%" },
  ];

  const createData = (
    name,
    phone,
    email,
    address,
    ordersCount,
    isVerified,
    uid
  ) => {
    return { name, phone, email, address, ordersCount, isVerified, uid };
  };

  const rows = matchedRestaurants.map((restaurant) => {
    return createData(
      restaurant?.name,
      restaurant?.phone,
      restaurant?.email,
      restaurant?.address,
      restaurant?.ordersCount,
      restaurant?.status,
      restaurant.uid
    );
  });

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleClose = () => {
    setRestaurantDetails({});
    setViewDetailsModal(false);
    setImagePreview(null);
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
    console.log("handleShowDelete called with id:", id);
    const restaurant = matchedRestaurants.find((res) => res.uid === id);
    console.log("Found restaurant:", restaurant);
    if (restaurant) {
      setRestaurantDetails(restaurant);
      setShowDeleteModal(true);
      console.log("ShowDeleteModal set to true");
    }
  };

  const handleDeleteRestaurant = async () => {
    try {
      const { uid, name, ownerId, status } = restaurantDetails;

      if (!uid) {
        console.error("No restaurant ID to delete.");
        return;
      }

      // Delete from the main restaurants collection
      await deleteDoc(doc(db, "restaurants", uid));

      // Delete from the appropriate collection based on verification status
      try {
        if (status === "Verified") {
          // Try to delete from `acceptedRestaurants` for verified restaurants
          await deleteDoc(doc(db, "acceptedRestaurants", uid));
        } else {
          // Try to delete from `restroRequests` for unverified restaurants
          await deleteDoc(doc(db, "restroRequests", uid));
        }
      } catch (err) {
        console.log(
          "Document might not exist in acceptedRestaurants/restroRequests:",
          err
        );
      }

      // Try to delete from the nested path if ownerId exists
      if (ownerId) {
        try {
          await deleteDoc(
            doc(db, `restaurants/${ownerId}/restaurantDetails`, uid)
          );
        } catch (err) {
          console.log("Document might not exist in nested path:", err);
        }
      }

      // Success notification
      successNotification(`${name} Deleted Successfully`);

      // Update local restaurant lists
      const updatedRestaurants = matchedRestaurants.filter(
        (restaurant) => restaurant.uid !== uid
      );
      setMatchedRestaurants(updatedRestaurants);
      setOriginalRestaurants(updatedRestaurants);

      // Close the delete confirmation modal
      setShowDeleteModal(false);
    } catch (error) {
      console.error("Error deleting restaurant:", error);
      successNotification(`Failed to delete ${restaurantDetails.name}`);
    }
  };

  // const handleSearchByName = (value) => {
  //   setSearchName(value);
  //   filterRestaurants(value, searchAddress);
  // };

  // const handleSearchByLocation = (value) => {
  //   setSearchAddress(value);
  //   filterRestaurants(searchName, value);
  // };

  // const filterRestaurants = (name, address) => {
  //   const filteredRestaurants = originalRestaurants.filter((restaurant) => {
  //     const matchesName = restaurant.name
  //       .toLowerCase()
  //       .includes(name.toLowerCase());
  //     const matchesAddress = restaurant.address
  //       .toLowerCase()
  //       .includes(address.toLowerCase());
  //     return matchesName && matchesAddress;
  //   });

  //   setMatchedRestaurants(filteredRestaurants);
  // };

  const handleSearch = (text) => {
    const matchingObjects = originalRestaurants.filter(
      (restaurant) =>
        restaurant.name.toLowerCase().includes(text.toLowerCase()) ||
        restaurant.address.toLowerCase().includes(text.toLowerCase())
    );

    setMatchedRestaurants(matchingObjects);
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
    const { uid, name, email, phone, address, description, ownerId } =
      restaurantDetails;
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
        const imageRef = ref(
          storage,
          `restaurantImages/${uid}/${selectedImage.name}`
        );
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
      await updateDoc(
        doc(db, `restaurants/${ownerId}/restaurantDetails`, uid),
        updatedData
      );

      successNotification(`${restaurantDetails.name} Updated Successfully`);
      setIsEditing(false); // Exit edit mode
      setSelectedImage(null); // Reset the selected image state
    } catch (error) {
      console.error("Error updating restaurant:", error);
    }
  };

  if (loading) {
    return <LoadingContent variant="skeleton" />;
  }

  if (error) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center space-y-4 p-8 bg-white rounded-2xl shadow-lg">
          <div className="w-16 h-16 mx-auto bg-danger-100 rounded-full flex items-center justify-center">
            <span className="text-3xl text-danger-600">⚠️</span>
          </div>
          <h3 className="text-xl font-bold text-neutral-800">Error Loading Data</h3>
          <p className="text-neutral-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeading
        text="Restaurants Management"
        subtitle="View and manage all restaurant partners"
      />

      <SearchBar handleSearch={handleSearch} btn={false} />

      <div className="bg-white rounded-2xl shadow-lg border border-neutral-100 overflow-hidden">
        <TableContainer sx={{ maxHeight: "auto" }}>
          <Table stickyHeader aria-label="restaurants table">
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    style={{
                      width: column.width,
                      fontWeight: "700",
                      backgroundColor: "#f8fafc",
                      color: "#1e293b",
                      fontSize: "0.875rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "2px solid #e2e8f0"
                    }}
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
                    <TableRow
                      hover
                      role="checkbox"
                      tabIndex={-1}
                      key={row.uid}
                      sx={{
                        "&:hover": {
                          backgroundColor: "#f8fafc",
                        },
                        transition: "background-color 0.2s ease",
                      }}
                    >
                      <TableCell sx={{ fontWeight: 600, color: "#334155" }}>
                        {row.name}
                      </TableCell>
                      <TableCell sx={{ color: "#64748b" }}>{row.phone}</TableCell>
                      <TableCell title={row.email} sx={{ color: "#64748b" }}>
                        {row.email.length > 20
                          ? `${row.email.slice(0, 18)}...`
                          : row.email}
                      </TableCell>
                      <TableCell sx={{ color: "#64748b" }}>{row.address}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700">
                          {row.ordersCount}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${row.isVerified === "Verified"
                            ? "bg-success-100 text-success-700 border border-success-200"
                            : "bg-warning-100 text-warning-700 border border-warning-200"
                          }`}>
                          {row.isVerified === "Verified" ? "✓ Accepted" : "⏳ Pending"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewDetails(row.uid)}
                            className="p-2 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors duration-200"
                            title="View details"
                          >
                            <ViewDetailsIcon />
                          </button>
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
          sx={{
            borderTop: "1px solid #e2e8f0",
            "& .MuiTablePagination-select": {
              borderRadius: "8px",
            },
          }}
        />
      </div>

      {/* Modern Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        aria-labelledby="delete-confirmation-dialog"
        PaperProps={{
          style: {
            minWidth: "450px",
            maxWidth: "500px",
            borderRadius: "24px",
            padding: "8px",
          },
        }}
      >
        <IconButton
          aria-label="close"
          onClick={() => setShowDeleteModal(false)}
          sx={{
            position: "absolute",
            right: 16,
            top: 16,
            color: "#64748b",
            "&:hover": {
              backgroundColor: "#f1f5f9",
            },
          }}
        >
          <CloseIcon />
        </IconButton>

        <DialogContent sx={{ textAlign: "center", pt: 4, pb: 3 }}>
          <div className="w-16 h-16 mx-auto mb-4 bg-danger-100 rounded-full flex items-center justify-center">
            <span className="text-3xl">🗑️</span>
          </div>
          <DialogTitle
            id="delete-confirmation-dialog"
            sx={{
              textAlign: "center",
              fontSize: "1.5rem",
              fontWeight: "bold",
              mb: 1,
              p: 0,
            }}
          >
            Delete Restaurant?
          </DialogTitle>
          <Typography align="center" variant="body1" sx={{ color: "#64748b", mb: 2 }}>
            Are you sure you want to delete <strong>{restaurantDetails.name}</strong>?
            This action cannot be undone.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ justifyContent: "center", pb: 3, gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setShowDeleteModal(false)}
            sx={{
              minWidth: "120px",
              borderRadius: "12px",
              textTransform: "none",
              fontWeight: 600,
              borderColor: "#e2e8f0",
              color: "#64748b",
              "&:hover": {
                borderColor: "#cbd5e1",
                backgroundColor: "#f8fafc",
              },
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDeleteRestaurant}
            sx={{
              minWidth: "120px",
              borderRadius: "12px",
              textTransform: "none",
              fontWeight: 600,
              backgroundColor: "#ef4444",
              "&:hover": {
                backgroundColor: "#dc2626",
              },
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modern View Details Modal */}
      <Dialog
        open={viewDetailsModal}
        onClose={handleClose}
        fullWidth
        maxWidth="md"
        PaperProps={{
          style: {
            borderRadius: "24px",
          },
        }}
      >
        <DialogTitle sx={{
          borderBottom: "1px solid #e2e8f0",
          pb: 2,
          fontSize: "1.5rem",
          fontWeight: "bold",
          color: "#1e293b"
        }}>
          Restaurant Details
          <IconButton
            onClick={handleClose}
            sx={{
              position: "absolute",
              right: 16,
              top: 16,
              color: "#64748b",
              "&:hover": {
                backgroundColor: "#f1f5f9",
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {isEditing ? (
            <Grid container spacing={3}>
              {/* Image Upload Field */}
              <Grid item xs={12}>
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-neutral-700">
                    Restaurant Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="block w-full text-sm text-neutral-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer"
                  />
                  {(imagePreview || restaurantDetails.imageUrl) && (
                    <img
                      src={imagePreview || restaurantDetails.imageUrl}
                      alt="Restaurant Preview"
                      className="w-full max-w-md aspect-[4/3] object-cover rounded-xl border-2 border-neutral-200"
                    />
                  )}
                </div>
              </Grid>

              {/* Form Fields */}
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
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "12px",
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
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
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "12px",
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
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
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "12px",
                    },
                  }}
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
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "12px",
                    },
                  }}
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
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "12px",
                    },
                  }}
                />
              </Grid>
            </Grid>
          ) : (
            // Non-edit view with modern design
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Restaurant Image */}
                <div className="md:col-span-1">
                  <img
                    src={restaurantDetails?.imageUrl || "/placeholder-image.png"}
                    alt={restaurantDetails?.name || "Restaurant"}
                    className="w-full aspect-square object-cover rounded-2xl border-2 border-neutral-200 shadow-lg"
                  />
                </div>

                {/* Restaurant Details */}
                <div className="md:col-span-2 space-y-4">
                  <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-2xl p-6 border border-primary-200">
                    <h3 className="text-2xl font-bold text-primary-900 mb-2">
                      {restaurantDetails?.name || "N/A"}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${restaurantDetails?.status === "Verified"
                          ? "bg-success-500 text-white"
                          : "bg-warning-500 text-white"
                        }`}>
                        {restaurantDetails?.status === "Verified" ? "✓ Verified" : "⏳ Pending"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary-600">📧</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                            Email
                          </p>
                          <p className="text-sm font-medium text-neutral-800">
                            {restaurantDetails?.email || "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-success-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-success-600">📱</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                            Phone
                          </p>
                          <p className="text-sm font-medium text-neutral-800">
                            {restaurantDetails?.phone || "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-secondary-600">📍</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                            Address
                          </p>
                          <p className="text-sm font-medium text-neutral-800">
                            {restaurantDetails?.address || "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {restaurantDetails?.description && (
                <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-200">
                  <h4 className="text-lg font-bold text-neutral-800 mb-3 flex items-center gap-2">
                    <span>📝</span> Description
                  </h4>
                  <p className="text-neutral-700 leading-relaxed">
                    {restaurantDetails?.description}
                  </p>
                </div>
              )}

              {/* Payment Information */}
              <div className="bg-gradient-to-br from-neutral-50 to-white rounded-2xl p-6 border border-neutral-200">
                <h4 className="text-lg font-bold text-neutral-800 mb-4 flex items-center gap-2">
                  <span>💳</span> Payment Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                      Bank Name
                    </p>
                    <p className="text-sm font-medium text-neutral-800">
                      {restaurantDetails?.bankName || "N/A"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                      Account Number
                    </p>
                    <p className="text-sm font-medium text-neutral-800">
                      {restaurantDetails?.accountNumber || "N/A"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                      Bank Location
                    </p>
                    <p className="text-sm font-medium text-neutral-800">
                      {restaurantDetails?.bankAddress || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Location Map */}
              {restaurantDetails?.location && (
                <div className="bg-white rounded-2xl p-6 border border-neutral-200">
                  <h4 className="text-lg font-bold text-neutral-800 mb-4 flex items-center gap-2">
                    <span>🗺️</span> Restaurant Location
                  </h4>
                  <div className="rounded-xl overflow-hidden border-2 border-neutral-200">
                    <StaticMap location={restaurantDetails?.location} />
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
        <DialogActions sx={{
          borderTop: "1px solid #e2e8f0",
          p: 3,
          gap: 2
        }}>
          <Button
            onClick={() => setIsEditing(!isEditing)}
            sx={{
              borderRadius: "12px",
              textTransform: "none",
              fontWeight: 600,
              px: 3,
              color: "#64748b",
              "&:hover": {
                backgroundColor: "#f1f5f9",
              },
            }}
          >
            {isEditing ? "Cancel" : "Edit"}
          </Button>
          {isEditing && (
            <Button
              onClick={handleEditRestaurant}
              variant="contained"
              sx={{
                borderRadius: "12px",
                textTransform: "none",
                fontWeight: 600,
                px: 4,
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                "&:hover": {
                  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                },
              }}
            >
              Save Changes
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Restaurants;
