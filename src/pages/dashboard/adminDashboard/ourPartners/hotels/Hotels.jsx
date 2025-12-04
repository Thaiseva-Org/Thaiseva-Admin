import CloseIcon from "@mui/icons-material/Close";
import {
  Button,
  Box,
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
  TextField,
  Tab,
  Tabs,
} from "@mui/material";
import {
  deleteDoc,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
} from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import DeleteButton from "../../../../../components/DeleteButton";
import LoadingContent from "../../../../../components/LoadingContent";
import PageHeading from "../../../../../components/PageHeading";
import SearchBar from "../../../../../components/SearchBar";
import StaticMap from "../../../../../components/StaticMap";
import SubTitle from "../../../../../components/SubTitle";
import ViewDetailsIcon from "../../../../../components/ViewDetailsIcon";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";
import {
  chatRoomsCollection,
  chatsCollection,
  hotelsCollection,
  usersCollection,
} from "../../../../../firebase/firebase.config";
import {
  askingForDelete,
  deleteNotification,
  item,
  successNotification,
} from "../../../../../utils/utils";

import AddHotelSelectionModal from "./AddHotelSelectionModal";
import { useNavigate } from "react-router-dom";
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';

const Hotels = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [lastDocs, setLastDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewDetailsModal, setViewDetailsModal] = useState(false); //Add service modal
  const [openSelectionModal, setOpenSelectionModal] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [hotelDetails, setHotelDetails] = useState({ status: "" });
  const [status, setStatus] = useState("Pending");
  const { hotels, loadingPartnerData, setUid } = useContext(PartnerContext);
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const [matchedHotels, setMatchedHotels] = useState([]);
  const [comission, setComission] = useState(0);
  // const [isBestHotel, setIsBestHotel] = useState(false);

  useEffect(() => {
    const fetchTotalPages = async () => {
      let q = query(hotelsCollection);
      const pages = await getCountFromServer(q);
      setTotalPages(Math.ceil(pages.data().count));
    };
    fetchTotalPages();
  }, []);

  useEffect(() => {
    const loadHotels = async () => {
      setLoading(true);
      const unSub = onSnapshot(hotelsCollection, (result) => {
        if (result) {
          const list = result.docs.map((doc) => doc.data());
          if (list?.length > 0) {
            setMatchedHotels(list);
            setLoading(false);
          } else {
            setMatchedHotels([]);
            setLoading(false);
          }
        }
      });

      return () => {
        unSub();
      };
    };

    (isAdmin || isSubAdmin) && loadHotels();
  }, [isAdmin, isSubAdmin]);

  // Partners table header
  // const columns = [
  //   { id: "hotelName", label: "Name", width: 120 },
  //   { id: "phoneNumber", label: "Phone Number", width: 130 },
  //   { id: "email", label: "Email", width: 80 },
  //   { id: "address", label: "Address", width: 100 },
  //   { id: "status", label: "Status", width: 100 },
  //   { id: "isBestHotel", label: "Best Hotel", width: 100 },
  //   { id: "action", label: "Action", width: 120 },
  // ];
  const columns = [
    { id: "hotelName", label: "Name", width: "15%" },
    { id: "phoneNumber", label: "Phone", width: "15%" },
    { id: "email", label: "Email", width: "15%" },
    { id: "address", label: "Address", width: "25%" },
    { id: "bookings", label: "Bookings", width: "10%" },
    { id: "action", label: "Action", width: "10%" },
  ];

  // creating single row
  function createData(
    hotelName,
    phoneNumber,
    email,
    address,
    uid,
    serviceCategory,
    isBestHotel,
    bookings
  ) {
    return {
      hotelName,
      phoneNumber,
      email,
      address,
      uid,
      serviceCategory,
      isBestHotel,
      bookings,
    };
  }

  // calling createData function with partner's data
  const rows = matchedHotels?.map((hotel) => {
    return createData(
      hotel.hotelInformation?.hotelName,
      hotel.hotelInformation?.phoneNumber,
      hotel.hotelInformation?.email,
      hotel.hotelInformation?.address,
      hotel.uid,
      hotel.serviceCategory,
      hotel.isBestHotel,
      hotel?.bookings?.length || 0
    );
  });

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(event.target.value);
    setPage(0);
  };

  const handleClose = () => {
    setHotelDetails({});
    setViewDetailsModal(false);
    setTabValue(0);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleViewDetails = async (id) => {
    const query = doc(hotelsCollection, id);
    const data = await getDoc(query);

    setHotelDetails(data.data());
    setStatus(data.data()?.status);
    setComission(data.data()?.comission);
    // setIsBestHotel(data.data()?.isBestHotel || false); // setting the best hotel status
    setViewDetailsModal(true); //opening the modal
  };

  const handleDelete = async (id) => {
    askingForDelete().then(async (result) => {
      if (result.isConfirmed) {
        await deleteDoc(doc(hotelsCollection, id)).then(() => {
          deleteNotification("The Hotel is deleted successfully.");
        }); // deleting partner data from partners collection

        await updateDoc(doc(chatRoomsCollection, "HotelSupport"), {
          [id + "_HotelSupport"]: deleteField(),
        });
        await deleteDoc(doc(chatsCollection, id + "_HotelSupport"));

        await updateDoc(doc(usersCollection, id), {
          isSuspended: true,
        });
      }
    });
  };

  /* =============================================================
              serach functionalities start
  =============================================================*/
  // const handleSearchByName = (text) => {
  //   const matchingObjects = hotels.filter((item) =>
  //     item.hotelInformation.hotelName.toLowerCase().includes(text.toLowerCase())
  //   );

  //   setMatchedHotels(matchingObjects);
  // };

  // const handleSearchByLocation = (text) => {
  //   const matchingObjects = hotels.filter((item) =>
  //     item.hotelInformation.address.toLowerCase().includes(text.toLowerCase())
  //   );

  //   setMatchedHotels(matchingObjects);
  // };

  const handleSearch = (text) => {
    const matchingObjects = hotels.filter(
      (item) =>
        item.hotelInformation.address
          .toLowerCase()
          .includes(text.toLowerCase()) ||
        item.hotelInformation.hotelName
          .toLowerCase()
          .includes(text.toLowerCase())
    );

    setMatchedHotels(matchingObjects);
  };
  /* =============================================================
              serach functionalities end
  =============================================================*/

  // changing the status
  // updating the commission
  const handleInputChange = (section, field, value) => {
    setHotelDetails((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleUpdateHotel = async () => {
    const updatedData = {
      ...hotelDetails,
      comission: Number(comission),
    };

    await updateDoc(doc(hotelsCollection, hotelDetails.uid), updatedData);
    await updateDoc(doc(usersCollection, hotelDetails.uid), updatedData).then(
      async () => {
        successNotification("Hotel details updated successfully");
        handleClose();
      }
    );
  };

  return (
    <div className="animate-fade-in">
      <PageHeading
        text="Hotels"
        subtitle="Manage hotel partners and their information"
        icon="🏨"
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium mb-1">
                Total Hotels
              </p>
              <p className="text-3xl font-bold">{matchedHotels.length}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">🏨</span>
            </div>
          </div>
        </div>
      </div>
      {/* <Grid container spacing={0.5} sx={{ mb: 2, mt: 0.5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By Hotel Name"
            type="search"
            placeholder="Hotel Name"
            fullWidth
            defaultValue=""
            onChange={(e) => handleSearchByName(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By Address"
            type="search"
            placeholder="Type Address"
            fullWidth
            defaultValue=""
            onChange={(e) => handleSearchByLocation(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={12} md={6}>
          <div className="text-right md:pr-10 mb-4 flex items-center justify-end h-full">
            <Link
              to="/hotel-onboarding"
              target="_blank"
              className="add-new-btn"
            >
              Add New Hotel
            </Link>
          </div>
        </Grid>
      </Grid> */}

      <SearchBar
        handleSearch={handleSearch}
        handleOpenModal={() => setOpenSelectionModal(true)}
        btnTitle="Add New Hotel"
      />

      {/* Modern Table Container */}
      <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          {loadingPartnerData ? (
            <LoadingContent variant="skeleton" />
          ) : (
            <table className="w-full">
              <thead className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                <tr>
                  {columns?.map((column) => (
                    <th
                      key={column.id}
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
                        {columns?.map((column) => {
                          const value = row[column.id];
                          return (
                            <td
                              key={column.id}
                              className="px-6 py-4 text-center"
                            >
                              {column.id === "email" ? (
                                <span
                                  title={value}
                                  className="text-sm text-neutral-700"
                                >
                                  {value?.length > 19
                                    ? `${value.slice(0, 18)}...`
                                    : value}
                                </span>
                              ) : column.id === "bookings" ? (
                                <span className="inline-flex items-center justify-center w-10 h-10 bg-primary-100 text-primary-700 rounded-full font-semibold">
                                  {value}
                                </span>
                              ) : column.id === "action" ? (
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleViewDetails(row.uid)}
                                    className="p-2 hover:bg-primary-100 rounded-lg transition-colors"
                                    title="View hotel's info"
                                  >
                                    <ViewDetailsIcon />
                                  </button>

                                  <button
                                    onClick={() =>
                                      navigate(`/dashboard/hotels/${row.uid}/rooms`)
                                    }
                                    className="p-2 hover:bg-secondary-100 rounded-lg transition-colors text-secondary-600"
                                    title="Manage Rooms"
                                  >
                                    <MeetingRoomIcon />
                                  </button>

                                  <button
                                    onClick={() => handleDelete(row.uid)}
                                    className="p-2 hover:bg-danger-100 rounded-lg transition-colors"
                                    title="Delete hotel"
                                  >
                                    <DeleteButton />
                                  </button>
                                </div>
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
                        <span className="text-6xl mb-4">🏨</span>
                        <p className="text-lg font-medium text-neutral-500">
                          No Hotels Found
                        </p>
                        <p className="text-sm text-neutral-400 mt-2">
                          Add a new hotel to get started.
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
        <DialogTitle
          sx={{
            borderBottom: "1px solid #e2e8f0",
            pb: 2,
            fontSize: "1.5rem",
            fontWeight: "bold",
            color: "#1e293b",
          }}
        >
          🏨 {hotelDetails?.hotelInformation?.hotelName}
        </DialogTitle>
        <Box sx={{ borderBottom: 1, borderColor: "divider", px: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="hotel details tabs">
            <Tab label="Details" />
          </Tabs>
        </Box>
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: "absolute",
            right: 8,
            top: 8,
            color: "#64748b",
            bgcolor: "#f1f5f9",
            "&:hover": {
              bgcolor: "#e2e8f0",
            },
          }}
        >
          <CloseIcon />
        </IconButton>

        {/* Modern Modal Body */}
        {tabValue === 0 && (
          <DialogContent sx={{ p: 4 }}>
            <Grid container spacing={3}>
              {/* Hotel Logo */}
              <Grid item xs={12} sm={6}>
                <div className="flex justify-center">
                  <div className="relative">
                    <img
                      src={hotelDetails?.hotelInformation?.logoURL}
                      alt="Hotel Logo"
                      className="w-40 h-40 rounded-2xl object-cover border-4 border-primary-200 shadow-lg"
                    />
                    <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-2 shadow-lg">
                      <span className="text-2xl">🏨</span>
                    </div>
                  </div>
                </div>
              </Grid>

              {/* Hotel Information */}
              <Grid item xs={12} sm={6}>
                <div className="bg-gradient-to-br from-primary-50 to-white rounded-xl p-4 border border-primary-100">
                  <h3 className="text-lg font-bold text-primary-700 mb-3 flex items-center gap-2">
                    <span>📋</span> Hotel Information
                  </h3>
                  <div className="space-y-4">
                    <TextField
                      label="Hotel Name"
                      fullWidth
                      value={hotelDetails?.hotelInformation?.hotelName || ""}
                      onChange={(e) =>
                        handleInputChange(
                          "hotelInformation",
                          "hotelName",
                          e.target.value
                        )
                      }
                      variant="outlined"
                      size="small"
                    />
                    <TextField
                      label="Email"
                      fullWidth
                      value={hotelDetails?.hotelInformation?.email || ""}
                      onChange={(e) =>
                        handleInputChange(
                          "hotelInformation",
                          "email",
                          e.target.value
                        )
                      }
                      variant="outlined"
                      size="small"
                    />
                    <TextField
                      label="Phone"
                      fullWidth
                      value={hotelDetails?.hotelInformation?.phoneNumber || ""}
                      onChange={(e) =>
                        handleInputChange(
                          "hotelInformation",
                          "phoneNumber",
                          e.target.value
                        )
                      }
                      variant="outlined"
                      size="small"
                    />
                    <TextField
                      label="Address"
                      fullWidth
                      multiline
                      rows={2}
                      value={hotelDetails?.hotelInformation?.address || ""}
                      onChange={(e) =>
                        handleInputChange(
                          "hotelInformation",
                          "address",
                          e.target.value
                        )
                      }
                      variant="outlined"
                      size="small"
                    />
                  </div>
                </div>
              </Grid>

              {/* Payment Information */}
              <Grid item xs={12}>
                <div className="bg-gradient-to-br from-success-50 to-white rounded-xl p-4 border border-success-100">
                  <h3 className="text-lg font-bold text-success-700 mb-3 flex items-center gap-2">
                    <span>💳</span> Payment Information
                  </h3>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Bank Name"
                        fullWidth
                        value={hotelDetails?.paymentInformation?.bankName || ""}
                        onChange={(e) =>
                          handleInputChange(
                            "paymentInformation",
                            "bankName",
                            e.target.value
                          )
                        }
                        variant="outlined"
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Account Number"
                        fullWidth
                        value={
                          hotelDetails?.paymentInformation?.accountNumber || ""
                        }
                        onChange={(e) =>
                          handleInputChange(
                            "paymentInformation",
                            "accountNumber",
                            e.target.value
                          )
                        }
                        variant="outlined"
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Bank Location"
                        fullWidth
                        value={
                          hotelDetails?.paymentInformation?.bankAddress || ""
                        }
                        onChange={(e) =>
                          handleInputChange(
                            "paymentInformation",
                            "bankAddress",
                            e.target.value
                          )
                        }
                        variant="outlined"
                        size="small"
                      />
                    </Grid>
                  </Grid>
                </div>
              </Grid>

              {/* Hotel Location Map */}
              <Grid item xs={12}>
                <div className="bg-gradient-to-br from-neutral-50 to-white rounded-xl p-4 border border-neutral-200">
                  <h3 className="text-lg font-bold text-neutral-700 mb-3 flex items-center gap-2">
                    <span>📍</span> Hotel Location
                  </h3>
                  <div className="rounded-xl overflow-hidden border-2 border-neutral-200">
                    <StaticMap
                      location={hotelDetails?.hotelInformation?.location}
                    />
                  </div>
                </div>
              </Grid>

              {/* Hotel License */}
              <Grid item xs={12}>
                <div className="bg-gradient-to-br from-secondary-50 to-white rounded-xl p-4 border border-secondary-100">
                  <h3 className="text-lg font-bold text-secondary-700 mb-3 flex items-center gap-2">
                    <span>📄</span> Hotel License
                  </h3>
                  <div className="rounded-xl overflow-hidden border-2 border-secondary-200">
                    <img
                      src={hotelDetails?.hotelInformation?.license}
                      alt="Hotel License"
                      className="w-full h-auto max-h-96 object-contain bg-neutral-50"
                    />
                  </div>
                </div>
              </Grid>

              {/* Commission */}
              <Grid item xs={12}>
                <div className="bg-gradient-to-br from-primary-50 to-white rounded-xl p-4 border border-primary-100">
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <div className="flex items-end gap-4">
                        <TextField
                          label="Commission (%)"
                          type="number"
                          placeholder="Enter Commission"
                          autoComplete="off"
                          autoCorrect="off"
                          defaultValue={hotelDetails?.comission || comission}
                          onInput={(e) => {
                            if (e.target.value) {
                              let value = parseInt(e.target.value, 10);
                              if (value < 0) e.target.value = 0;
                              if (value > 100) e.target.value = 100;
                            }
                          }}
                          onKeyDown={(e) => {
                            if (
                              e.key === "+" ||
                              e.key === "e" ||
                              e.key === "-" ||
                              e.key === "."
                            ) {
                              e.preventDefault();
                            }
                          }}
                          onWheel={(e) => e.target.blur()}
                          fullWidth
                          onChange={(e) => setComission(e.target.value)}
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              borderRadius: "12px",
                              "& fieldset": {
                                borderWidth: "2px",
                              },
                            },
                          }}
                        />

                      </div>
                    </Grid>
                  </Grid>
                </div>
              </Grid>
            </Grid>
          </DialogContent>
        )}



        <DialogActions sx={{ px: 4, py: 3, borderTop: "1px solid #e2e8f0" }}>
          <Button
            onClick={handleClose}
            sx={{
              minWidth: "120px",
              borderRadius: "12px",
              textTransform: "none",
              fontWeight: 600,
              color: "#64748b",
              "&:hover": {
                backgroundColor: "#f8fafc",
              },
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateHotel}
            sx={{
              minWidth: "120px",
              borderRadius: "12px",
              textTransform: "none",
              fontWeight: 600,
              background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
              "&:hover": {
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              },
            }}
          >
            💾 Save Changes
          </Button>
        </DialogActions>
      </Dialog>



      <AddHotelSelectionModal
        open={openSelectionModal}
        onClose={() => setOpenSelectionModal(false)}
      />
    </div >
  );
};

export default Hotels;
