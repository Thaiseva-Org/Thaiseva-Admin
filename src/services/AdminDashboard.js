import {
  getDocs,
  query
} from "firebase/firestore";
import {
  settingsCollection
} from "../firebase/firebase.config.js";

const fetchDashboardData = async (setDashboardData, setLoading) => {
  setLoading(true);
  try {
    const q = query(settingsCollection);
    const snapshot = await getDocs(q);
    const data = snapshot?.docs?.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
      };
    });
    setDashboardData(data);
  } catch (error) {
    console.error("Error fetching dashboard data: ", error);
  } finally {
    setLoading(false);
  }
};

export { fetchDashboardData };

