import { useContext, useEffect, useState } from "react";
import { StatisticsContext } from "../../../../../contextAPIs/StatisticsProvider";
import {
  AccountBalanceWalletIcon,
  ApartmentIcon,
  LocalTaxiRoundedIcon,
  LuggageIcon,
  DirectionsCarIcon,
} from "../../../../../utils/Icons";
import { amountCalculator } from "../../../../../utils/utils";
import BarEarningChart from "../../../../../components/BarEarningChart";
import {
  Button,
  FormControl,
  MenuItem,
  Select,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Box,
} from "@mui/material";
import FilterAltIcon from "@mui/icons-material/FilterAlt";

// Custom Stat Card Component
const StatCard = ({ title, value, icon, color, gradient }) => (
  <Card
    sx={{
      borderRadius: 4,
      boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)",
      height: "100%",
      position: "relative",
      overflow: "hidden",
      transition: "transform 0.2s",
      "&:hover": {
        transform: "translateY(-5px)",
        boxShadow: "0 20px 40px -12px rgba(0,0,0,0.2)",
      },
    }}
  >
    <div
      style={{
        background: gradient,
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        opacity: 0.1,
        zIndex: 0,
      }}
    />
    <CardContent sx={{ position: "relative", zIndex: 1, p: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Box
          sx={{
            p: 1.5,
            borderRadius: "12px",
            background: gradient,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 4px 12px ${color}40`,
          }}
        >
          {icon}
        </Box>
      </Box>
      <Typography variant="h5" fontWeight={800} color="text.primary" sx={{ mb: 0.5 }}>
        ฿{value.toLocaleString()}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: color,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {title}
      </Typography>
    </CardContent>
  </Card>
);

const AllStatistics = () => {
  const {
    allStatistics,
    selectedView,
    setSelectedView,
    setMonth,
    setYear,
    month,
    year,
    filterRange,
  } = useContext(StatisticsContext);

  const [filteredAll, setFilteredAll] = useState([]);
  const [filteredHotel, setFilteredHotel] = useState([]);
  const [filteredTaxi, setFilteredTaxi] = useState([]);
  const [filteredSelfdrive, setFilteredSelfdrive] = useState([]);
  const [filteredSightseeing, setFilteredSightseeing] = useState([]);
  const [chartType, setChartType] = useState("Bar");

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - 2025 + 1 },
    (_, i) => currentYear - i
  );

  useEffect(() => {
    setFilteredAll(allStatistics.Total || []);
    setFilteredHotel(allStatistics.Hotels || []);
    setFilteredTaxi(allStatistics.Cars || []);
    setFilteredSelfdrive(allStatistics.SelfDrive || []);
    setFilteredSightseeing(allStatistics.Sightseeing || []);
  }, [allStatistics]);

  const allTotal = amountCalculator(filteredAll);
  const hotelTotal = amountCalculator(filteredHotel);
  const SightseeingTotal = amountCalculator(filteredSightseeing);
  const taxiTotal = amountCalculator(filteredTaxi);
  const SelfdriveTotal = amountCalculator(filteredSelfdrive);

  return (
    <Box sx={{ pb: 4 }}>
      {/* Controls Section */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 4,
          border: "1px solid",
          borderColor: "divider",
          background: "white",
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Box sx={{ display: "flex", gap: 2 }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Typography variant="caption" sx={{ mb: 0.5, color: "text.secondary", fontWeight: 600 }}>
                  View By
                </Typography>
                <Select
                  value={selectedView}
                  onChange={(e) => setSelectedView(e.target.value)}
                  displayEmpty
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value={"Days"}>Days</MenuItem>
                  <MenuItem value={"Months"}>Months</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Typography variant="caption" sx={{ mb: 0.5, color: "text.secondary", fontWeight: 600 }}>
                  Chart Type
                </Typography>
                <Select
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value)}
                  displayEmpty
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value={"Bar"}>Bar</MenuItem>
                  <MenuItem value={"Line"}>Line</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-end", justifyContent: { md: "flex-end" } }}>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <Typography variant="caption" sx={{ mb: 0.5, color: "text.secondary", fontWeight: 600 }}>
                  Month
                </Typography>
                <Select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  displayEmpty
                  sx={{ borderRadius: 2 }}
                >
                  {months.map((val, i) => (
                    <MenuItem
                      value={val}
                      key={i}
                      disabled={
                        year == new Date().getFullYear() &&
                        i > new Date().getMonth()
                      }
                    >
                      {val}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <Typography variant="caption" sx={{ mb: 0.5, color: "text.secondary", fontWeight: 600 }}>
                  Year
                </Typography>
                <Select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  displayEmpty
                  sx={{ borderRadius: 2 }}
                >
                  {years.map((val, i) => (
                    <MenuItem value={val} key={i}>
                      {val}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                onClick={filterRange}
                startIcon={<FilterAltIcon />}
                sx={{
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 600,
                  background: "var(--primary-bg)",
                  height: 40,
                  mb: "1px" // Alignment tweak
                }}
              >
                Apply
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Chart Section */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 4,
          border: "1px solid",
          borderColor: "divider",
          minHeight: 400,
        }}
      >
        <BarEarningChart
          selectedView={selectedView}
          chartType={chartType}
          statsData={allStatistics}
        />
      </Paper>

      {/* Stats Cards Section */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Total Revenue"
            value={allTotal}
            icon={<AccountBalanceWalletIcon sx={{ fontSize: 32 }} />}
            color="#FF5722"
            gradient="linear-gradient(135deg, #FF5722 0%, #E64A19 100%)"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Hotels"
            value={hotelTotal}
            icon={<ApartmentIcon sx={{ fontSize: 32 }} />}
            color="#ffd000"
            gradient="linear-gradient(135deg, #ffd000 0%, #e6bb00 100%)"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Sightseeing"
            value={SightseeingTotal}
            icon={<LuggageIcon sx={{ fontSize: 32 }} />}
            color="#0c63e7"
            gradient="linear-gradient(135deg, #0c63e7 0%, #0a4fb8 100%)"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Taxi"
            value={taxiTotal}
            icon={<LocalTaxiRoundedIcon sx={{ fontSize: 32 }} />}
            color="#55AD9B"
            gradient="linear-gradient(135deg, #55AD9B 0%, #3d8c7c 100%)"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Self Drive"
            value={SelfdriveTotal}
            icon={<DirectionsCarIcon sx={{ fontSize: 32 }} />}
            color="#ee1e3a"
            gradient="linear-gradient(135deg, #ee1e3a 0%, #c41830 100%)"
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default AllStatistics;
