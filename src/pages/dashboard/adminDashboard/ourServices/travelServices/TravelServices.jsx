import {
  TablePagination,
  IconButton,
  Tooltip,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  ToggleButtonGroup,
  ToggleButton,
  Grid,
  Typography,
  Box,
  InputAdornment,
  TextField,
  Button
} from "@mui/material";
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
} from "firebase/firestore";
import { MdEdit, MdDelete, MdInfo } from "@icons";
import { GridView, ViewList, AccessTime, LocationOn, MonetizationOn, Star, Search } from "@icons";
import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Loading from "../../../../../components/Loading";
import PageHeading from "../../../../../components/PageHeading";
import SearchBar from "../../../../../components/SearchBar";
import { AuthContext } from "../../../../../contextAPIs/AuthProvider";
import {
  db,
  travelServicesCollection,
  travelServicesDetailsCollection,
} from "../../../../../firebase/firebase.config";
import {
  askingForDelete,
  deleteNotification,
} from "../../../../../utils/utils";

import SightseeingSettingsModal from "./SightseeingSettingsModal";
import { MdSettings } from "@icons";

const TravelServices = () => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const navigate = useNavigate();
  const [travelServices, setTravelServices] = useState([]);
  const [matchedTravelServices, setMatchedTravelServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [refetch, setRefetch] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);

  const [viewMode, setViewMode] = useState('list');

  // fetching all services
  const fetchTotalPages = async () => {
    let q = query(travelServicesCollection, orderBy("timestamp", "desc"));
    const querySnapshot = await getCountFromServer(q);
    setTotalPages(Math.ceil(querySnapshot.data().count));
  };

  const fetchData = async () => {
    setLoadingServices(true);
    let q = query(
      travelServicesCollection,
      orderBy("timestamp", "desc"),
      limit(rowsPerPage)
    );

    if (page > 0 && lastDocs[page - 1]) {
      q = query(
        travelServicesCollection,
        orderBy("timestamp", "desc"),
        startAfter(lastDocs[page - 1]),
        limit(rowsPerPage)
      );
    }
    const querySnapshot = await getDocs(q);
    const newData = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    const lastDoc =
      querySnapshot.docs.length > 0
        ? querySnapshot.docs[querySnapshot.docs.length - 1]
        : null;
    setLastDocs((prev) => {
      const updated = [...prev];
      updated[page] = lastDoc;
      return updated;
    });
    setTravelServices(newData);
    setMatchedTravelServices(newData);
    setLoadingServices(false);
  };
  useEffect(() => {
    if (isAdmin || isSubAdmin) {
      fetchTotalPages();
      fetchData();
    }
  }, [isAdmin, isSubAdmin, refetch, page, rowsPerPage]);

  const columns = [
    { id: "title", label: "Title", width: "20%" },
    {
      id: "location",
      label: "Location",
      width: "10%",
    },
    {
      id: "period",
      label: "Period",
      width: "10%",
    },
    {
      id: "maxBookingsPerWeek",
      label: "Capacity/Week",
      width: "10%",
    },
    {
      id: "price",
      label: "Price",
      width: "10%",
    },
    {
      id: "discount",
      label: "Discount",
      width: "10%",
    },
    {
      id: "action",
      label: "Action",
      width: "10%",
    },
  ];

  // creating single row
  function createData(
    title,
    description,
    location,
    period,
    price,
    discount,
    rating,
    id,
    coverPhoto,
    maxBookingsPerWeek
  ) {
    return {
      title,
      description,
      location,
      period,
      price,
      discount,
      rating,
      id,
      coverPhoto,
      maxBookingsPerWeek
    };
  }

  // calling createData function with driver's data
  const rows = matchedTravelServices.map((service) => {
    return createData(
      service.title,
      service.description,
      service.location,
      service.period,
      service.price,
      service.discount,
      service.rating,
      service.id,
      service.coverPhoto || service.images?.[0] || 'https://via.placeholder.com/300x200?text=No+Image',
      service.maxBookingsPerWeek || 200
    );
  });

  const handleSearch = (text) => {
    const matchingObjects = travelServices.filter(
      (item) =>
        item.location.toLowerCase().includes(text.toLowerCase()) ||
        item.title.toLowerCase().includes(text.toLowerCase())
    );

    setMatchedTravelServices(matchingObjects);
  };

  const renderPackageList = (packageRows, title) => {
    if (packageRows.length === 0) return null; // Or show empty message if preferred, but filtering removes noise

    return (
      <div className="mb-8">
        {title && (
          <Typography variant="h6" className="text-gray-800 font-bold mb-4 flex items-center gap-2">
            {title} <span className="text-sm font-normal text-gray-500">({packageRows.length})</span>
          </Typography>
        )}
        <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            {viewMode === 'list' ? (
              <table className="w-full">
                <thead className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                  <tr>
                    {columns.map((column) => (
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
                  {packageRows.map((row, i) => {
                    return (
                      <tr
                        key={i}
                        className="hover:bg-primary-50 transition-colors duration-200"
                      >
                        {columns.map((column) => {
                          let value = row[column.id];
                          return (
                            <td key={column.id} className="px-6 py-4 text-center">
                              {column.id === "action" ? (
                                <div className="flex items-center justify-center gap-2">
                                  <Tooltip title="Edit Package">
                                    <IconButton
                                      onClick={() => handleViewPackage(row.id)}
                                      sx={{
                                        color: '#f59e0b',
                                        '&:hover': { bgcolor: '#fffbeb' },
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      <MdEdit size={20} />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Delete Package">
                                    <IconButton
                                      onClick={() => handleDeletePackage(row.id)}
                                      sx={{
                                        color: '#ef4444',
                                        '&:hover': { bgcolor: '#fef2f2' },
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      <MdDelete size={20} />
                                    </IconButton>
                                  </Tooltip>
                                </div>
                              ) : column.id === "price" ? (
                                <span className="font-semibold text-success-600">
                                  ฿{value}
                                </span>
                              ) : column.id === "discount" ? (
                                <span className="inline-flex items-center justify-center w-12 h-12 bg-secondary-100 text-secondary-700 rounded-full font-semibold">
                                  {value}%
                                </span>
                              ) : column.id === "period" ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-primary-100 text-primary-700">
                                  {value} days
                                </span>
                              ) : column.id === "location" ? (
                                <span className="inline-flex items-center gap-1 text-sm text-neutral-700">
                                  <span>📍</span> {value}
                                </span>
                              ) : column.id === "description" ? (
                                <span className="text-sm text-neutral-600 line-clamp-2">
                                  {value}
                                </span>
                              ) : (
                                <span className="text-sm text-neutral-700 font-medium">
                                  {value}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-6 bg-neutral-50">
                <Grid container spacing={3}>
                  {packageRows.map((row) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={row.id}>
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
                          image={row.coverPhoto}
                          alt={row.title}
                          sx={{ height: 200, objectFit: 'cover' }}
                        />
                        <Box sx={{ position: 'absolute', top: 12, right: 12, bgcolor: 'rgba(255,255,255,0.95)', borderRadius: '20px', px: 1.5, py: 0.5, display: 'flex', alignItems: 'center', gap: 0.5, boxShadow: 1 }}>
                          <Star sx={{ color: '#fbbf24', fontSize: 16 }} />
                          <Typography variant="body2" fontWeight="700" color="text.primary">{row.rating || 4.5}</Typography>
                        </Box>
                        <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
                          <Typography variant="h6" fontWeight="700" gutterBottom noWrap title={row.title} sx={{ mb: 1 }}>
                            {row.title}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mb: 2 }}>
                            <LocationOn sx={{ fontSize: 18, color: 'error.main' }} />
                            <Typography variant="body2" noWrap>{row.location}</Typography>
                          </Box>
                          <div className="flex justify-between items-center mt-4">
                            <Typography variant="h6" color="primary.main" fontWeight="800">
                              ฿{row.price && row.price.toLocaleString()}
                            </Typography>
                            {row.discount > 0 && (
                              <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-full">
                                {row.discount}% OFF
                              </span>
                            )}
                          </div>
                        </CardContent>
                        <div className="border-t border-gray-100 p-3 flex justify-between items-center bg-gray-50">
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => handleViewPackage(row.id)} sx={{ color: '#f59e0b', bgcolor: 'white', border: '1px solid #f3f4f6', '&:hover': { bgcolor: '#fffbeb', borderColor: '#fcd34d' } }}>
                                <MdEdit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" onClick={() => handleDeletePackage(row.id)} sx={{ color: '#ef4444', bgcolor: 'white', border: '1px solid #f3f4f6', '&:hover': { bgcolor: '#fef2f2', borderColor: '#fca5a5' } }}>
                                <MdDelete />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          <Typography variant="caption" sx={{ bgcolor: 'secondary.main', color: 'white', px: 1.5, py: 0.5, borderRadius: 4, fontWeight: 'medium' }}>
                            {row.period} days
                          </Typography>
                        </div>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleAddNewPackage = () => {
    navigate("/dashboard/travel-services/add");
  };

  const handleViewPackage = (id) => {
    navigate(`edit/${id}`);
  };

  const handleDeletePackage = async (id) => {
    try {
      // const result = await askingForDelete();
      // if (result.isConfirmed) {
      if (window.confirm("Are you sure you want to delete this package?")) {
        await deleteDoc(doc(travelServicesCollection, id));
        await deleteDoc(doc(travelServicesDetailsCollection, id));

        deleteNotification("The Package is deleted successfully.");
        setRefetch((p) => !p);
      }
      // }
    } catch (error) {
      console.error("Error deleting package:", error);
      alert(`Failed to delete package: ${error.message}`);
    }
  };

  const loadingContent = (
    <div className="md:h-[40vh] w-full flex items-center justify-center">
      <Loading />
    </div>
  );

  return (
    <div className="animate-fade-in">
      <PageHeading
        text="Sightseeing Packages"
        subtitle="Manage tour packages and travel services"
        icon="🗺️"
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium mb-1">
                Total Packages
              </p>
              <p className="text-3xl font-bold">
                {matchedTravelServices.length}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">🗺️</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-success-500 to-success-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-success-100 text-sm font-medium mb-1">
                Active Tours
              </p>
              <p className="text-3xl font-bold">
                {matchedTravelServices.length}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">✅</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium mb-1">
                Locations
              </p>
              <p className="text-3xl font-bold">
                {new Set(matchedTravelServices.map((s) => s.location)).size}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">📍</span>
            </div>
          </div>
        </div>
      </div >

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
            height: '52px', // Match Search input height aprox
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
            placeholder="Search here..."
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
            onClick={handleAddNewPackage}
          >
            <span className="text-xl">+</span> Add New Package
          </button>
        </div>
      </div>

      {/* Modern Table Container */}
      <div>
        {loadingServices ? (
          loadingContent
        ) : (
          <>
            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-neutral-400 py-12 bg-white rounded-2xl border border-neutral-200">
                <span className="text-6xl mb-4">🗺️</span>
                <p className="text-lg font-medium text-neutral-500">No Packages Found</p>
                <p className="text-sm text-neutral-400 mt-2 mb-4">Create your first sightseeing package.</p>
                <button
                  onClick={handleAddNewPackage}
                  className="px-6 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-xl shadow-md transition-all active:scale-95"
                >
                  + Add Sightseeing Package
                </button>
              </div>
            ) : (
              renderPackageList(rows)
            )}
          </>
        )}
      </div>    {/* Modern Pagination */}
      <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-4">
        <TablePagination
          rowsPerPageOptions={[10, 25, 100]}
          component="div"
          count={totalPages}
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

      <SightseeingSettingsModal
        open={openSettingsModal}
        onClose={() => setOpenSettingsModal(false)}
      />
    </div >
  );
};

export default TravelServices;
