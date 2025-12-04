import CloseIcon from "@mui/icons-material/Close";
import RemoveRedEyeIcon from "@mui/icons-material/RemoveRedEye";
import {
  Box,
  Button,
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
import { useContext, useState } from "react";
import { format } from "timeago.js";
import Loading from "../../../../components/Loading";
import { successNotification } from "../../../../components/Notifications";
import PageHeading from "../../../../components/PageHeading";
import PendingPartnership from "../../../../components/PendingPartnership";
import { AuthContext } from "../../../../contextAPIs/AuthProvider";
import { RequirementContext } from "../../../../contextAPIs/RequirementsProvider";
import { travelRequirementsCollection } from "../../../../firebase/firebase.config";
import { item } from "../../../../utils/utils";

const MyDrivingRequirements = () => {
  const { isVerifiedPartner } = useContext(AuthContext);
  const { myRequirements } = useContext(RequirementContext);
  const [requirement, setRequirement] = useState({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [viewDetailsModal, setViewDetailsModal] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  if (!isVerifiedPartner) {
    return <PendingPartnership />;
  }

  const columns = [
    { id: "requirementTitle", label: "Title", width: 100 },
    { id: "date", label: "Task Assigned", width: 100 },
    {
      id: "status",
      label: "Status",
      width: 100,
    },
    {
      id: "action",
      label: "Action",
      width: 120,
    },
  ];

  // creating single row
  function createData(requirementTitle, date, isChecked, isCompleted, id) {
    return {
      requirementTitle,
      date,
      isChecked,
      isCompleted,
      id,
    };
  }

  // calling createData function with partner's data
  const rows = myRequirements?.map((requirement) => {
    return createData(
      requirement.requirementTitle,
      requirement.date,
      requirement.isChecked,
      requirement.isCompleted,
      requirement.id
    );
  });

  const handleChangeStatus = async (id) => {
    await updateDoc(doc(travelRequirementsCollection, id), {
      isCompleted: JSON.parse(isCompleted),
    }).then(() => {
      // setRefetchRequirement((p) => !p);

      successNotification(
        "The requirement status is changed successfully.",
        "success"
      );

      // setViewDetailsModal(false);
    });
  };

  const handleViewDetails = async (id) => {
    const res = await getDoc(doc(travelRequirementsCollection, id));
    setRequirement(res.data());
    setViewDetailsModal(true);
  };

  //
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const loadingContent = (
    <div className="md:h-[40vh] w-full flex items-center justify-center">
      <Loading />
    </div>
  );
  return (
    <div>
      <PageHeading text={"Requirments"} />
      <Paper sx={{ width: "100%", overflowX: "hidden" }}>
        <TableContainer sx={{ maxHeight: 440, maxWidth: "87vw" }}>
          {!myRequirements ? (
            loadingContent
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
                {rows
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
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
                            row["date"]?.seconds * 1000 +
                              row["date"]?.nanoseconds / 1000000
                          );
                          return (
                            <TableCell key={column.id} align="center">
                              {((value === "Incomplete" ||
                                value === "Pending" ||
                                value === "Completed") && (
                                <span
                                  className={`${
                                    (value === "Incomplete" &&
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
                                    <button
                                      onClick={() => handleViewDetails(row.id)}
                                      className="bg-[var(--primary-bg)] text-white p-1 rounded"
                                    >
                                      <RemoveRedEyeIcon />
                                    </button>
                                  </>
                                )) ||
                                value}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
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

      {/* modal  */}
      <Dialog
        open={viewDetailsModal}
        onClose={() => setViewDetailsModal(false)}
        aria-labelledby="responsive-dialog-title"
        // fullWidth
      >
        <Box>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            {item("Task Name", requirement?.requirementTitle)}
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

            <Grid container spacing={1}>
              {item("Client Location", requirement?.locationName)}
              {item("Clinet's Name", requirement?.clientName)}
              {item("Client's Phone", requirement?.clientNumber)}
              {item("Description", requirement?.requirementText, true)}
            </Grid>

            {/* <h3 className="text-xl font-bold">Location: </h3> */}
            {/* <div className=" w-full h-[300px]">
              {/* <Map
                isMarkerShown={true}
                locationURL={requirement?.locationURL}
              /> 
              <DirectionMap />
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
                    className="bg-[var(--primary-bg)] text-white rounded py-1 px-2 text-xs w-fit mt-2"
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
            <Button
              variant="contained"
              type="submit"
              autoFocus
              sx={{
                bgcolor: "var(--primary-bg)",
                color: "white",
                hover: "none",
              }}
              onClick={() => setViewDetailsModal(false)}
            >
              Close
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </div>
  );
};

export default MyDrivingRequirements;
