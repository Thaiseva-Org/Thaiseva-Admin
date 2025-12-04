import CloseIcon from "@mui/icons-material/Close";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
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
  TextField,
} from "@mui/material";
import { PDFDownloadLink } from "@react-pdf/renderer";
import {
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import { v4 as uuid } from "uuid";
import { PartnerContext } from "../contextAPIs/PartnerProvider";
import { invoicesCollection } from "../firebase/firebase.config";
import {
  askingForDelete,
  dateCalculator,
  deleteNotification,
  successNotification,
} from "../utils/utils";
import DeleteButton from "./DeleteButton";
import LoadingContent from "./LoadingContent";
import Invoice from "./reports/Invoice";
import { AuthContext } from "../contextAPIs/AuthProvider";

const PartnerInvoices = ({ partnerUid, paymentTo, category }) => {
  const { isAdmin } = useContext(AuthContext);
  const [openModal, setOpenModal] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const { setLoadingData, loadingData, contactInfo, setRefetch, refetch } =
    useContext(PartnerContext);
  const [newInvoice, setNewInvoice] = useState({
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

  useEffect(() => {
    paymentTo && setNewInvoice((p) => ({ ...p, paymentTo: paymentTo }));
  }, [paymentTo]);

  useEffect(() => {
    const loadInvoices = async () => {
      setLoadingData(true);
      const snap = await getDocs(
        query(invoicesCollection, where("partnerUid", "==", partnerUid))
      );
      const partner = snap.docs.map((doc) => doc.data());

      if (partner) {
        setInvoices(partner);
        setLoadingData(false);
      }
    };

    partnerUid && loadInvoices();
  }, [partnerUid, setLoadingData, refetch]);

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
  const rows = invoices?.map((invoice) => {
    return createData(
      invoice.paymentTo?.partnerName,
      invoice.paymentTo?.partnerPhone,
      invoice.paymentTo?.partnerEmail,
      invoice.paymentTable?.total,
      invoice.invoiceDate,
      invoice.category,
      invoice.invoiceId,
      invoice
    );
  });

  const handleAddInvoice = async () => {
    const date = new Date();
    const id = uuid();
    newInvoice.invoiceDate = date;
    newInvoice.partnerUid = partnerUid;
    newInvoice.paymentTable.totalCommission =
      newInvoice?.paymentTable?.subTotal *
      (newInvoice?.paymentTable?.commission / 100);
    newInvoice.category = category;
    newInvoice.invoiceId = id;

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
    askingForDelete().then(async (result) => {
      if (result.isConfirmed) {
        await deleteDoc(doc(invoicesCollection, id)).then(() => {
          setRefetch((p) => !p);
          deleteNotification("The invoice is deleted successfully.");
        });
      }
    });
  };

  return (
    <div className="bg-white">
      {isAdmin && (
        <button
          onClick={() => setOpenModal(true)}
          className="add-new-btn my-4 ml-4"
        >
          Add Invoice
        </button>
      )}
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
                {rows.map((row, i) => {
                  return (
                    <TableRow hover role="checkbox" tabIndex={-1} key={i}>
                      {columns?.map((column) => {
                        let value = row[column.id];

                        return (
                          <TableCell key={column.id} align="center">
                            {(column?.id === "date" && dateCalculator(value)) ||
                              (column.id === "action" && (
                                <div className="flex items-center justify-center gap-1">
                                  <PDFDownloadLink
                                    document={
                                      <Invoice
                                        invoice={row?.invoice}
                                        contactInfo={contactInfo}
                                      />
                                    }
                                    fileName="invoice.pdf"
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
                  InputProps={{
                    readOnly: paymentTo.partnerName,
                  }}
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
                  InputProps={{
                    readOnly: paymentTo.partnerAddress,
                  }}
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
                  InputProps={{
                    readOnly: paymentTo.partnerPhone,
                  }}
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
                  InputProps={{
                    readOnly: paymentTo.partnerEmail,
                  }}
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

              <Grid item xs={12} sm={4}>
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

              <Grid item xs={12} sm={4}>
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

              <Grid item xs={12} sm={4}>
                <TextField
                  label="Total paid"
                  type="number"
                  value={newInvoice?.paymentTable?.total}
                  fullWidth
                />
                <span className="text-sm text-orange-400">{`${newInvoice?.paymentTable?.subTotal} - (${newInvoice?.paymentTable?.subTotal} * ${newInvoice?.paymentTable?.commission}%)`}</span>
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
                bgcolor: "var(--primary-bg)",
                color: "white",
                hover: "none",
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

export default PartnerInvoices;
