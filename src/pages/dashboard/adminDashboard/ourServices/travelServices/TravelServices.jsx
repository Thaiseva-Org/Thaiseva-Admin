import {
  TablePagination,
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
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
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
import ViewDetailsIcon from "./../../../../../components/ViewDetailsIcon";

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
    { id: "description", label: "Description", width: "30%" },
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
    id
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
      service.id
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

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(event.target.value);
    setPage(0);
  };

  const handleAddNewPackage = () => {
    navigate("add");
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

        <div className="bg-gradient-to-br from-secondary-500 to-secondary-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary-100 text-sm font-medium mb-1">
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

      <div className="flex gap-4 items-center justify-between">
        <div className="flex-grow">
          <SearchBar
            handleSearch={handleSearch}
            handleOpenModal={handleAddNewPackage}
            btnTitle="Add New Package"
          />
        </div>
      </div>

      {/* Modern Table Container */}
      <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          {loadingServices ? (
            loadingContent
          ) : (
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
                {rows.map((row, i) => {
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
                              <div className="flex gap-2 items-center justify-center">
                                <button
                                  onClick={() => handleViewPackage(row.id)}
                                  className="p-2 hover:bg-primary-100 rounded-lg transition-colors"
                                  title="View Details"
                                >
                                  <ViewDetailsIcon />
                                </button>
                                <button
                                  onClick={() => handleDeletePackage(row.id)}
                                  className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                                  title="Delete package"
                                >
                                  <DeleteForeverIcon />
                                </button>
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
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12">
                      <div className="flex flex-col items-center justify-center text-neutral-400">
                        <span className="text-6xl mb-4">🗺️</span>
                        <p className="text-lg font-medium text-neutral-500">
                          No Packages Found
                        </p>
                        <p className="text-sm text-neutral-400 mt-2">
                          Create your first sightseeing package.
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
      </div>
    </div>
  );
};

export default TravelServices;
