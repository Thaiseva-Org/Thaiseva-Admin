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
import {
  carBookingsCollection,
  db,
  roomBookingCollection,
  selfDriveBookingCollection,
  travelBookingCollection,
  vanBookingsCollection,
} from "../firebase/firebase.config.js";
import { isHotelRevenueEligible } from "../utils/bookingStatus.js";

const SERVICE_TYPES = ["Cars", "SelfDrive", "Sightseeing", "Hotels", "Vans"];

const SERVICE_LABELS = {
  Cars: "Taxi",
  SelfDrive: "Self Drive",
  Sightseeing: "Sightseeing",
  Hotels: "Hotels",
  Vans: "Vans",
};

const DEFAULT_RANGE_DAYS = 60;

const ACCEPTED_STATUS_VALUES = new Set([
  "accepted",
  "confirmed",
  "done",
  "completed",
]);

const isVanTransportBooking = (booking = {}) =>
  String(booking.transportType || "").toLowerCase().includes("van");

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

const endOfDay = (date) => {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
};

const toTimestamp = (value) => {
  if (!value) return null;

  if (value.seconds) {
    return new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isAcceptedBooking = (booking = {}) => {
  const rawStatus = booking.bookingStatus || booking.status || "";
  const normalized = String(rawStatus).trim().toLowerCase();
  return ACCEPTED_STATUS_VALUES.has(normalized);
};

const getBookingAmount = (booking = {}) =>
  Number(
    booking.amountTHB ??
      booking.AmountOffered ??
      booking.finalPrice ??
      booking.price ??
      booking.totalAmount ??
      booking.amount ??
      0
  ) || 0;

const getBookingDate = (booking = {}, dateFields = []) => {
  for (const field of dateFields) {
    const parsed = toTimestamp(booking[field]);
    if (parsed) return parsed;
  }

  return null;
};

async function fetchBookingsInRange(collectionRef, dateFields, fromDate, toDate, extraFilter) {
  const rangeStart = startOfDay(fromDate);
  const rangeEnd = endOfDay(toDate);
  const fromKey = toDateKey(rangeStart);
  const toKey = toDateKey(rangeEnd);
  const docsMap = new Map();

  for (const field of dateFields) {
    const queryAttempts = [
      query(
        collectionRef,
        where(field, ">=", rangeStart),
        where(field, "<=", rangeEnd)
      ),
      query(collectionRef, where(field, ">=", fromKey), where(field, "<=", toKey)),
      query(
        collectionRef,
        where(field, ">=", `${fromKey}T00:00`),
        where(field, "<=", `${toKey}T23:59`)
      ),
    ];

    for (const queryToUse of queryAttempts) {
      try {
        const snapshot = await getDocs(queryToUse);
        snapshot.docs.forEach((snapshotDoc) => {
          docsMap.set(snapshotDoc.id, { id: snapshotDoc.id, ...snapshotDoc.data() });
        });
      } catch (error) {
        if (error?.code !== "failed-precondition") {
          console.warn(`Statistics query skipped for ${field}:`, error?.code || error?.message);
        }
      }
    }
  }

  const bookings = Array.from(docsMap.values());
  return extraFilter ? bookings.filter(extraFilter) : bookings;
}

function bucketBookingRevenue(bookings, dateKeys, dateFields) {
  const buckets = new Map(dateKeys.map((dateKey) => [dateKey, 0]));

  bookings.forEach((booking) => {
    if (!isAcceptedBooking(booking)) return;

    const amount = getBookingAmount(booking);
    if (amount <= 0) return;

    const bookingDate = getBookingDate(booking, dateFields);
    if (!bookingDate) return;

    const dateKey = toDateKey(startOfDay(bookingDate));
    if (!buckets.has(dateKey)) return;

    buckets.set(dateKey, buckets.get(dateKey) + amount);
  });

  return dateKeys.map((dateKey) => buckets.get(dateKey) || 0);
}

function bucketTransportRealizedCommission(bookings, dateKeys, dateFields) {
  const buckets = new Map(dateKeys.map((dateKey) => [dateKey, 0]));
  const add = (value, date) => {
    if (!date) return;
    const key = toDateKey(startOfDay(date));
    if (buckets.has(key)) buckets.set(key, buckets.get(key) + value);
  };

  bookings.forEach((booking) => {
    const rate = Math.max(
      0,
      Math.min(100, Number(booking.commissionPercentage ?? booking.comission) || 0)
    ) / 100;
    const payments = Array.isArray(booking.paymentTransactions)
      ? booking.paymentTransactions
      : [];
    const refunds = Array.isArray(booking.refundTransactions)
      ? booking.refundTransactions
      : [];

    if (payments.length || refunds.length) {
      payments.forEach((payment) => add(
        Math.max(0, Number(payment.amount) || 0) * rate,
        toTimestamp(payment.receivedDate || payment.createdAt)
      ));
      refunds.forEach((refund) => add(
        -Math.max(0, Number(refund.amount) || 0) * rate,
        toTimestamp(refund.receivedDate || refund.createdAt)
      ));
      return;
    }

    // Compatibility for older paid records that predate transaction history.
    const explicitlyPaid = String(booking.paymentStatus || "").toLowerCase() === "paid" ||
      booking.isPaymentDone === true || booking.isPaymentClear === true;
    const received = Math.max(0, Number(booking.amountReceived) || 0);
    if (!explicitlyPaid && received <= 0) return;
    const refunded = Math.max(0, Number(booking.amountRefunded) || 0);
    add(
      Math.max(0, (received || getBookingAmount(booking)) - refunded) * rate,
      getBookingDate(booking, dateFields)
    );
  });

  return dateKeys.map((dateKey) => buckets.get(dateKey) || 0);
}

async function getBookingRevenueInRange(type, fromDate = "", toDate = "") {
  const { from, to } = normalizeDateRange(fromDate, toDate);
  const dateKeys = getDateKeysInRange(from, to);

  if (!dateKeys.length) {
    return { values: [], permissionError: null };
  }

  try {
    let bookings = [];

    switch (type) {
      case "Hotels":
        bookings = await fetchBookingsInRange(
          roomBookingCollection,
          ["checkInDate", "checkIn", "createdAt", "orderedAt", "timestamp"],
          from,
          to
        );
        bookings = bookings.filter(isHotelRevenueEligible);
        break;
      case "Sightseeing":
        bookings = await fetchBookingsInRange(travelBookingCollection, [
          "orderedAt",
          "createdAt",
          "timestamp",
        ], from, to);
        break;
      case "Cars":
        bookings = await fetchBookingsInRange(
          carBookingsCollection,
          ["timestamp", "orderedAt", "createdAt"],
          from,
          to,
          (booking) => !isVanTransportBooking(booking)
        );
        break;
      case "SelfDrive":
        bookings = await fetchBookingsInRange(selfDriveBookingCollection, [
          "time",
          "timestamp",
          "createdAt",
          "orderedAt",
        ], from, to);
        break;
      case "Vans": {
        const manualVans = await fetchBookingsInRange(
          vanBookingsCollection,
          ["bookingDate", "createdAt", "orderedAt", "timestamp"],
          from,
          to
        );
        const mobileVans = await fetchBookingsInRange(
          carBookingsCollection,
          ["timestamp", "orderedAt", "createdAt"],
          from,
          to,
          isVanTransportBooking
        );
        bookings = [...manualVans, ...mobileVans];
        return {
          values: bucketTransportRealizedCommission(bookings, dateKeys, [
            "bookingDate",
            "createdAt",
            "orderedAt",
            "timestamp",
            "time",
          ]),
          permissionError: null,
        };
      }
      default:
        bookings = [];
    }

    return {
      values: ["Cars", "SelfDrive"].includes(type)
        ? bucketTransportRealizedCommission(bookings, dateKeys, [
          "createdAt",
          "orderedAt",
          "timestamp",
          "time",
          "bookingDate",
        ])
        : bucketBookingRevenue(bookings, dateKeys, [
        "checkInDate",
        "checkIn",
        "createdAt",
        "orderedAt",
        "timestamp",
        "time",
        "bookingDate",
        ]),
      permissionError: null,
    };
  } catch (error) {
    console.error(`Error fetching ${type} booking revenue:`, error);

    return {
      values: dateKeys.map(() => 0),
      permissionError:
        error?.code === "permission-denied"
          ? "You do not have permission to read booking revenue."
          : null,
    };
  }
}

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
  let permissionError = null;

  try {
    const { from, to } = normalizeDateRange(fromDate, toDate);
    const dateKeys = getDateKeysInRange(from, to);

    if (!dateKeys.length) {
      return { values: [], permissionError: null };
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
      querySnapshot.docs.map((snapshotDoc) => {
        const data = snapshotDoc.data();
        const dateKey = data.date || snapshotDoc.id;
        return [dateKey, data.totalAmount || 0];
      })
    );

    return {
      values: dateKeys.map((dateKey) => earningsMap.get(dateKey) || 0),
      permissionError,
    };
  } catch (error) {
    console.error("Error fetching daily earnings:", error);

    if (error?.code === "permission-denied") {
      permissionError = "You do not have permission to read earnings data.";
    }

    return {
      values: [],
      permissionError,
    };
  }
}

async function createStatData(view = "Days", fromDate = "", toDate = "") {
  try {
    const { from, to } = normalizeDateRange(fromDate, toDate);
    const dailyKeys = getDateKeysInRange(from, to);

    const dailySeriesEntries = await Promise.all(
      SERVICE_TYPES.map(async (type) => {
        const bookingResult = await getBookingRevenueInRange(type, from, to);

        if (!bookingResult.permissionError) {
          return [type, bookingResult];
        }

        const earningsResult = await getDailyEarningsInRange(type, from, to);
        return [type, earningsResult];
      })
    );

    const loadError = dailySeriesEntries.find(([, result]) => result.permissionError)?.[1]
      ?.permissionError;

    const dailySeriesMap = Object.fromEntries(
      dailySeriesEntries.map(([type, result]) => [type, result.values])
    );
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
      loadError: loadError || null,
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
      loadError:
        error?.code === "permission-denied"
          ? "You do not have permission to read earnings data."
          : "Unable to load earnings data.",
    };
  }
}

export {
  createStatData,
  getDailyEarningsInRange,
  updateHourlyEarnings,
  updateMonthlyEarnings,
};
