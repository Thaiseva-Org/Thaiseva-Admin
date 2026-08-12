import {
  getDocs,
  orderBy,
  query,
  where,
  doc,
  updateDoc,
  limit,
  getDoc,
} from "firebase/firestore";
import {
  carBookingsCollection,
  roomBookingCollection,
  selfDriveBookingCollection,
  travelBookingCollection,
} from "../firebase/firebase.config";
import { generateInvoiceIds, INVOICE_TYPES } from "../utils/invoiceGenerator";

const SIGHTSEEING_PENDING_STATUSES = [
  "Pending",
  "pending",
  "PENDING",
  "Not Reviewed",
  "not reviewed",
  "NOT REVIEWED",
  "In Progress",
  "in progress",
  "IN PROGRESS",
  "Reviewed",
  "reviewed",
  "REVIEWED",
  "Awaiting Payment",
  "awaiting payment",
  "AWAITING PAYMENT",
  "Pending Verification",
  "pending verification",
  "PENDING_VERIFICATION",
  "Payment Pending",
  "payment pending",
  "PAYMENT_PENDING",
];

const SIGHTSEEING_ACTIVE_STATUSES = [
  "Accepted",
  "Confirmed",
  "Done",
  "accepted",
  "confirmed",
  "done",
  "ACCEPTED",
  "CONFIRMED",
  "DONE",
  ...SIGHTSEEING_PENDING_STATUSES,
];

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const isSightseeingDashboardStatus = (value) => {
  const normalized = normalizeStatus(value);
  if (!normalized) return true;
  return SIGHTSEEING_ACTIVE_STATUSES.some(
    (status) => normalizeStatus(status) === normalized
  );
};

// Helper to resolve collection based on category
// Helper to resolve collection based on category
const getCollectionAndTimestamp = (category, startDate, endDate) => {
  const todayStart = new Date(startDate);
  todayStart.setDate(todayStart.getDate());
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(endDate);
  todayEnd.setHours(23, 59, 59, 999);

  let collectionRef;
  let timestampField;

  // Trim category to avoid matching issues
  const cat = category ? String(category).trim() : "";

  if (cat === "Taxi Bookings") {
    collectionRef = carBookingsCollection;
    timestampField = "timestamp";
  } else if (cat === "Selfdrive Bookings") {
    collectionRef = selfDriveBookingCollection;
    timestampField = "time";
  } else if (cat === "Room Bookings") {
    collectionRef = roomBookingCollection;
    timestampField = "createdAt";
  } else {
    // Default to Sightseeing
    collectionRef = travelBookingCollection;
    timestampField = "orderedAt";
  }

  return { collectionRef, timestampField, todayStart, todayEnd };
};

const CATEGORY_DATE_FIELDS = {
  "Room Bookings": ["createdAt", "orderedAt", "timestamp", "checkInDate", "checkIn"],
  "Sightseeing Bookings": ["orderedAt", "createdAt", "timestamp"],
  "Taxi Bookings": ["timestamp", "orderedAt", "createdAt"],
  "Selfdrive Bookings": ["time", "timestamp", "createdAt", "orderedAt"],
};

const toDateValue = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value.seconds) {
    return new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toLocalDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDateRange = (startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59.999`);
  return { start, end };
};

const isWithinRange = (value, start, end) => {
  const date = toDateValue(value);
  return date && date >= start && date <= end;
};

const bookingMatchesRange = (booking, fields, start, end) =>
  fields.some((field) => isWithinRange(booking[field], start, end));

const getBookingDateValue = (booking, fields) => {
  for (const field of fields) {
    const date = toDateValue(booking[field]);
    if (date) return date.getTime();
  }
  return 0;
};

const fetchCollectionInRange = async (collectionRef, fields, start, end) => {
  const docsMap = new Map();
  const startKey = toLocalDateKey(start);
  const endKey = toLocalDateKey(end);

  await Promise.all(
    fields.flatMap((field) => {
      const attempts = [
        query(collectionRef, where(field, ">=", start), where(field, "<=", end)),
        query(
          collectionRef,
          where(field, ">=", startKey),
          where(field, "<=", `${endKey}\uf8ff`)
        ),
      ];

      return attempts.map(async (queryToUse) => {
        try {
          const snapshot = await getDocs(queryToUse);
          snapshot.docs.forEach((snapshotDoc) => {
            docsMap.set(snapshotDoc.id, {
              id: snapshotDoc.id,
              ...snapshotDoc.data(),
            });
          });
        } catch (error) {
          console.warn(
            `Booking date query skipped for ${field}:`,
            error?.code || error?.message
          );
        }
      });
    })
  );

  return Array.from(docsMap.values()).filter((booking) =>
    bookingMatchesRange(booking, fields, start, end)
  );
};

const fetchAllBookingsForCategory = async (category, startDate, endDate) => {
  const { start, end } = getDateRange(startDate, endDate);
  const fields = CATEGORY_DATE_FIELDS[category] || CATEGORY_DATE_FIELDS["Sightseeing Bookings"];

  // Taxi Bookings = all car_bookings (car | van | taxi | bike)
  const collectionRef =
    category === "Room Bookings"
      ? roomBookingCollection
      : category === "Taxi Bookings"
        ? carBookingsCollection
        : category === "Selfdrive Bookings"
          ? selfDriveBookingCollection
          : travelBookingCollection;
  const bookings = await fetchCollectionInRange(collectionRef, fields, start, end);

  return bookings.sort(
    (a, b) => getBookingDateValue(b, fields) - getBookingDateValue(a, fields)
  );
};

export const todayBooking = async (
  setData,
  setLoading,
  category,
  startDate,
  endDate
) => {
  setLoading(true);
  try {
    const list = await fetchAllBookingsForCategory(category, startDate, endDate);
    setData(list);
    return list;
  } catch (error) {
    console.error("Error fetching today bookings:", error);
    return [];
  } finally {
    setLoading(false);
  }
};

export const handleClear = async (category, id, source = null) => {
  try {
    let col;
    let serviceType;
    const cat = category?.trim();

    if (cat === "Taxi Bookings") {
      col = carBookingsCollection;
      serviceType = INVOICE_TYPES.TAXI;
    } else if (cat === "Selfdrive Bookings") {
      col = selfDriveBookingCollection;
      serviceType = INVOICE_TYPES.SAFE_DRIVE;
    } else if (cat === "Room Bookings") {
      col = roomBookingCollection;
      serviceType = INVOICE_TYPES.ROOM;
    } else {
      col = travelBookingCollection;
      serviceType = INVOICE_TYPES.SIGHTSEEING;
    }

    const OrderRef = doc(col, id);
    const docSnap = await getDoc(OrderRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      let updates = { isPaymentClear: true, isPaymentDone: true };

      if (!data.customerInvoiceId || !data.partnerInvoiceId) {
        try {
          const { customerId, partnerId } = await generateInvoiceIds(serviceType);
          updates = {
            ...updates,
            customerInvoiceId: customerId,
            partnerInvoiceId: partnerId,
            invoiceId: partnerId,
          };
        } catch (err) {
          console.error("Failed to generate invoice ID during clear:", err);
        }
      }

      await updateDoc(OrderRef, updates);
    } else {
      await updateDoc(OrderRef, { isPaymentClear: true, isPaymentDone: true });
    }

    return true;
  } catch (error) {
    console.error("Error clearing payment status:", error);
    throw error;
  }
};

export const fetchBookingsTotalPages = async (
  setTotalPages,
  startDate,
  endDate,
  category
) => {
  try {
    const bookings = await fetchAllBookingsForCategory(category, startDate, endDate);
    setTotalPages(bookings.length);
  } catch (error) {
    console.error("Error fetching total pages:", error);
    setTotalPages(0);
  }
};

export const fetchTodayBooking = async (
  setData,
  setLoading,
  category,
  startDate,
  endDate,
  pageSize = null,
  page = 0
) => {
  setLoading(true);
  const { collectionRef, timestampField, todayStart, todayEnd } = getCollectionAndTimestamp(category, startDate, endDate);

  const validStatuses = category?.trim() === "Sightseeing Bookings"
    ? SIGHTSEEING_ACTIVE_STATUSES
    : ["Accepted", "Confirmed", "Done", "accepted", "confirmed", "done", "ACCEPTED", "CONFIRMED", "DONE"];
  if (category?.trim()?.includes("Van")) {
    validStatuses.push("Pending");
    validStatuses.push("pending");
    validStatuses.push("PENDING");
  }

  // --- Helper for Sorting ---
  const sortDocs = (docs) => {
    return docs.sort((a, b) => {
      const getTime = (item) => {
        const val = item.timestamp || item.orderedAt || item.createdAt || item.time || item.bookingDate;
        if (!val) return 0;
        return val.seconds ? val.seconds : (new Date(val).getTime() / 1000);
      };
      return getTime(b) - getTime(a);
    });
  };

  try {
    // This path returns every booking in the selected range, regardless of status,
    // and supports all timestamp fields used by legacy and current records.
    let list = await fetchAllBookingsForCategory(category, startDate, endDate);

    // Fallback for room / sightseeing when primary range fetch returned empty
    if (!list && (category === "Sightseeing Bookings" || category === "Room Bookings")) {
      // ... Keeps existing logic for merging timestamp fields ...
      // We can reuse the existing performQuery logic structure but simplified for brevity in this replacement block 
      // or just copy the working logic from before.

      // Re-implementing logic compactly:
      const fieldsToQuery = category === "Sightseeing Bookings"
        ? ["orderedAt", "createdAt", "timestamp"]
        : ["createdAt", "orderedAt", "timestamp", "checkInDate", "checkIn"];

      const performQuery = async (field, includeStatus) => {
        const sDate = new Date(todayStart).toISOString().split('T')[0];
        const eDate = new Date(todayEnd).toISOString().split('T')[0];

        const getConstraints = (f, start, end) => {
          const c = [
            where(f, ">=", start),
            where(f, "<=", end),
            orderBy(f, "desc"),
            limit(2000)
          ];
          if (includeStatus) c.unshift(where("status", "in", validStatuses));
          return c;
        };

        if (field === "checkInDate" || field === "checkIn") {
          // Check both formats
          const q1 = query(collectionRef, ...getConstraints(field, todayStart, todayEnd));
          const q2 = query(collectionRef, ...getConstraints(field, sDate, eDate));
          const [res1, res2] = await Promise.all([getDocs(q1), getDocs(q2)]);
          return [...res1.docs, ...res2.docs];
        }

        const q = query(collectionRef, ...getConstraints(field, todayStart, todayEnd));
        const snap = await getDocs(q);
        return snap.docs;
      };

      const promises = fieldsToQuery.map(async f => {
        try {
          return await performQuery(f, category !== "Room Bookings" && category !== "Sightseeing Bookings");
        } catch (e) {
          return await performQuery(f, false);
        }
      });

      const results = await Promise.all(promises);
      const docsMap = new Map();

      results.flat().forEach(doc => {
        const data = doc.data();
        let isMatch = false;
        // Room Booking Status Logic
        if (category === "Room Bookings") {
          const rawStatus = data.bookingStatus || data.status || "";
          const upper = rawStatus.toUpperCase();
          // Filter matching RoomBookings.jsx logic - Accepted ones are records
          if (['ACCEPTED', 'CONFIRMED', 'DONE'].includes(upper)) isMatch = true;
        } else {
          // Basic Status Check
          isMatch = category === "Sightseeing Bookings"
            ? isSightseeingDashboardStatus(data.status)
            : validStatuses.includes(data.status);
        }

        if (isMatch) docsMap.set(doc.id, { id: doc.id, ...data });
      });

      list = sortDocs(Array.from(docsMap.values()));

    }
    // --- CASE 4: Standard Fallback (SelfDrive) ---
    else if (!list) {
      const q = query(
        collectionRef,
        where("status", "in", validStatuses),
        where(timestampField, ">=", todayStart),
        where(timestampField, "<=", todayEnd),
        orderBy(timestampField, "desc")
      );
      const snap = await getDocs(q);
      list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // --- Pagination (Common Slicing) ---
    if (pageSize && list.length > pageSize) {
      const startIndex = page * pageSize;
      const endIndex = startIndex + pageSize;
      list = list.slice(startIndex, endIndex);
    }

    // Update cursor logic (Approximation since we are slicing)
    // setLastDocs is irrelevant when we slice array fully, but keeping it for compatibility if needed.

    setData(list);
    return list;
  } catch (error) {
    console.error("Error fetching today bookings:", error);
    return [];
  } finally {
    setLoading(false);
  }
};

export const exportAllBooking = async (selDate) => {
  const categories = [
    "Room Bookings",
    "Sightseeing Bookings",
    "Taxi Bookings",
    "Selfdrive Bookings",
  ];

  const promises = categories.map((item) =>
    todayBooking(
      () => { },
      () => { },
      item,
      selDate,
      selDate
    )
  );

  await Promise.all(promises);
};
