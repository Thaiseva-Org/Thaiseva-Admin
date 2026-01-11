import { doc, getDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { statisticsCollection } from "../firebase/firebase.config";
import { AuthContext } from "./AuthProvider";
import { createStatData } from "../services/Earning";
export const StatisticsContext = createContext();

const StatisticsProvider = ({ children }) => {
  const [allStatistics, setAllStatistics] = useState({
    date: [],
    Cars: [],
    SelfDrive: [],
    Sightseeing: [],
    Hotels: [],
    Vans: [],
    Total: [],
  });
  const [selectedView, setSelectedView] = useState("Days");
  const [month, setMonth] = useState("Jan");
  const [year, setYear] = useState("2025");
  const { isAdmin } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadAllStatistics = async () => {
      setLoading(true);
      const data = await createStatData(selectedView);
      setAllStatistics(data);
      setLoading(false);
    };

    isAdmin && loadAllStatistics();
  }, [isAdmin, selectedView]);

  const filterRange = async () => {
    setLoading(true);
    const data = await createStatData("Days", month, year);
    setAllStatistics(data);
    setLoading(false);
  };



  const obj = {
    allStatistics,
    selectedView,
    setSelectedView,
    setMonth,
    month,
    year,
    setYear,
    filterRange,
    loading,
  };

  return (
    <StatisticsContext.Provider value={obj}>
      {children}
    </StatisticsContext.Provider>
  );
};

export default StatisticsProvider;
