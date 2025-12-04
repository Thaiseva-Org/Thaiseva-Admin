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
import { dateCalculator } from "../utils/utils";

const LineAndBarChart = ({
  title,
  all,
  hotelStatistics,
  localStatistics,
  travelStatistics,
  chartType,
}) => {
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

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: title,
      },
    },
    interaction: {
      mode: "index",
      intersect: false,
    },
  };

  const data = {
    type: chartType,
    labels: all.map((input) => {
      if (input.date) {
        const date = dateCalculator(input.date);
        return date;
      } else if (input.month) {
        return input.month;
      } else {
        return input.year;
      }
    }),
    datasets: [
      {
        // type: chartType,
        label: "Total ",
        borderColor: "#122159",
        data: all.map((input) => input.amount),
        backgroundColor: "#122159",
      },
      {
        // type: chartType,
        label: "Hotel ",
        data: hotelStatistics.map((input) => input.amount),
        borderColor: "blue",
        backgroundColor: "blue",
      },
      {
        // type: chartType,
        label: "Local ",
        data: localStatistics.map((input) => input.amount),
        borderColor: "green",
        backgroundColor: "green",
      },
      {
        // type: chartType,
        label: "Travel ",
        data: travelStatistics.map((input) => input.amount),
        borderColor: "orange",
        backgroundColor: "orange",
      },
    ],
  };

  if (chartType === "line")
    return <Line options={options} data={data} className="w-full h-full" />;
  if (chartType === "bar")
    return <Bar options={options} data={data} className="w-full h-full" />;
};

export default LineAndBarChart;
