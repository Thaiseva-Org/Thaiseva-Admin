import {
  Box,
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
} from "@mui/material";
import { useContext, useEffect, useState } from "react";
import PageHeading from "../../../../components/PageHeading";
import { PartnerContext } from "../../../../contextAPIs/PartnerProvider";
import LoadingContent from "../../../../components/LoadingContent";
import {
  askingForDelete,
  dateCalculator,
  deleteNotification,
  successNotification,
} from "../../../../utils/utils";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { PDFDownloadLink } from "@react-pdf/renderer";
import Invoice from "../../../../components/reports/Invoice";
import { v4 as uuid } from "uuid";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { invoicesCollection } from "../../../../firebase/firebase.config";
import CloseIcon from "@mui/icons-material/Close";
import DeleteButton from "../../../../components/DeleteButton";
import SearchBar from "../../../../components/SearchBar";
import PartnerInvoice from "../../../../components/reports/PartnerInvoice";

const Invoices = () => {
  const { invoices, loadingData, contactInfo, setRefetch } =
    useContext(PartnerContext);
  const [matchedBillings, setMatchedBillings] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openModal, setOpenModal] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    paymentDate: "",
    invoiceDate: "",
    partnerUid: "",
    category: "Hotel",
    paymentTable: {
      commission: 0,
      totalCommission: 0,
      description: "",
      subTotal: 0,
      total: 0,
    },
    paymentTo: {
      partnerName: "",
      partnerPhone: "",
      partnerEmail: "",
      partnerAddress: "",
    },
    bankInfo: {
      accountNumber: "",
      address: "",
      bankName: "",
    },
  });

  useEffect(() => {
    invoices && setMatchedBillings(invoices);
  }, [invoices]);

  const columns = [
    { id: "partnerName", label: "Name", width: 100 },
    { id: "partnerPhone", label: "Phone", width: 100 },
    { id: "partnerEmail", label: "Email", width: 100 },
    { id: "total", label: "Paid Amount", width: 100 },
    { id: "date", label: "Date", width: 100 },
    { id: "category", label: "Category", width: 50 },
    { id: "action", label: "Action", width: 50 },
  ];

  // creating single row
  function createData(
    partnerName,
    partnerPhone,
    partnerEmail,
    total,
    date,
    category,
    invoiceId,
    invoice
  ) {
    return {
      partnerName,
      partnerPhone,
      partnerEmail,
      total,
      date,
      category,
      invoiceId,
      invoice,
    };
  }

  // calling createData function with partner's data
  const rows = matchedBillings?.map((billing) => {
    return createData(
      billing.paymentTo?.partnerName,
      billing.paymentTo?.partnerPhone,
      billing.paymentTo?.partnerEmail,
      billing.paymentTable?.total,
      billing.invoiceDate,
      billing.category,
      billing.invoiceId,
      billing
    );
  });

  const handleAddInvoice = async () => {
    const date = new Date();
    newInvoice.invoiceDate = date;
    newInvoice.partnerUid = "";
    newInvoice.paymentTable.totalCommission =
      newInvoice?.paymentTable?.subTotal *
      (newInvoice?.paymentTable?.commission / 100);
    // newInvoice.category = category;
    const id = uuid();

    await setDoc(doc(invoicesCollection, id), newInvoice).then(() => {
      successNotification("The invoice is sent successfully");
      setOpenModal(false);
      setRefetch((p) => !p);
      setNewInvoice({
        paymentDate: "",
        invoiceDate: "",
        partnerUid: "",
        category: "",
        paymentTable: {
          commission: 0,
          totalCommission: 0,
          description: "",
          subTotal: 0,
          total: 0,
        },
        paymentTo: {
          partnerName: "",
          partnerPhone: "",
          partnerEmail: "",
          partnerAddress: "",
        },
        bankInfo: {
          accountNumber: "",
          address: "",
          bankName: "",
        },
      });
    });
  };

  const handleCloseModal = () => {
    setOpenModal(false);
  };

  const handleDeleteInvoice = (id) => {
    // console.log(id);
    askingForDelete().then(async (result) => {
      if (result.isConfirmed) {
        await deleteDoc(doc(invoicesCollection, id)).then(() => {
          setRefetch((p) => !p);
          deleteNotification("The invoice is deleted successfully.");
        });
      }
    });
  };

  // const handleSearchByName = async (e) => {
  //   // const string = e.split(" ").join(",");
  //   const snap = await getDocs(
  //     query(invoicesCollection, where("paymentTo.partnerEmail", "==", e))
  //   );

  //   const list = snap.docs?.map((doc) => doc.data());
  //   console.log(list);
  // };

  const handleSearch = (text) => {
    const matchingObjects = invoices.filter(
      (invoice) =>
        invoice.paymentTo.partnerName
          .toLowerCase()
          .includes(text.toLowerCase()) ||
        invoice.paymentTo.partnerPhone.includes(text.toLowerCase()) ||
        invoice.paymentTo.partnerEmail
          .toLowerCase()
          .includes(text.toLowerCase())
    );

    setMatchedBillings(matchingObjects);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };
  return (
    <div>
      <PageHeading text="Billings" />

      {/* <Grid container spacing={0.5} sx={{ mb: 2, mt: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Search By Title"
            type="search"
            placeholder="Requirement's Title"
            fullWidth
            defaultValue=""
            onChange={(e) => handleSearchByName(e.target.value)}
          />
        </Grid>
      </Grid> */}
      {/* <div>
        <button
          onClick={() => setOpenModal(true)}
          className="add-new-btn my-4 ml-4"
        >
          Add Invoice
        </button>
      </div> */}

      <SearchBar
        handleSearch={handleSearch}
        handleOpenModal={setOpenModal}
        btnTitle="Add Invoice"
      />

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
                        {columns?.map((column) => {
                          let value = row[column.id];

                          return (
                            <TableCell key={column.id} align="center">
                              {(column?.id === "date" &&
                                dateCalculator(value)) ||
                                (column.id === "action" && (
                                  <div className="flex items-center justify-center gap-1">
                                    <PDFDownloadLink
                                      document={
                                        <PartnerInvoice
                                          invoice={row?.invoice}
                                          contactInfo={contactInfo}
                                        />
                                      }
                                      fileName="somename.pdf"
                                    >
                                      {({ loading }) =>
                                        loading ? (
                                          "Loading..."
                                        ) : (
                                          <button className="bg-[var(--primary-bg)] text-white p-1 rounded mr-1">
                                            <FileDownloadIcon />
                                          </button>
                                        )
                                      }
                                    </PDFDownloadLink>

                                    <div
                                      onClick={() =>
                                        handleDeleteInvoice(row.invoiceId)
                                      }
                                    >
                                      <DeleteButton />
                                    </div>
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
          count={rows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* add banner modal */}
      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        aria-labelledby="responsive-dialog-title"
      >
        <Box>
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            New Invoice
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
              {/* banner title */}

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Partner Name"
                  type="text"
                  value={newInvoice.paymentTo.partnerName}
                  onChange={(e) =>
                    setNewInvoice((p) => ({
                      ...p,
                      paymentTo: {
                        ...p.paymentTo,
                        partnerName: e.target.value,
                      },
                    }))
                  }
                  fullWidth
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Partner Address"
                  type="text"
                  value={newInvoice.paymentTo.partnerAddress}
                  onChange={(e) =>
                    setNewInvoice((p) => ({
                      ...p,
                      paymentTo: {
                        ...p.paymentTo,
                        partnerAddress: e.target.value,
                      },
                    }))
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Partner Phone"
                  type="text"
                  value={newInvoice.paymentTo.partnerPhone}
                  onChange={(e) =>
                    setNewInvoice((p) => ({
                      ...p,
                      paymentTo: {
                        ...p.paymentTo,
                        partnerPhone: e.target.value,
                      },
                    }))
                  }
                  fullWidth
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Partner Email"
                  type="text"
                  value={newInvoice.paymentTo.partnerEmail}
                  onChange={(e) =>
                    setNewInvoice((p) => ({
                      ...p,
                      paymentTo: {
                        ...p.paymentTo,
                        partnerEmail: e.target.value,
                      },
                    }))
                  }
                  fullWidth
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Description"
                  type="text"
                  placeholder="Invoice description"
                  value={newInvoice?.paymentTable?.description}
                  onChange={(e) =>
                    setNewInvoice((p) => ({
                      ...p,
                      paymentTable: {
                        ...p.paymentTable,
                        description: e.target.value,
                      },
                    }))
                  }
                  fullWidth
                />
              </Grid>

              <Grid item xs={12} sm={3}>
                <TextField
                  label="Sub total"
                  type="number"
                  placeholder="Sub total"
                  value={newInvoice?.paymentTable?.subTotal}
                  onChange={(e) =>
                    setNewInvoice((p) => ({
                      ...p,
                      paymentTable: {
                        ...p.paymentTable,
                        subTotal: e.target.value,
                        total:
                          e.target.value -
                          e.target.value * (p.paymentTable.commission / 100),
                      },
                    }))
                  }
                  fullWidth
                />
              </Grid>

              <Grid item xs={12} sm={3}>
                <TextField
                  label="Commission %"
                  type="number"
                  placeholder="Commission in %"
                  value={newInvoice?.paymentTable?.commission}
                  onChange={(e) =>
                    setNewInvoice((p) => ({
                      ...p,
                      paymentTable: {
                        ...p.paymentTable,
                        commission: e.target.value,
                        total:
                          p.paymentTable.subTotal -
                          p?.paymentTable?.subTotal * (e.target.value / 100),
                      },
                    }))
                  }
                  fullWidth
                />
              </Grid>

              <Grid item xs={12} sm={3}>
                <TextField
                  label="Total paid"
                  type="number"
                  value={newInvoice?.paymentTable?.total}
                  fullWidth
                />
                <span className="text-sm text-orange-400">{`${newInvoice?.paymentTable?.subTotal} - (${newInvoice?.paymentTable?.subTotal} * ${newInvoice?.paymentTable?.commission}%)`}</span>
              </Grid>

              <Grid item xs={12} sm={3}>
                <FormControl fullWidth>
                  <InputLabel id="service-category-label">
                    Service Category
                  </InputLabel>
                  <Select
                    labelId="service-category-label"
                    label="Service Category"
                    defaultValue="Hotel"
                    onChange={(e) =>
                      setNewInvoice((p) => ({ ...p, category: e.target.value }))
                    }
                  >
                    <MenuItem value="Hotel">Hotel</MenuItem>
                    <MenuItem value="Driving">Driving</MenuItem>
                    <MenuItem value="Local">Local</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Bank name"
                  type="text"
                  placeholder="Partner's bank name"
                  value={newInvoice?.bankInfo?.bankName}
                  onChange={(e) =>
                    setNewInvoice((p) => ({
                      ...p,
                      bankInfo: {
                        ...p.bankInfo,
                        bankName: e.target.value,
                      },
                    }))
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Account number"
                  type="text"
                  placeholder="Partner's account number"
                  value={newInvoice?.bankInfo?.accountNumber}
                  onChange={(e) =>
                    setNewInvoice((p) => ({
                      ...p,
                      bankInfo: {
                        ...p.bankInfo,
                        accountNumber: e.target.value,
                      },
                    }))
                  }
                  fullWidth
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Bank address"
                  type="text"
                  placeholder="Partner's bank address"
                  value={newInvoice?.bankInfo?.address}
                  onChange={(e) =>
                    setNewInvoice((p) => ({
                      ...p,
                      bankInfo: {
                        ...p.bankInfo,
                        address: e.target.value,
                      },
                    }))
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Payment date"
                  type="date"
                  onChange={(e) =>
                    setNewInvoice((p) => ({
                      ...p,
                      paymentDate: new Date(
                        e.target.value
                      ).toLocaleDateString(),
                    }))
                  }
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              type="submit"
              autoFocus
              sx={{
                backgroundColor: "var(--form-button-bg-color)",
                color: "white",
                "&:hover": {
                  backgroundColor: "var(--form-button-hover-bg-color)",
                },
              }}
              onClick={handleAddInvoice}
            >
              Add
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </div>
  );
};

export default Invoices;
