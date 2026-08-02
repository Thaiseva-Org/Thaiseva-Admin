import CloseIcon from "@mui/icons-material/Close";
import { MdVisibility, MdEdit, MdDelete, MdMeetingRoom, MdAdd, MdEventAvailable } from "react-icons/md"; // Icons
import AddHotelForm from "./AddHotelForm"; // Import Form
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
  Tooltip,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  InputAdornment
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
  collection
} from "firebase/firestore";
import { GridView, ViewList, LocationOn, Star, Search } from "@mui/icons-material";
import { useContext, useEffect, useState } from "react";
import DeleteButton from "../../../../../components/DeleteButton";
import LoadingContent from "../../../../../components/LoadingContent";
import PageHeading from "../../../../../components/PageHeading";
import SearchBar from "../../../../../components/SearchBar";
import StaticMap from "../../../../../components/StaticMap";
import SubTitle from "../../../../../components/SubTitle";
import {
  chatRoomsCollection,
  chatsCollection,
  hotelsCollection,
  usersCollection,
  db
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
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";

const Hotels = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [lastDocs, setLastDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewDetailsModal, setViewDetailsModal] = useState(false); //Add service modal
  const [openSelectionModal, setOpenSelectionModal] = useState(false);
  const [editHotelModal, setEditHotelModal] = useState(false);
  const [selectedHotelForEdit, setSelectedHotelForEdit] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [viewMode, setViewMode] = useState('list');
  const [hotelDetails, setHotelDetails] = useState({ status: "" });
  const [status, setStatus] = useState("Pending");
  const { hotels, loadingPartnerData, setUid, roomBookings } = useContext(PartnerContext);
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
      const unSub = onSnapshot(hotelsCollection, async (result) => {
        if (result) {
          let list = result.docs.map((doc) => ({ ...doc.data(), uid: doc.id }));

          // Fetch room counts for each hotel
          list = await Promise.all(list.map(async (hotel) => {
            try {
              const roomsRef = collection(db, "HotelDB", hotel.uid, "rooms");
              const snapshot = await getCountFromServer(roomsRef);
              // Use the 'totalRooms' from the hotel document if available
              const totalRooms = Number(
                hotel.totalRooms ||
                hotel.hotel?.totalRooms ||
                hotel.hotelInformation?.totalRooms ||
                hotel.hotelDetails?.totalRooms ||
                0
              );

              // Calculate occupied rooms for TODAY
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              const occupiedRooms = (roomBookings || []).reduce((acc, booking) => {
                // Check if booking is for this hotel and is active
                // Active = Accepted OR Pending (that might be auto-confirmed soon)
                // We should count active stays
                if (booking.hotelUid === hotel.uid || booking.hotelId === hotel.uid) {
                  const status = booking.status || booking.bookingStatus;
                  const isConfirmed = booking.isBookingConfirmed === true;

                  // Count if Accepted OR Pending+Confirmed OR Pending (potential)
                  if (status === 'Accepted' || status === 'ACCEPTED' || isConfirmed) {
                    const checkInRaw = booking.checkInDate || booking.checkIn;
                    const checkOutRaw = booking.checkOutDate || booking.checkOut;

                    if (checkInRaw && checkOutRaw) {
                      const checkIn = checkInRaw.seconds ? new Date(checkInRaw.seconds * 1000) : new Date(checkInRaw);
                      const checkOut = checkOutRaw.seconds ? new Date(checkOutRaw.seconds * 1000) : new Date(checkOutRaw);

                      checkIn.setHours(0, 0, 0, 0);
                      checkOut.setHours(0, 0, 0, 0);

                      // If today is strictly within [checkIn, checkOut)
                      if (today >= checkIn && today < checkOut) {
                        return acc + (Number(booking.rooms || booking.noOfRooms || 0));
                      }
                    }
                  }
                }
                return acc;
              }, 0);

              const available = Math.max(0, totalRooms - occupiedRooms);

              return { ...hotel, roomTypesCount: snapshot.data().count, totalRoomsAvailable: available, totalCapacity: totalRooms };
            } catch (error) {
              console.error("Error fetching room count:", error);
              return { ...hotel, roomTypesCount: 0, totalRoomsAvailable: 0 };
            }
          }));

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
  }, [isAdmin, isSubAdmin, roomBookings]);

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
    { id: "totalRoomsAvailable", label: "Total Rooms", width: "10%" },
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
    roomTypesCount,
    totalRoomsAvailable,
    totalCapacity,
    fullData
  ) {
    return {
      hotelName,
      phoneNumber,
      email,
      address,
      uid,
      serviceCategory,
      isBestHotel,
      roomTypesCount,
      totalRoomsAvailable,
      totalCapacity,
      fullData
    };
  }

  // calling createData function with partner's data
  const rows = matchedHotels?.map((hotel) => {
    return createData(
      hotel.hotelInformation?.hotelName || hotel.hotelName || hotel.hotel?.hotelName,
      hotel.hotelInformation?.phoneNumber || hotel.phoneNumber || hotel.hotel?.phoneNumber,
      hotel.hotelInformation?.email || hotel.email || hotel.hotel?.email,
      hotel.hotelInformation?.address || hotel.address || hotel.hotel?.address,
      hotel.uid,
      hotel.serviceCategory,
      hotel.isBestHotel,
      hotel.roomTypesCount || 0,
      hotel.totalRoomsAvailable || 0,
      hotel.totalCapacity || 0,
      hotel // Pass full data
    );
  });

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
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

    // Merge document ID with data
    setHotelDetails({ ...data.data(), uid: id });
    const s = data.data()?.status || (data.data()?.hotel ? data.data().hotel.status : "");
    setStatus(s);
    setComission(data.data()?.comission);
    setViewDetailsModal(true);
  };

  const handleEditHotel = (hotelData) => {
    navigate(`/dashboard/hotels/edit/${hotelData.uid}`, { state: hotelData });
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

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, newMode) => {
            if (newMode) setViewMode(newMode);
          }}
          aria-label="view mode"
          sx={{
            bgcolor: 'white',
            boxShadow: 1,
            height: '52px',
            borderRadius: '12px',
            '& .MuiToggleButton-root': {
              border: '1px solid #e0e0e0',
              px: 2,
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'white',
                '&:hover': {
                  bgcolor: 'primary.dark',
                },
              },
              '&:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
              '&:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
            },
          }}
        >
          <ToggleButton value="list" aria-label="list view">
            <ViewList />
          </ToggleButton>
          <ToggleButton value="grid" aria-label="grid view">
            <GridView />
          </ToggleButton>
        </ToggleButtonGroup>

        <div className="flex-grow flex gap-4 w-full md:w-auto">
          <TextField
            placeholder="Search hotels..."
            type="search"
            fullWidth
            variant="outlined"
            size="medium"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search className="text-neutral-400" />
                </InputAdornment>
              ),
            }}
            sx={{
              flexGrow: 1,
              "& .MuiOutlinedInput-root": {
                backgroundColor: "white",
                borderRadius: "12px",
                transition: "all 0.3s ease",
                "&:hover": {
                  backgroundColor: "#f8fafc",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#3b82f6",
                  },
                },
                "&.Mui-focused": {
                  backgroundColor: "white",
                  boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#3b82f6",
                    borderWidth: "2px",
                  },
                },
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#e5e7eb",
                },
              },
            }}
            onChange={(e) => handleSearch(e.target.value)}
          />

          <button
            className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
            onClick={() => setOpenSelectionModal(true)}
          >
            <span className="text-xl">+</span> Add New Hotel
          </button>
        </div>
      </div>

      {/* Modern Table Container */}
      <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          {loadingPartnerData ? (
            <LoadingContent variant="skeleton" />
          ) : viewMode === 'list' ? (
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
                              ) : column.id === "totalRoomsAvailable" ? (
                                <span className="inline-flex items-center justify-center min-w-[3rem] px-2 h-8 font-bold text-sm text-neutral-700">
                                  {row.totalRoomsAvailable ?? 0}/{row.totalCapacity ?? 0}
                                </span>
                              ) : column.id === "action" ? (
                                <div className="flex items-center justify-center gap-2">
                                  <IconButton
                                    onClick={() =>
                                      navigate(
                                        `/dashboard/hotel-room-availability/${row.uid}`
                                      )
                                    }
                                    sx={{
                                      color: "#0ea5e9",
                                      "&:hover": { bgcolor: "#f0f9ff" },
                                      transition: "all 0.2s",
                                    }}
                                    title="Manage Room Availability"
                                  >
                                    <MdEventAvailable size={20} />
                                  </IconButton>

                                  {/* Edit */}
                                  <IconButton
                                    onClick={() => handleEditHotel(row.fullData)}
                                    sx={{
                                      color: '#f59e0b',
                                      '&:hover': { bgcolor: '#fffbeb' },
                                      transition: 'all 0.2s'
                                    }}
                                    title="Edit Hotel"
                                  >
                                    <MdEdit size={20} />
                                  </IconButton>

                                  {/* Delete */}
                                  <IconButton
                                    onClick={() => handleDelete(row.uid)}
                                    sx={{
                                      color: '#ef4444',
                                      '&:hover': { bgcolor: '#fef2f2' },
                                      transition: 'all 0.2s'
                                    }}
                                    title="Delete Hotel"
                                  >
                                    <MdDelete size={20} />
                                  </IconButton>
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
          ) : (
            <div className="p-6 bg-neutral-50 min-h-[400px]">
              {rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-neutral-400 py-12">
                  <span className="text-6xl mb-4">🏨</span>
                  <p className="text-lg font-medium text-neutral-500">No Hotels Found</p>
                </div>
              ) : (
                <Grid container spacing={3}>
                  {rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={row.uid}>
                      <Card sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        borderRadius: 3,
                        overflow: 'hidden',
                        border: '1px solid',
                        borderColor: 'divider',
                        '&:hover': { transform: 'translateY(-4px)', boxShadow: 4, borderColor: 'primary.main' }
                      }}>
                        <CardMedia
                          component="img"
                          height="200"
                          image={row.fullData?.hotelInformation?.logoURL || row.fullData?.hotel?.images?.logo || 'https://via.placeholder.com/300x200?text=No+Image'}
                          alt={row.hotelName}
                          sx={{ height: 200, objectFit: 'cover' }}
                        />
                        <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
                          <Typography variant="h6" fontWeight="700" gutterBottom noWrap title={row.hotelName} sx={{ mb: 1 }}>
                            {row.hotelName}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mb: 2 }}>
                            <LocationOn sx={{ fontSize: 18, color: 'error.main' }} />
                            <Typography variant="body2" noWrap>{row.address || "No Address"}</Typography>
                          </Box>
                          <div className="flex justify-between items-center mt-4 border-t border-gray-100 pt-3">
                            <Typography variant="body2" color="text.secondary">
                              Phone: {row.phoneNumber}
                            </Typography>
                          </div>
                        </CardContent>
                        <div className="border-t border-gray-100 p-3 flex justify-between items-center bg-gray-50">
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title="Manage Room Availability">
                              <IconButton
                                size="small"
                                onClick={() =>
                                  navigate(
                                    `/dashboard/hotel-room-availability/${row.uid}`
                                  )
                                }
                                sx={{
                                  color: "#0ea5e9",
                                  bgcolor: "white",
                                  border: "1px solid #f3f4f6",
                                  "&:hover": {
                                    bgcolor: "#f0f9ff",
                                    borderColor: "#7dd3fc",
                                  },
                                }}
                              >
                                <MdEventAvailable />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => handleEditHotel(row.fullData)} sx={{ color: '#f59e0b', bgcolor: 'white', border: '1px solid #f3f4f6', '&:hover': { bgcolor: '#fffbeb', borderColor: '#fcd34d' } }}>
                                <MdEdit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" onClick={() => handleDelete(row.uid)} sx={{ color: '#ef4444', bgcolor: 'white', border: '1px solid #f3f4f6', '&:hover': { bgcolor: '#fef2f2', borderColor: '#fca5a5' } }}>
                                <MdDelete />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          <div className="flex items-center gap-2">
                            <Tooltip title={`${row.totalCapacity} Total Rooms`}>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border bg-neutral-50 text-neutral-700 border-neutral-100">
                                <MdMeetingRoom size={14} />
                                {row.totalCapacity} Rooms
                              </span>
                            </Tooltip>
                            <Tooltip title="Room Types">
                              <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-xs font-bold border border-indigo-100">
                                <span className="text-[10px] uppercase tracking-wider">Type</span>
                                {row.roomTypesCount}
                              </span>
                            </Tooltip>
                          </div>
                        </div>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </div>
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
                      src={
                        hotelDetails?.hotel?.images?.logo ||
                        hotelDetails?.hotelInformation?.logoURL
                      }
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
                      value={
                        hotelDetails?.hotel?.hotelName ||
                        hotelDetails?.hotelInformation?.hotelName ||
                        ""
                      }
                      InputProps={{ readOnly: true }}
                      variant="outlined"
                      size="small"
                    />
                    <TextField
                      label="Email"
                      fullWidth
                      value={
                        hotelDetails?.hotel?.email ||
                        hotelDetails?.hotelInformation?.email ||
                        ""
                      }
                      InputProps={{ readOnly: true }}
                      variant="outlined"
                      size="small"
                    />
                    <TextField
                      label="Phone"
                      fullWidth
                      value={
                        hotelDetails?.hotel?.phoneNumber ||
                        hotelDetails?.hotelInformation?.phoneNumber ||
                        ""
                      }
                      InputProps={{ readOnly: true }}
                      variant="outlined"
                      size="small"
                    />
                    <TextField
                      label="Address"
                      fullWidth
                      multiline
                      rows={2}
                      value={
                        hotelDetails?.hotel?.address ||
                        hotelDetails?.hotelInformation?.address ||
                        ""
                      }
                      InputProps={{ readOnly: true }}
                      variant="outlined"
                      size="small"
                    />
                  </div>
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
                      location={
                        hotelDetails?.hotel?.location ||
                        hotelDetails?.hotelInformation?.location
                      }
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



        <DialogActions sx={{ px: 4, py: 3, borderTop: "1px solid #e2e8f0", justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<MdMeetingRoom />}
            onClick={() => navigate(`/dashboard/hotels/${hotelDetails?.uid || hotelDetails?.hotel?.hotelUid}/rooms`)}
            sx={{
              borderRadius: "12px",
              fontWeight: 600,
              textTransform: "none"
            }}
          >
            Manage Rooms
          </Button>
          <Box>
            <Button
              onClick={handleClose}
              sx={{
                minWidth: "120px",
                borderRadius: "12px",
                textTransform: "none",
                fontWeight: 600,
                color: "#64748b",
                mr: 2,
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
          </Box>
        </DialogActions>
      </Dialog>

      {/* Edit Hotel Modal using AddHotelForm */}
      <Dialog
        open={editHotelModal}
        onClose={() => setEditHotelModal(false)}
        fullScreen
        PaperProps={{
          style: {
            backgroundColor: "#f8f9fa"
          }
        }}
      >
        <div className="relative">
          <IconButton
            onClick={() => setEditHotelModal(false)}
            sx={{ position: 'absolute', right: 20, top: 20, zIndex: 50, bgcolor: 'white', border: '1px solid #ccc' }}
          >
            <CloseIcon />
          </IconButton>
          <AddHotelForm
            initialData={selectedHotelForEdit}
            isEdit={true}
            onClose={() => setEditHotelModal(false)}
          />
        </div>
      </Dialog>
      <AddHotelSelectionModal
        open={openSelectionModal}
        onClose={() => setOpenSelectionModal(false)}
      />
    </div>
  );
};

export default Hotels;
