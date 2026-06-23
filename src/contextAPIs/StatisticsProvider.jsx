import { createContext, useContext, useEffect, useState } from "react";
import { createStatData } from "../services/Earning";
import { AuthContext } from "./AuthProvider";

export const StatisticsContext = createContext();

const getTodayKey = () => {
  const today = new Date();
  return new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
};

const getDefaultFromKey = () => {
  const today = new Date();
  today.setDate(today.getDate() - 59);
  return new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
};

const normalizeRange = (fromDate, toDate) => {
  if (!fromDate || !toDate) {
    return {
      from: fromDate || getDefaultFromKey(),
      to: toDate || getTodayKey(),
    };
  }

  if (new Date(fromDate).getTime() <= new Date(toDate).getTime()) {
    return { from: fromDate, to: toDate };
  }

  return { from: toDate, to: fromDate };
};

const emptyStatistics = {
  date: [],
  Cars: [],
  SelfDrive: [],
  Sightseeing: [],
  Hotels: [],
  Vans: [],
  Total: [],
  reportingWindow: {
    from: "",
    to: "",
    fromLabel: "",
    toLabel: "",
    dayCount: 0,
    periodCount: 0,
  },
  totals: {
    totalRevenue: 0,
    averagePerDay: 0,
    averagePerPeriod: 0,
  },
  totalsByType: {},
  serviceBreakdown: [],
};

const StatisticsProvider = ({ children }) => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const canViewStatistics = isAdmin || isSubAdmin;
  const [allStatistics, setAllStatistics] = useState(emptyStatistics);
  const [selectedView, setSelectedView] = useState("Days");
  const [fromDate, setFromDate] = useState(getDefaultFromKey);
  const [toDate, setToDate] = useState(getTodayKey);
  const [appliedFromDate, setAppliedFromDate] = useState(getDefaultFromKey);
  const [appliedToDate, setAppliedToDate] = useState(getTodayKey);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAllStatistics = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await createStatData(selectedView, appliedFromDate, appliedToDate);
        setAllStatistics(data);

        const hasRevenue = Number(data?.totals?.totalRevenue) > 0;
        const hasSeries = Array.isArray(data?.date) && data.date.length > 0;

        if (!hasRevenue && !hasSeries && data?.loadError) {
          setError(data.loadError);
        }
      } catch (loadError) {
        console.error("Failed to load statistics:", loadError);
        setAllStatistics(emptyStatistics);
        setError("Unable to load statistics. Please check your permissions and try again.");
      } finally {
        setLoading(false);
      }
    };

    if (canViewStatistics) {
      loadAllStatistics();
    }
  }, [appliedFromDate, appliedToDate, canViewStatistics, selectedView]);

  const filterRange = async () => {
    const normalizedRange = normalizeRange(fromDate, toDate);

    setFromDate(normalizedRange.from);
    setToDate(normalizedRange.to);
    setAppliedFromDate(normalizedRange.from);
    setAppliedToDate(normalizedRange.to);
  };

  return (
    <StatisticsContext.Provider
      value={{
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
      }}
    >
      {children}
    </StatisticsContext.Provider>
  );
};

export default StatisticsProvider;
