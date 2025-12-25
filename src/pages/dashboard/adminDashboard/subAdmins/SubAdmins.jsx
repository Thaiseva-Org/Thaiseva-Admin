/* eslint-disable no-unused-vars */
import { useContext, useState } from "react";
import { useEffect } from "react";
import {
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  query,
  setDoc,
  startAfter,
  where,
} from "firebase/firestore";
import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
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
} from "@mui/material";
import { useForm } from "react-hook-form";
import { app, usersCollection } from "../../../../firebase/firebase.config";
import { AuthContext } from "../../../../contextAPIs/AuthProvider";
import PageHeading from "../../../../components/PageHeading";
import Loading from "../../../../components/Loading";
import { deleteFile, getFileUrl } from "../../../../utils/utils";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import DeleteButton from "../../../../components/DeleteButton";
import SearchBar from "../../../../components/SearchBar";

const auth = getAuth(app);

const SubAdmins = () => {
  const { isAdmin, updateUserProfile, validatePassword } =
    useContext(AuthContext);
  const [subAdmins, setSubAdmins] = useState([]);
  const [refetch, setRefetch] = useState(true);
  const [matchedAdmins, setMatchedAdmins] = useState([]);
  const [error, setError] = useState({ for: "", text: "" });
  const [loadingServices, setLoadingServices] = useState(false);
  const [photoURL, setPhotoURL] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openModal, setOpenModal] = useState(false); // Add requirement modal
  const [adminUser, setAdminUser] = useState(auth.currentUser);
  const { handleSubmit, reset, register } = useForm();

  useEffect(() => {
    setMatchedAdmins(subAdmins);
  }, [subAdmins]);

  useEffect(() => {
    const fetchTotalPages = async () => {
      let q = query(usersCollection, where("role", "==", "Sub Admin"));
      const pages = await getCountFromServer(q);
      setTotalPages(Math.ceil(pages.data().count));
    };
    fetchTotalPages();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoadingServices(true);
      let q = query(
        usersCollection,
        where("role", "==", "Sub Admin"),
        limit(rowsPerPage)
      );
      if (page > 0 && lastDocs[page - 1]) {
        q = query(
          usersCollection,
          where("role", "==", "Sub Admin"),
          startAfter(lastDocs[page - 1]),
          limit(rowsPerPage)
        );
      }
      try {
        const res = await getDocs(q);
        const list = res.docs.map((doc) => doc.data());
        const lastDoc =
          res.docs.length > 0 ? res.docs[res.docs.length - 1] : null;
        setLastDocs((prev) => {
          const updated = [...prev];
          updated[page] = lastDoc;
          return updated;
        });
        setSubAdmins(list);
      } catch (error) {
        console.error("Error loading Sub Admins:", error);
        setSubAdmins([]);
      } finally {
        setLoadingServices(false);
      }
    };
    isAdmin && loadData();
  }, [isAdmin, refetch, page, rowsPerPage]);

  const columns = [
    { id: "photoURL", label: "Profile", width: 150 },
    {
      id: "displayName",
      label: "Name",
      width: 100,
    },
    {
      id: "email",
      label: "Email",
      width: 70,
    },
    {
      id: "password",
      label: "Password",
      width: 50,
    },
    {
      id: "action",
      label: "Action",
      width: 50,
    },
  ];

  // creating single row
  function createData(photoURL, displayName, email, password, uid) {
    return { photoURL, displayName, email, password, uid };
  }

  // calling createData function with driver's data
  const rows = matchedAdmins.map((admin) => {
    return createData(
      admin.photoURL,
      admin.displayName,
      admin.email,
      admin.password,
      admin.uid
    );
  });

  /* =============================================================
              serach functionalities start
  =============================================================*/
  // const handleSearchByName = (text) => {
  //   const matchingObjects = subAdmins.filter((admin) =>
  //     admin.displayName.toLowerCase().includes(text.toLowerCase())
  //   );
  //   setMatchedAdmins(matchingObjects);
  // };

  // const handleSearchByEmail = (text) => {
  //   const matchingObjects = subAdmins.filter((admin) =>
  //     admin.email.toLowerCase().includes(text.toLowerCase())
  //   );

  //   setMatchedAdmins(matchingObjects);
  // };

  const handleSearch = (text) => {
    const matchingObjects = subAdmins.filter(
      (admin) =>
        admin.email.toLowerCase().includes(text.toLowerCase()) ||
        admin.displayName.toLowerCase().includes(text.toLowerCase())
    );

    setMatchedAdmins(matchingObjects);
  };

  /* =============================================================
              serach functionalities end
  =============================================================*/

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(event.target.value);
    setPage(0);
  };

  /* =============================================================
              Add New Sub Admin start
  =============================================================*/
  const handleOpenModal = () => {
    reset();
    setError({ for: "", text: "" });
    setOpenModal(true);
  };

  // opening AddPackagesModal the modal while cliking on right sign icon
  const handleCloseModal = () => {
    reset();
    setPhotoURL("");

    setOpenModal(false);
  };

  // storing admin data in the database
  const handleAddSubAdmin = async (data) => {
    setError({ for: "", text: "" });
    const { email, password, displayName } = data;

    if (!displayName) {
      // console.log("Please provide username");
      setError({ for: "displayName", text: "Please provide username" });
      return;
    }
    if (!email) {
      // console.log("Please provide email");
      setError({ for: "email", text: "Please provide email" });
      return;
    }
    if (password) {
      const res = validatePassword(password);
      if (res !== "valid") {
        // console.log("Please provide valid password");
        setError({ for: "password", text: res });
        return;
      }
    }

    if (!photoURL) {
      return setError({
        for: "photoURL",
        text: "Please select a profile picture",
      });
    }

    // Create sub-admin account
    await createUserWithEmailAndPassword(auth, email, password)
      .then(async (result) => {
        const createdSubAdmin = result.user;

        // adding users data to the useres collection
        await setDoc(doc(usersCollection, createdSubAdmin.uid), {
          email: email,
          displayName,
          password,
          photoURL,
          role: "Sub Admin",
          uid: createdSubAdmin.uid,
        });
        await updateUserProfile(displayName, photoURL);
        handleCloseModal();
        setRefetch((p) => !p);
      })
      .catch((error) => {
        if (error.code === "auth/email-already-in-use") {
          // console.log(err)
          setError({
            for: "email",
            text: "This email is already in use. Please log in.",
          });
        } else if (error.code === "auth/weak-password") {
          setError({ for: "password", text: "Password is too weak." });
        } else if (error.code === "auth/network-request-failed") {
          setError({
            for: "common",
            text: "Network error. Please check your internet connection.",
          });
        } else {
          console.error(error);
          setError({
            for: "common",
            text: "An unexpected error occurred. Please try again.",
          });
        }
      });

    // Sign in as the main admin after creating the sub-admin
    await auth.updateCurrentUser(adminUser);
    // await signInWithEmailAndPassword(
    //   auth,
    //   localStorage.getItem("email"),
    //   localStorage.getItem("password")
    // ); // todo:
  };
  /* =============================================================
              Add New Sub Admin end
  =============================================================*/

  // delete package
  const handleDeleteSubAdmin = async (uid, photoURL) => {
    try {
      if (confirm("Are you sure? You won't be able to revert this!")) {
        await deleteFile(photoURL);
        await deleteDoc(doc(usersCollection, uid));
        alert("User Deleted Successfully");
        setRefetch((p) => !p);
      }
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  // upload cover photo
  const handleUploadPhotoURL = async (e) => {
    const { files } = e.target;
    setError({ for: "", text: "" });
    setError({
      for: "photoURL",
      text: "Picture is uploading...",
    });
    const result = await getFileUrl(files);
    if (result?.error) {
      setError({ for: "photoURL", text: result.message });
    } else {
      setPhotoURL(result.url);
      setError({
        for: "photoURL",
        text: "Picture is uploaded successfully.",
      });
    }
  };

  // custom text field for common data
  const textField = (label, name, placeholder, defaultValue) => {
    return (
      <Grid item xs={12} sm={6}>
        <TextField
          label={label}
          type="text"
          error={error.for === name}
          helperText={
            error.for === name ? (
              <span className="text-red-500 text-sm">{error.text}</span>
            ) : (
              ""
            )
          }
          defaultValue={defaultValue && defaultValue}
          placeholder={placeholder}
          autoComplete="off"
          fullWidth
          {...register(name, { required: true })}
        />
        {/* {errors?.name && (
          <span className="text-red-500 text-sm">{label} is required</span>
        )}
        {error.for === name && (
          <span className="text-red-500 text-sm">{error.text}</span>
        )} */}
      </Grid>
    );
  };

  const loadingContent = (
    <div className="md:h-[40vh] w-full flex items-center justify-center">
      <Loading />
    </div>
  );

  return (
    <div>
      <PageHeading text="Sub Admins" />

      {/* <Grid container spacing={0.5} sx={{ mb: 2, mt: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By Name"
            type="search"
            placeholder="Admin Name"
            fullWidth
            onChange={(e) => handleSearchByName(e.target.value)}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By Email"
            type="search"
            placeholder="Admin Email"
            fullWidth
            onChange={(e) => handleSearchByEmail(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={6}>
          <div className="text-right md:pr-10 mb-4 flex items-center justify-end h-full">
            <button
              onClick={handleOpenModal}
              className="py-1 px-2 rounded bg-[var(--primary-bg)] text-white"
            >
              Add Sub Admin
            </button>
          </div>
        </Grid>
      </Grid> */}

      <SearchBar
        btnTitle="Add Sub Admin"
        handleSearch={handleSearch}
        handleOpenModal={handleOpenModal}
      />

      <Paper sx={{ width: "100%", overflowX: "hidden" }}>
        <TableContainer>
          {loadingServices ? (
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
                {rows.map((row, i) => {
                  return (
                    <TableRow hover role="checkbox" tabIndex={-1} key={i}>
                      {columns.map((column) => {
                        let value = row[column.id];
                        return (
                          <TableCell key={column.id} align="center">
                            {(column.id === "action" && (
                              <div className="flex gap-1 items-center justify-center">
                                <div
                                  onClick={() =>
                                    handleDeleteSubAdmin(row.uid, row.photoURL)
                                  }
                                >
                                  <DeleteButton />
                                </div>
                              </div>
                            )) ||
                              (column.id === "photoURL" && (
                                <div className="flex items-center justify-center">
                                  {" "}
                                  <img
                                    loading="lazy"
                                    src={value}
                                    className="w-10 h-10 lg:w-16 lg:h-16  rounded-full"
                                  />
                                </div>
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
          count={totalPages}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Add requirement modal */}
      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        aria-labelledby="responsive-dialog-title"
      >
        <Box component="form" onSubmit={handleSubmit(handleAddSubAdmin)}>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            Add New Sub Admin
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
              {/* Email */}
              {textField("Email", "email", "New subadmin Email")}

              {/* Password */}
              {textField("Password", "password", "Set subadmin Password")}

              {/* Name */}
              {textField("Name", "displayName", "New subadmin Name")}

              <Grid item xs={12} sm={6}>
                <TextField
                  label={"Select cover photo"}
                  type="file"
                  defaultValue=""
                  // error={error.for === "photoURL"}
                  helperText={
                    error.for === "photoURL" && (
                      <span
                        className={` text-sm ${(error?.text.includes("select") && "text-red-500") ||
                          (error?.text.includes("uploading") &&
                            "text-orange-500") ||
                          (error?.text.includes("success") && "text-green-500")
                          }`}
                      >
                        {error.text}
                      </span>
                    )
                  }
                  onChange={handleUploadPhotoURL}
                  placeholder=""
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
                {/* {error.for === "photoURL" && (
                  <span
                    className={` text-sm ${
                      (error?.text.includes("select") && "text-red-500") ||
                      (error?.text.includes("uploading") &&
                        "text-orange-500") ||
                      (error?.text.includes("success") && "text-green-500")
                    }`}
                  >
                    {error.text}
                  </span>
                )} */}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              type="submit"
              disabled={!photoURL}
              autoFocus
              sx={{
                backgroundColor: "var(--form-button-bg-color)",
                color: "white",
                "&:hover": {
                  backgroundColor: "var(--form-button-hover-bg-color)",
                },
              }}
            >
              Add
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </div>
  );
};

export default SubAdmins;
