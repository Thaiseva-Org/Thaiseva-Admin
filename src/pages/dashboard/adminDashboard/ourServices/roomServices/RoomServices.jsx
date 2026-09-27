import { CloseIcon } from "@icons";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TablePagination,
} from "@mui/material";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";

import LoadingContent from "../../../../../components/LoadingContent";
import PageHeading from "../../../../../components/PageHeading";
import RedirectWhatsApp from "../../../../../components/RedirectWhatsApp";
import SearchBar from "../../../../../components/SearchBar";
import SubTitle from "../../../../../components/SubTitle";
import UpdateButton from "../../../../../components/UpdateButton";
import ViewDetailsIcon from "../../../../../components/ViewDetailsIcon";
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";
import {
  hotelPackageDetails,
  hotelsCollection,
} from "../../../../../firebase/firebase.config";
import { calculateDiscountPrice } from "../../../../../utils/utils";
const RoomServices = () => {
  const { rooms, loadingData, setPage, setRowsPerPage, page, rowsPerPage } =
    useContext(PartnerContext);
  const [openModal, setOpenModal] = useState(false); //Add service modal
  const [viewHotelDetailsModal, setViewHotelDetailsModal] = useState(false);
  const [hotelDetails, setHotelDetails] = useState({});
  const [status, setStatus] = useState("Pending");
  const [matchedRooms, setMatchedRooms] = useState([]);
  const [roomDetails, setRoomDetails] = useState({
    id: "",
    packageName: "",
    price: "",
    description: "",
    discount: "",
    location: {},
    period: "",
    bookingInfo: {},
    numberOfGuests: "",
    address: "",
    ratings: "",
    numberOfReviews: "",
    amenities: [],
    included: [],
    pictures: [],
    places: [],
  });

  useEffect(() => {
    setMatchedRooms(rooms);
  }, [rooms]);

  // Partners table header
  let columns = [
    { property: "hotelName", label: "Hotel Name", width: "15%" },
    { property: "name", label: "Package Name", width: "15%" },
    { property: "price", label: "Price", width: "15%" },
    { property: "discount", label: "Discount", width: "15%" },
    { property: "guests", label: "Guests Allowed", width: "15%" },
    // { property: "period", label: "Period", width: "10%" },
    // { property: "ratings", label: "Rating", width: 50 },
    // { property: "numberOfReviews", label: "Reviews", width: 50 },
    { property: "status", label: "Status", width: "15%" },
    { property: "action", label: "Action", width: "10%" },
  ];

  // creating single row
  function createData(
    hotelName,
    name,
    price,
    discount,
    period,
    guests,
    // ratings,
    // numberOfReviews,
    status,
    id,
    hotelUid
  ) {
    return {
      hotelName,
      name,
      price,
      discount,
      period,
      guests,
      // ratings,
      // numberOfReviews,
      status,
      id,
      hotelUid,
    };
  }

  // calling createData function with partner's data
  const rows = matchedRooms?.map((room) => {
    return createData(
      room?.hotelName || "-",
      room?.packageName || "-",
      room?.price || "-",
      room?.discount || "-",
      room?.period || "-",
      room?.numberOfGuests || "-",
      // room.ratings,
      // room.numberOfReviews,
      room?.status || "-",
      room?.id || "-",
      room?.hotelUid || "-"
    );
  });

  /* =============================================================
              serach functionalities start
  =============================================================*/
  // const handleSearchByPackageName = (text) => {
  //   const matchingObjects = rooms.filter((item) =>
  //     item.packageName.toLowerCase().includes(text.toLowerCase())
  //   );
  //   setMatchedRooms(matchingObjects);
  // };

  const handleSearch = (text) => {
    const matchingObjects = rooms.filter((room) =>
      room.packageName.toLowerCase().includes(text.toLowerCase())
    );

    setMatchedRooms(matchingObjects);
  };

  // const handleSearchByServiceArea = (text) => {
  //   const matchingObjects = rooms.filter((item) =>
  //     item.serviceArea.toLowerCase().includes(text.toLowerCase())
  //   );

  //   setMatchedRooms(matchingObjects);
  // };

  // const handleSearchByPhone = (text) => {
  //   const matchingObjects = rooms.filter((item) =>
  //     item.providerPhone.includes(text)
  //   );

  //   setMatchedRooms(matchingObjects);
  // };
  /* =============================================================
              serach functionalities end
  =============================================================*/

  // deleting room
  // const handleDelete = async (id) => {
  //   askingForDelete().then(async (result) => {
  //     if (result.isConfirmed) {
  //       await deleteDoc(doc(hotelPackages, id));
  //       await deleteDoc(doc(hotelPackageDetails, id)).then(() => {
  //         deleteNotification("The Room is deleted successfully.");
  //       });
  //     }
  //   });
  // };

  // opening AddPackagesModal the modal while cliking on right sign icon
  const handleCloseModal = () => {
    setRoomDetails({
      id: "",
      packageName: "",
      price: "",
      description: "",
      discount: "",
      location: {},
      period: "",
      bookingInfo: {},
      numberOfGuests: "",
      address: "",
      ratings: "",
      numberOfReviews: "",
      amenities: [],
      included: [],
      pictures: [],
      places: [],
    });
    setOpenModal(false);
  };

  // upadate package
  const handleViewRoomDetails = async (id) => {
    const snapshot = await getDoc(doc(hotelPackageDetails, id));
    if (snapshot.exists()) {
      const existingData = snapshot.data();
      setRoomDetails(existingData);
    }
    setOpenModal(true);
  };

  const handleUpdateStatus = async (id) => {
    // console.log(id);
    const updatedStatus = { status: status };

    // await updateDoc(doc(hotelPackages, id), updatedStatus);
    await updateDoc(doc(hotelPackageDetails, id), updatedStatus).then(() => {
      setOpenModal(false);
    });
  };

  const handleViewHotelDetails = async (id) => {
    setViewHotelDetailsModal(true); //opening the modal
    const query = doc(hotelsCollection, id);
    const data = await getDoc(query);

    setHotelDetails(data.data());
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // custom text field for common data
  const textField = (label, value, is12) => {
    return (
      <Grid item xs={12} sm={label === "Description" || is12 ? 12 : 6}>
        <div className="flex gap-2">
          <p>
            <span className="font-bold">{label}: </span>
            {label.includes("Price") && "฿"}
            {value}
            {label === "Discount" && "%"}
          </p>
        </div>
      </Grid>
    );
  };

  return (
    <div className="animate-fade-in">
      <PageHeading
        text="Room Services"
        subtitle="Manage hotel room packages and availability"
        icon="🛏️"
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium mb-1">
                Total Rooms
              </p>
              <p className="text-3xl font-bold">{matchedRooms.length}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">🛏️</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-success-500 to-success-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-success-100 text-sm font-medium mb-1">
                Approved
              </p>
              <p className="text-3xl font-bold">
                {matchedRooms.filter((r) => r.status === "Approved").length}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">✅</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-warning-500 to-warning-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-warning-100 text-sm font-medium mb-1">
                Pending
              </p>
              <p className="text-3xl font-bold">
                {matchedRooms.filter((r) => r.status === "Pending").length}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">⏳</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-danger-500 to-danger-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-danger-100 text-sm font-medium mb-1">Denied</p>
              <p className="text-3xl font-bold">
                {matchedRooms.filter((r) => r.status === "Denied").length}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">❌</span>
            </div>
          </div>
        </div>
      </div>

      <SearchBar handleSearch={handleSearch} btn={false} />

      {/* Modern Table Container */}
      <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          {loadingData ? (
            <LoadingContent variant="skeleton" />
          ) : (
            <table className="w-full">
              <thead className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.property}
                      className="px-6 py-4 text-center text-sm font-semibold uppercase tracking-wider"
                      style={{ width: column.width }}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {rows
                  ?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  ?.map((row, i) => {
                    return (
                      <tr
                        key={i}
                        className="hover:bg-primary-50 transition-colors duration-200"
                      >
                        {columns.map((column) => {
                          const value = row[column.property];

                          return (
                            <td
                              key={column.property}
                              className="px-6 py-4 text-center"
                            >
                              {value === "Pending" ||
                                value === "Approved" ||
                                value === "Denied" ? (
                                <span
                                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${value === "Pending"
                                      ? "bg-warning-100 text-warning-700 border border-warning-300"
                                      : value === "Approved"
                                        ? "bg-success-100 text-success-700 border border-success-300"
                                        : "bg-danger-100 text-danger-700 border border-danger-300"
                                    }`}
                                >
                                  {value === "Approved" && "✓ "}
                                  {value === "Pending" && "⏳ "}
                                  {value === "Denied" && "✗ "}
                                  {value}
                                </span>
                              ) : column.property === "action" ? (
                                <div className="flex gap-2 justify-center">
                                  <button
                                    onClick={() =>
                                      handleViewRoomDetails(row.id)
                                    }
                                    className="p-2 hover:bg-primary-100 rounded-lg transition-colors"
                                    title="Update Status"
                                  >
                                    <UpdateButton />
                                  </button>

                                  <button
                                    onClick={() =>
                                      handleViewHotelDetails(row.hotelUid)
                                    }
                                    className="p-2 hover:bg-secondary-100 rounded-lg transition-colors"
                                    title="View Hotel's Info"
                                  >
                                    <ViewDetailsIcon />
                                  </button>
                                </div>
                              ) : column.property === "price" ? (
                                <span className="font-semibold text-success-600">
                                  ฿{value}
                                </span>
                              ) : column.property === "discount" ? (
                                <span className="inline-flex items-center justify-center w-12 h-12 bg-secondary-100 text-secondary-700 rounded-full font-semibold">
                                  {value}%
                                </span>
                              ) : (
                                <span className="text-sm text-neutral-700">
                                  {value}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12">
                      <div className="flex flex-col items-center justify-center text-neutral-400">
                        <span className="text-6xl mb-4">🛏️</span>
                        <p className="text-lg font-medium text-neutral-500">
                          No Room Services Found
                        </p>
                        <p className="text-sm text-neutral-400 mt-2">
                          No room packages available at this time.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Modern Pagination */}
        <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-4">
          <TablePagination
            rowsPerPageOptions={[10, 25, 100]}
            component="div"
            count={rows.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{
              "& .MuiTablePagination-toolbar": {
                color: "var(--text-primary)",
              },
              "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows":
              {
                margin: 0,
                fontWeight: 500,
              },
              "& .MuiTablePagination-select": {
                borderRadius: "8px",
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                padding: "4px 8px",
              },
              "& .MuiTablePagination-actions button": {
                borderRadius: "8px",
                "&:hover": {
                  backgroundColor: "var(--primary-bg-light)",
                },
              },
            }}
          />
        </div>
      </div>

      {/* view room details and change status modal */}
      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        aria-labelledby="responsive-dialog-title"
      >
        <Box sx={{ lg: { width: "800" } }}>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            Name : {roomDetails?.hotelName}
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
              {/* Cover Photo */}
              <Grid item xs={12} sm={6}>
                {roomDetails && (
                  <img
                    src={roomDetails?.coverPhoto}
                    alt=""
                    className="h-40 w-full mx-auto rounded object-cover"
                  />
                )}
              </Grid>
              <Grid item xs={12} sm={6}>
                {/* Room Name */}
                {textField("Package Name", roomDetails?.packageName, true)}
                {/* Price */}
                {textField("Price", roomDetails?.price, true)}
                {/* Discount */}
                {textField("Discount", roomDetails?.discount, true)}
                {/* Discount Price*/}
                {textField(
                  "Discount Price",
                  calculateDiscountPrice(
                    roomDetails?.price,
                    roomDetails?.discount
                  ),
                  true
                )}
                {/* Number Of Guests */}
                {textField(
                  "Number Of Guests",
                  roomDetails?.numberOfGuests,
                  true
                )}
                {/* Requirement Title */}
                {/* {textField("Address", roomDetails?.address, true)} */}
                {/* Period */}
                {/* {textField("Period", roomDetails?.period, true)} */}
              </Grid>
            </Grid>
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              {/* Description */}
              {textField("Description", roomDetails?.description)}

              {/* Add Amenities */}
              <Grid item xs={12}>
                <h3 className="font-bold text-[var(--primary-bg)] border-b">
                  Amenities
                </h3>
                <div className="flex flex-wrap gap-1 text-sm my-2">
                  {roomDetails.amenities &&
                    roomDetails?.amenities?.map((amenity, i) => (
                      <span key={i} className="bg-gray-200 py-1 px-2 rounded">
                        {amenity}
                      </span>
                    ))}
                </div>
              </Grid>

              {/* Add images */}
              <Grid item xs={12}>
                <h3 className="font-bold text-[var(--primary-bg)] border-b">
                  Room Pictures
                </h3>
                <div className="flex flex-wrap gap-2 my-2">
                  {roomDetails.pictures?.map((picture, i) => (
                    <div key={i}>
                      <h4 className="text-lg">{picture?.label}</h4>
                      <img
                        src={picture?.url}
                        alt=""
                        className="h-36 w-40 rounded"
                      />
                    </div>
                  ))}
                </div>
              </Grid>

              {/* Permission */}
              <h3 className="font-bold text-xl text-[var(--primary-bg)] border-b ml-4">
                Permission
              </h3>
              <Grid container spacing={2} sx={{ mb: 2, mt: 0.5, p: 1 }}>
                <Grid item xs={12} sm={6} md={6}>
                  <span className="font-bold ">Current Status : </span>{" "}
                  <span
                    className={`${(roomDetails?.status === "Pending" &&
                        "bg-orange-300 text-black") ||
                      (roomDetails?.status === "Approved" && "bg-green-500") ||
                      (roomDetails?.status === "Denied" && "bg-red-600")
                      } text-white  py-1 px-2 rounded`}
                  >
                    {roomDetails?.status}
                  </span>
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <FormControl fullWidth>
                    <InputLabel id="status-label ">Change Status</InputLabel>
                    <Select
                      labelId="status-label"
                      label="Change Status"
                      defaultValue={roomDetails?.status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <MenuItem value="Pending">Pending</MenuItem>
                      <MenuItem value="Approved">Approved</MenuItem>
                      <MenuItem value="Denied">Denied</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Grid>
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
              onClick={() => handleUpdateStatus(roomDetails?.id)}
            >
              Update
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* modal  */}
      <Dialog
        open={viewHotelDetailsModal}
        onClose={() => setViewHotelDetailsModal(false)}
        aria-labelledby="responsive-dialog-title"
      >
        <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
          Name: {hotelDetails?.hotelInformation?.hotelName}
        </DialogTitle>
        <IconButton
          aria-label="close"
          onClick={() => setViewHotelDetailsModal(false)}
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
        <DialogContent dividers sx={{ p: { xs: 2, md: 4 } }}>
          <Grid container spacing={0.5} sx={{ mb: 2, mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <div className="flex justify-between">
                <img
                  src={hotelDetails?.hotelInformation?.logoURL}
                  alt=""
                  className="w-32 h-32 border-2 border-[var(--primary-bg)]"
                />
              </div>
            </Grid>
            <Grid item xs={12} sm={6}>
              {/* Driver Information */}
              <div className="flex items-center justify-between">
                <SubTitle text="Hotel Information" />
                {hotelDetails?.hotelInformation?.phoneNumber && (
                  <RedirectWhatsApp
                    number={hotelDetails?.hotelInformation?.phoneNumber}
                  />
                )}
              </div>
              <Divider />
              <Grid container spacing={0.5} sx={{ mb: 2, mt: 0.5 }}>
                <Grid item xs={12}>
                  <span className="font-bold">Email: </span>
                  {hotelDetails?.hotelInformation?.email}
                </Grid>
                <Grid item xs={12}>
                  <span className="font-bold">Phone Number: </span>{" "}
                  {hotelDetails?.hotelInformation?.phoneNumber}
                </Grid>
                <Grid item xs={12}>
                  <span className="font-bold">Address: </span>
                  {hotelDetails?.hotelInformation?.address}
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            autoFocus
            sx={{
              bgcolor: "var(--button-bg-color)",
              color: "white",
              hover: "none",
            }}
            className="add-new-btn"
            onClick={() => setViewHotelDetailsModal(false)}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default RoomServices;
