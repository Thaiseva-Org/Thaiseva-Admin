import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
  Box,
  Button,
  IconButton,
  Tooltip,
  TextField,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  AppBar,
  Toolbar
} from "@mui/material";
import { useState, useEffect, useContext, useOptimistic, useTransition } from "react";
import LoadingContent from "../../../../components/LoadingContent";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import RemoveRedEyeIcon from "@mui/icons-material/RemoveRedEye";
import {
  CalendarMonth,
  MonetizationOn,
  Delete,
  Category,
  FilterList,
  CloudDownload,
  CheckCircle,
  Close as CloseIcon,
} from "@mui/icons-material";
import {
  fetchBookingsTotalPages,
  fetchTodayBooking,
  handleClear,
} from "../../../../services/DailyRecords";
import { ensureInvoiceIdForBooking } from "../../../../services/invoiceService";

import { PartnerContext } from "../../../../contextAPIs/PartnerProvider";
import { AuthContext } from "../../../../contextAPIs/AuthProvider";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { logo, newlogo1 } from "../../../../assets";

const TodayBookings = () => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const { contactInfo } = useContext(PartnerContext);

  // State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);
  const [refetch, setRefetch] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    // Default to 1 week ago to ensure recent bookings (e.g. yesterday) are visible by default
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [queryCategory, setQueryCategory] = useState("Sightseeing Bookings");
  const [loadingReq, setLoadingReq] = useState(false);
  const [matchedRequirements, setMatchedRequirements] = useState([]);

  // Transitions & Optimistic UI
  const [isPending, startTransition] = useTransition();
  const [isDownloading, setIsDownloading] = useState(false);
  const [processingInvoiceId, setProcessingInvoiceId] = useState(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);

  // Optimistic State for Requirements
  const [optimisticRequirements, setOptimisticRequirements] = useOptimistic(
    matchedRequirements,
    (currentRequirements, updatedId) => {
      return currentRequirements.map((req) =>
        req.id === updatedId ? { ...req, isPaymentClear: true } : req
      );
    }
  );

  const generatePdfBlob = async (row) => {
    try {
      const doc = new jsPDF();
      const invoice = row.userInvoce;

      // --- COLOR PALETTE (Based on User's HTML) ---
      const COLORS = {
        primary: [30, 58, 138],    // #1e3a8a (Thaiseva Blue)
        darkBg: [15, 23, 42],      // #0f172a (Slate-900 - Header BG)
        slate800: [30, 41, 59],
        slate600: [71, 85, 105],
        slate500: [100, 116, 139],
        slate400: [148, 163, 184],
        slate100: [241, 245, 249],
        emeraldText: [52, 211, 153],  // Emerald-300
        emeraldBg: [6, 78, 59],       // Emerald-900 (Darker for contrast on dark bg)
        blueAccent: [59, 130, 246]    // Blue-500
      };

      // ================= HEADER =================
      // Full width dark header
      doc.setFillColor(...COLORS.primary); // Using primary blue instead of slate-900 for brand consistency, or could use darkBg
      doc.rect(0, 0, 210, 50, 'F');

      // --- Logo ---
      try {
        // Logo with whitespace fallback container
        doc.setFillColor(255, 255, 255);
        // Wider box to accommodate landscape logo aspect ratio
        doc.roundedRect(14, 10, 60, 28, 2, 2, 'F');

        // Image adjusted to "real size" fit (assuming landscape)
        doc.addImage(logo, 'JPEG', 15, 11, 58, 26);
      } catch (e) {
        // fallback
        doc.setFontSize(8); doc.text("TS", 16, 17);
      }

      // Removed "Thaiseva" and "Premium Transport Services" text as requested

      // --- PAID Badge (Top Right) ---
      doc.setFillColor(16, 185, 129); // Emerald-500
      doc.roundedRect(175, 10, 20, 7, 3, 3, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("PAID", 185, 14.5, { align: "center" });

      // Invoice ID
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("INVOICE NO:", 196, 21, { align: "right" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`#${row.customerInvoiceId || row.id || "0000"}`, 196, 26, { align: "right" });



      // ================= CONTENT AREA =================
      const topSectionY = 70;

      // --- LEFT COLUMN: Billed To ---
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.slate400);
      doc.setFont("helvetica", "bold");
      doc.text("BILLED TO", 14, topSectionY);

      doc.setFontSize(22);
      doc.setTextColor(...COLORS.slate800);
      doc.text(String(invoice?.paymentTo?.partnerName || "Guest"), 14, topSectionY + 8);

      // Contact Pill
      doc.setFillColor(...COLORS.slate100);
      doc.roundedRect(14, topSectionY + 14, 50, 8, 4, 4, 'F');

      doc.setFontSize(9);
      doc.setTextColor(...COLORS.slate600);
      doc.setFont("helvetica", "normal");
      doc.text(`+ ${invoice?.paymentTo?.partnerPhone || "-"}`, 18, topSectionY + 19);


      // --- RIGHT COLUMN: Dates & Provider ---
      const col2X = 110;

      // Row 1: Dates
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.slate400);
      doc.setFont("helvetica", "bold");
      doc.text("BOOKING DATE", col2X, topSectionY);
      doc.text("INVOICE DATE", col2X + 50, topSectionY);

      doc.setFontSize(11);
      doc.setTextColor(...COLORS.slate800);
      doc.text(String(invoice?.paymentDate || "-"), col2X, topSectionY + 6);
      doc.text(String(invoice?.invoiceDate || "-"), col2X + 50, topSectionY + 6);

      // Row 2: Service Provider
      const providerY = topSectionY + 18;
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.slate400);
      doc.text("SERVICE PROVIDER", col2X, providerY);

      // Provider Card
      doc.setFillColor(...COLORS.slate100);
      doc.roundedRect(col2X, providerY + 3, 70, 14, 2, 2, 'F');

      // SP Icon Box
      doc.setFillColor(255, 255, 255);
      doc.rect(col2X + 2, providerY + 5, 10, 10, 'F');
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.blueAccent);
      doc.text("SP", col2X + 7, providerY + 11, { align: "center" });

      // Provider Name
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.slate800);
      doc.text(String(invoice?.partnerInfo?.name || "Admin"), col2X + 15, providerY + 8);
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.slate500);
      doc.text(`Contact: ${invoice?.partnerInfo?.contact || "-"}`, col2X + 15, providerY + 12);


      // ================= ITEMS TABLE =================
      const tableStartY = 115;

      autoTable(doc, {
        startY: tableStartY,
        head: [['DESCRIPTION', 'AMOUNT']],
        body: [
          [
            invoice?.paymentTable?.description || "Service Details",
            `${invoice?.paymentTable?.subTotal || "0"} THB`
          ],
        ],
        theme: 'grid',
        headStyles: {
          fillColor: COLORS.slate100,
          textColor: COLORS.slate500,
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'left',
          cellPadding: 6,
          lineWidth: 0
        },
        bodyStyles: {
          textColor: COLORS.slate800,
          fontSize: 10,
          cellPadding: 8,
          valign: 'middle',
          fontStyle: 'bold' // Title style font
        },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 50, halign: 'right', fontStyle: 'bold', fontSize: 11 }
        },
        didParseCell: function (data) {
          // Add subtitle to description if possible?
          // jsPDF AutoTable doesn't support complex cell rendering easily without hooks.
          // We keep it simple.
        }
      });

      // ================= FOOTER / TOTALS =================
      const finalY = (doc).lastAutoTable.finalY;

      // Totals Box Background
      doc.setFillColor(...COLORS.slate100);
      doc.rect(0, finalY, 210, 35, 'F'); // Light gray band for totals

      // Subtotal
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.slate500);
      doc.text("Sub Total", 140, finalY + 10);
      doc.text(`${invoice?.paymentTable?.subTotal || 0} THB`, 196, finalY + 10, { align: 'right' });

      // Total
      doc.setFontSize(14);
      doc.setTextColor(...COLORS.primary); // Blue Total
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL", 140, finalY + 22);
      doc.text(`${invoice?.paymentTable?.total || 0} THB`, 196, finalY + 22, { align: 'right' });


      // ================= BOTTOM MESSAGE =================
      const pageHeight = doc.internal.pageSize.height;
      const bottomY = pageHeight - 30;

      // Centered "Thank you"
      doc.setFontSize(11);
      doc.setTextColor(...COLORS.slate800);
      doc.setFont("helvetica", "bold");
      doc.text("Thank you for choosing Thaiseva!", 105, bottomY, { align: "center" });

      doc.setFontSize(9);
      doc.setTextColor(...COLORS.slate500);
      doc.setFont("helvetica", "normal");
      doc.text("We appreciate your business. Questions? Contact support.", 105, bottomY + 6, { align: "center" });

      return doc.output('blob');
    } catch (err) {
      console.error("jsPDF Error:", err);
      throw err;
    }
  };


  const handleDownloadInvoice = async (row) => {
    if (processingInvoiceId) return;
    setProcessingInvoiceId(row.id);
    try {
      // Ensure we have an Invoice ID before generating
      const updatedRow = await ensureInvoiceIdForBooking(queryCategory, row.id, row);
      const blob = await generatePdfBlob(updatedRow);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice_${row.name || 'User'}_${new Date().getTime()}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setProcessingInvoiceId(null);
    }
  };

  const handlePreviewInvoice = async (row) => {
    if (processingInvoiceId) return;
    setProcessingInvoiceId(row.id);
    try {
      // Ensure we have an Invoice ID before previewing
      const updatedRow = await ensureInvoiceIdForBooking(queryCategory, row.id, row);
      const blob = await generatePdfBlob(updatedRow);
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
      setPreviewOpen(true);
    } catch (error) {
      console.error("Error previewing PDF:", error);
      alert("Failed to preview invoice.");
    } finally {
      setProcessingInvoiceId(null);
    }
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl);
      setPreviewPdfUrl(null);
    }
  };

  // --- Normalization Logic ---
  function createData(
    id,
    isPaymentClear,
    provider,
    providerContact,
    name,
    phone,
    timestamp,
    userAmount,
    comission,
    category,
    status,
    title = "",
    customerInvoiceId = null
  ) {
    // Standardize timestamp if it's a Firestore Timestamp or Date object
    let dateObj;
    if (timestamp?.seconds) {
      dateObj = new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000);
    } else if (timestamp instanceof Date) {
      dateObj = timestamp;
    } else if (typeof timestamp === 'string') {
      dateObj = new Date(timestamp);
    } else {
      dateObj = new Date();
    }

    const invoicedate = new Date();
    // Calculations
    const ua = parseFloat(userAmount) || 0;
    const comissionAmount = "0.00";

    return {
      id,
      isPaymentClear,
      provider,
      providerContact: String(providerContact),
      name,
      phone,
      timestamp: dateObj.toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      userAmount: String(ua),
      category,
      status,
      customerInvoiceId,
      userInvoce: {
        paymentTo: {
          partnerName: name,
          partnerAddress: "",
          partnerPhone: phone,
          partnerEmail: "",
        },
        paymentDate: dateObj.toLocaleDateString(),
        invoiceDate: invoicedate.toLocaleDateString(),
        paymentTable: {
          description: `${title !== "" ? title : ""}${category}`,
          subTotal: String(ua),
          commission: "0",
          total: String(ua),
          totalCommission: comissionAmount,
        },
        partnerInfo: {
          name: provider,
          contact: providerContact,
        },
      },
    };
  }

  const setupDataProperly = (data, category) => {
    return data.map((item) => {
      // Default to empty strings or 0 to prevent crashes
      const defaults = {
        id: item?.id || "-",
        paymentClear: item?.isPaymentClear || item?.isPaymentDone,
        provider: "-",
        providerContact: "-",
        guestName: item?.guestDetails?.name || item?.name || item?.fullName || item?.username || "-",
        guestPhone: item?.guestDetails?.phone || item?.guestDetails?.phoneNumber || item?.contact || item?.phone || item?.phoneNo || "-",
        time: item?.timestamp || item?.time || item?.orderedAt || item?.createdAt || new Date(),
        amount: item?.amountTHB || item?.amountINR || item?.AmountOffered || item?.amount || item?.price || "0",
        commission: "0",
        status: item?.status === "pending" ? "Pending" : item?.status || "Pending"
      };

      if (category === "Taxi Bookings") {
        return createData(
          defaults.id, defaults.paymentClear,
          item?.Driver?.name || "-", item?.Driver?.phone || "-",
          defaults.guestName, defaults.guestPhone,
          defaults.time, defaults.amount, defaults.commission,
          category, defaults.status, "", item?.customerInvoiceId
        );
      }
      if (category === "Selfdrive Bookings") {
        return createData(
          defaults.id, defaults.paymentClear,
          item?.Provider?.name || "-", item?.Provider?.phone || "-",
          defaults.guestName, defaults.guestPhone,
          defaults.time, defaults.amount, defaults.commission,
          category, defaults.status, "", item?.customerInvoiceId
        );
      }
      if (category === "Room Bookings") {
        const roomPrice = item?.totalPrice || item?.totalAmount || item?.amount || defaults.amount;
        return createData(
          defaults.id, defaults.paymentClear,
          item?.hotel?.hotelName || item?.hotelName || "-", item?.hotel?.phoneNumber || item?.managerPhone || "-",
          defaults.guestName, defaults.guestPhone,
          defaults.time, roomPrice, defaults.commission,
          category, defaults.status, "", item?.customerInvoiceId
        );
      }
      if (category === "Sightseeing Bookings") {
        const guestName = item?.guestDetails?.name?.replace("not_present", "")?.trim() || item?.fullName || defaults.guestName;
        const guestPhone = item?.guestDetails?.phoneNumber || item?.phone || defaults.guestPhone;
        const price = item?.totalAmount || item?.price || defaults.amount;
        const titleVal = item?.title || item?.packageName || "-";

        const bookingTime = item?.timestamp ? new Date(item.timestamp.seconds * 1000).getTime() :
          (item?.orderedAt ? new Date(item.orderedAt.seconds * 1000).getTime() : defaults.time);

        // Ensure provider has a value to prevent PDF errors
        const providerName = item?.Provider?.name || "Thaiseva";
        const providerPhone = item?.Provider?.phone || "-";

        return createData(
          item?.orderId || defaults.id, defaults.paymentClear,
          providerName, providerPhone,
          guestName, guestPhone,
          bookingTime, price, defaults.commission,
          category, defaults.status, titleVal, item?.customerInvoiceId
        );
      }
      return createData("-", "-", "-", "-", "-", "0", "0", "0", category);
    });
  };

  // Derive Rows from Optimistic State
  const rows = setupDataProperly(optimisticRequirements, queryCategory);

  // --- Actions ---

  const handleClearAction = (id) => {
    if (window.confirm("Are you sure to clear this entry?")) {
      startTransition(async () => {
        // 1. Optimistic Update (Immediate UI feedback)
        setOptimisticRequirements(id);

        // 2. Server Update
        await handleClear(queryCategory, id);

        // 3. Sync
        setRefetch((p) => !p);
      });
    }
  };

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // --- Effects ---
  useEffect(() => {
    let mounted = true;
    if (isAdmin || isSubAdmin) {
      fetchBookingsTotalPages(setTotalPages, startDate, endDate, queryCategory);
      fetchTodayBooking(
        (data) => { if (mounted) setMatchedRequirements(data); },
        (loading) => { if (mounted) setLoadingReq(loading); },
        queryCategory,
        startDate,
        endDate,
        lastDocs,
        setLastDocs,
        rowsPerPage,
        page
      );
    }
    return () => { mounted = false; };
  }, [queryCategory, refetch, page, rowsPerPage, isAdmin, isSubAdmin, startDate, endDate, setLastDocs]);

  // --- CSV Export Logic ---
  const headers = [
    { label: "Provider Name", key: "provider" },
    { label: "Provider Contact", key: "providerContact" },
    { label: "User Name", key: "name" },
    { label: "User Contact", key: "phone" },
    { label: "Booking At", key: "timestamp" },
    { label: "Booking Amount", key: "userAmount" },
    { label: "Booking Category", key: "category" },
  ];



  const downloadCSV = async () => {
    setIsDownloading(true);
    const categories = ["Room Bookings", "Sightseeing Bookings", "Taxi Bookings", "Selfdrive Bookings"];

    let allData = [];

    // Fetch all categories
    await Promise.all(categories.map(async (cat) => {
      const raw = await fetchTodayBooking(() => { }, () => { }, cat, startDate, endDate);
      const normalized = setupDataProperly(raw, cat);
      allData = [...allData, ...normalized];
    }));

    // Generate CSV Content
    const csvHeader = headers.map(h => `"${h.label}"`).join(",");
    const csvRows = allData.map(row => {
      return headers.map(h => {
        const val = row[h.key] ? String(row[h.key]).replace(/"/g, '""') : "";
        return `"${val}"`;
      }).join(",");
    }).join("\n");

    const csvContent = `${csvHeader}\n${csvRows}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Bookings_from_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setIsDownloading(false);
  };

  const columns = [
    { id: "provider", label: "Provider", width: "15%" },
    { id: "phone", label: "User Contact", width: "10%" },
    { id: "name", label: "Guest Name", width: "12%" },
    { id: "timestamp", label: "Booking Time", width: "13%" },
    { id: "userAmount", label: "Booking Amount", width: "10%" },
    { id: "userInvoice", label: "Invoice", width: "15%" },
    { id: "action", label: "Action", width: "10%" },
  ];

  return (
    <div className="animate-fade-in pb-8">
      {/* Controls Card */}
      <Card sx={{ borderRadius: 4, mb: 4, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
        <CardContent>
          <Grid container spacing={3} alignItems="flex-end">
            <Grid item xs={12} md={5}>
              <Box component="form" onSubmit={(e) => { e.preventDefault(); setRefetch(p => !p); }} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                  label="Booking Date From"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                  fullWidth
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <Typography color="text.secondary">to</Typography>
                <TextField
                  label="End Date"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    if (startDate === "") {
                      alert("Please Select Start Date First!!");
                      return;
                    }
                    setEndDate(e.target.value);
                  }}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                  fullWidth
                  inputProps={{ min: startDate }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                    '&:hover': { background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)' }
                  }}
                >
                  Apply
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12} md={7} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={downloadCSV}
                disabled={isDownloading}
                startIcon={isDownloading ? <CircularProgress size={16} /> : <CloudDownload />}
                sx={{ borderRadius: 2, textTransform: 'none', borderColor: '#f97316', color: '#f97316' }}
              >
                {isDownloading ? "Generating CSV..." : "Export CSV"}
              </Button>
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {["Room Bookings", "Sightseeing Bookings", "Taxi Bookings", "Selfdrive Bookings"].map((serviceCategory, i) => (
              <Chip
                key={i}
                icon={<Category fontSize="small" style={{ color: queryCategory === serviceCategory ? 'white' : 'inherit' }} />}
                label={serviceCategory}
                clickable
                onClick={() => {
                  setQueryCategory(serviceCategory);
                  setPage(0);
                }}
                sx={{
                  borderRadius: 2,
                  px: 1,
                  bgcolor: queryCategory === serviceCategory ? 'var(--categories-bg-color)' : 'transparent',
                  color: queryCategory === serviceCategory ? 'white' : 'text.primary',
                  border: '1px solid',
                  borderColor: queryCategory === serviceCategory ? 'transparent' : 'divider',
                  '&:hover': {
                    bgcolor: queryCategory === serviceCategory ? 'var(--categories-bg-color)' : 'action.hover',
                    opacity: 0.9
                  }
                }}
              />
            ))}
          </Box>
        </CardContent>
      </Card>

      <Paper elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <TableContainer>
          {loadingReq ? (
            <Box sx={{ p: 4 }}>
              <LoadingContent variant="skeleton" />
            </Box>
          ) : (
            <Table stickyHeader aria-label="sticky table" sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow sx={{ background: '#1e3a8a !important' }}>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      align="left"
                      sx={{
                        py: 2,
                        px: 3,
                        fontWeight: 700,
                        color: '#ffffff !important',
                        fontSize: '0.875rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderBottom: 'none',
                        background: '#1e3a8a !important' // Fallback to solid blue
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
                    <TableRow
                      hover
                      role="checkbox"
                      tabIndex={-1}
                      key={row.id || i}
                      sx={{
                        '&:last-child td, &:last-child th': { border: 0 },
                        transition: 'all 0.2s',
                        '&:hover': {
                          backgroundColor: '#f1f5f9',
                          transform: 'scale(1.001)',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                        }
                      }}
                    >
                      {columns.map((column) => {
                        let value = row[column.id];

                        return (
                          <TableCell key={column.id} align="left" sx={{ py: 2, px: 3 }}>
                            {(column?.id === "timestamp" && value) ? (
                              <Chip
                                label={value}
                                size="small"
                                icon={<CalendarMonth fontSize="small" />}
                                sx={{
                                  bgcolor: '#eff6ff',
                                  color: '#3b82f6',
                                  fontWeight: 500,
                                  borderRadius: '6px',
                                  height: '28px'
                                }}
                              />
                            ) : (column.id === "action") ? (
                              <Tooltip title={row.isPaymentClear ? "Payment Cleared" : "Mark as Clear"}>
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleClearAction(row.id)}
                                    disabled={row.isPaymentClear || isPending}
                                    sx={{
                                      color: row.isPaymentClear ? '#22c55e' : '#ef4444',
                                      bgcolor: row.isPaymentClear ? '#dcfce7' : '#fee2e2',
                                      '&:hover': {
                                        bgcolor: row.isPaymentClear ? '#bbf7d0' : '#fecaca',
                                      },
                                      opacity: isPending ? 0.7 : 1
                                    }}
                                  >
                                    {row.isPaymentClear ? <CheckCircle fontSize="small" /> : <Delete fontSize="small" />}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            ) : (column.id === "userInvoice") ? (
                              <div className="flex items-center gap-1">
                                <Tooltip title="Preview Invoice">
                                  <IconButton
                                    size="small"
                                    onClick={() => handlePreviewInvoice(row)}
                                    disabled={processingInvoiceId === row.id}
                                    sx={{ color: '#3b82f6', bgcolor: '#eff6ff', '&:hover': { bgcolor: '#dbeafe' } }}
                                  >
                                    {processingInvoiceId === row.id ? (
                                      <CircularProgress size={20} color="inherit" />
                                    ) : (
                                      <RemoveRedEyeIcon fontSize="small" />
                                    )}
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Download Invoice">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDownloadInvoice(row)}
                                    disabled={processingInvoiceId === row.id}
                                    sx={{ color: '#22c55e', bgcolor: '#dcfce7', '&:hover': { bgcolor: '#bbf7d0' } }}
                                  >
                                    <FileDownloadIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </div>
                            ) : (column.id === "userAmount") ? (
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155' }}>
                                ฿{value}
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                {value}
                              </Typography>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} sx={{ py: 8, textAlign: 'center' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'text.secondary', opacity: 0.6 }}>
                        <FilterList sx={{ fontSize: 48, mb: 1 }} />
                        <Typography variant="h6">No {queryCategory} Found</Typography>
                        <Typography variant="body2">Try selecting a different date range or category.</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
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
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
            '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
              fontWeight: 500,
              color: 'text.secondary',
            }
          }}
        />
      </Paper>

      {/* Invoice Preview Dialog */}
      <Dialog
        fullScreen={false}
        maxWidth="lg"
        fullWidth
        open={previewOpen}
        onClose={handleClosePreview}
        PaperProps={{
          sx: { borderRadius: 2, height: '90vh' }
        }}
      >
        <AppBar position="relative" elevation={0} sx={{ bgcolor: '#1e3a8a' }}>
          <Toolbar>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
              Invoice Preview
            </Typography>
            <IconButton
              edge="start"
              color="inherit"
              onClick={handleClosePreview}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
        <DialogContent sx={{ p: 0, overflow: 'hidden', bgcolor: '#f1f5f9' }}>
          {previewPdfUrl && (
            <iframe
              src={previewPdfUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Invoice Preview"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default TodayBookings;
