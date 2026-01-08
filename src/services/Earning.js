import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebase.config.js";

async function updateHourlyEarnings(orderAmount, type = "", id = "") {
  try {
    const now = new Date();

    const currentDate = now.toISOString().slice(0, 10);
    const currentHour = `${now.getHours().toString().padStart(2, "0")}:00`;

    const dailyDocRef =
      id === ""
        ? doc(
          db,
          `MasterEarnings/Admin/${type}/Earnings/dailyEarnings`,
          currentDate
        )
        : doc(
          db,
          `MasterEarnings/${type}/${id}/Earnings/dailyEarnings`,
          currentDate
        );

    const dailyDocSnapshot = await getDoc(dailyDocRef);

    if (dailyDocSnapshot.exists()) {
      const data = dailyDocSnapshot.data();
      let totalAmount = data.totalAmount || 0;
      let hourlyEarnings = data.hourlyEarnings || [];

      // Find if the current hour already exists
      const index = hourlyEarnings.findIndex(
        (entry) => entry.hour === currentHour
      );

      if (index >= 0) {
        // Update existing entry
        hourlyEarnings[index].earnings += Number(orderAmount);
      } else {
        // Add new entry for this hour
        hourlyEarnings.push({
          hour: currentHour,
          earnings: Number(orderAmount),
        });
      }
      totalAmount += Number(orderAmount);

      await updateDoc(dailyDocRef, { hourlyEarnings, totalAmount });
    } else {
      // Create the document if it doesn't exist
      await setDoc(dailyDocRef, {
        date: currentDate,
        hourlyEarnings: [{ hour: currentHour, earnings: Number(orderAmount) }],
        totalAmount: Number(orderAmount),
        timestamp: new Date(),
      });
    }

    // console.log(
    //   `Earnings updated successfully for ${currentDate} ${currentHour}`
    // );
  } catch (error) {
    console.error("Error updating hourly earnings:", error);
  }
}

async function updateMonthlyEarnings(orderAmount, type, id = "") {
  try {
    const now = new Date();

    // Format year and month (e.g., "2025-01" for January 2025)
    const currentYearMonth = `${now.getFullYear()}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;

    const monthlyDocRef =
      id === ""
        ? doc(
          db,
          `MasterEarnings/Admin/${type}/Earnings/monthlyEarnings`,
          currentYearMonth
        )
        : doc(
          db,
          `MasterEarnings/${type}/${id}/Earnings/monthlyEarnings`,
          currentYearMonth
        );

    const monthlyDocSnapshot = await getDoc(monthlyDocRef);

    if (monthlyDocSnapshot.exists()) {
      // Update the existing document
      const data = monthlyDocSnapshot.data();
      const currentEarnings = data.totalEarnings || 0;

      await updateDoc(monthlyDocRef, {
        totalEarnings: currentEarnings + Number(orderAmount),
      });
    } else {
      // Create a new document if it doesn't exist
      await setDoc(monthlyDocRef, {
        month: currentYearMonth,
        totalEarnings: Number(orderAmount),
        timestamp: new Date(),
      });
    }

    // console.log(
    //   `Monthly earnings updated successfully for ${currentYearMonth}`
    // );
  } catch (error) {
    console.error("Error updating monthly earnings:", error);
  }
}

function getLast30Days() {
  const dates = [];
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const currentDate = new Date();
    currentDate.setDate(now.getDate() - i);
    dates.push(currentDate.toISOString().slice(0, 10));
  }
  return dates.reverse(); // Sorted from earliest to latest
}

function getSelectedMonthDays(month, year) {
  const dates = [];
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
  const monthIndex = months.indexOf(month);

  // Start from Day 1 of the month
  const date = new Date(year, monthIndex, 1);

  // Loop until month changes
  while (date.getMonth() === monthIndex) {
    // Add date string
    const dateString = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .split('T')[0];
    dates.push(dateString);
    date.setDate(date.getDate() + 1);
  }
  return dates;
}

// Renamed for clarity, fetching daily earnings for a range of dates
async function getDailyEarningsInRange(type, month = "", year = "") {
  try {
    const last30Days =
      month === "" && year === ""
        ? getLast30Days()
        : getSelectedMonthDays(month, year);

    if (last30Days.length === 0) return [];

    const earningsRef = collection(
      db,
      `MasterEarnings/Admin/${type}/Earnings/dailyEarnings`
    );

    // Fetch in chunks or optimizing query. 
    // Firestore 'in' query supports up to 10-30 depending on implementation but here we use range.
    // Range query is efficient on 'date' string field.
    const earningsQuery = query(
      earningsRef,
      where("date", ">=", last30Days[0]),
      where("date", "<=", last30Days[last30Days.length - 1])
    );

    const querySnapshot = await getDocs(earningsQuery);

    const earningsMap = new Map(
      querySnapshot.docs.map((doc) => [doc.id, doc.data().totalAmount || 0])
    );

    const dailyEarnings = last30Days.map((date) => earningsMap.get(date) || 0);
    return dailyEarnings;
  } catch (error) {
    console.error("Error fetching daily earnings:", error);
    return [];
  }
}

async function createStatData(view = "Days", month = "", year = "") {
  try {
    const dateRange =
      month === "" && year === ""
        ? getLast30Days()
        : getSelectedMonthDays(month, year);
    const lastMonths = getLast12Months();
    const types = ["Cars", "SelfDrive", "Sightseeing", "Hotels"];
    const data = {
      date: view === "Days" ? dateRange : lastMonths,
      Cars: [],
      SelfDrive: [],
      Sightseeing: [],
      Hotels: [],
      Total: [],
    };
    for (let item of types) {
      if (view === "Days") {
        data[item] = await getDailyEarningsInRange(item, month, year);
      } else {
        data[item] = await getAllMonthlyEarnings(item);
      }
    }

    if (view === "Days") {
      data.Total = dateRange.map(
        (date, index) =>
          (data.Hotels[index] || 0) +
          (data.Sightseeing[index] || 0) +
          (data.Cars[index] || 0) +
          (data.SelfDrive[index] || 0)
      );
    } else {
      data.Total = lastMonths.map(
        (date, index) =>
          (data.Hotels[index] || 0) +
          (data.Sightseeing[index] || 0) +
          (data.Cars[index] || 0) +
          (data.SelfDrive[index] || 0)
      );
    }
    return data;
  } catch (error) {
    console.error("Error fetching earnings data:", error);
    return {
      date: [],
      Cars: [],
      SelfDrive: [],
      Sightseeing: [],
      Hotels: [],
      Total: [],
    };
  }
}

function getLast12Months() {
  const months = [];
  const now = new Date();
  const monthNames = [
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

  for (let i = 0; i < 12; i++) {
    const currentMonth = new Date();
    currentMonth.setMonth(now.getMonth() - i);
    const month = monthNames[currentMonth.getMonth()];
    const year = currentMonth.getFullYear().toString().slice(-2);
    months.push(`${month} ${year}`);
  }

  return months.reverse();
}

async function getAllMonthlyEarnings(type) {
  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(now.getMonth() - 11); // 12 months ago
    const startMonth = `${startDate.getFullYear()}-${(startDate.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;
    const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;

    const earningsRef = collection(
      db,
      `MasterEarnings/Admin/${type}/Earnings/monthlyEarnings`
    );

    const earningsQuery = query(
      earningsRef,
      where("month", ">=", startMonth),
      where("month", "<=", currentMonth)
    );

    const querySnapshot = await getDocs(earningsQuery);

    const monthlyEarnings = [];

    // Map the results, filling empty months with 0 if needed
    const monthMap = new Map(
      querySnapshot.docs.map((doc) => [doc.id, doc.data().totalEarnings || 0])
    );

    // Fill last 12 months, accounting for missing months
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(now);
      monthDate.setMonth(now.getMonth() - i);
      const year = monthDate.getFullYear();
      const month = (monthDate.getMonth() + 1).toString().padStart(2, "0");
      const monthId = `${year}-${month}`;

      monthlyEarnings.unshift(monthMap.get(monthId) || 0);
    }
    return monthlyEarnings;
  } catch (error) {
    console.error("Error fetching monthly earnings:", error);
  }
}

export {
  updateHourlyEarnings,
  updateMonthlyEarnings,
  createStatData,
  getDailyEarningsInRange,
  getAllMonthlyEarnings,
};
