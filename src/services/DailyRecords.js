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
  getDoc,
} from "firebase/firestore";
import {
  carBookingsCollection,
  roomBookingCollection,
  selfDriveBookingCollection,
  travelBookingCollection,
  vanBookingsCollection,
} from "../firebase/firebase.config";
import { generateInvoiceIds, INVOICE_TYPES } from "../utils/invoiceGenerator";

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
  console.log("DailyRecords: Resolving collection for category:", cat);

  if (cat === "Taxi Bookings") {
    collectionRef = carBookingsCollection;
    timestampField = "timestamp";
  } else if (cat === "Selfdrive Bookings") {
    collectionRef = selfDriveBookingCollection;
    timestampField = "time";
  } else if (cat === "Room Bookings") {
    collectionRef = roomBookingCollection;
    timestampField = "createdAt";
  } else if (cat === "Van Bookings") {
    console.log("DailyRecords: Matched Van Bookings - Using vanBookingsCollection");
    collectionRef = vanBookingsCollection;
    timestampField = "bookingDate";
    // For Van Bookings, we store date as string "YYYY-MM-DDTHH:mm"
    return {
      collectionRef,
      timestampField,
      todayStart: `${startDate}T00:00`,
      todayEnd: `${endDate}T23:59`
    };
  } else {
    console.log("DailyRecords: Defaulting to Sightseeing for category:", cat);
    // Default to Sightseeing
    collectionRef = travelBookingCollection;
    timestampField = "orderedAt";
  }

  return { collectionRef, timestampField, todayStart, todayEnd };
};

export const todayBooking = async (
  setData,
  setLoading,
  category,
  startDate,
  endDate
) => {
  setLoading(true);
  const { collectionRef, timestampField, todayStart, todayEnd } = getCollectionAndTimestamp(category, startDate, endDate);

  let statuses = ["Accepted", "Confirmed", "Done", "accepted", "confirmed", "done", "ACCEPTED", "CONFIRMED", "DONE"];
  if (category?.trim() === "Van Bookings") {
    statuses.push("Pending");
    statuses.push("pending");
  }

  const queryToUse = query(
    collectionRef,
    where("status", "in", statuses),
    where(timestampField, ">=", todayStart),
    where(timestampField, "<=", todayEnd),
    orderBy(timestampField, "desc")
  );

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
    return [];
  } finally {
    setLoading(false);
  }
};

export const handleClear = async (category, id) => {
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
  } else if (cat === "Van Bookings") {
    col = vanBookingsCollection;
    serviceType = INVOICE_TYPES.VAN;
  } else {
    col = travelBookingCollection;
    serviceType = INVOICE_TYPES.SIGHTSEEING;
  }

  const OrderRef = doc(col, id);
  const docSnap = await getDoc(OrderRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    let updates = { isPaymentClear: true };

    // Generate Invoice ID if missing
    if (!data.customerInvoiceId || !data.partnerInvoiceId) {
      try {
        const { customerId, partnerId } = await generateInvoiceIds(serviceType);
        updates = {
          ...updates,
          customerInvoiceId: customerId,
          partnerInvoiceId: partnerId,
          // Legacy fallback - keeping invoiceId consistent with partnerId if possible, or just don't overwrite if it means something else.
          // Usually 'id' is doc ID. 'invoiceId' might be expected by some legacy views. 
          // Let's set it to partnerId to be safe, as Invoices.jsx does.
          invoiceId: partnerId
        };
      } catch (err) {
        console.error("Failed to generate invoice ID during clean:", err);
      }
    }

    await updateDoc(OrderRef, updates);
  } else {
    // Fallback if fetch fails (shouldn't happen if ID is valid)
    await updateDoc(OrderRef, { isPaymentClear: true });
  }

  return true;
};

export const fetchBookingsTotalPages = async (
  setTotalPages,
  startDate,
  endDate,
  category
) => {
  const { collectionRef, timestampField, todayStart, todayEnd } = getCollectionAndTimestamp(category, startDate, endDate);

  let statuses = ["Accepted", "Confirmed", "Done", "accepted", "confirmed", "done", "ACCEPTED", "CONFIRMED", "DONE"];
  if (category?.trim() === "Van Bookings") {
    statuses.push("Pending");
    statuses.push("pending");
  }

  const queryToUse = query(
    collectionRef,
    where("status", "in", statuses),
    where(timestampField, ">=", todayStart),
    where(timestampField, "<=", todayEnd),
    orderBy(timestampField, "desc")
  );

  try {
    const pages = await getCountFromServer(queryToUse);
    setTotalPages(Math.ceil(pages.data().count));
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
  lastDoc = [],
  setLastDocs = () => { },
  pageSize = null,
  page = 0
) => {
  setLoading(true);
  const { collectionRef, timestampField, todayStart, todayEnd } = getCollectionAndTimestamp(category, startDate, endDate);

  const validStatuses = ["Accepted", "Confirmed", "Done", "accepted", "confirmed", "done", "ACCEPTED", "CONFIRMED", "DONE"];

  if (category?.trim()?.includes("Van")) {
    validStatuses.push("Pending");
  }

  const performQuery = async (field, includeStatus = true) => {
    let constraints = [];

    // If includeStatus is true, we try the composite query (needs index)
    if (includeStatus) {
      constraints.push(where("status", "in", validStatuses));
    }

    constraints.push(where(field, ">=", todayStart));
    constraints.push(where(field, "<=", todayEnd));
    constraints.push(orderBy(field, "desc"));

    if (pageSize) {
      // If filtering client-side, we might want to fetch more to ensure we have enough matches
      // But for safety, keep it simple.
      constraints.push(limit(pageSize * 5)); // Fetch extra buffer
    }

    const q = query(collectionRef, ...constraints);
    const snap = await getDocs(q);

    // If we didn't filter by status in query, filter now
    if (!includeStatus) {
      return snap.docs.filter(d => validStatuses.includes(d.data().status));
    }

    return snap.docs;
  };

  try {
    let list = [];
    if (category === "Sightseeing Bookings" || category === "Room Bookings") {
      // We attempt to query potential timestamp fields.
      // For Sightseeing: orderedAt, createdAt, timestamp
      // For Room Bookings: orderedAt, createdAt (as per RoomBookings.jsx)

      const fieldsToQuery = category === "Sightseeing Bookings"
        ? ["orderedAt", "createdAt", "timestamp"]
        : ["createdAt", "orderedAt", "timestamp"];  // Added timestamp for Room Bookings too

      const tryFetch = async (field) => {
        try {
          // For Room Bookings, we DO NOT filter by status in the query to capture 'bookingStatus' variations
          // For others, we try status filter if possible for performance
          const useStatusFilter = category !== "Room Bookings";
          return await performQuery(field, useStatusFilter);
        } catch (err) {
          if (err.code === 'failed-precondition') {
            console.warn(`Composite query failed for ${field} due to missing index, falling back to date-only query.`);
          } else {
            console.warn(`Composite query failed for ${field}, falling back to date-only query.`, err);
          }
          return await performQuery(field, false);
        }
      };

      const promises = fieldsToQuery.map(f => tryFetch(f));
      const results = await Promise.allSettled(promises);

      const docsMap = new Map();

      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          result.value.forEach(doc => {
            const data = doc.data();
            let isMatch = false;

            // Normalize Status Logic (Match RoomBookings.jsx)
            let normalizedStatus = data.status || "Pending";
            const rawStatus = data.bookingStatus || data.status;
            if (typeof rawStatus === 'string') {
              const upper = rawStatus.toUpperCase();
              if (['ACCEPTED', 'CONFIRMED', 'DONE'].includes(upper)) normalizedStatus = 'Accepted';
              else if (['PENDING'].includes(upper)) normalizedStatus = 'Pending';
            }
            if (normalizedStatus === 'Accepted' || validStatuses.includes(data.status)) {
              // For Room Bookings, we removed the strict payment check to ensure ALL Accepted bookings appear.
              // The user considers 'Accepted' == 'Record' even if payment flag isn't explicitly true yet (e.g. Pay at Hotel).
              isMatch = true;
            }

            if (isMatch) {
              docsMap.set(doc.id, { id: doc.id, ...data });
            }
          });
        }
      });

      // Convert map to array and sort manually
      list = Array.from(docsMap.values()).sort((a, b) => {
        // Generic timestamp extraction
        const getTime = (item) => {
          const val = item.orderedAt || item.createdAt || item.timestamp || item.time;
          if (!val) return 0;
          return val.seconds || (new Date(val).getTime() / 1000) || 0;
        };
        return getTime(b) - getTime(a);
      });

      // Pagination Handling for Merged List
      if (pageSize && list.length > pageSize) {
        const startIndex = page * pageSize;
        const endIndex = startIndex + pageSize;
        list = list.slice(startIndex, endIndex);
      }

    } else {
      // Standard single query for other categories (Taxi, etc.)
      let statuses = ["Accepted", "Confirmed", "Done", "accepted", "confirmed", "done", "ACCEPTED", "CONFIRMED", "DONE"];
      if (category?.trim() === "Van Bookings") {
        statuses.push("Pending");
        statuses.push("pending");
      }

      const cons = [
        where("status", "in", statuses),
        where(timestampField, ">=", todayStart),
        where(timestampField, "<=", todayEnd),
        orderBy(timestampField, "desc"),
      ];

      // For Room Bookings, we need to filter by payment status client-side (to avoid complex index requirements)
      // So we fetch more items to ensure we have enough after filtering
      if (category === "Room Bookings" && pageSize) {
        cons.push(limit(pageSize * 5));
      } else if (pageSize) {
        cons.push(limit(pageSize));
      }

      if (page > 0 && lastDoc[page - 1]) cons.push(startAfter(lastDoc[page - 1]));

      const q = query(collectionRef, ...cons);
      const result = await getDocs(q);

      list = result.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filter for PAID Room Bookings
      if (category === "Room Bookings") {
        list = list.filter(item => item.isPaymentDone === true || item.isPaymentClear === true);

        // Handle pagination slicing manually since we fetched extra
        if (pageSize && list.length > pageSize) {
          // If we're on page 0, take first N. If paging, this logic is imperfect with startAfter + filtering
          // But valid for "Records" viewing
          list = list.slice(0, pageSize);
        }
      }

      // Update Pagination Cursor for standard queries
      if (pageSize && result.docs.length > 0) {
        // This cursor logic is approximate when filtering is involved
        const lastDocument = result.docs.length > 0 ? result.docs[result.docs.length - 1] : null;
        setLastDocs((prev) => {
          const updated = [...prev];
          updated[page] = lastDocument;
          return updated;
        });
      }
    }

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
    "Van Bookings",
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
