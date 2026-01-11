import { useState, useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  Filler,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import {
  ArrowBackIosNewRoundedIcon,
  ArrowForwardIosRoundedIcon,
} from "../utils/Icons";
import { Box, IconButton, Typography, useTheme, alpha } from "@mui/material";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const BarEarningChart = ({
  selectedView,
  chartType,
  statsData = {
    date: [],
    Cars: [],
    SelfDrive: [],
    Sightseeing: [],
    Hotels: [],
    Total: [],
  },
}) => {
  const chartRef = useRef(null);
  const theme = useTheme();
  // Initialize min based on data length
  const [min, setMin] = useState(0);
  // Max is derived from min for pagination window
  const getWindowSize = () => (selectedView === "Days" ? 7 : 6);
  const max = min + getWindowSize() - 1;

  const [data, setData] = useState({
    labels: [],
    datasets: [],
  });

  useEffect(() => {
    // Reset min when view changes or data updates to show the latest data (end of array)
    if (statsData.date.length > 0) {
      const windowSize = getWindowSize();
      const newMin = Math.max(0, statsData.date.length - windowSize);
      setMin(newMin);
    }
  }, [selectedView, statsData.date.length]);

  useEffect(() => {
    if (!statsData.date.length) return;

    const getGradient = (ctx, color) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, alpha(color, 0.8));
      gradient.addColorStop(1, alpha(color, 0.2));
      return gradient;
    };

    const datasets = [
      {
        label: "Total Revenue",
        data: statsData.Total,
        borderColor: "#FF9E2F",
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, "#FF9E2F");
          gradient.addColorStop(1, alpha("#FF9E2F", 0.3));
          return gradient;
        },
        pointBackgroundColor: "#fff",
        pointBorderColor: "#FF9E2F",
        borderRadius: 4,
      },
      {
        label: "Hotel",
        data: statsData.Hotels,
        borderColor: "#ffd000",
        backgroundColor: (context) => {
          // Simple color for inactive/secondary items or same gradient logic
          return chartType === "Line" ? alpha("#ffd000", 0.1) : "#ffd000";
        },
        pointBackgroundColor: "#fff",
        pointBorderColor: "#ffd000",
        borderRadius: 4,
      },
      {
        label: "Sightseeing",
        data: statsData.Sightseeing,
        borderColor: "#0c63e7",
        backgroundColor: chartType === "Line" ? alpha("#0c63e7", 0.1) : "#0c63e7",
        pointBackgroundColor: "#fff",
        pointBorderColor: "#0c63e7",
        borderRadius: 4,
      },
      {
        label: "Taxi",
        data: statsData.Cars,
        borderColor: "#55AD9B",
        backgroundColor: chartType === "Line" ? alpha("#55AD9B", 0.1) : "#55AD9B",
        pointBackgroundColor: "#fff",
        pointBorderColor: "#55AD9B",
        borderRadius: 4,
      },
      {
        label: "Self Drive",
        data: statsData.SelfDrive,
        borderColor: "#ee1e3a",
        backgroundColor: chartType === "Line" ? alpha("#ee1e3a", 0.1) : "#ee1e3a",
        pointBackgroundColor: "#fff",
        pointBorderColor: "#ee1e3a",
        borderRadius: 4,
      },
      {
        label: "Vans",
        data: statsData.Vans,
        borderColor: "#8b5cf6",
        backgroundColor: chartType === "Line" ? alpha("#8b5cf6", 0.1) : "#8b5cf6",
        pointBackgroundColor: "#fff",
        pointBorderColor: "#8b5cf6",
        borderRadius: 4,
      },
    ];

    setData({
      labels: statsData.date,
      datasets: datasets,
    });
  }, [selectedView, statsData, chartType]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        align: "end",
        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          padding: 20,
          font: {
            family: "'Inter', sans-serif",
            size: 12,
            weight: 500,
          },
          color: theme.palette.text.secondary,
        },
      },
      tooltip: {
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.secondary,
        borderColor: theme.palette.divider,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
        displayColors: true,
        boxPadding: 6,
        usePointStyle: true,
        titleFont: {
          size: 13,
          weight: 700,
          family: "'Inter', sans-serif",
        },
        bodyFont: {
          size: 12,
          family: "'Inter', sans-serif",
        },
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat("th-TH", {
                style: "currency",
                currency: "THB",
              }).format(context.parsed.y);
            }
            return label;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          font: {
            family: "'Inter', sans-serif",
            size: 12,
          },
          color: theme.palette.text.secondary,
          maxRotation: 0,
        },
        min: min,
        max: max,
        border: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        border: {
          display: false,
          dash: [4, 4],
        },
        grid: {
          color: theme.palette.divider,
          borderDash: [4, 4],
          drawBorder: false,
        },
        ticks: {
          padding: 10,
          font: {
            family: "'Inter', sans-serif",
            size: 11,
          },
          color: theme.palette.text.secondary,
          callback: function (value) {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
            if (value >= 1000) return (value / 1000).toFixed(0) + "k";
            return value;
          },
        },
      },
    },
    interaction: {
      mode: "index",
      intersect: false,
    },
    elements: {
      bar: {
        borderRadius: 4,
        borderSkipped: false,
      },
      line: {
        tension: 0.4,
        borderWidth: 3,
        fill: chartType === "Line",
      },
      point: {
        radius: 0,
        hoverRadius: 6,
        borderWidth: 3,
        hoverBorderWidth: 3,
      },
    },
  };

  const handleNext = () => {
    if (data.labels.length === 0) return;
    const windowSize = getWindowSize();
    if (max < data.labels.length - 1) {
      // Advance by half window size for smoother browsing, or full. Let's do 1 step or more.
      // Logic: Move forward but don't exceed bounds
      const step = 1;
      const newMin = Math.min(min + step, data.labels.length - windowSize);
      setMin(newMin);
    }
  };

  const handlePrev = () => {
    if (data.labels.length === 0) return;
    if (min > 0) {
      const step = 1;
      const newMin = Math.max(min - step, 0);
      setMin(newMin);
    }
  };

  // Only render if we have valid min/max logic? ChartJS handles empty data gracefully usually.

  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%", minHeight: "400px" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h6" fontWeight={700} color="text.primary">
          Earnings Overview
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <IconButton
            onClick={handlePrev}
            disabled={min <= 0}
            size="small"
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              "&:disabled": { opacity: 0.3 },
            }}
          >
            <ArrowBackIosNewRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton
            onClick={handleNext}
            disabled={max >= data.labels.length - 1}
            size="small"
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              "&:disabled": { opacity: 0.3 },
            }}
          >
            <ArrowForwardIosRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ height: "350px", width: "100%" }}>
        {chartType === "Line" ? (
          <Line ref={chartRef} options={options} data={data} />
        ) : (
          <Bar ref={chartRef} options={options} data={data} />
        )}
      </Box>
    </Box>
  );
};

export default BarEarningChart;
