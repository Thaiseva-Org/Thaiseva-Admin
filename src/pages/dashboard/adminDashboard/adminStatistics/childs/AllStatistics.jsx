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
  Skeleton,
} from "@mui/material";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import AirportShuttleIcon from "@mui/icons-material/AirportShuttle";

// Custom Stat Card Component
const StatCard = ({ title, value, icon, color, gradient }) => (
  <Card
    sx={{
      borderRadius: "20px",
      boxShadow: "0 2px 20px rgba(0,0,0,0.05)",
      background: "#fff",
      position: "relative",
      overflow: "hidden",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      border: "1px solid rgba(0,0,0,0.05)",
      "&:hover": {
        transform: "translateY(-8px)",
        boxShadow: `0 20px 40px -10px ${color}30`,
      },
    }}
  >
    {/* Decorative Background Circle */}
    <Box
      sx={{
        position: 'absolute',
        top: -20,
        right: -20,
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: gradient,
        opacity: 0.15,
        zIndex: 0
      }}
    />

    <CardContent sx={{ position: "relative", zIndex: 1, p: "24px !important" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 3 }}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: "16px",
            background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
            color: color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </Box>
      </Box>

      <Box>
        <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600, mb: 0.5, fontSize: '0.85rem' }}>
          {title}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, color: "text.primary", letterSpacing: '-0.5px' }}>
          <span style={{ fontSize: '1.2rem', marginRight: '4px', verticalAlign: 'text-top', opacity: 0.7 }}>฿</span>
          {value.toLocaleString()}
        </Typography>
      </Box>
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
    loading,
  } = useContext(StatisticsContext);

  const [filteredAll, setFilteredAll] = useState([]);
  const [filteredHotel, setFilteredHotel] = useState([]);
  const [filteredTaxi, setFilteredTaxi] = useState([]);
  const [filteredSelfdrive, setFilteredSelfdrive] = useState([]);
  const [filteredSightseeing, setFilteredSightseeing] = useState([]);
  const [filteredVans, setFilteredVans] = useState([]);
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
    setFilteredVans(allStatistics.Vans || []);
  }, [allStatistics]);

  const allTotal = amountCalculator(filteredAll);
  const hotelTotal = amountCalculator(filteredHotel);
  const SightseeingTotal = amountCalculator(filteredSightseeing);
  const taxiTotal = amountCalculator(filteredTaxi);
  const SelfdriveTotal = amountCalculator(filteredSelfdrive);
  const vanTotal = amountCalculator(filteredVans);

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
      {loading ? (
        <Skeleton
          variant="rectangular"
          height={400}
          sx={{ borderRadius: 4, mb: 4 }}
        />
      ) : (
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
      )}

      {/* Stats Cards Section */}
      <Grid container spacing={3}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={2} key={i}>
              <Skeleton
                variant="rectangular"
                height={180}
                sx={{ borderRadius: 4 }}
              />
            </Grid>
          ))
          : [
            {
              title: "Total Revenue",
              value: allTotal,
              icon: <AccountBalanceWalletIcon sx={{ fontSize: 32 }} />,
              color: "#FF9E2F",
              gradient: "linear-gradient(135deg, #FF9E2F 0%, #E0851F 100%)",
            },
            {
              title: "Hotels",
              value: hotelTotal,
              icon: <ApartmentIcon sx={{ fontSize: 32 }} />,
              color: "#ffd000",
              gradient: "linear-gradient(135deg, #ffd000 0%, #e6bb00 100%)",
            },
            {
              title: "Sightseeing",
              value: SightseeingTotal,
              icon: <LuggageIcon sx={{ fontSize: 32 }} />,
              color: "#0c63e7",
              gradient: "linear-gradient(135deg, #0c63e7 0%, #0a4fb8 100%)",
            },
            {
              title: "Taxi",
              value: taxiTotal,
              icon: <LocalTaxiRoundedIcon sx={{ fontSize: 32 }} />,
              color: "#55AD9B",
              gradient: "linear-gradient(135deg, #55AD9B 0%, #3d8c7c 100%)",
            },
            {
              title: "Self Drive",
              value: SelfdriveTotal,
              icon: <DirectionsCarIcon sx={{ fontSize: 32 }} />,
              color: "#ee1e3a",
              gradient: "linear-gradient(135deg, #ee1e3a 0%, #c41830 100%)",
            },
            {
              title: "Vans",
              value: vanTotal,
              icon: <AirportShuttleIcon sx={{ fontSize: 32 }} />,
              color: "#8b5cf6",
              gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
            },
          ].map((item, index) => (
            <Grid item xs={12} sm={6} md={2} key={index}>
              <StatCard {...item} />
            </Grid>
          ))}
      </Grid>
    </Box>
  );
};

export default AllStatistics;
