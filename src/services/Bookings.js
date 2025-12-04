import {
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import {
  carBookingsCollection,
  roomBookingCollection,
  selfDriveBookingCollection,
  travelBookingCollection,
} from "../firebase/firebase.config";

const fetchBookingsTotalPages = async (
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
    where(timestampField, ">=", todayStart),
    where(timestampField, "<=", todayEnd),
    orderBy(timestampField, "desc")
  );

  const pages = await getCountFromServer(queryToUse);
  setTotalPages(Math.ceil(pages.data().count));
};

const fetchBookings = async (
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
    where(timestampField, ">=", todayStart),
    where(timestampField, "<=", todayEnd),
    orderBy(timestampField, "desc")
  );

  if (pageSize) {
    queryToUse = query(
      collectionRef,
      where(timestampField, ">=", todayStart),
      where(timestampField, "<=", todayEnd),
      orderBy(timestampField, "desc"),
      limit(pageSize)
    );
  }

  if (page > 0 && lastDoc[page - 1]) {
    queryToUse = query(
      collectionRef,
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
    console.error("Error fetching reservations:", error);
  } finally {
    setLoading(false);
  }
};

const fetchHotelBookingsTotalPages = async (
  setTotalPages,
  startDate,
  endDate,
  id
) => {
  const todayStart = new Date(startDate);
  todayStart.setDate(todayStart.getDate());
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(endDate);
  todayEnd.setHours(23, 59, 59, 999);

  let queryToUse = query(
    roomBookingCollection,
    where("hotelUid", "==", id),
    where("orderedAt", ">=", todayStart),
    where("orderedAt", "<=", todayEnd),
    orderBy("orderedAt", "desc")
  );

  const pages = await getCountFromServer(queryToUse);
  setTotalPages(Math.ceil(pages.data().count));
};

const fetchHotelBookings = async (
  setData,
  setLoading,
  id,
  startDate,
  endDate,
  lastDoc = [],
  setLastDocs = () => {},
  pageSize = null,
  page = 0
) => {
  setLoading(true);

  const todayStart = new Date(startDate);
  todayStart.setDate(todayStart.getDate());
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(endDate);
  todayEnd.setHours(23, 59, 59, 999);

  let queryToUse = query(
    roomBookingCollection,
    where("hotelUid", "==", id),
    where("orderedAt", ">=", todayStart),
    where("orderedAt", "<=", todayEnd),
    orderBy("orderedAt", "desc")
  );

  if (pageSize) {
    queryToUse = query(
      roomBookingCollection,
      where("hotelUid", "==", id),
      where("orderedAt", ">=", todayStart),
      where("orderedAt", "<=", todayEnd),
      orderBy("orderedAt", "desc"),
      limit(pageSize)
    );
  }

  if (page > 0 && lastDoc[page - 1]) {
    queryToUse = query(
      roomBookingCollection,
      where("hotelUid", "==", id),
      where("orderedAt", ">=", todayStart),
      where("orderedAt", "<=", todayEnd),
      orderBy("orderedAt", "desc"),
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
    console.error("Error fetching reservations:", error);
  } finally {
    setLoading(false);
  }
};

export {
  fetchBookings,
  fetchBookingsTotalPages,
  fetchHotelBookingsTotalPages,
  fetchHotelBookings,
};
