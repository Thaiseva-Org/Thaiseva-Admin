import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebase.config.js";

const SERVICE_TYPES = ["Cars", "SelfDrive", "Sightseeing", "Hotels", "Vans"];

const SERVICE_LABELS = {
  Cars: "Taxi",
  SelfDrive: "Self Drive",
  Sightseeing: "Sightseeing",
  Hotels: "Hotels",
  Vans: "Vans",
};

const DEFAULT_RANGE_DAYS = 30;

const toDateKey = (date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];

const parseDateKey = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const startOfDay = (date) => {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const getDefaultDateRange = () => {
  const today = startOfDay(new Date());
  return {
    from: addDays(today, -(DEFAULT_RANGE_DAYS - 1)),
    to: today,
  };
};

const normalizeDateRange = (fromDate, toDate) => {
  const fallback = getDefaultDateRange();
  const start = fromDate ? startOfDay(new Date(fromDate)) : fallback.from;
  const end = toDate ? startOfDay(new Date(toDate)) : fallback.to;

  if (start.getTime() > end.getTime()) {
    return { from: end, to: start };
  }

  return { from: start, to: end };
};

const getDateKeysInRange = (fromDate, toDate) => {
  const dates = [];
  const cursor = new Date(fromDate);

  while (cursor.getTime() <= toDate.getTime()) {
    dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const formatDayLabel = (dateKey) =>
  parseDateKey(dateKey).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

const formatMonthLabel = (dateKey) =>
  parseDateKey(dateKey).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });

const sumSeries = (series = []) =>
  series.reduce((total, value) => total + (Number(value) || 0), 0);

const buildMonthlySeries = (dailyKeys, dailySeries) => {
  const buckets = new Map();

  dailyKeys.forEach((dateKey, index) => {
    const bucket = formatMonthLabel(dateKey);
    buckets.set(bucket, (buckets.get(bucket) || 0) + (Number(dailySeries[index]) || 0));
  });

  return {
    labels: Array.from(buckets.keys()),
    values: Array.from(buckets.values()),
  };
};

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
      const hourlyEarnings = data.hourlyEarnings || [];

      const index = hourlyEarnings.findIndex((entry) => entry.hour === currentHour);

      if (index >= 0) {
        hourlyEarnings[index].earnings += Number(orderAmount);
      } else {
        hourlyEarnings.push({
          hour: currentHour,
          earnings: Number(orderAmount),
        });
      }

      totalAmount += Number(orderAmount);
      await updateDoc(dailyDocRef, { hourlyEarnings, totalAmount });
      return;
    }

    await setDoc(dailyDocRef, {
      date: currentDate,
      hourlyEarnings: [{ hour: currentHour, earnings: Number(orderAmount) }],
      totalAmount: Number(orderAmount),
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error updating hourly earnings:", error);
  }
}

async function updateMonthlyEarnings(orderAmount, type, id = "") {
  try {
    const now = new Date();
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
      const data = monthlyDocSnapshot.data();
      const currentEarnings = data.totalEarnings || 0;

      await updateDoc(monthlyDocRef, {
        totalEarnings: currentEarnings + Number(orderAmount),
      });
      return;
    }

    await setDoc(monthlyDocRef, {
      month: currentYearMonth,
      totalEarnings: Number(orderAmount),
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error updating monthly earnings:", error);
  }
}

async function getDailyEarningsInRange(type, fromDate = "", toDate = "") {
  try {
    const { from, to } = normalizeDateRange(fromDate, toDate);
    const dateKeys = getDateKeysInRange(from, to);

    if (!dateKeys.length) {
      return [];
    }

    const earningsRef = collection(
      db,
      `MasterEarnings/Admin/${type}/Earnings/dailyEarnings`
    );

    const earningsQuery = query(
      earningsRef,
      where("date", ">=", dateKeys[0]),
      where("date", "<=", dateKeys[dateKeys.length - 1])
    );

    const querySnapshot = await getDocs(earningsQuery);
    const earningsMap = new Map(
      querySnapshot.docs.map((snapshotDoc) => [
        snapshotDoc.id,
        snapshotDoc.data().totalAmount || 0,
      ])
    );

    return dateKeys.map((dateKey) => earningsMap.get(dateKey) || 0);
  } catch (error) {
    console.error("Error fetching daily earnings:", error);
    return [];
  }
}

async function createStatData(view = "Days", fromDate = "", toDate = "") {
  try {
    const { from, to } = normalizeDateRange(fromDate, toDate);
    const dailyKeys = getDateKeysInRange(from, to);

    const dailySeriesEntries = await Promise.all(
      SERVICE_TYPES.map(async (type) => [
        type,
        await getDailyEarningsInRange(type, from, to),
      ])
    );

    const dailySeriesMap = Object.fromEntries(dailySeriesEntries);
    const totalDailySeries = dailyKeys.map((_, index) =>
      SERVICE_TYPES.reduce(
        (total, type) => total + (Number(dailySeriesMap[type]?.[index]) || 0),
        0
      )
    );

    let labels = dailyKeys.map(formatDayLabel);
    const chartSeries = { ...dailySeriesMap, Total: totalDailySeries };

    if (view === "Months") {
      const monthlyLabels = buildMonthlySeries(dailyKeys, totalDailySeries).labels;
      labels = monthlyLabels;

      SERVICE_TYPES.forEach((type) => {
        chartSeries[type] = buildMonthlySeries(dailyKeys, dailySeriesMap[type]).values;
      });
      chartSeries.Total = buildMonthlySeries(dailyKeys, totalDailySeries).values;
    }

    const totalsByType = SERVICE_TYPES.reduce((accumulator, type) => {
      accumulator[type] = sumSeries(dailySeriesMap[type]);
      return accumulator;
    }, {});

    const totalRevenue = sumSeries(totalDailySeries);
    const periodCount = chartSeries.Total.length || 1;
    const dayCount = dailyKeys.length || 1;

    const serviceBreakdown = SERVICE_TYPES.map((type) => ({
      key: type,
      label: SERVICE_LABELS[type],
      total: totalsByType[type],
      share: totalRevenue > 0 ? (totalsByType[type] / totalRevenue) * 100 : 0,
    })).sort((left, right) => right.total - left.total);

    return {
      date: labels,
      Cars: chartSeries.Cars,
      SelfDrive: chartSeries.SelfDrive,
      Sightseeing: chartSeries.Sightseeing,
      Hotels: chartSeries.Hotels,
      Vans: chartSeries.Vans,
      Total: chartSeries.Total,
      reportingWindow: {
        from: toDateKey(from),
        to: toDateKey(to),
        fromLabel: from.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        toLabel: to.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        dayCount,
        periodCount,
      },
      totals: {
        totalRevenue,
        averagePerDay: totalRevenue / dayCount,
        averagePerPeriod: totalRevenue / periodCount,
      },
      totalsByType,
      serviceBreakdown,
    };
  } catch (error) {
    console.error("Error fetching earnings data:", error);
    return {
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
  }
}

export {
  createStatData,
  getDailyEarningsInRange,
  updateHourlyEarnings,
  updateMonthlyEarnings,
};
