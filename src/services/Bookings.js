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
  let isSightseeingBooking = false;

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
      timestampField = "createdAt";
      break;
    default:
      collectionRef = travelBookingCollection;
      timestampField = "orderedAt";
      isSightseeingBooking = true;
  }

  // For sightseeing bookings, fetch all and count client-side
  if (isSightseeingBooking) {
    const queryToUse = query(collectionRef);
    const result = await getDocs(queryToUse);

    // Filter by date range client-side
    const filteredCount = result.docs.filter((doc) => {
      const data = doc.data();
      const timestamp = data.orderedAt || data.createdAt || data.timestamp;
      if (!timestamp) return false;

      const bookingDate = timestamp.seconds
        ? new Date(timestamp.seconds * 1000)
        : new Date(timestamp);

      return bookingDate >= todayStart && bookingDate <= todayEnd;
    }).length;

    setTotalPages(filteredCount);
  } else {
    // Other booking types can use server-side counting
    let queryToUse = query(
      collectionRef,
      where(timestampField, ">=", todayStart),
      where(timestampField, "<=", todayEnd),
      orderBy(timestampField, "desc")
    );

    const pages = await getCountFromServer(queryToUse);
    setTotalPages(Math.ceil(pages.data().count));
  }
};

const fetchBookings = async (
  setData,
  setLoading,
  category,
  startDate,
  endDate,
  lastDoc = [],
  setLastDocs = () => { },
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
  let isSightseeingBooking = false;

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
      timestampField = "createdAt";
      break;
    default:
      collectionRef = travelBookingCollection;
      timestampField = "orderedAt"; // Primary field for old bookings
      isSightseeingBooking = true;
  }

  // For sightseeing bookings, we need to fetch all and filter/sort client-side
  // because they use different timestamp fields (orderedAt vs createdAt)
  let queryToUse;

  if (isSightseeingBooking) {
    // Fetch all sightseeing bookings without date filter (will filter client-side)
    queryToUse = query(collectionRef);
  } else {
    // Other booking types can use server-side filtering and sorting
    queryToUse = query(
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
  }

  try {
    const result = await getDocs(queryToUse);
    let list = result.docs.map((snap) => ({
      ...(snap.data() || {}),
      id: snap.id, // keep doc id last so it is never overwritten
    }));

    // Client-side filtering and sorting for sightseeing bookings
    if (isSightseeingBooking) {
      const toMs = (value) => {
        if (!value) return null;
        if (typeof value.toMillis === "function") return value.toMillis();
        if (typeof value.seconds === "number") {
          return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
        }
        if (value instanceof Date) return value.getTime();
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
      };

      // Filter by date range (orderedAt / createdAt / timestamp)
      list = list.filter((booking) => {
        const ms = toMs(
          booking.orderedAt || booking.createdAt || booking.timestamp
        );
        if (ms == null) return false;
        return ms >= todayStart.getTime() && ms <= todayEnd.getTime();
      });

      // Sort by timestamp (latest first)
      list.sort((a, b) => {
        const timeA =
          toMs(a.orderedAt || a.createdAt || a.timestamp) || 0;
        const timeB =
          toMs(b.orderedAt || b.createdAt || b.timestamp) || 0;
        return timeB - timeA;
      });

      // Apply pagination client-side
      if (pageSize) {
        const startIndex = page * pageSize;
        const endIndex = startIndex + pageSize;
        list = list.slice(startIndex, endIndex);
      }
    }

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
    where("createdAt", ">=", todayStart),
    where("createdAt", "<=", todayEnd),
    orderBy("createdAt", "desc")
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
  setLastDocs = () => { },
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
    where("createdAt", ">=", todayStart),
    where("createdAt", "<=", todayEnd),
    orderBy("createdAt", "desc")
  );

  if (pageSize) {
    queryToUse = query(
      roomBookingCollection,
      where("hotelUid", "==", id),
      where("createdAt", ">=", todayStart),
      where("createdAt", "<=", todayEnd),
      orderBy("createdAt", "desc"),
      limit(pageSize)
    );
  }

  if (page > 0 && lastDoc[page - 1]) {
    queryToUse = query(
      roomBookingCollection,
      where("hotelUid", "==", id),
      where("createdAt", ">=", todayStart),
      where("createdAt", "<=", todayEnd),
      orderBy("createdAt", "desc"),
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
