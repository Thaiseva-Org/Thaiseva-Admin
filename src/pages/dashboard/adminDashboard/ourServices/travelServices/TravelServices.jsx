import ListingStatus, { StatusBadge, StatusFilters, StatusSummary } from "../../../../../components/ListingStatus";
import { useListingStatus } from "../../../../../hooks/useListingStatus";
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
  deleteDoc,
  doc,
  onSnapshot,
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
  const [matchedTravelServices, setMatchedTravelServices] = useState([]);
  const visibility = useListingStatus('tour', matchedTravelServices);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const navigate = useNavigate();
  const [travelServices, setTravelServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(20);

  const [viewMode, setViewMode] = useState('list');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "sightseeingConfig"), (snap) => {
      if (snap.exists()) {
        const val = snap.data().globalDailyLimit;
        if (val !== undefined) setDailyLimit(val);
      }
    }, (err) => console.warn("Failed to listen to sightseeingConfig:", err));
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (!(isAdmin || isSubAdmin)) return;
    setLoadingServices(true);
    return onSnapshot(travelServicesCollection, (snapshot) => {
      const records = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      records.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setTravelServices(records);
      setMatchedTravelServices(records);
      setLoadingServices(false);
    }, () => setLoadingServices(false));
  }, [isAdmin, isSubAdmin]);
  const statusTours = matchedTravelServices.map((record) => ({ ...record, isActive: visibility.resolve(record) })).filter((record) =>
    [record.title, record.location].some((value) => String(value || '').toLowerCase().includes(searchText)));
  const handleTogglePackageActive = (packageId, currentStatus) => visibility.toggle(travelServices.find((record) => record.id === packageId), !currentStatus);

  const columns = [
    { id: "visibility", label: "Status", width: "15%" },
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
  const filteredTours = statusTours.filter((record) => statusFilter === 'all' || record.isActive === (statusFilter === 'active'));
  const rows = filteredTours.slice(page * rowsPerPage, (page + 1) * rowsPerPage).map((service) => ({ ...service, coverPhoto: service.coverPhoto || service.images?.[0] }));
  const handleSearch = (text) => { setSearchText(String(text || '').toLowerCase().trim()); setPage(0); };

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
                              {column.id === "visibility" ? (
 <ListingStatus active={row.isActive} disabled={visibility.pending[row.id]} onChange={() => handleTogglePackageActive(row.id, row.isActive)} label={`Visibility of ${row.title}`} />
 ) : column.id === "action" ? (
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
                        <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 1 }}><StatusBadge active={row.isActive} /></Box>
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
                        <div className="border-t border-gray-100 p-3 flex flex-wrap gap-2 justify-between items-center bg-gray-50">
 <ListingStatus active={row.isActive} disabled={visibility.pending[row.id]} onChange={() => handleTogglePackageActive(row.id, row.isActive)} label={`Visibility of ${row.title}`} />
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

      <StatusSummary
        records={statusTours}
        noun="Tours"
        activeFilter={statusFilter}
        onSelectFilter={(value) => {
          setStatusFilter(value);
          setPage(0);
        }}
      />
      <StatusFilters records={statusTours} value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(0); }} />
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
            type="button"
            className="px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
            onClick={() => setOpenSettingsModal(true)}
            title="Update Daily Tour-Date Booking Limit"
          >
            <MdSettings className="text-xl" />
            <span>Daily Limit: <span className="bg-white/20 px-2 py-0.5 rounded-md font-bold">{dailyLimit}</span></span>
          </button>

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
          count={filteredTours.length}
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
