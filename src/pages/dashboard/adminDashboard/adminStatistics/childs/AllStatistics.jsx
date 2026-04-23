import { useContext, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import { StatisticsContext } from "../../../../../contextAPIs/StatisticsProvider";
import BarEarningChart from "../../../../../components/BarEarningChart";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

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
  } = useContext(StatisticsContext);
  const [chartType, setChartType] = useState("Bar");

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
          <Grid item xs={12} md={2}>
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

          <Grid item xs={12} md={2}>
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

          <Grid item xs={12} md={3}>
            <Typography variant="caption" sx={{ mb: 0.5, color: "text.secondary", fontWeight: 700, display: "block" }}>
              From
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

          <Grid item xs={12} md={3}>
            <Typography variant="caption" sx={{ mb: 0.5, color: "text.secondary", fontWeight: 700, display: "block" }}>
              To
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

          <Grid item xs={12} md={2}>
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
          </Grid>
        </Grid>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mt: 2 }}>
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

      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 4,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="h6" fontWeight={800}>
          Service Breakdown
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
          Every service total below is calculated from the same selected reporting window.
        </Typography>

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
    </Box>
  );
};

export default AllStatistics;
