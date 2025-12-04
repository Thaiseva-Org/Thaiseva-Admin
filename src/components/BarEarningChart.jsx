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
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
// import { createStatData } from "../services/Earning";
import {
  ArrowBackIosNewRoundedIcon,
  ArrowForwardIosRoundedIcon,
} from "../utils/Icons";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
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
  const [min, setMin] = useState(statsData.Hotels.length - 5);
  const max = selectedView === "Days" ? min + 5 : min + 2;
  const [data, setData] = useState({
    labels: [],
    datasets: [],
  });

  useEffect(() => {
    async function fetchData() {
      try {
        setMin(
          selectedView === "Days"
            ? statsData.Hotels.length - 6
            : statsData.Hotels.length - 3
        );
        setData({
          labels: statsData.date.map((date) => date),
          datasets: [
            {
              label: "Total ",
              data: statsData.Total.map((input) => input),
              borderColor: "#be0aff",
              backgroundColor: "#be0aff",
            },
            {
              label: "Hotel ",
              data: statsData.Hotels.map((input) => input),
              borderColor: "#ffd000",
              backgroundColor: "#ffd000",
            },
            {
              label: "Sightseeing ",
              data: statsData.Sightseeing.map((input) => input),
              borderColor: "#0c63e7",
              backgroundColor: "#0c63e7",
            },
            {
              label: "Taxi ",
              data: statsData.Cars.map((input) => input),
              borderColor: "#55AD9B",
              backgroundColor: "#55AD9B",
            },
            {
              label: "Self Drive ",
              data: statsData.SelfDrive.map((input) => input),
              borderColor: "#ee1e3a",
              backgroundColor: "#ee1e3a",
            },
          ],
        });
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    }
    fetchData();
  }, [selectedView, statsData]);

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Earnings",
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          autoSkip: false,
          maxTicksLimit: 7,
        },
        min: min,
        max: max,
      },
      y: {
        beginAtZero: true,
      },
    },
    interaction: {
      mode: "index",
      intersect: false,
    },
  };

  const handleNext = () => {
    if (max < data.labels.length - 1) {
      const newMin = Math.min(
        min + 3,
        selectedView === "Days"
          ? data.labels.length - 6
          : data.labels.length - 3
      );
      setMin(newMin);
      chartRef.current.options.scales.x.min = newMin;
      chartRef.current.options.scales.x.max =
        selectedView === "Days" ? newMin + 6 : newMin + 3;
      chartRef.current.update();
    }
  };

  const handlePrev = () => {
    if (min > 0) {
      const newMin = Math.max(min - 3, 0);
      setMin(newMin);
      chartRef.current.options.scales.x.min = newMin;
      chartRef.current.options.scales.x.max =
        selectedView === "Days" ? newMin + 6 : newMin + 3;
      chartRef.current.update();
    }
  };

  return (
    <>
      <div className="flex justify-center gap-5 my-4">
        <div className="flex items-center justify-center">
          <button
            className={`p-2 bg-blue-500 text-white rounded-full ${
              min === 0 ? "opacity-50 cursor-not-allowed" : ""
            }`}
            onClick={handlePrev}
            disabled={min === 0}
          >
            <ArrowBackIosNewRoundedIcon />
          </button>
        </div>
        {chartType === "Line" ? (
          <Line
            ref={chartRef}
            options={options}
            data={data}
            className="w-full h-full"
          />
        ) : (
          <Bar
            ref={chartRef}
            options={options}
            data={data}
            className="w-full h-full"
          />
        )}
        <div className="flex items-center justify-center">
          <button
            className={`p-2 bg-blue-500 text-white rounded-full ${
              max >= data.labels.length - 1
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
            onClick={handleNext}
            disabled={max >= data.labels.length - 1}
          >
            <ArrowForwardIosRoundedIcon />
          </button>
        </div>
      </div>
    </>
  );
};

export default BarEarningChart;
