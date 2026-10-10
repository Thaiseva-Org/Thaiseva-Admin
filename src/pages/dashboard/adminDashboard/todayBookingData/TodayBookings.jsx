/**
 * @file TodayBookings.jsx
 * @description Administrative booking management interface for daily operations and payment auditing.
 *
 * Architecture & Features:
 * - Multi-category booking aggregation (Room Bookings, Sightseeing Bookings, Taxi Bookings, Van Bookings, Selfdrive Bookings)
 * - Temporal filtering with dynamic date-range selector (defaults to trailing 7 days)
 * - React 19 concurrent features: optimistic UI updates (useOptimistic) and transition boundaries (useTransition)
 * - Client-side dynamic PDF invoice/voucher generation via jsPDF & jspdf-autotable with in-browser modal preview and direct download
 * - Automated sequential invoice number provisioning via ensureInvoiceIdForBooking
 * - Consolidated multi-vertical Excel workbook export via SheetJS (xlsx)
 * - Server-side paginated queries via fetchTodayBooking and fetchBookingsTotalPages
 *
 * @module AdminDashboard/TodayBookings
 */

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
  DialogContent,
  AppBar,
  Toolbar
} from "@mui/material";
import { useState, useEffect, useContext, useOptimistic, useTransition } from "react";
import LoadingContent from "../../../../components/LoadingContent";
import {
  CalendarMonth,
  Category,
  CheckCircle,
  CloseIcon,
  CloudDownload,
  Delete,
  FileDownloadIcon,
  FilterList,
  RemoveRedEyeIcon,
} from "@icons";
import {
  fetchBookingsTotalPages,
  fetchTodayBooking,
  handleClear,
} from "../../../../services/DailyRecords";
import { ensureInvoiceIdForBooking } from "../../../../services/invoiceService";
import { getBookingPickupRequest } from "../../../../utils/bookingNotes";
import { normalizeHotelBookingStatus } from "../../../../utils/bookingStatus";

import { AuthContext } from "../../../../contextAPIs/AuthProvider";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { logo } from "../../../../assets";
import ExcelJS from 'exceljs';

/**
 * TodayBookings Component.
 *
 * Operational dashboard for administrators and sub-administrators to review,
 * audit, and manage bookings across all travel and lodging verticals.
 */
const TodayBookings = () => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);

  // State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
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
        req.id === updatedId
          ? { ...req, isPaymentClear: true, isPaymentDone: true }
          : req
      );
    }
  );

  /**
   * Generates a styled, multi-section PDF voucher/invoice for the given booking row.
   *
   * Adaptively formats headers, customer details, service itineraries, room allocations,
   * vehicle information, and currency totals based on the service category.
   *
   * @async
   * @param {object} row - Normalized booking record with rawData attached.
   * @returns {Promise<Blob>} jsPDF output as a binary Blob suitable for iframe display or download.
   */
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
        slate200: [226, 232, 240],
        slate100: [241, 245, 249],
        emerald: [16, 185, 129],
      };

      // Title determination
      const docTitle =
        category === "Room Bookings"
          ? "Hotel Confirmation"
          : category === "Sightseeing Bookings"
            ? "Booking Voucher"
            : category.includes("Van")
              ? "Van Booking Voucher"
              : "Transport Voucher";

      // --- BRAND HEADER ---
      doc.setFillColor(...COLORS.primary);
      doc.rect(0, 0, 210, 45, 'F');

      // Logo box
      try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(14, 8, 52, 24, 2, 2, 'F');
        doc.addImage(logo, 'JPEG', 15, 9, 50, 22);
      } catch (e) {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("THAISEVA", 15, 22);
      }

      // Title & Invoice No
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(docTitle.toUpperCase(), 196, 16, { align: "right" });

      const invoiceNo = row.customerInvoiceId || raw.customerInvoiceId || raw.invoiceId || "";
      if (invoiceNo) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(226, 232, 240);
        doc.text(`Invoice #: ${invoiceNo}`, 196, 23, { align: "right" });
      }

      // Status Badge
      const status = String(raw.status || row.status || "Pending").trim();
      const isSuccess = ['accepted', 'confirmed', 'done'].includes(status.toLowerCase());
      doc.setFillColor(...(isSuccess ? COLORS.emerald : [203, 213, 225]));
      doc.roundedRect(160, 28, 36, 7, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...(isSuccess ? [255, 255, 255] : COLORS.slate800));
      doc.text(status.toUpperCase(), 178, 32.5, { align: "center" });

      // --- HELPERS ---
      const drawSectionTitle = (text, currentY) => {
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.primary);
        doc.setFont("helvetica", "bold");
        doc.text(text.toUpperCase(), 14, currentY);
        doc.setDrawColor(...COLORS.slate200);
        doc.setLineWidth(0.4);
        doc.line(14, currentY + 2, 196, currentY + 2);
        return currentY + 8;
      };

      const drawFieldColumn = (label, value, x, y, width = 45) => {
        if (value === undefined || value === null || value === "") return y;
        const strVal = String(value).trim();
        if (!strVal || strVal === "-") return y;

        doc.setFontSize(8.5);
        doc.setTextColor(...COLORS.slate500);
        doc.setFont("helvetica", "normal");
        doc.text(label, x, y);

        doc.setFontSize(9.5);
        doc.setTextColor(...COLORS.slate800);
        doc.setFont("helvetica", "bold");

        const lines = doc.splitTextToSize(strVal, width);
        doc.text(lines, x, y + 4.5);
        return y + (lines.length * 4.5) + 3;
      };

      const drawFieldRow = (fields, currentY) => {
        let maxY = currentY;
        fields.forEach(f => {
          if (!f.value || f.value === "-" || f.value === "0" || f.value === "") return;
          const endY = drawFieldColumn(f.label, f.value, f.x, currentY, f.width || 45);
          if (endY > maxY) maxY = endY;
        });
        return maxY > currentY ? maxY + 3 : currentY;
      };

      let y = 56;

      // --- 1. SIGHTSEEING BOOKINGS ---
      if (category === "Sightseeing Bookings") {
        const displayId = raw.bookingId || raw.orderId || row.customerInvoiceId || row.id;

        y = drawSectionTitle("Booking Details", y);
        y = drawFieldRow([
          { label: "Booking ID", value: displayId, x: 14, width: 45 },
          { label: "Booking Date", value: row.timestamp, x: 65, width: 45 },
          { label: "Provider", value: (raw.Provider?.name && raw.Provider.name !== "Thaiseva") ? raw.Provider.name : "Thaiseva", x: 115, width: 40 },
          { label: "Provider Phone", value: raw.Provider?.phone || "-", x: 160, width: 35 },
        ], y);

        y = drawSectionTitle("Customer Details", y);
        y = drawFieldRow([
          { label: "Guest Name", value: raw.fullName || raw.guestDetails?.name || raw.name || row.name, x: 14, width: 45 },
          { label: "Phone", value: raw.guestPhone || raw.guestDetails?.phoneNumber || raw.phone || row.phone, x: 65, width: 45 },
          { label: "Email", value: raw.guestEmail || raw.guestDetails?.email || raw.email || "-", x: 115, width: 40 },
          { label: "Passengers", value: raw.guestDetails?.noOfPassengers || raw.noOfPeople || 1, x: 160, width: 35 },
        ], y);

        y = drawSectionTitle("Service Details", y);
        const title = raw.title || raw.packageName || row.userInvoce?.paymentTable?.description || "-";
        doc.setFontSize(10.5);
        doc.setTextColor(...COLORS.slate800);
        doc.setFont("helvetica", "bold");
        const titleLines = doc.splitTextToSize(title, 180);
        doc.text(titleLines, 14, y);
        y += (titleLines.length * 4.5) + 5;

        const pickupRequest = getBookingPickupRequest(raw);
        y = drawFieldRow([
          { label: "Pick-Up Time", value: raw.pickUpTime || "-", x: 14, width: 45 },
          { label: "Pickup Request / Location", value: pickupRequest || "-", x: 65, width: 125 },
        ], y);
      }

      // --- 2. ROOM BOOKINGS (HOTEL) ---
      else if (category === "Room Bookings") {
        const displayId = raw.bookingId || row.customerInvoiceId || row.id;

        y = drawSectionTitle("Reservation Details", y);
        const hotelName = raw.hotelName || raw.hotel?.hotelName || (typeof raw.hotel === 'string' ? raw.hotel : "") || "-";
        y = drawFieldRow([
          { label: "Booking ID", value: displayId, x: 14, width: 45 },
          { label: "Booked On", value: row.timestamp, x: 65, width: 45 },
          { label: "Hotel Name", value: hotelName, x: 115, width: 80 },
        ], y);

        y = drawSectionTitle("Guest Information", y);
        y = drawFieldRow([
          { label: "Primary Guest", value: raw.fullName || raw.guestDetails?.name || raw.name || row.name, x: 14, width: 45 },
          { label: "Contact Phone", value: raw.guestPhone || raw.guestDetails?.phoneNumber || raw.phone || row.phone || "-", x: 65, width: 45 },
          { label: "Email", value: raw.guestEmail || raw.guestDetails?.email || raw.email || "-", x: 115, width: 40 },
          { label: "Nationality", value: raw.nationality || "-", x: 160, width: 35 },
        ], y);

        y = drawSectionTitle("Stay Details", y);
        const formatDate = (val) => {
          if (!val) return "-";
          if (val.seconds) return new Date(val.seconds * 1000).toLocaleDateString();
          const d = new Date(val);
          return isNaN(d) ? "-" : d.toLocaleDateString();
        };

        let nights = raw.nights;
        if (!nights && raw.checkInDate && raw.checkOutDate) {
          const d1 = raw.checkInDate.seconds ? new Date(raw.checkInDate.seconds * 1000) : new Date(raw.checkInDate);
          const d2 = raw.checkOutDate.seconds ? new Date(raw.checkOutDate.seconds * 1000) : new Date(raw.checkOutDate);
          if (!isNaN(d1) && !isNaN(d2)) {
            nights = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
          }
        }

        y = drawFieldRow([
          { label: "Check-In", value: formatDate(raw.checkInDate || raw.checkIn), x: 14, width: 45 },
          { label: "Check-Out", value: formatDate(raw.checkOutDate || raw.checkOut), x: 65, width: 45 },
          { label: "Duration", value: nights ? `${nights} Night(s)` : "-", x: 115, width: 40 },
          { label: "Guests", value: `${raw.adults || 0} Adult(s), ${raw.children || 0} Child(ren)`, x: 160, width: 35 },
        ], y);

        y = drawSectionTitle("Room Allocation", y);
        const rooms = raw.roomDetails || [{ roomName: raw.roomName || "Standard Room", count: raw.noOfRooms || 1 }];
        autoTable(doc, {
          startY: y,
          head: [['Room Type', 'Qty', 'Assigned Room(s)']],
          body: rooms.map(r => [r.roomName || "Standard Room", r.count || 1, raw.roomNumbers || "On Arrival"]),
          theme: 'grid',
          headStyles: { fillColor: COLORS.slate100, textColor: COLORS.slate600, fontSize: 8.5, fontStyle: 'bold' },
          styles: { fontSize: 9, textColor: COLORS.slate800 },
          margin: { left: 14, right: 14 }
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      // --- 3. TRANSPORT (TAXI / VAN / SELFDRIVE) ---
      else {
        const displayId = raw.bookingId || row.customerInvoiceId || row.id;

        y = drawSectionTitle("Trip Details", y);
        y = drawFieldRow([
          { label: "Booking ID", value: displayId, x: 14, width: 45 },
          { label: "Booking Date", value: row.timestamp, x: 65, width: 45 },
          { label: "Service Type", value: category, x: 115, width: 80 },
        ], y);

        y = drawSectionTitle("Passenger Details", y);
        y = drawFieldRow([
          { label: "Passenger Name", value: raw.name || raw.guestName || raw.fullName || row.name, x: 14, width: 45 },
          { label: "Contact Phone", value: raw.contact || raw.guestPhone || raw.phone || row.phone, x: 65, width: 45 },
        ], y);

        if (raw.passengers && Array.isArray(raw.passengers) && raw.passengers.length > 0) {
          const passengerText = raw.passengers.map(p => {
            if (typeof p === 'string') return p;
            return `${p.name || ''}${p.phone ? ` (${p.phone})` : ''}`;
          }).filter(Boolean).join(", ");
          if (passengerText) {
            y = drawFieldRow([
              { label: "Additional Passengers", value: passengerText, x: 14, width: 180 }
            ], y);
          }
        }

        y = drawSectionTitle("Route Information", y);
        const pickup = getBookingPickupRequest(raw) || "-";
        const drop = raw.dropLocation || raw.drop || "-";
        const tripTime = raw.time || raw.bookingDate || "-";

        y = drawFieldRow([
          { label: "Pickup Location", value: pickup, x: 14, width: 85 },
          { label: "Drop-Off Location", value: drop, x: 105, width: 85 },
        ], y);

        y = drawFieldRow([
          { label: "Scheduled Time", value: tripTime, x: 14, width: 85 },
        ], y);

        if (raw.Driver || raw.companyName || raw.providerName) {
          y = drawSectionTitle("Vehicle & Driver Information", y);
          const driverName = raw.Driver?.name || raw.companyName || raw.providerName || "-";
          const driverPhone = raw.Driver?.phone || raw.companyPhone || "-";
          const vehicleInfo = `${raw.vehicleDetails?.vehicle || raw.vehicleType || "Vehicle"} (${raw.vehicleDetails?.vehicleNumber || "Assigned on arrival"})`;
          y = drawFieldRow([
            { label: "Driver / Partner", value: driverName, x: 14, width: 45 },
            { label: "Contact Phone", value: driverPhone, x: 65, width: 45 },
            { label: "Vehicle Info", value: vehicleInfo, x: 115, width: 80 },
          ], y);
        }
      }

      // --- FINANCIALS & SUMMARY TABLE ---
      const lastTableY = doc.lastAutoTable?.finalY;
      let startY = Math.max(y + 6, lastTableY ? lastTableY + 8 : 0);
      if (startY > 230) {
        doc.addPage();
        startY = 20;
      }

      const rawAmount = raw.amountTHB || raw.totalAmount || raw.totalPrice || raw.price || raw.amount || (row.userAmount !== "-" && row.userAmount !== "0" ? row.userAmount : null);
      const parsedNum = parseFloat(rawAmount);
      const hasAmount = !isNaN(parsedNum) && parsedNum > 0;
      const formattedTotal = hasAmount
        ? `${parsedNum.toLocaleString()} THB`
        : (row.userAmount && row.userAmount !== "-" && row.userAmount !== "0" ? `${row.userAmount} THB` : "Included / On Request");

      const serviceDescription = raw.title || raw.packageName || raw.hotelName || `${category} Service`;

      autoTable(doc, {
        startY: startY,
        head: [['Description', 'Amount']],
        body: [
          [
            `Service Fee (${category}): ${serviceDescription}`,
            formattedTotal
          ],
          (category === "Room Bookings" && raw.amountINR) ? [`Equivalent in INR`, `₹ ${Number(raw.amountINR).toLocaleString()}`] : null
        ].filter(Boolean),
        theme: 'striped',
        headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 14, right: 14 }
      });

      const finalY = doc.lastAutoTable.finalY + 8;
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.slate800);
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL DUE:", 140, finalY);
      doc.setFontSize(13);
      doc.setTextColor(...COLORS.primary);
      doc.text(formattedTotal, 196, finalY, { align: 'right' });

      // Footer note
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.slate500);
      doc.text("Thank you for choosing ThaiSeva. For support or inquiries, please contact ThaiSeva Support.", 105, 282, { align: 'center' });

      return doc.output('blob');
    } catch (err) {
      console.error("jsPDF Error:", err);
      throw err;
    }
  };

  /**
   * Initiates direct PDF invoice download for a booking record, ensuring an official
   * sequential customer invoice number is provisioned in Firestore beforehand.
   *
   * @async
   * @param {object} row - Target booking record.
   * @returns {Promise<void>}
   */
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

  /**
   * Generates and presents the booking invoice PDF inside an in-app dialog modal.
   *
   * @async
   * @param {object} row - Target booking record.
   * @returns {Promise<void>}
   */
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

  /**
   * Closes the invoice preview dialog and releases the object URL to avoid memory leaks.
   */
  const handleClosePreview = () => {
    setPreviewOpen(false);
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl);
      setPreviewPdfUrl(null);
    }
  };

  // --- Normalization Logic ---

  /**
   * Factory function constructing a normalized booking row with computed totals,
   * human-readable timestamps, and structured invoice metadata.
   *
   * @param {string} id - Firestore document ID.
   * @param {boolean} isPaymentClear - Settlement status flag.
   * @param {string} provider - Vendor, hotel, or driver identifier.
   * @param {string} providerContact - Vendor contact number.
   * @param {string} name - Guest primary name.
   * @param {string} phone - Guest contact phone.
   * @param {object|Date|string} timestamp - Booking creation or check-in timestamp.
   * @param {string|number} userAmount - Gross booking cost in THB.
   * @param {string|number} comission - Commission amount.
   * @param {string} category - Service category string.
   * @param {string} status - Booking workflow state.
   * @param {string} [title=""] - Package title or route summary.
   * @param {string|null} [customerInvoiceId=null] - Formal customer invoice sequence ID.
   * @returns {object} Standardized booking record.
   */
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

  /**
   * Normalizes heterogeneous Firestore documents across different travel verticals
   * into homogeneous tabular row structures.
   *
   * @param {Array<object>} data - Raw documents fetched from Firestore.
   * @param {string} category - Active service category.
   * @returns {Array<object>} Normalized array of booking rows.
   */
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
        status:
          category === "Room Bookings"
            ? normalizeHotelBookingStatus(item)
            : item?.status === "pending"
              ? "Pending"
              : item?.status || "Pending",
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
            category, defaults.status, `${getBookingPickupRequest(item) || "?"} -> ${item?.dropLocation || item?.drop || "?"}`, item?.customerInvoiceId
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

        const bookingTime =
          item?.timestamp || item?.orderedAt || item?.createdAt || defaults.time;

        const providerName = item?.Provider?.name || "Thaiseva";
        const providerPhone = item?.Provider?.phone || "-";

        return {
          ...createData(
            defaults.id, defaults.paymentClear,
            providerName, providerPhone,
            guestName, guestPhone,
            bookingTime, price, defaults.commission,
            category, defaults.status, titleVal, item?.customerInvoiceId
          ),
          orderId: item?.orderId,
          rawData: item
        };
      }
      return createData("-", "-", "-", "-", "-", "0", "0", "0", category);
    });
  };

  // Derive Rows from Optimistic State
  const rows = setupDataProperly(optimisticRequirements, queryCategory);

  // --- Actions ---

  /**
   * Confirms and executes optimistic payment clearance for a booking row.
   *
   * Uses React 19 useOptimistic for zero-latency UI transition followed by
   * asynchronous persistence in Firestore via handleClear.
   *
   * @param {object} row - Booking record to clear.
   */
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
        rowsPerPage,
        page
      );
    }
    return () => { mounted = false; };
  }, [queryCategory, refetch, page, rowsPerPage, isAdmin, isSubAdmin, startDate, endDate]);

  /**
   * Compiles and exports an aggregated multi-category Excel (.xlsx) workbook
   * covering all 5 travel verticals across the selected date window.
   *
   * @async
   * @returns {Promise<void>}
   */
  const downloadExcel = async () => {
    setIsDownloading(true);
    const categories = ["Room Bookings", "Sightseeing Bookings", "Taxi Bookings", "Van Bookings", "Selfdrive Bookings"];

    let allData = [];

    // Fetch all categories
    await Promise.all(categories.map(async (cat) => {
      const raw = await fetchTodayBooking(() => { }, () => { }, cat, startDate, endDate);
      const normalized = setupDataProperly(raw, cat);
      allData = [...allData, ...normalized];
    }));

    // Generate Excel Data
    const excelData = allData.map(row => {
      const raw = row.rawData || {};
      const title = raw.title || raw.packageName || row?.userInvoce?.paymentTable?.description || "-";
      
      return {
        "Order ID": row.id || "-",
        "Invoice ID": row.customerInvoiceId || raw.customerInvoiceId || raw.invoiceId || "-",
        "Booking Category": row.category || "-",
        "Provider Name": row.provider || "-",
        "Provider Contact": row.providerContact || "-",
        "Guest Name": row.name || "-",
        "Guest Contact": row.phone || "-",
        "Booking Date/Time": row.timestamp || "-",
        "Service Description": title,
        "Status": row.status || "-",
        "Payment Clear": row.isPaymentClear ? "Yes" : "No",
        "Booking Amount": parseFloat(row.userAmount) || 0,
      };
    });

    // Add totals row
    const totalAmount = excelData.reduce((acc, row) => acc + (parseFloat(row["Booking Amount"]) || 0), 0);
    excelData.push({
      "Order ID": "TOTAL",
      "Invoice ID": "",
      "Booking Category": "",
      "Provider Name": "",
      "Provider Contact": "",
      "Guest Name": "",
      "Guest Contact": "",
      "Booking Date/Time": "",
      "Service Description": "",
      "Status": "",
      "Payment Clear": "",
      "Booking Amount": totalAmount,
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Bookings");
    
    // Auto adjust column widths
    const colWidths = [
      { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 20 },
      { wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 35 }, { wch: 15 },
      { wch: 15 }, { wch: 20 }
    ];
    worksheet.columns = Object.keys(excelData[0]).map((key, index) => ({header: key, key, width: colWidths[index].wch}));
    worksheet.addRows(excelData);
    const buffer = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bookings_from_${startDate}_to_${endDate}.xlsx`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

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
                onClick={downloadExcel}
                disabled={isDownloading}
                startIcon={isDownloading ? <CircularProgress size={16} /> : <CloudDownload />}
                sx={{ borderRadius: 2, textTransform: 'none', borderColor: '#f97316', color: '#f97316' }}
              >
                {isDownloading ? "Generating Excel..." : "Export Excel"}
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
