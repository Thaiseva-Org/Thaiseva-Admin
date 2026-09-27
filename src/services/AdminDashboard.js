/**
 * @fileoverview Service for fetching admin dashboard data from Firestore.
 */

import {
  getDocs,
  query
} from "firebase/firestore";
import {
  settingsCollection
} from "../firebase/firebase.config.js";

/**
 * Fetches dashboard data from the settings collection in Firestore.
 *
 * @async
 * @function fetchDashboardData
 * @param {Function} setDashboardData - State setter function to update the dashboard data.
 * @param {Function} setLoading - State setter function to update the loading status.
 * @returns {Promise<void>} A promise that resolves when the data fetching is complete.
 */
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
