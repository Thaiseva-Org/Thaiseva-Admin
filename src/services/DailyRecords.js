import {
  getDocs,
  orderBy,
  query,
  where,
  doc,
  updateDoc,
  limit,
  startAfter,
  getCountFromServer,
} from "firebase/firestore";
import {
  carBookingsCollection,
  roomBookingCollection,
  selfDriveBookingCollection,
  travelBookingCollection,
} from "../firebase/firebase.config";

export const todayBooking = async (
  setData,
  setLoading,
  category,
  startDate,
  endDate
) => {
  setLoading(true);

  const todayStart = new Date(startDate);
  todayStart.setDate(todayStart.getDate());
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(endDate);
  todayEnd.setHours(23, 59, 59, 999);

  let queryToUse;

  if (category === "Taxi Bookings") {
    queryToUse = query(
      carBookingsCollection,
      where("status", "==", "Accepted"),
      where("timestamp", ">=", todayStart),
      where("timestamp", "<=", todayEnd),
      orderBy("timestamp", "desc")
    );
  } else if (category === "Selfdrive Bookings") {
    queryToUse = query(
      selfDriveBookingCollection,
      where("status", "==", "Accepted"),
      where("time", ">=", todayStart),
      where("time", "<=", todayEnd),
      orderBy("time", "desc")
    );
  } else if (category === "Room Bookings") {
    queryToUse = query(
      roomBookingCollection,
      where("status", "==", "Accepted"),
      where("orderedAt", ">=", todayStart),
      where("orderedAt", "<=", todayEnd),
      orderBy("orderedAt", "desc")
    );
  } else {
    queryToUse = query(
      travelBookingCollection,
      where("status", "==", "Accepted"),
      where("orderedAt", ">=", todayStart),
      where("orderedAt", "<=", todayEnd),
      orderBy("orderedAt", "desc")
    );
  }
  try {
    const result = await getDocs(queryToUse);
    const list = result.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setData(list);
    return list;
  } catch (error) {
    console.error("Error fetching today bookings:", error);
  } finally {
    setLoading(false);
  }
};

export const handleClear = async (category, id, setRefetch) => {
  console.log(id);
  if (confirm("Are you sure to clear this entry?")) {
    let col;
    if (category === "Taxi Bookings") {
      col = carBookingsCollection;
    } else if (category === "Selfdrive Bookings") {
      col = selfDriveBookingCollection;
    } else if (category === "Room Bookings") {
      col = roomBookingCollection;
    } else {
      col = travelBookingCollection;
    }
    const OrderRef = doc(col, id);
    await updateDoc(OrderRef, "isPaymentClear", true);
    setRefetch((p) => !p);
  }
};

export const fetchBookingsTotalPages = async (
  setTotalPages,
  startDate,
  endDate,
  category
) => {
  const todayStart = new Date(startDate);
  todayStart.setDate(todayStart.getDate());
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(endDate);
  todayEnd.setHours(23, 59, 59, 999);

  let collectionRef;
  let timestampField;

  switch (category) {
    case "Taxi Bookings":
      collectionRef = carBookingsCollection;
      timestampField = "timestamp";
      break;
    case "Selfdrive Bookings":
      collectionRef = selfDriveBookingCollection;
      timestampField = "time";
      break;
    case "Room Bookings":
      collectionRef = roomBookingCollection;
      timestampField = "orderedAt";
      break;
    default:
      collectionRef = travelBookingCollection;
      timestampField = "orderedAt";
  }

  let queryToUse = query(
    collectionRef,
    where("status", "==", "Accepted"),
    where(timestampField, ">=", todayStart),
    where(timestampField, "<=", todayEnd),
    orderBy(timestampField, "desc")
  );

  const pages = await getCountFromServer(queryToUse);
  setTotalPages(Math.ceil(pages.data().count));
};

export const fetchTodayBooking = async (
  setData,
  setLoading,
  category,
  startDate,
  endDate,
  lastDoc = [],
  setLastDocs = () => {},
  pageSize = null,
  page = 0
) => {
  setLoading(true);

  const todayStart = new Date(startDate);
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(endDate);
  todayEnd.setHours(23, 59, 59, 999);

  let collectionRef;
  let timestampField;

  switch (category) {
    case "Taxi Bookings":
      collectionRef = carBookingsCollection;
      timestampField = "timestamp";
      break;
    case "Selfdrive Bookings":
      collectionRef = selfDriveBookingCollection;
      timestampField = "time";
      break;
    case "Room Bookings":
      collectionRef = roomBookingCollection;
      timestampField = "orderedAt";
      break;
    default:
      collectionRef = travelBookingCollection;
      timestampField = "orderedAt";
  }

  let queryToUse = query(
    collectionRef,
    where("status", "==", "Accepted"),
    where(timestampField, ">=", todayStart),
    where(timestampField, "<=", todayEnd),
    orderBy(timestampField, "desc")
  );

  if (pageSize) {
    queryToUse = query(
      collectionRef,
      where("status", "==", "Accepted"),
      where(timestampField, ">=", todayStart),
      where(timestampField, "<=", todayEnd),
      orderBy(timestampField, "desc"),
      limit(pageSize)
    );
  }

  if (page > 0 && lastDoc[page - 1]) {
    queryToUse = query(
      collectionRef,
      where("status", "==", "Accepted"),
      where(timestampField, ">=", todayStart),
      where(timestampField, "<=", todayEnd),
      orderBy(timestampField, "desc"),
      startAfter(lastDoc[page - 1]),
      limit(pageSize)
    );
  }

  try {
    const result = await getDocs(queryToUse);
    const list = result.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const lastDoc =
      result.docs.length > 0 ? result.docs[result.docs.length - 1] : null;
    setLastDocs((prev) => {
      const updated = [...prev];
      updated[page] = lastDoc;
      return updated;
    });

    setData(list);
    return list;
  } catch (error) {
    console.error("Error fetching today bookings:", error);
  } finally {
    setLoading(false);
  }
};

export const exportAllBooking = async (selDate) => {
  [
    "Room Bookings",
    "Sightseeing Bookings",
    "Taxi Bookings",
    "Selfdrive Bookings",
  ].map(async (item) => {
    await todayBooking(
      () => {},
      () => {},
      item,
      selDate
    );
  });
};
