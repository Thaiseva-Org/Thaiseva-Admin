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

export const handleClear = async (category, id, source = null) => {
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
    if (source === 'mobile') {
      col = carBookingsCollection;
    } else {
      col = vanBookingsCollection;
    }
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

  // Common Constraints
  let statuses = ["Accepted", "Confirmed", "Done", "accepted", "confirmed", "done", "ACCEPTED", "CONFIRMED", "DONE"];
  if (category?.trim() === "Van Bookings") {
    statuses.push("Pending");
    statuses.push("pending");
    statuses.push("PENDING");
  } else if (!category?.trim().includes("Room")) {
    // Taxi / Sightseeing / SelfDrive - usually we want these statuses. 
    // Room bookings logic is handled separately usually, but for count we stick to accepted unless specified.
    // If user wants everything, we might need to broaden this.
  }

  const dateConstraints = [
    where(timestampField, ">=", todayStart),
    where(timestampField, "<=", todayEnd),
  ];

  // Conditionally add status constraint if not Room Bookings (Rooms track payment status separately)
  if (category !== "Room Bookings") {
    dateConstraints.unshift(where("status", "in", statuses));
  }

  try {
    if (category === "Van Bookings") {
      // 1. Manual Vans (Uses String Date)
      const qManual = query(vanBookingsCollection, ...dateConstraints);
      const manualSnap = await getDocs(qManual);

      // 2. Mobile Vans (Uses Timestamp - Needs Date Object)
      const dateStart = new Date(todayStart);
      const dateEnd = new Date(todayEnd);

      const qMobile = query(
        carBookingsCollection,
        where("status", "in", statuses),
        where("timestamp", ">=", dateStart),
        where("timestamp", "<=", dateEnd)
      );
      const mobileSnap = await getDocs(qMobile);
      const mobileVansCount = mobileSnap.docs.filter(d => d.data().transportType?.toLowerCase().includes('van')).length;

      setTotalPages(manualSnap.size + mobileVansCount);

    } else if (category === "Taxi Bookings") {
      // Filter out Vans
      const q = query(
        carBookingsCollection,
        where("status", "in", statuses),
        where("timestamp", ">=", todayStart),
        where("timestamp", "<=", todayEnd)
      );
      const snap = await getDocs(q);
      const taxiCount = snap.docs.filter(d => !d.data().transportType?.toLowerCase().includes('van')).length;

      setTotalPages(taxiCount);

    } else if (category === "Room Bookings") {
      // Room Bookings need special counting (Paid Only) or All?
      // fetchTodayBooking filters by payment statuses. We should approximate or fetch all.
      // Fetching all to be accurate with fetchTodayBooking Logic
      const q = query(collectionRef, ...dateConstraints);
      const snap = await getDocs(q);
      const paidCount = snap.docs.filter(d => {
        const data = d.data();
        return data.isPaymentDone === true || data.isPaymentClear === true;
      }).length;
      setTotalPages(paidCount);

    } else {
      // Standard Count
      const q = query(collectionRef, ...dateConstraints);
      const pages = await getCountFromServer(q);
      setTotalPages(Math.ceil(pages.data().count));
    }
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
    let list = [];

    // --- CASE 1: Van Bookings (Merge Manual + Mobile Vans) ---
    if (category === "Van Bookings") {
      // 1. Manual
      const qManual = query(
        vanBookingsCollection,
        where("status", "in", validStatuses),
        where("bookingDate", ">=", todayStart),
        where("bookingDate", "<=", todayEnd)
      );

      // 2. Mobile (carBookings)
      const dateStart = new Date(todayStart);
      const dateEnd = new Date(todayEnd);

      const qMobile = query(
        carBookingsCollection,
        where("status", "in", validStatuses),
        where("timestamp", ">=", dateStart),
        where("timestamp", "<=", dateEnd)
      );

      const [manualSnap, mobileSnap] = await Promise.all([getDocs(qManual), getDocs(qMobile)]);

      const manualDocs = manualSnap.docs.map(d => ({ id: d.id, ...d.data(), source: 'manual' }));
      const mobileDocs = mobileSnap.docs
        .map(d => ({ id: d.id, ...d.data(), source: 'mobile' }))
        .filter(d => d.transportType?.toLowerCase().includes('van'));

      list = sortDocs([...manualDocs, ...mobileDocs]);

    }
    // --- CASE 2: Taxi Bookings (Exclude Vans) ---
    else if (category === "Taxi Bookings") {
      const q = query(
        carBookingsCollection,
        where("status", "in", validStatuses),
        where("timestamp", ">=", todayStart),
        where("timestamp", "<=", todayEnd)
      );
      const snap = await getDocs(q);

      list = snap.docs
        .map(d => ({ id: d.id, ...d.data(), source: 'mobile' }))
        .filter(d => !d.transportType?.toLowerCase().includes('van'));

      list = sortDocs(list);
    }
    // --- CASE 3: Room / Sightseeing (Existing Complex Login) ---
    else if (category === "Sightseeing Bookings" || category === "Room Bookings") {
      // ... Keeps existing logic for merging timestamp fields ...
      // We can reuse the existing performQuery logic structure but simplified for brevity in this replacement block 
      // or just copy the working logic from before.

      // Re-implementing logic compactly:
      const fieldsToQuery = category === "Sightseeing Bookings"
        ? ["orderedAt", "createdAt", "timestamp"]
        : ["createdAt", "orderedAt", "timestamp"];

      const performQuery = async (field, includeStatus) => {
        const constraints = [
          where(field, ">=", todayStart),
          where(field, "<=", todayEnd),
          orderBy(field, "desc"),
          limit(pageSize ? pageSize * 5 : 500)
        ];
        if (includeStatus) constraints.unshift(where("status", "in", validStatuses));

        const q = query(collectionRef, ...constraints);
        const snap = await getDocs(q);
        return snap.docs;
      };

      const promises = fieldsToQuery.map(async f => {
        try {
          return await performQuery(f, category !== "Room Bookings");
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
          // Filter matching RoomBookings.jsx logic
          if (['ACCEPTED', 'CONFIRMED', 'DONE'].includes(upper)) isMatch = true;
          // Also check payment
          if ((data.isPaymentDone === true || data.isPaymentClear === true) && isMatch) {
            // Valid
          } else {
            isMatch = false; // Must be paid/clear
          }
        } else {
          // Basic Status Check
          isMatch = validStatuses.includes(data.status);
        }

        if (isMatch) docsMap.set(doc.id, { id: doc.id, ...data });
      });

      list = sortDocs(Array.from(docsMap.values()));

    }
    // --- CASE 4: Standard Fallback (SelfDrive) ---
    else {
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
