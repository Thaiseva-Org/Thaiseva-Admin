/**
 * @file AllStatistics.jsx
 * @description Primary administrative financial analytics and booking intelligence dashboard.
 *
 * Architecture & Features:
 * - Real-time statistics aggregation consumed from {@link StatisticsContext}
 * - Dynamic temporal grouping (Daily vs. Monthly views) and date-range filtering
 * - Visual earnings breakdown supporting Bar and Line chart projections ({@link BarEarningChart})
 * - Key Performance Indicator (KPI) metric cards for total gross revenue, period averages, and time windows
 * - Segmented service revenue contributions across 5 verticals (Cars, Self Drive, Sightseeing, Hotels, Vans)
 * - Multi-sheet analytical Excel workbook generation via {@link exportAdminStatisticsExcel}
 * - Real-time searchable, filterable, and paginated audit table for all individual customer transactions
 *
 * @module AdminDashboard/AllStatistics
 */

import { useContext, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  FilterAltIcon,
  CalendarMonthRoundedIcon,
  InsightsRoundedIcon,
  PaidRoundedIcon,
  TimelineRoundedIcon,
  DownloadIcon,
  SearchIcon,
} from "@icons";
import { toast } from "react-toastify";
import { StatisticsContext } from "../../../../../contextAPIs/StatisticsProvider";
import BarEarningChart from "../../../../../components/BarEarningChart";
import { exportAdminStatisticsExcel } from "../../../../../utils/exportAdminStatisticsExcel";

/**
 * Formats numeric monetary values as standard Thai Baht (THB) currency strings.
 *
 * @param {number|string} value - Raw monetary amount.
 * @returns {string} Formatted currency string without fraction digits (e.g. "THB 150,000").
 */
const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

/**
 * Returns color tokens and chip styling for booking service categories.
 *
 * @param {string} cat - Service category name ("Cars", "Self Drive", "Sightseeing", "Hotels", "Vans").
 * @returns {object} Material-UI sx styling properties.
 */
const getCategoryChipStyle = (cat) => {
  switch (cat) {
    case "Cars":
      return { bgcolor: "rgba(15, 118, 110, 0.1)", color: "#0f766e", border: "1px solid rgba(15, 118, 110, 0.2)" };
    case "Self Drive":
      return { bgcolor: "rgba(16, 185, 129, 0.1)", color: "#047857", border: "1px solid rgba(16, 185, 129, 0.2)" };
    case "Sightseeing":
      return { bgcolor: "rgba(37, 99, 235, 0.1)", color: "#1d4ed8", border: "1px solid rgba(37, 99, 235, 0.2)" };
    case "Hotels":
      return { bgcolor: "rgba(217, 119, 6, 0.1)", color: "#b45309", border: "1px solid rgba(217, 119, 6, 0.2)" };
    case "Vans":
      return { bgcolor: "rgba(139, 92, 246, 0.1)", color: "#6d28d9", border: "1px solid rgba(139, 92, 246, 0.2)" };
    default:
      return { bgcolor: "rgba(100, 116, 139, 0.1)", color: "#475569", border: "1px solid rgba(100, 116, 139, 0.2)" };
  }
};

/**
 * Reusable summary metric card for displaying high-level financial KPIs.
 *
 * @component
 * @param {object} props
 * @param {string} props.title - Card metric title.
 * @param {string} props.value - Primary formatted display value.
 * @param {string} props.subtitle - Descriptive context or time window note.
 * @param {React.ReactNode} props.icon - Leading visual icon element.
 */
const SummaryCard = ({ title, value, subtitle, icon }) => (
  <Card
    elevation={0}
    sx={{
      height: "100%",
      borderRadius: 4,
      border: "1px solid",
      borderColor: "divider",
      boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
    }}
  >
    <CardContent sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Box>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {title}
          </Typography>
          <Typography variant="h5" fontWeight={800} sx={{ mt: 1 }}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {subtitle}
          </Typography>
        </Box>
        <Box
          sx={{
            width: 44,
            height: 44,
            display: "grid",
            placeItems: "center",
            borderRadius: 3,
            bgcolor: "rgba(15, 118, 110, 0.08)",
            color: "#0f766e",
          }}
        >
          {icon}
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

SummaryCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  icon: PropTypes.node.isRequired,
};

/**
 * AllStatistics Component.
 *
 * Renders the full analytical dashboard for platform administrators, enabling historical
 * revenue audits, category-specific volume breakdowns, and itemized customer transaction inspection.
 */
const AllStatistics = () => {
  const {
    allStatistics,
    selectedView,
    setSelectedView,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    filterRange,
    loading,
    error,
  } = useContext(StatisticsContext);
  const [chartType, setChartType] = useState("Bar");
  const [exporting, setExporting] = useState(false);

  // Orders Table State
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [orderCategoryFilter, setOrderCategoryFilter] = useState("All");
  const [orderStatusFilter, setOrderStatusFilter] = useState("All");
  const [ordersPage, setOrdersPage] = useState(0);
  const [ordersRowsPerPage, setOrdersRowsPerPage] = useState(10);

  const filteredOrders = useMemo(() => {
    const rawOrdersList = allStatistics?.allOrders || [];
    return rawOrdersList.filter((order) => {
      if (orderCategoryFilter !== "All" && order.category !== orderCategoryFilter) {
        return false;
      }
      if (orderStatusFilter !== "All" && order.status !== orderStatusFilter) {
        return false;
      }
      if (orderSearchQuery.trim()) {
        const query = orderSearchQuery.toLowerCase();
        const matchName = order.guestName?.toLowerCase().includes(query);
        const matchPhone = order.guestPhone?.toLowerCase().includes(query);
        const matchEmail = order.guestEmail?.toLowerCase().includes(query);
        const matchId = order.bookingId?.toLowerCase().includes(query);
        const matchProvider = order.providerName?.toLowerCase().includes(query);
        const matchDetails = order.details?.toLowerCase().includes(query);
        return matchName || matchPhone || matchEmail || matchId || matchProvider || matchDetails;
      }
      return true;
    });
  }, [allStatistics?.allOrders, orderCategoryFilter, orderStatusFilter, orderSearchQuery]);

  const paginatedOrders = useMemo(() => {
    const start = ordersPage * ordersRowsPerPage;
    return filteredOrders.slice(start, start + ordersRowsPerPage);
  }, [filteredOrders, ordersPage, ordersRowsPerPage]);

  const totalFilteredRevenue = useMemo(() => {
    return filteredOrders.reduce((sum, item) => sum + (Number(item.amountTHB) || 0), 0);
  }, [filteredOrders]);

  const handleExportExcel = async () => {
    if (!allStatistics || !allStatistics.date || !allStatistics.date.length) {
      toast.error("No statistics data available to export.");
      return;
    }

    try {
      setExporting(true);
      toast.info("Generating multi-sheet analytical Excel report...");
      await exportAdminStatisticsExcel(allStatistics, selectedView);
      toast.success("Excel Analytical Report downloaded successfully!");
    } catch (exportErr) {
      console.error("Failed to export Excel report:", exportErr);
      toast.error("Failed to export Excel report. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const summaryCards = useMemo(
    () => [
      {
        title: "Total Revenue",
        value: formatCurrency(allStatistics?.totals?.totalRevenue),
        subtitle: "Calculated across the active reporting window.",
        icon: <PaidRoundedIcon />,
      },
      {
        title: selectedView === "Days" ? "Average Per Day" : "Average Per Month",
        value: formatCurrency(allStatistics?.totals?.averagePerPeriod),
        subtitle:
          selectedView === "Days"
            ? "Average daily revenue inside the selected window."
            : "Average monthly revenue inside the selected window.",
        icon: <TimelineRoundedIcon />,
      },
      {
        title: "Window Length",
        value: `${allStatistics?.reportingWindow?.dayCount || 0} days`,
        subtitle: `${allStatistics?.reportingWindow?.fromLabel || "Select dates"} to ${
          allStatistics?.reportingWindow?.toLabel || "apply filter"
        }`,
        icon: <CalendarMonthRoundedIcon />,
      },
    ],
    [allStatistics, selectedView]
  );

  const topService = allStatistics?.serviceBreakdown?.[0];

  return (
    <Box sx={{ pb: 4 }}>
      {error ? (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 3 }}>
          {error}
        </Alert>
      ) : null}

      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 4,
          border: "1px solid",
          borderColor: "divider",
          background:
            "linear-gradient(180deg, rgba(248,250,252,0.9) 0%, rgba(255,255,255,1) 100%)",
        }}
      >
        <Grid container spacing={2} alignItems="end">
          <Grid item xs={12} sm={6} md={2}>
            <FormControl size="small" fullWidth>
              <Typography variant="caption" sx={{ mb: 0.5, color: "text.secondary", fontWeight: 700 }}>
                View By
              </Typography>
              <Select
                value={selectedView}
                onChange={(event) => setSelectedView(event.target.value)}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="Days">Days</MenuItem>
                <MenuItem value="Months">Months</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl size="small" fullWidth>
              <Typography variant="caption" sx={{ mb: 0.5, color: "text.secondary", fontWeight: 700 }}>
                Chart Type
              </Typography>
              <Select
                value={chartType}
                onChange={(event) => setChartType(event.target.value)}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="Bar">Bar</MenuItem>
                <MenuItem value="Line">Line</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2.5}>
            <Typography variant="caption" sx={{ mb: 0.5, color: "text.secondary", fontWeight: 700, display: "block" }}>
              From Date
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2.5}>
            <Typography variant="caption" sx={{ mb: 0.5, color: "text.secondary", fontWeight: 700, display: "block" }}>
              To Date
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <Stack direction="row" spacing={1}>
              <Button
                fullWidth
                variant="contained"
                onClick={filterRange}
                startIcon={<FilterAltIcon />}
                sx={{
                  height: 40,
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 700,
                  background: "var(--primary-bg)",
                }}
              >
                Apply
              </Button>

              <Tooltip title="Export multi-sheet analytical Excel report with KPIs, service breakdowns, and period trends">
                <Button
                  fullWidth
                  variant="contained"
                  disabled={loading || exporting || !allStatistics?.date?.length}
                  onClick={handleExportExcel}
                  startIcon={exporting ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
                  sx={{
                    height: 40,
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 700,
                    background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
                    color: "#ffffff",
                    boxShadow: "0 4px 12px rgba(15, 118, 110, 0.25)",
                    "&:hover": {
                      background: "linear-gradient(135deg, #115e59 0%, #0f766e 100%)",
                      boxShadow: "0 6px 16px rgba(15, 118, 110, 0.35)",
                    },
                    "&:disabled": {
                      background: "#e2e8f0",
                      color: "#94a3b8",
                    },
                  }}
                >
                  {exporting ? "Exporting..." : "Export Excel"}
                </Button>
              </Tooltip>
            </Stack>
          </Grid>
        </Grid>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1.5}
          sx={{ mt: 2.5, pt: 2, borderTop: "1px solid", borderColor: "divider" }}
        >
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <Chip
              icon={<InsightsRoundedIcon />}
              label={`Reporting window: ${allStatistics?.reportingWindow?.fromLabel || "--"} to ${
                allStatistics?.reportingWindow?.toLabel || "--"
              }`}
              sx={{ width: "fit-content" }}
            />
            {topService ? (
              <Chip
                label={`Top service: ${topService.label} (${formatCurrency(topService.total)})`}
                sx={{ width: "fit-content" }}
              />
            ) : null}
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 4 }} />
              </Grid>
            ))
          : summaryCards.map((card) => (
              <Grid item xs={12} md={4} key={card.title}>
                <SummaryCard {...card} />
              </Grid>
            ))}
      </Grid>

      {loading ? (
        <Skeleton variant="rectangular" height={420} sx={{ borderRadius: 4, mb: 4 }} />
      ) : (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 4,
            borderRadius: 4,
            border: "1px solid",
            borderColor: "divider",
            minHeight: 420,
          }}
        >
          <BarEarningChart
            chartType={chartType}
            selectedView={selectedView}
            statsData={allStatistics}
          />
        </Paper>
      )}

      {/* Service Breakdown Card */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 4,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h6" fontWeight={800}>
              Service Breakdown
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Every service total below is calculated from the same selected reporting window.
            </Typography>
          </Box>

          <Button
            variant="outlined"
            size="small"
            disabled={loading || exporting || !allStatistics?.date?.length}
            onClick={handleExportExcel}
            startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 700,
              borderColor: "#0f766e",
              color: "#0f766e",
              "&:hover": {
                borderColor: "#0d5c56",
                bgcolor: "rgba(15, 118, 110, 0.04)",
              },
            }}
          >
            {exporting ? "Generating..." : "Download Excel Report"}
          </Button>
        </Stack>

        {loading ? (
          <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 3 }} />
        ) : (
          <Stack spacing={2.5}>
            {allStatistics?.serviceBreakdown?.map((item) => (
              <Box key={item.key}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  spacing={2}
                  sx={{ mb: 1 }}
                >
                  <Box>
                    <Typography variant="body1" fontWeight={700}>
                      {item.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.share.toFixed(1)}% of total revenue
                    </Typography>
                  </Box>
                  <Typography variant="body1" fontWeight={800}>
                    {formatCurrency(item.total)}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(item.share || 0, 100)}
                  sx={{
                    height: 10,
                    borderRadius: 999,
                    bgcolor: "rgba(148, 163, 184, 0.18)",
                    "& .MuiLinearProgress-bar": {
                      borderRadius: 999,
                      background: "linear-gradient(90deg, #0f766e 0%, #14b8a6 100%)",
                    },
                  }}
                />
              </Box>
            ))}

            {!allStatistics?.serviceBreakdown?.length ? (
              <Typography variant="body2" color="text.secondary">
                No revenue data was found for the selected date range.
              </Typography>
            ) : null}
          </Stack>
        )}
      </Paper>

      {/* ALL BOOKING ORDERS & TRANSACTIONS SECTION */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 4,
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.03)",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Typography variant="h6" fontWeight={800}>
                All Booking Orders & Transactions
              </Typography>
              <Chip
                label={`${filteredOrders.length} Orders`}
                size="small"
                sx={{
                  bgcolor: "rgba(15, 118, 110, 0.1)",
                  color: "#0f766e",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                }}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Comprehensive list of every individual booking order matching the active date range.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
            <Chip
              label={`Filtered Revenue: ${formatCurrency(totalFilteredRevenue)}`}
              sx={{ fontWeight: 700, bgcolor: "#f1f5f9", color: "#334155" }}
            />
          </Stack>
        </Stack>

        {/* Filter Controls for Orders Table */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={5}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by Guest Name, Phone, Email, Booking ID, or Provider..."
              value={orderSearchQuery}
              onChange={(e) => {
                setOrderSearchQuery(e.target.value);
                setOrdersPage(0);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "text.secondary", fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3.5}>
            <FormControl size="small" fullWidth>
              <Select
                value={orderCategoryFilter}
                onChange={(e) => {
                  setOrderCategoryFilter(e.target.value);
                  setOrdersPage(0);
                }}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="All">All Categories</MenuItem>
                <MenuItem value="Cars">Car Bookings</MenuItem>
                <MenuItem value="Self Drive">Self Drive</MenuItem>
                <MenuItem value="Sightseeing">Sightseeing</MenuItem>
                <MenuItem value="Hotels">Hotels</MenuItem>
                <MenuItem value="Vans">Vans</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3.5}>
            <FormControl size="small" fullWidth>
              <Select
                value={orderStatusFilter}
                onChange={(e) => {
                  setOrderStatusFilter(e.target.value);
                  setOrdersPage(0);
                }}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="All">All Statuses</MenuItem>
                <MenuItem value="Confirmed">Confirmed / Done</MenuItem>
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="Cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Orders Table */}
        {loading ? (
          <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 3 }} />
        ) : (
          <>
            <TableContainer sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
              <Table size="medium">
                <TableHead sx={{ bgcolor: "#f8fafc" }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, width: 50 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Booking ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Guest Details</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Provider / Hotel</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Date & Time</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Service / Route Details</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Amount (THB)</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedOrders.map((order, idx) => {
                    const globalIdx = ordersPage * ordersRowsPerPage + idx + 1;
                    return (
                      <TableRow key={order.id || idx} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                        <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>
                          {globalIdx}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, color: "#0f766e" }}>
                          {order.bookingId}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={order.category}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              ...getCategoryChipStyle(order.category),
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700} color="text.primary">
                            {order.guestName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {order.guestPhone}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.primary">
                            {order.providerName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.primary" fontWeight={600}>
                            {order.bookingDate}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 260 }}>
                            {order.details}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>
                          {formatCurrency(order.amountTHB)}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={order.status}
                            size="small"
                            color={
                              order.status === "Confirmed"
                                ? "success"
                                : order.status === "Pending"
                                ? "warning"
                                : "error"
                            }
                            variant="outlined"
                            sx={{ fontWeight: 700, borderRadius: 2 }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {!paginatedOrders.length ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                        <Typography variant="body1" color="text.secondary" fontWeight={600}>
                          No booking orders found matching the filter criteria.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination Controls */}
            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={filteredOrders.length}
              rowsPerPage={ordersRowsPerPage}
              page={ordersPage}
              onPageChange={(_, newPage) => setOrdersPage(newPage)}
              onRowsPerPageChange={(e) => {
                setOrdersRowsPerPage(parseInt(e.target.value, 10));
                setOrdersPage(0);
              }}
              sx={{ mt: 1 }}
            />
          </>
        )}
      </Paper>
    </Box>
  );
};

export default AllStatistics;



