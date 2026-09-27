import { useContext, useEffect } from "react";
import { useState } from "react";
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
  TableRow,
} from "@mui/material";
import { CloseIcon } from "@icons";
import { doc, getDoc } from "firebase/firestore";
import { restaurentsCollection } from "../../../../../firebase/firebase.config";
import PageHeading from "../../../../../components/PageHeading";
import LoadingContent from "../../../../../components/LoadingContent";
import { PartnerContext } from "../../../../../contextAPIs/PartnerProvider";
import ViewDetailsIcon from "../../../../../components/ViewDetailsIcon";
import SearchBar from "../../../../../components/SearchBar";

const FoodServices = () => {
  const { foodMenu, loadingData } = useContext(PartnerContext);
  const [openModal, setOpenModal] = useState(false); //Add service modal
  const [matchedMenu, setMatchedMenu] = useState([]);
  const [menuDetails, setMenuDetails] = useState({
    id: "",
    restaurantName: "",
    menuName: "",
    price: "",
    description: "",
    address: "",
    keywords: "",
    ratings: "",
    numberOfReviews: "",
  });

  useEffect(() => {
    setMatchedMenu(foodMenu);
  }, [foodMenu]);

  // Partners table header
  let columns = [
    { property: "name", label: "Name", width: 130 },
    { property: "price", label: "Price", width: 50 },
    { property: "restaurantName", label: "Restaurant Name", width: 50 },
    { property: "phone", label: "Phone", width: 30 },
    { property: "action", label: "Action", width: 120 },
  ];

  // creating single row
  function createData(name, price, restaurantName, email, phone, id) {
    return {
      name,
      price,
      restaurantName,
      email,
      phone,
      id,
    };
  }

  // calling createData function with partner's data
  const rows = matchedMenu?.map((menu) => {
    return createData(
      menu.name,
      menu.price,
      menu.restaurantName,
      menu.email,
      menu.phone,
      menu.id
    );
  });

  /* =============================================================
              Add Menu functionalities start
  =============================================================*/

  // opening AddPackagesModal the modal while cliking on right sign icon
  const handleCloseModal = () => {
    setMenuDetails({
      id: "",
      restaurantName: "",
      name: "",
      price: "",
      description: "",
      coupon: "",
      address: "",
    });
    setOpenModal(false);
  };

  /* =============================================================
              Add Menu functionalities end
  =============================================================*/

  /* =============================================================
              serach functionalities start
  =============================================================*/
  // const handleSearchByMenuName = (text) => {
  //   const matchingObjects = foodMenu.filter((item) =>
  //     item.name.toLowerCase().includes(text.toLowerCase())
  //   );
  //   setMatchedMenu(matchingObjects);
  // };

  // const handleSearchByRestaurantName = (text) => {
  //   const matchingObjects = foodMenu.filter((item) =>
  //     item.restaurantName.toLowerCase().includes(text.toLowerCase())
  //   );
  //   setMatchedMenu(matchingObjects);
  // };

  const handleSearch = (text) => {
    const matchingObjects = foodMenu.filter(
      (item) =>
        item.restaurantName.toLowerCase().includes(text.toLowerCase()) ||
        item.name.toLowerCase().includes(text.toLowerCase())
    );
    setMatchedMenu(matchingObjects);
  };

  /* =============================================================
              serach functionalities end
  =============================================================*/

  // upadate package
  const handleViewmenuDetails = async (email, itemId) => {
    const snapshot = await getDoc(doc(restaurentsCollection, email));
    if (snapshot.exists()) {
      const existingData = snapshot.data();
      if (existingData) {
        const { items } = existingData;
        const menu = items.find((item) => item.id === itemId);
        setMenuDetails({
          ...menu,
          email: existingData.email,
          restaurantName: existingData.name,
          keywords: existingData?.keywords,
          address: existingData?.address,
          phone: existingData?.phone,
        });
        setOpenModal(true);
      }
    }
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
          </p>
        </div>
      </Grid>
    );
  };

  return (
    <div>
      <PageHeading text="Added Menus" />

      {/* <Grid container spacing={1} sx={{ mb: 2, mt: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By Menu Name"
            type="search"
            InputLabelProps={{ shrink: true }}
            placeholder="Menu Name"
            fullWidth
            onChange={(e) => handleSearchByMenuName(e.target.value)}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By Restaurant Name"
            type="search"
            placeholder="Restaurant Name"
            fullWidth
            onChange={(e) => handleSearchByRestaurantName(e.target.value)}
          />
        </Grid>
      </Grid> */}

      <SearchBar handleSearch={handleSearch} btn={false} />
      <div className="flex items-center justify-between  md:pr-3 mb-2">
        <p className="my-2 font-bold">{foodMenu.length} menu added</p>
      </div>
      <Paper sx={{ width: "100%", overflowX: "hidden" }}>
        <TableContainer sx={{ maxHeight: 440, maxWidth: "87vw" }}>
          {loadingData ? (
            <LoadingContent />
          ) : (
            <Table stickyHeader aria-label="sticky table">
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      key={column.property}
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
                        const value = row[column.property];
                        return (
                          <TableCell key={column.property} align="center">
                            {(column.property === "action" && (
                              <div className="flex gap-1 items-center justify-center">
                                <div
                                  onClick={() =>
                                    handleViewmenuDetails(row.email, row.id)
                                  }
                                >
                                  <ViewDetailsIcon title="View Details" />
                                </div>
                              </div>
                            )) ||
                              (column.property === "price" && `฿${value}`) ||
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
      </Paper>

      {/* Add and Update Package modal */}
      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        aria-labelledby="responsive-dialog-title"
      >
        <Box>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            {menuDetails?.name}
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
              <Grid item xs={12} sm={6}>
                <img src={menuDetails?.photo} alt="" className="h-44 w-full" />
              </Grid>
              {textField("Price", menuDetails?.price)}
              {textField("Address", menuDetails?.address)}
              {textField("Email", menuDetails?.email)}
              {textField("Keywords", menuDetails?.keywords)}
              {textField("Restaurant Name", menuDetails?.restaurantName)}
              {textField("Phone", menuDetails?.phone)}
              {/* {textField("Coupon", menuDetails?.coupon)} */}
              {textField("Description", menuDetails?.description)}
            </Grid>
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
              onClick={() => setOpenModal(false)}
            >
              Close
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </div>
  );
};

export default FoodServices;
