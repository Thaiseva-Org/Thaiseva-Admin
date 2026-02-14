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
  Paper,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from "@mui/material";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import { format } from "timeago.js";
import LoadingContent from "../../../../components/LoadingContent";
// import { successNotification } from "../../../../components/Notifications";
import PageHeading from "../../../../components/PageHeading";
import PendingPartnership from "../../../../components/PendingPartnership";
import UpdateButton from "../../../../components/UpdateButton";
import { AuthContext } from "../../../../contextAPIs/AuthProvider";
import { RequirementContext } from "../../../../contextAPIs/RequirementsProvider";
import { requirementsCollection } from "../../../../firebase/firebase.config";
import {
  fetchlocalPartnerRequirements,
  localPartnerRequirementsTotalPages,
} from "../../../../services/LocalRelated";
import { item, successNotification } from "../../../../utils/utils";

const MyLocalRequirements = () => {
  const { isVerifiedPartner, user } = useContext(AuthContext);
  const { myRequirements } = useContext(RequirementContext);
  const [requirement, setRequirement] = useState({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [viewDetailsModal, setViewDetailsModal] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [refetch, setRefetch] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isRealTime, setIsRealTime] = useState(true);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [matchedRequirements, setMatchedRequirements] = useState([]);

  if (!isVerifiedPartner) {
    return <PendingPartnership />;
  }

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
    if (!isRealTime && isVerifiedPartner) {
      localPartnerRequirementsTotalPages(
        setTotalPages,
        startDate,
        endDate,
        user.uid
      );
      fetchlocalPartnerRequirements(
        setMatchedRequirements,
        setLoading,
        user.uid,
        startDate,
        endDate,
        lastDocs,
        setLastDocs,
        rowsPerPage,
        page
      );
    }
  }, [isVerifiedPartner, user, page, rowsPerPage, isRealTime, refetch]);

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const columns = [
    { id: "requirementTitle", label: "Title", width: 100 },
    { id: "clientName", label: "Client's Name", width: 100 },
    { id: "clientNumber", label: "Client's Phone", width: 100 },
    { id: "date", label: "Task Assigned", width: 100 },
    { id: "status", label: "Status", width: 120 },
    { id: "action", label: "Action", width: 120 },
  ];

  // creating single row
  function createData(
    requirementTitle,
    clientName,
    clientNumber,
    isChecked,
    isCompleted,
    id,
    locationURL,
    date
  ) {
    return {
      requirementTitle,
      clientName,
      clientNumber,
      isChecked,
      isCompleted,
      id,
      locationURL,
      date,
    };
  }

  // calling createData function with partner's data
  const rows = (requirements) => {
    return requirements?.map((requirement) => {
      return createData(
        requirement.requirementTitle,
        requirement.clientName,
        requirement.clientNumber,
        requirement.isChecked,
        requirement.isCompleted,
        requirement.id,
        requirement?.locationURL,
        requirement.date
      );
    });
  };

  const handleChangeStatus = async (id) => {
    await updateDoc(doc(requirementsCollection, id), {
      isCompleted: JSON.parse(isCompleted),
    }).then(() => {
      setViewDetailsModal(false);
      successNotification("The requirement status is changed successfully.");
    });
  };

  const handleViewDetails = async (id) => {
    const res = await getDoc(doc(requirementsCollection, id));
    setRequirement(res.data());
    setViewDetailsModal(true);
  };

  return (
    <div>
      <PageHeading text={"Requirments"} />
      <div className="flex justify-end items-center mb-4">
        <div className="flex gap-2 flex-wrap">
          <form
            onSubmit={(e) => {
              handleDateRangeSubmit(e);
            }}
            className="flex items-end justify-between"
          >
            <fieldset className="px-2 pb-2 border border-black rounded-md">
              <legend className="px-1 text-sm">Start</legend>
              <input
                type="date"
                className="date-input w-[7.5rem] outline-none  bg-transparent"
                placeholder="Select date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                }}
                max={new Date().toISOString().split("T")[0]}
              />
            </fieldset>
            <p className="px-2 pt-1 m-auto"> to </p>
            <fieldset className="px-2 pb-2 border border-black rounded-md">
              <legend className="px-1 text-sm">End</legend>
              <input
                type="date"
                className="date-input w-[7.5rem] outline-none bg-transparent"
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

            <button
              type="submit"
              className="w-24 py-2 mb-1 ml-2 text-sm font-semibold text-white bg-orange-400 rounded hover:bg-orange-500 focus:outline-none focus:shadow-outline"
            >
              Apply
            </button>
          </form>
          <div className="mb-1 flex items-end">
            <button
              className={` py-2 px-4 rounded text-white font-semibold bg-orange-400 hover:bg-orange-500 focus:outline-none focus:shadow-outline text-sm`}
              onClick={() => {
                setIsRealTime(true), setStartDate(""), setEndDate("");
              }}
            >
              Show Realtime
            </button>
          </div>
        </div>
      </div>
      <Paper sx={{ width: "100%", overflowX: "hidden" }}>
        <TableContainer sx={{ maxHeight: 440, maxWidth: "87vw" }}>
          {loading ? (
            <LoadingContent />
          ) : (
            <Table stickyHeader aria-label="sticky table">
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      align="center"
                      style={{
                        width: column.width,
                        color: "var(--primary-bg)",
                        fontWeight: "bold",
                      }}
                    >
                      {column.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows(isRealTime ? myRequirements : matchedRequirements)
                  // .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row, i) => {
                    return (
                      <TableRow hover role="checkbox" tabIndex={-1} key={i}>
                        {columns.map((column) => {
                          let value = row[column.id];
                          if (column.id === "status") {
                            if (
                              row.isCompleted === false &&
                              row.isChecked === false
                            ) {
                              value = "Incomplete";
                            } else if (
                              row.isCompleted === true &&
                              row.isChecked === false
                            ) {
                              value = "Pending";
                            } else if (
                              row.isCompleted === true &&
                              row.isChecked === true
                            ) {
                              value = "Completed";
                            }
                          }

                          const date = new Date(
                            row["date"].seconds * 1000 +
                            row["date"].nanoseconds / 1000000
                          );
                          return (
                            <TableCell key={column.id} align="center">
                              {((value === "Incomplete" ||
                                value === "Pending" ||
                                value === "Completed") && (
                                  <span
                                    className={`${(value === "Incomplete" &&
                                        "bg-slate-400 text-black") ||
                                      (value === "Pending" && "bg-orange-500") ||
                                      (value === "Completed" && "bg-green-500")
                                      } text-white  py-1 px-2 rounded`}
                                  >
                                    {value}
                                  </span>
                                )) ||
                                (column?.id === "date" && format(date)) ||
                                (column.id === "action" && (
                                  <>
                                    {/* <button
                                      onClick={() => handleViewDetails(row.id)}
                                      className="bg-[blue] text-white p-1 rounded"
                                    >
                                      <RemoveRedEyeIcon />
                                    </button> */}
                                    <UpdateButton
                                      title={"acknowledge requirement"}
                                      handleEdit={() =>
                                        handleViewDetails(row.id)
                                      }
                                    />
                                  </>
                                )) ||
                                value}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                {(isRealTime ? myRequirements : matchedRequirements).length ===
                  0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className="w-full text-center my-5 light-text">
                          No Requirements
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
              </TableBody>
            </Table>
          )}
        </TableContainer>

        {!isRealTime && (
          <TablePagination
            rowsPerPageOptions={[10, 25, 100]}
            component="div"
            count={totalPages}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        )}
      </Paper>

      {/* modal  */}

      <Dialog
        open={viewDetailsModal}
        onClose={() => setViewDetailsModal(false)}
        aria-labelledby="responsive-dialog-title"
      >
        <Box>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            Task Details
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

            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              {item("Clinet's Name", requirement?.clientName)}
              {item("Client's Phone", requirement?.clientNumber)}
              {item("Client Location", requirement?.locationName)}
              {item("Location Url", requirement?.locationURL)}
              {item("Title", requirement?.requirementTitle)}
              {item("Description", requirement?.requirementText, true)}
            </Grid>

            {/* <h3 className="text-xl font-bold">Location: </h3>
            <div className=" w-full">
              <Map
                isMarkerShown={true}
                locationURL={requirement?.locationURL}
              />
              <a>{requirement.locationURL}</a>
            </div> */}

            {requirement?.isChecked ? (
              <p className="bg-green-500 text-center py-1 rounded text-white my-3">
                The task was completed
              </p>
            ) : (
              <div>
                {requirement?.isCompleted &&
                  requirement?.isChecked === false && (
                    <p className="bg-orange-500 text-center p-1 rounded text-white my-3 text-sm">
                      Admin is validating the requirement. Still, you can change
                      the status.
                    </p>
                  )}
                <div className="flex flex-col">
                  <FormControl>
                    <FormLabel className="mt-2">Is it completed?</FormLabel>
                    <RadioGroup
                      name="controlled-radio-buttons-group"
                      defaultValue={requirement.isCompleted}
                      onChange={(e) => setIsCompleted(e.target.value)}
                    >
                      <FormControlLabel
                        value={false}
                        control={<Radio />}
                        label="Incomplete"
                      />
                      <FormControlLabel
                        value={true}
                        control={<Radio />}
                        label="Completed"
                      />
                    </RadioGroup>
                  </FormControl>
                  <button
                    className="bg-[var(--primary-bg)] text-white rounded py-1 px-2 w-fit mt-2"
                    onClick={() => handleChangeStatus(requirement.id)}
                    disabled={requirement.isChecked}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <button
              // variant="contained"
              type="submit"
              autoFocus
              className="add-new-btn"
              // sx={{ bgcolor: "blue", color: "white", hover: "none" }}
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

export default MyLocalRequirements;
