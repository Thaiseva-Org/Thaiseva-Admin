import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  IconButton,
  Radio,
  RadioGroup,
  TablePagination,
  Typography,
} from "@mui/material";
import { deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import { CSVLink } from "react-csv";
import DeleteButton from "../../../../components/DeleteButton";
import LoadingContent from "../../../../components/LoadingContent";
import PageHeading from "../../../../components/PageHeading";
import ViewDetailsIcon from "../../../../components/ViewDetailsIcon";
import { AuthContext } from "../../../../contextAPIs/AuthProvider";
import { RequirementContext } from "../../../../contextAPIs/RequirementsProvider";
import {
  requirementsCollection,
  serviceCategoriesDoc,
} from "../../../../firebase/firebase.config";
import {
  fetchAlllocalRequirements,
  fetchlocalRequirements,
  localReuirementsTotalPages,
} from "../../../../services/LocalRelated";
import { askingForDelete, deleteNotification } from "../../../../utils/utils";

const LocalRequirements = () => {
  const {
    allRequirements,
    // setRefetch,
    queryCategory,
    setQueryCategory,
    loadingReq,
  } = useContext(RequirementContext);
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const [requirement, setRequirement] = useState({});
  // const [queryStatus, setQueryStatus] = useState("Total");
  const [csvData, setCsvData] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [viewDetailsModal, setViewDetailsModal] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [refetch, setRefetch] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isRealTime, setIsRealTime] = useState(true);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);
  const [loading, setLoading] = useState(loadingReq);
  // const [totalQuantity, setTotalQuantity] = useState([]);
  // const [completedQuantity, setCompletedQuantity] = useState(0);
  // const [pendingQuantity, setPendingQuantity] = useState(0);
  // const [notYetQuantity, setNotYetQuantity] = useState(0);

  const [matchedRequirements, setMatchedRequirements] = useState([]);

  // useEffect(() => {
  //   if (queryStatus === "Total") {
  //     setMatchedRequirements(allRequirements); // data is coming form requirement context provider
  //   }

  //   // Getting the quantity of completed task
  //   const completedQuantity = allRequirements.filter(
  //     (item) => item.isChecked === true
  //   );
  //   // Getting the quantity of pending task
  //   const pendingQuantity = allRequirements.filter(
  //     (item) => item.isChecked === false && item.isCompleted === true
  //   );
  //   // Getting the quantity of not Yet task
  //   const notYetQuantity = allRequirements.filter(
  //     (item) => item.isChecked === false && item.isCompleted === false
  //   );

  //   setTotalQuantity(allRequirements.length); // number of total task
  //   setCompletedQuantity(completedQuantity.length); // number of completed task
  //   setPendingQuantity(pendingQuantity.length); // number of pending task
  //   setNotYetQuantity(notYetQuantity.length); // number of not yet task

  //   // Getting completed task
  //   if (queryStatus === "Completed") {
  //     const completedTasks = allRequirements.filter(
  //       (item) => item.isChecked === true
  //     );
  //     setMatchedRequirements(completedTasks);
  //   }

  //   // Getting pending task
  //   if (queryStatus === "Pending") {
  //     const pendingTasks = allRequirements.filter(
  //       (item) => item.isChecked === false && item.isCompleted === true
  //     );
  //     setMatchedRequirements(pendingTasks);
  //   }

  //   // Getting not yet task
  //   if (queryStatus === "Incomplete") {
  //     const notYetTasks = allRequirements.filter(
  //       (item) => item.isCompleted === false
  //     );
  //     setMatchedRequirements(notYetTasks);
  //   }
  // }, [allRequirements, queryStatus]);

  const handleDateRangeSubmit = (event) => {
    event.preventDefault();
    if (endDate == "") {
      alert("Please select both start and end!!");
      return;
    }
    setPage(0);
    setLastDocs([]);
    setRefetch((p) => !p);
    setIsRealTime(false);
  };

  useEffect(() => {
    if (!isRealTime && (isAdmin || isSubAdmin)) {
      localReuirementsTotalPages(
        setTotalPages,
        startDate,
        endDate,
        queryCategory
      );
      fetchlocalRequirements(
        setMatchedRequirements,
        setLoading,
        queryCategory,
        startDate,
        endDate,
        lastDocs,
        setLastDocs,
        rowsPerPage,
        page
      );
    }
  }, [
    isAdmin,
    isSubAdmin,
    page,
    rowsPerPage,
    isRealTime,
    refetch,
    queryCategory,
  ]);

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const columns = [
    { id: "requirementTitle", label: "Title", width: "20%" },
    {
      id: "providerPhone",
      label: "Provider's\u00a0Phone",
      width: "20%",
    },
    {
      id: "serviceCategory",
      label: "Service\u00a0Category",
      width: "18%",
    },
    {
      id: "date",
      label: "Task Assigned",
      width: "18%",
    },
    {
      id: "status",
      label: "Status",
      width: "12%",
    },
    {
      id: "action",
      label: "Action",
      width: "12%",
    },
  ];

  // creating single row
  function createData(
    requirementTitle,
    providerPhone,
    serviceCategory,
    isChecked,
    isCompleted,
    id,
    date
  ) {
    let value;
    if (isCompleted === false && isChecked === false) {
      value = "Incomplete";
    } else if (isCompleted === true && isChecked === false) {
      value = "Pending";
    } else if (isCompleted === true && isChecked === true) {
      value = "Completed";
    }

    const timestamp = new Date(
      date?.seconds * 1000 + date?.nanoseconds / 1000000
    );

    return {
      requirementTitle,
      providerPhone,
      serviceCategory,
      isChecked,
      isCompleted,
      id,
      status: value,
      date: timestamp.toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    };
  }

  // calling createData function with partner's data
  const rows = (bookings) => {
    return bookings.map((requirement) => {
      return createData(
        requirement.requirementTitle,
        requirement.providerPhone,
        requirement.serviceCategory,
        requirement.isChecked,
        requirement.isCompleted,
        requirement.id,
        requirement?.date
      );
    });
  };

  const handleViewDetails = async (id) => {
    const res = await getDoc(doc(requirementsCollection, id));
    setRequirement(res.data());
    setViewDetailsModal(true);
  };

  const handleChangeStatus = async (id) => {
    await updateDoc(doc(requirementsCollection, id), {
      isChecked: JSON.parse(isChecked),
    }).then(() => {
      setViewDetailsModal(false);
      if (!isRealTime) setRefetch((p) => !p);
    });
  };

  // const handleChangePage = (event, newPage) => {
  //   setPage(newPage);
  // };

  // const handleChangeRowsPerPage = (event) => {
  //   setRowsPerPage(+event.target.value);
  //   setPage(0);
  // };

  /* =============================================================
                serach functionalities start
    =============================================================*/
  // const handleSearchByTitle = (text) => {
  //   const matchingObjects = allRequirements.filter((item) =>
  //     item.requirementTitle.toLowerCase().includes(text.toLowerCase())
  //   );
  //   setMatchedRequirements(matchingObjects);
  // };

  // const handleSearchByServiceArea = (text) => {
  //   const matchingObjects = allRequirements.filter((item) =>
  //     item.serviceArea.toLowerCase().includes(text.toLowerCase())
  //   );

  //   setMatchedRequirements(matchingObjects);
  // };

  // const handleSearchByPhone = (text) => {
  //   const matchingObjects = allRequirements.filter((item) =>
  //     item.providerPhone.includes(text)
  //   );

  //   setMatchedRequirements(matchingObjects);
  // };

  // const handleSearch = (text) => {
  //   const matchingObjects = allRequirements.filter(
  //     (item) =>
  //       item.requirementTitle.toLowerCase().includes(text.toLowerCase()) ||
  //       item.serviceCategory.toLowerCase().includes(text.toLowerCase()) ||
  //       item.providerPhone.includes(text)
  //   );

  //   setMatchedRequirements(matchingObjects);
  // };
  /* =============================================================
                serach functionalities end
    =============================================================*/

  // deleting the requirement
  const handleDeleteRequirement = (id) => {
    askingForDelete().then(async (result) => {
      if (result.isConfirmed) {
        await deleteDoc(doc(requirementsCollection, id)).then(() => {
          deleteNotification("The Requirement is deleted successfully.");
        });
      }
    });
  };

  const [serviceCategories, setServiceCategories] = useState([]);

  useEffect(() => {
    const fetchServiceCategories = async () => {
      await getDoc(serviceCategoriesDoc).then((snapshot) => {
        const data = snapshot.data();
        setServiceCategories([
          "All",
          ...data.categories.map((cat) => cat.title),
          "Others",
        ]);
      });
    };
    fetchServiceCategories();
  }, []);

  const createExportData = async (startDate, endDate) => {
    const rawData = await fetchAlllocalRequirements(startDate, endDate);
    const data = rawData.map((item) => {
      return createData(
        item.requirementTitle,
        item.providerPhone,
        item.serviceCategory,
        item.isChecked,
        item.isCompleted,
        item.id,
        item?.date
      );
    });
    setCsvData(data);
    return data;
  };

  const headers = [
    { label: "Requirement Title", key: "requirementTitle" },
    { label: "Provider Contact", key: "providerPhone" },
    { label: "Service Category", key: "serviceCategory" },
    { label: "Status", key: "status" },
    { label: "Date", key: "date" },
  ];

  const handleDownload = async () => {
    if (startDate == "" || endDate == "") {
      alert("Please select both start and end dates!!");
      return;
    }
    setIsDownloading(true);
    const data = await createExportData(startDate, endDate);
    setCsvData(data);
    setIsDownloading(false);
  };

  const fileName = `Bookings _from_${startDate}_to_${endDate}.csv`;

  const item = (label, value, is12) => {
    return (
      <Grid item xs={12} sm={is12 ? 12 : 6} fullWidth>
        <p className="">
          <span className="font-bold">{label}: </span>
          <span className="text-slate-600"> {value}</span>
        </p>
      </Grid>
    );
  };

  return (
    <div className="animate-fade-in">
      <PageHeading
        text="Local Requirements"
        subtitle="Manage customer requirements and service requests"
        icon="📋"
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium mb-1">
                Total Requirements
              </p>
              <p className="text-3xl font-bold">
                {(isRealTime ? allRequirements : matchedRequirements).length}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">📋</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-success-500 to-success-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-success-100 text-sm font-medium mb-1">
                Completed
              </p>
              <p className="text-3xl font-bold">
                {
                  (isRealTime ? allRequirements : matchedRequirements).filter(
                    (r) => r.isChecked === true
                  ).length
                }
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
                {
                  (isRealTime ? allRequirements : matchedRequirements).filter(
                    (r) => r.isCompleted === true && r.isChecked === false
                  ).length
                }
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">⏳</span>
            </div>
          </div>
        </div>
      </div>

      {/* Date Filter and Export Section */}
      <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-4 mb-6">
        <div className="flex justify-between items-center gap-4 flex-wrap">
          <h3 className="text-lg font-semibold text-neutral-700 flex items-center gap-2">
            <span>📆</span> Filter & Export
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <form
              onSubmit={(e) => {
                handleDateRangeSubmit(e);
              }}
              className="flex items-end gap-2 flex-wrap"
            >
              <fieldset className="px-3 pb-2 border-2 border-neutral-300 rounded-lg hover:border-primary-400 transition-colors">
                <legend className="px-2 text-sm font-medium text-neutral-600">
                  Start Date
                </legend>
                <input
                  type="date"
                  className="date-input w-[7.5rem] outline-none bg-transparent text-neutral-700"
                  placeholder="Select date"
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                  }}
                  max={new Date().toISOString().split("T")[0]}
                />
              </fieldset>
              <span className="text-neutral-500 font-medium pb-2">to</span>
              <fieldset className="px-3 pb-2 border-2 border-neutral-300 rounded-lg hover:border-primary-400 transition-colors">
                <legend className="px-2 text-sm font-medium text-neutral-600">
                  End Date
                </legend>
                <input
                  type="date"
                  className="date-input w-[7.5rem] outline-none bg-transparent text-neutral-700"
                  placeholder="Select date"
                  value={endDate}
                  onChange={(event) => {
                    if (startDate == "") {
                      alert("Please Select Start Date First!!");
                      return;
                    }
                    setEndDate(event.target.value);
                  }}
                  min={startDate}
                  max={new Date().toISOString().split("T")[0]}
                />
              </fieldset>

              <button type="submit" className="btn-gradient-primary">
                Apply Filter
              </button>
            </form>

            <button
              type="button"
              className="btn-gradient-secondary"
              onClick={() => {
                setIsRealTime(true), setStartDate(""), setEndDate("");
              }}
            >
              Show Realtime
            </button>

            {!csvData ? (
              <button
                className="px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-success-500 to-success-600 text-white hover:shadow-lg transition-all duration-200"
                onClick={handleDownload}
              >
                {isDownloading ? "Generating..." : "Generate CSV"}
              </button>
            ) : (
              <CSVLink
                className="px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-success-500 to-success-600 text-white hover:shadow-lg transition-all duration-200 inline-block"
                data={csvData}
                onClick={() => setCsvData(null)}
                headers={headers}
                filename={fileName}
              >
                Export CSV
              </CSVLink>
            )}
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-4 mb-6">
        <h3 className="text-sm font-semibold text-neutral-600 mb-3">
          Filter by Category
        </h3>
        <div className="flex gap-2 flex-wrap">
          {serviceCategories.map((serviceCategory, i) => (
            <button
              key={i}
              onClick={() => setQueryCategory(serviceCategory)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${queryCategory === serviceCategory
                  ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md scale-105"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
            >
              {serviceCategory}
            </button>
          ))}
        </div>
      </div>
      {/* <Grid container spacing={0.5} sx={{ mb: 2, mt: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By Title"
            type="search"
            placeholder="Requirement's Title"
            fullWidth
            defaultValue=""
            onChange={(e) => handleSearchByTitle(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {" "}
          <TextField
            label="Search By Service Area"
            type="search"
            placeholder="Type Location"
            fullWidth
            defaultValue=""
            onChange={(e) => handleSearchByServiceArea(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {" "}
          <TextField
            label="Search By Provider's Phone"
            type="search"
            placeholder="Provider's Phone"
            fullWidth
            defaultValue=""
            onChange={(e) => handleSearchByPhone(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By Requirement Id"
            type="search"
            placeholder="Type Requirement Id"
            fullWidth
            defaultValue=""
            onChange={(e) => handleSearchByServiceArea(e.target.value)}
          />
        </Grid>
      </Grid> */}

      {/* <div className="flex flex-wrap gap-1 justify-between md:pr-4 mb-1">
        <button
          className={`py-1 px-2 rounded text-sm ${
            queryStatus === "Total"
              ? "bg-[var(--primary-bg)] text-white"
              : "bg-gray-300"
          }`}
          onClick={() => setQueryStatus("Total")}
        >
          Total : {totalQuantity}
        </button>
        <button
          className={`py-1 px-2 rounded text-sm ${
            queryStatus === "Completed"
              ? "bg-[var(--primary-bg)] text-white"
              : "bg-gray-300"
          }`}
          onClick={() => setQueryStatus("Completed")}
        >
          Completed : {completedQuantity}
        </button>
        <button
          className={`py-1 px-2 rounded text-sm ${
            queryStatus === "Pending"
              ? "bg-[var(--primary-bg)] text-white"
              : "bg-gray-300"
          }`}
          onClick={() => setQueryStatus("Pending")}
        >
          Pending : {pendingQuantity}
        </button>
        <button
          className={`py-1 px-2 rounded text-sm ${
            queryStatus === "Incomplete"
              ? "bg-[var(--primary-bg)] text-white"
              : "bg-gray-300"
          }`}
          onClick={() => setQueryStatus("Incomplete")}
        >
          Incomplete : {notYetQuantity}
        </button>
      </div> */}
      {/* Requirements Table */}
      <div className="bg-white rounded-xl shadow-md border border-neutral-200 overflow-hidden">
        {loading ? (
          <LoadingContent />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.id}
                        className="px-4 py-4 text-center text-sm font-semibold"
                        style={{ width: column.width }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {(isRealTime ? allRequirements : matchedRequirements)
                    .length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <span className="text-6xl opacity-50">📋</span>
                          <p className="text-neutral-500 font-medium">
                            No Requirements Found
                          </p>
                          <p className="text-neutral-400 text-sm">
                            Customer requirements will appear here
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows(
                      isRealTime ? allRequirements : matchedRequirements
                    ).map((row, i) => {
                      return (
                        <tr
                          key={i}
                          className="hover:bg-primary-50 transition-colors duration-150"
                        >
                          {columns.map((column) => {
                            let value = row[column.id];

                            return (
                              <td
                                key={column.id}
                                className="px-4 py-4 text-center text-sm"
                              >
                                {value === "Incomplete" ||
                                  value === "Pending" ||
                                  value === "Completed" ? (
                                  <span
                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${value === "Incomplete"
                                        ? "bg-neutral-200 text-neutral-700"
                                        : value === "Pending"
                                          ? "bg-warning-100 text-warning-700"
                                          : "bg-success-100 text-success-700"
                                      }`}
                                  >
                                    {value === "Incomplete" && "⚪ "}
                                    {value === "Pending" && "⏳ "}
                                    {value === "Completed" && "✓ "}
                                    {value}
                                  </span>
                                ) : column.id === "action" ? (
                                  <div className="flex items-center justify-center gap-2">
                                    {(row["isChecked"] ||
                                      row["isCompleted"] !== true) && (
                                        <div
                                          onClick={() =>
                                            handleDeleteRequirement(row.id)
                                          }
                                        >
                                          <DeleteButton title="Delete Requirement" />
                                        </div>
                                      )}
                                    <div
                                      onClick={() => handleViewDetails(row.id)}
                                    >
                                      <ViewDetailsIcon title="View Requirement's details" />
                                    </div>
                                  </div>
                                ) : column.id === "serviceCategory" ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700">
                                    {value}
                                  </span>
                                ) : column.id === "providerPhone" ? (
                                  <span className="text-neutral-600 font-mono">
                                    {value}
                                  </span>
                                ) : (
                                  <span className="text-neutral-700 font-medium">
                                    {value}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!isRealTime && (
              <div className="border-t border-neutral-200">
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
                      padding: "12px 16px",
                    },
                    "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows":
                    {
                      color: "#6B7280",
                      fontWeight: 500,
                    },
                    "& .MuiTablePagination-select": {
                      borderRadius: "8px",
                      padding: "4px 8px",
                      border: "1px solid #E5E7EB",
                      "&:hover": {
                        backgroundColor: "#F3F4F6",
                      },
                    },
                    "& .MuiTablePagination-actions button": {
                      borderRadius: "8px",
                      padding: "4px",
                      "&:hover": {
                        backgroundColor: "#EFF6FF",
                      },
                    },
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* View Details Modal */}
      <Dialog
        open={viewDetailsModal}
        onClose={() => setViewDetailsModal(false)}
        aria-labelledby="responsive-dialog-title"
        fullWidth
      >
        <Box>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            <Typography variant="div">
              <span className="font-semibold ">Category : </span>{" "}
              <span className="bg-[var(--primary-bg)] text-white font-bold py-1 px-2 rounded inline-block text-base">
                {requirement?.serviceCategory}
              </span>
            </Typography>
          </DialogTitle>
          <IconButton
            aria-label="close"
            onClick={() => setViewDetailsModal(false)}
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
            {/* personal information */}

            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }} fullWidth>
              {item("Task Name", requirement?.requirementTitle)}
              {item("Service Name", requirement?.serviceName)}
              {item("Provider", requirement?.providerName)}
              {item("Provider Phone", requirement?.providerPhone)}
              {item("Client Location", requirement?.locationName)}
              {item("Clinet's Name", requirement?.clientName)}
              {item("Client's Phone", requirement?.clientNumber)}
              {item("Description", requirement?.requirementText, true)}
            </Grid>

            {requirement.isChecked ? (
              <p className="bg-green-500 text-center py-1 rounded text-white my-3">
                The task was completed
              </p>
            ) : (
              <div className="">
                {requirement.isCompleted && (
                  <p className="bg-orange-500 text-center p-1 rounded text-white my-3 text-sm">
                    The service provider has completed this task. Confirm the
                    task after asking the client.
                  </p>
                )}
                <div className="flex flex-col">
                  <FormControl>
                    {requirement.isCompleted && (
                      <>
                        <FormLabel className="mt-2">Verify the task</FormLabel>
                        <RadioGroup
                          name="controlled-radio-buttons-group"
                          defaultValue={requirement.isChecked}
                          onChange={(e) => setIsChecked(e.target.value)}
                        >
                          <FormControlLabel
                            value={true}
                            control={<Radio />}
                            label="Checked"
                          />
                        </RadioGroup>
                      </>
                    )}
                  </FormControl>
                  <button
                    className="bg-[var(--primary-bg)] text-white rounded py-1 px-2 w-fit mt-2"
                    onClick={() => handleChangeStatus(requirement.id)}
                    disabled={
                      requirement.isChecked || requirement.isCompleted === false
                    }
                  >
                    {requirement.isCompleted ? "Confirm" : "Not Completed"}
                  </button>
                </div>
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <button
              type="submit"
              autoFocus
              className="add-new-btn"
              onClick={() => setViewDetailsModal(false)}
            >
              Close
            </button>
          </DialogActions>
        </Box>
      </Dialog>
    </div>
  );
};

export default LocalRequirements;
