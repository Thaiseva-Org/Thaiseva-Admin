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
      const raw = row.rawData || {}; // Access raw Firestore data
      const category = row.category;

      // --- COLORS ---
      const COLORS = {
        primary: [30, 58, 138],    // #1e3a8a
        darkBg: [15, 23, 42],      // #0f172a
        slate800: [30, 41, 59],
        slate600: [71, 85, 105],
        slate500: [100, 116, 139],
        slate100: [241, 245, 249],
        emerald: [16, 185, 129],
      };

      // --- HELPERS ---
      const drawBrandHeader = (title) => {
        // Top Bar
        doc.setFillColor(...COLORS.primary);
        doc.rect(0, 0, 210, 45, 'F');

        // Logo
        try {
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(14, 8, 50, 24, 2, 2, 'F');
          doc.addImage(logo, 'JPEG', 15, 9, 48, 22);
        } catch (e) {
          doc.setFontSize(10); doc.setTextColor(255, 255, 255); doc.text("THAISEVA", 15, 20);
        }

        // Title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(title.toUpperCase(), 196, 18, { align: "right" });

        // Status Badge
        const status = raw.status || "Pending";
        const isSuccess = status.toLowerCase() === 'accepted' || status.toLowerCase() === 'confirmed';
        doc.setFillColor(...(isSuccess ? COLORS.emerald : [200, 200, 200]));
        doc.roundedRect(176, 25, 20, 6, 2, 2, 'F');
        doc.setFontSize(8);
        doc.text(status.toUpperCase(), 186, 29, { align: "center" });
      };

      const drawSectionTitle = (text, y) => {
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.primary);
        doc.setFont("helvetica", "bold");
        doc.text(text.toUpperCase(), 14, y);
        doc.setDrawColor(...COLORS.slate100);
        doc.line(14, y + 2, 196, y + 2);
      };

      const drawField = (label, value, x, y) => {
        if (!value || value === "-" || value === "0" || value === "") return;
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.slate500);
        doc.setFont("helvetica", "normal");
        doc.text(label, x, y);
        doc.setTextColor(...COLORS.slate800);
        doc.setFont("helvetica", "bold");
        doc.text(String(value), x, y + 5);
      };

      // --- TEMPLATES ---

      // 1. SIGHTSEEING
      if (category === "Sightseeing Bookings") {
        drawBrandHeader("Booking Voucher");

        let y = 60;
        // Booking Details
        drawSectionTitle("Booking Details", y);
        y += 10;
        // Prioritize explicit IDs, then Invoice ID, then fallback
        const displayId = raw.bookingId || raw.orderId || row.customerInvoiceId || row.id;
        drawField("Booking ID", displayId, 14, y);
        drawField("Date", row.timestamp, 60, y);
        // Only show Provider if it's external/assigned
        if (raw.Provider?.name && raw.Provider.name !== "Thaiseva") {
          drawField("Provider", raw.Provider.name, 110, y);
          drawField("Provider Phone", raw.Provider.phone, 160, y);
        }

        y += 20;
        // Customer Details
        drawSectionTitle("Customer Details", y);
        y += 10;
        drawField("Name", raw.fullName || raw.guestDetails?.name || raw.name, 14, y);
        drawField("Phone", raw.guestPhone || raw.guestDetails?.phoneNumber || raw.phone, 60, y);
        const email = raw.guestEmail || raw.guestDetails?.email || raw.email;
        if (email) drawField("Email", email, 110, y);
        // Removed Nationality as typically extra

        y += 20;
        // Service Details
        drawSectionTitle("Service Details", y);
        y += 10;
        const title = raw.title || raw.packageName || row.userInvoce.paymentTable.description;
        doc.setFontSize(12); doc.setTextColor(...COLORS.slate800);
        doc.text(title, 14, y + 5); // Large Title

        y += 15;
        drawField("Passengers", raw.guestDetails?.noOfPassengers || raw.noOfPeople || 1, 14, y);
        if (raw.pickUpTime) drawField("Pick-Up Time", raw.pickUpTime, 60, y);
        if (raw.pickupLocation) drawField("Location", raw.pickupLocation, 110, y);

        // Invoice ID
        if (row.customerInvoiceId) {
          y += 20;
          drawField("Invoice No", row.customerInvoiceId, 160, 38); // Header area
        }
      }

      // 2. HOTEL
      else if (category === "Room Bookings") {
        drawBrandHeader("Hotel Confirmation");

        let y = 60;
        drawSectionTitle("Reservation Details", y);
        y += 10;
        const displayId = raw.bookingId || row.customerInvoiceId || row.id;
        drawField("Booking ID", displayId, 14, y);
        drawField("Booked On", row.timestamp, 60, y);
        drawField("Hotel Name", raw.hotelName || raw.hotel?.hotelName || (typeof raw.hotel === 'string' ? raw.hotel : ""), 110, y);

        y += 20;
        drawSectionTitle("Guest Information", y);
        y += 10;
        drawField("Primary Guest", raw.fullName || raw.guestDetails?.name || raw.name, 14, y);
        drawField("Contact", `${raw.guestPhone || raw.guestDetails?.phoneNumber || raw.phone || "-"}`, 60, y);
        if (raw.nationality) drawField("Nationality", raw.nationality, 160, y);

        y += 20;
        drawSectionTitle("Stay Details", y);
        y += 10;
        const formatDate = (val) => {
          if (!val) return "-";
          if (val.seconds) return new Date(val.seconds * 1000).toLocaleDateString();
          return new Date(val).toLocaleDateString();
        };

        drawField("Check-In", formatDate(raw.checkInDate), 14, y);
        drawField("Check-Out", formatDate(raw.checkOutDate), 60, y);

        // Duration Calc
        let nights = raw.nights;
        if (!nights && raw.checkInDate && raw.checkOutDate) {
          const d1 = raw.checkInDate.seconds ? new Date(raw.checkInDate.seconds * 1000) : new Date(raw.checkInDate);
          const d2 = raw.checkOutDate.seconds ? new Date(raw.checkOutDate.seconds * 1000) : new Date(raw.checkOutDate);
          nights = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
        }
        if (nights) drawField("Duration", `${nights} Night(s)`, 110, y);
        drawField("Guests", `${raw.adults || 0} Adults, ${raw.children || 0} Children`, 160, y);

        y += 20;
        drawSectionTitle("Room Allocation", y);
        y += 10;
        const rooms = raw.roomDetails || [{ roomName: raw.roomName || "Standard Room", count: raw.noOfRooms || 1 }];

        // Table for rooms
        autoTable(doc, {
          startY: y,
          head: [['Room Type', 'Qty', 'Assigned Rooms']],
          body: rooms.map(r => [r.roomName, r.count || 1, raw.roomNumbers || "On Arrival"]),
          theme: 'grid',
          headStyles: { fillColor: COLORS.slate100, textColor: COLORS.slate600, fontSize: 8 },
          styles: { fontSize: 9, textColor: COLORS.slate800 }
        });
      }

      // 3. TRANSPORT (Taxi, Van, SelfDrive)
      else {
        // Taxi / Van / SelfDrive
        const typeLabel = category.includes("Van") ? "Van Booking Invoice" : "Transport Invoice";
        drawBrandHeader(typeLabel);

        let y = 60;
        drawSectionTitle("Trip Details", y);
        y += 10;
        const displayId = raw.bookingId || row.customerInvoiceId || row.id;
        drawField("Booking ID", displayId, 14, y);
        drawField("Date", row.timestamp, 60, y);
        drawField("Service Type", category, 110, y);

        y += 20;
        drawSectionTitle("Passenger Details", y);
        y += 10;
        drawField("Name", raw.name || raw.guestName, 14, y);
        drawField("Contact", raw.contact || raw.guestPhone || raw.phone, 60, y);

        if (raw.passengers && raw.passengers.length > 0) {
          y += 12; // Move down for extra row
          doc.setFontSize(9); doc.setTextColor(...COLORS.slate500); doc.setFont("helvetica", "normal");
          doc.text("Additional Passengers", 14, y);
          doc.setTextColor(...COLORS.slate800); doc.setFont("helvetica", "bold");

          // Format list: "Name (Phone), Name 2 (Phone 2)"
          const passengerText = raw.passengers.map(p => {
            if (typeof p === 'string') return p;
            return `${p.name}${p.phone ? ` (${p.phone})` : ''}`;
          }).join(", ");

          // Join and wrap text
          doc.text(passengerText, 14, y + 5, { maxWidth: 180 });

          // Adjust Y based on how many lines likely used (approximate)
          const lines = Math.ceil(passengerText.length / 90); // approx chars per line
          y += (lines * 5);
        }

        y += 20;
        drawSectionTitle("Route Information", y);
        y += 10;
        // Wrapping text for locations
        doc.setFontSize(9); doc.setTextColor(...COLORS.slate500); doc.text("Pickup", 14, y);
        doc.setTextColor(...COLORS.slate800); doc.text(String(raw.pickupLocation || raw.pickup || "-"), 14, y + 5, { maxWidth: 80 });

        doc.setTextColor(...COLORS.slate500); doc.text("Drop", 110, y);
        doc.setTextColor(...COLORS.slate800); doc.text(String(raw.dropLocation || raw.drop || "-"), 110, y + 5, { maxWidth: 80 });

        y += 15;
        drawField("Time", raw.time || raw.bookingDate || "-", 14, y);

        if (raw.Driver || raw.companyName) {
          y += 20;
          drawSectionTitle("Vehicle & Driver", y);
          y += 10;
          drawField("Driver/Company", raw.Driver?.name || raw.companyName || "-", 14, y);
          drawField("Phone", raw.Driver?.phone || "-", 60, y);
          drawField("Vehicle", `${raw.vehicleDetails?.vehicle || "Van"} (${raw.vehicleDetails?.vehicleNumber || "-"})`, 110, y);
        }
      }

      // --- FINANCIALS (Common Bottom Section) ---
      const startY = (doc).lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 20 : 160;

      autoTable(doc, {
        startY: startY,
        head: [['Description', 'Amount']],
        body: [
          [
            `Service Charges (${category})`,
            `${row.userInvoce.paymentTable.total} THB`
          ],
          (category === "Room Bookings" && raw.amountINR) ? [`Equivalent in INR`, `₹ ${raw.amountINR}`] : null
        ].filter(Boolean),
        theme: 'striped',
        headStyles: { fillColor: COLORS.primary, textColor: 255 },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
      });

      // Total Box
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.slate800);
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL DUE:", 140, finalY);
      doc.setFontSize(14);
      doc.setTextColor(...COLORS.primary);
      doc.text(`${row.userInvoce.paymentTable.total} THB`, 196, finalY, { align: 'right' });


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
        guestName: item?.fullName || item?.guestDetails?.name || item?.name || item?.username || "-",
        guestPhone: item?.guestPhone || item?.guestDetails?.phone || item?.guestDetails?.phoneNumber || item?.contact || item?.phone || item?.phoneNo || "-",
        guestEmail: item?.guestEmail || item?.email || item?.guestDetails?.email || "-",
        time: item?.timestamp || item?.time || item?.orderedAt || item?.createdAt || new Date(),
        amount: item?.amountTHB || item?.amountINR || item?.AmountOffered || item?.amount || item?.price || "0",
        commission: "0",
        status: item?.status === "pending" ? "Pending" : item?.status || "Pending",
        adults: item?.adults !== undefined ? item.adults : (item?.guestDetails?.adults || 0),
        children: item?.children !== undefined ? item.children : (item?.guestDetails?.children || 0),
      };

      if (category === "Taxi Bookings") {
        return {
          ...createData(
            defaults.id, defaults.paymentClear,
            item?.Driver?.name || "-", item?.Driver?.phone || "-",
            defaults.guestName, defaults.guestPhone,
            defaults.time, defaults.amount, defaults.commission,
            category, defaults.status, "", item?.customerInvoiceId
          ), rawData: item
        };
      }
      if (category === "Selfdrive Bookings") {
        return {
          ...createData(
            defaults.id, defaults.paymentClear,
            item?.Provider?.name || "-", item?.Provider?.phone || "-",
            defaults.guestName, defaults.guestPhone,
            defaults.time, defaults.amount, defaults.commission,
            category, defaults.status, "", item?.customerInvoiceId
          ), rawData: item
        };
      }
      if (category === "Van Bookings" || (category && category.includes("Van"))) {
        // Price removed, set to "-"
        const price = "-";
        // Ensure date is handled
        const bDate = item?.bookingDate || item?.createdAt || new Date();

        // Determine Provider Name
        const isMobile = item?.source === 'mobile';
        const providerName = isMobile ? "Mobile App Request" : (item?.companyName || "Van Booking");

        let displayGuest = item?.guestName || defaults.guestName;
        if (item?.passengers && item.passengers.length > 0) {
          displayGuest += ` (+${item.passengers.length})`;
        }

        return {
          ...createData(
            defaults.id, defaults.paymentClear,
            providerName, "-",
            displayGuest,
            item?.guestPhone || defaults.guestPhone,
            bDate,
            price, defaults.commission,
            category, defaults.status, `${item?.pickupLocation || "?"} -> ${item?.dropLocation || "?"}`, item?.customerInvoiceId
          ),
          source: item?.source, // Important for Mobile Van support
          rawData: item
        };
      }
      if (category === "Room Bookings") {
        const roomPrice = item?.totalPrice || item?.totalAmount || item?.amount || defaults.amount;
        // For Room Bookings, "Timestamp" should show the Check-In Date
        const checkIn = item.checkInDate || item.checkIn || defaults.time;

        return {
          ...createData(
            defaults.id, defaults.paymentClear,
            (() => {
              const primary = item?.hotelName || "";
              const nested = item?.hotel?.hotelName || "";
              const fallback = typeof item?.hotel === 'string' ? item.hotel : "";
              if (primary.toLowerCase() === "hotel" || !primary) {
                return nested || fallback || primary || "-";
              }
              return primary;
            })(),
            item?.hotel?.phoneNumber || item?.managerPhone || "-",
            defaults.guestName, defaults.guestPhone,
            checkIn, roomPrice, defaults.commission,
            category, defaults.status, "", item?.customerInvoiceId
          ), rawData: item
        };
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

        return {
          ...createData(
            item?.orderId || defaults.id, defaults.paymentClear,
            providerName, providerPhone,
            guestName, guestPhone,
            bookingTime, price, defaults.commission,
            category, defaults.status, titleVal, item?.customerInvoiceId
          ), rawData: item
        };
      }
      return createData("-", "-", "-", "-", "-", "0", "0", "0", category);
    });
  };

  // Derive Rows from Optimistic State
  const rows = setupDataProperly(optimisticRequirements, queryCategory);

  // --- Actions ---

  const handleClearAction = (row) => {
    if (window.confirm("Are you sure to clear this entry?")) {
      startTransition(async () => {
        // 1. Optimistic Update (Immediate UI feedback)
        setOptimisticRequirements(row.id);

        // 2. Server Update
        await handleClear(queryCategory, row.id, row.source);

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
    const categories = ["Room Bookings", "Sightseeing Bookings", "Taxi Bookings", "Selfdrive Bookings", "Van Bookings"];

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
    { id: "provider", label: queryCategory === "Room Bookings" ? "Hotel Name" : "Provider", width: "15%" },
    { id: "phone", label: "User Contact", width: "10%" },
    { id: "name", label: "Guest Name", width: "12%" },
    { id: "timestamp", label: queryCategory === "Room Bookings" ? "Check In" : "Booking Time", width: "13%" },
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
              <Box component="form" onSubmit={(e) => { e.preventDefault(); setPage(0); setRefetch(p => !p); }} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
            {["Room Bookings", "Sightseeing Bookings", "Taxi Bookings", "Selfdrive Bookings", "Van Bookings"].map((serviceCategory, i) => (
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
                                    onClick={() => handleClearAction(row)}
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
                                {value === "-" || value === "0" ? "-" : `฿${value}`}
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
