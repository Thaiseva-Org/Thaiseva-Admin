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
  localServicesCollection,
  partnersCollection,
  requirementsCollection,
} from "../firebase/firebase.config";

const localReuirementsTotalPages = async (
  setTotalPages,
  startDate,
  endDate,
  queryCategory
) => {
  const todayStart = new Date(startDate);
  todayStart.setDate(todayStart.getDate());
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(endDate);
  todayEnd.setHours(23, 59, 59, 999);

  let queryToUse;
  if (queryCategory === "All") {
    queryToUse = query(
      requirementsCollection,
      where("date", ">=", todayStart),
      where("date", "<=", todayEnd),
      orderBy("date", "desc")
    );
  } else {
    queryToUse = query(
      requirementsCollection,
      where("serviceCategory", "==", queryCategory),
      where("date", ">=", todayStart),
      where("date", "<=", todayEnd),
      orderBy("date", "desc")
    );
  }

  const pages = await getCountFromServer(queryToUse);
  setTotalPages(Math.ceil(pages.data().count));
};

const fetchlocalRequirements = async (
  setData,
  setLoading,
  queryCategory,
  startDate,
  endDate,
  lastDoc = [],
  setLastDocs = () => {},
  pageSize = null,
  page = 0
) => {
  setLoading(true);

  let queryToUse;
  const todayStart = new Date(startDate);
  todayStart.setDate(todayStart.getDate());
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(endDate);
  todayEnd.setHours(23, 59, 59, 999);

  if (queryCategory === "All") {
    queryToUse = query(
      requirementsCollection,
      where("date", ">=", todayStart),
      where("date", "<=", todayEnd),
      orderBy("date", "desc")
    );
  } else {
    queryToUse = query(
      requirementsCollection,
      where("serviceCategory", "==", queryCategory),
      where("date", ">=", todayStart),
      where("date", "<=", todayEnd),
      orderBy("date", "desc")
    );
  }

  if (pageSize) {
    if (queryCategory === "All") {
      queryToUse = query(
        requirementsCollection,
        where("date", ">=", todayStart),
        where("date", "<=", todayEnd),
        orderBy("date", "desc"),
        limit(pageSize)
      );
    } else {
      queryToUse = query(
        requirementsCollection,
        where("serviceCategory", "==", queryCategory),
        where("date", ">=", todayStart),
        where("date", "<=", todayEnd),
        orderBy("date", "desc"),
        limit(pageSize)
      );
    }
  }

  if (page > 0 && lastDoc[page - 1]) {
    if (queryCategory === "All") {
      queryToUse = query(
        requirementsCollection,
        where("date", ">=", todayStart),
        where("date", "<=", todayEnd),
        orderBy("date", "desc"),
        startAfter(lastDoc[page - 1]),
        limit(pageSize)
      );
    } else {
      queryToUse = query(
        requirementsCollection,
        where("serviceCategory", "==", queryCategory),
        where("date", ">=", todayStart),
        where("date", "<=", todayEnd),
        orderBy("date", "desc"),
        startAfter(lastDoc[page - 1]),
        limit(pageSize)
      );
    }
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
    console.error("Error fetching services:", error);
  } finally {
    setLoading(false);
  }
};

const fetchAlllocalRequirements = async (startDate, endDate) => {
  let queryToUse;
  const todayStart = new Date(startDate);
  todayStart.setDate(todayStart.getDate());
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(endDate);
  todayEnd.setHours(23, 59, 59, 999);

  queryToUse = query(
    requirementsCollection,
    where("date", ">=", todayStart),
    where("date", "<=", todayEnd),
    orderBy("date", "desc")
  );

  try {
    const result = await getDocs(queryToUse);
    const list = result.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return list;
  } catch (error) {
    console.error("Error fetching csv data:", error);
  }
};

const localPartnerRequirementsTotalPages = async (
  setTotalPages,
  startDate,
  endDate,
  uid
) => {
  const todayStart = new Date(startDate);
  todayStart.setDate(todayStart.getDate());
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(endDate);
  todayEnd.setHours(23, 59, 59, 999);

  let queryToUse = query(
    requirementsCollection,
    where("providerUid", "==", uid),
    where("date", ">=", todayStart),
    where("date", ">=", todayStart),
    where("date", "<=", todayEnd),
    orderBy("date", "desc")
  );

  const pages = await getCountFromServer(queryToUse);
  setTotalPages(Math.ceil(pages.data().count));
};

const fetchlocalPartnerRequirements = async (
  setData,
  setLoading,
  uid,
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
    requirementsCollection,
    where("providerUid", "==", uid),
    where("date", ">=", todayStart),
    where("date", "<=", todayEnd),
    orderBy("date", "desc")
  );

  if (pageSize) {
    queryToUse = query(
      requirementsCollection,
      where("providerUid", "==", uid),
      where("date", ">=", todayStart),
      where("date", "<=", todayEnd),
      orderBy("date", "desc"),
      limit(pageSize)
    );
  }

  if (page > 0 && lastDoc[page - 1]) {
    queryToUse = query(
      requirementsCollection,
      where("providerUid", "==", uid),
      where("date", ">=", todayStart),
      where("date", "<=", todayEnd),
      orderBy("date", "desc"),
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
    console.error("Error fetching services:", error);
  } finally {
    setLoading(false);
  }
};

const localServicesTotalPages = async (setTotalPages, queryCategory) => {
  let queryToUse;
  if (queryCategory === "All") {
    queryToUse = query(localServicesCollection, orderBy("timestamp", "desc"));
  } else {
    queryToUse = query(
      localServicesCollection,
      where("serviceCategory", "==", queryCategory),
      orderBy("timestamp", "desc")
    );
  }

  const pages = await getCountFromServer(queryToUse);
  setTotalPages(Math.ceil(pages.data().count));
};

const fetchlocalServices = async (
  setData,
  setMatchedServices,
  setLoading,
  queryCategory,
  lastDoc = [],
  setLastDocs = () => {},
  pageSize = null,
  page = 0
) => {
  setLoading(true);

  let queryToUse;
  if (queryCategory === "All") {
    queryToUse = query(localServicesCollection, orderBy("timestamp", "desc"));
  } else {
    queryToUse = query(
      localServicesCollection,
      where("serviceCategory", "==", queryCategory),
      orderBy("timestamp", "desc")
    );
  }

  if (pageSize) {
    if (queryCategory === "All") {
      queryToUse = query(
        localServicesCollection,
        orderBy("timestamp", "desc"),
        limit(pageSize)
      );
    } else {
      queryToUse = query(
        localServicesCollection,
        where("serviceCategory", "==", queryCategory),
        orderBy("timestamp", "desc"),
        limit(pageSize)
      );
    }
  }

  if (page > 0 && lastDoc[page - 1]) {
    if (queryCategory === "All") {
      queryToUse = query(
        localServicesCollection,
        orderBy("timestamp", "desc"),
        startAfter(lastDoc[page - 1]),
        limit(pageSize)
      );
    } else {
      queryToUse = query(
        localServicesCollection,
        where("serviceCategory", "==", queryCategory),
        orderBy("timestamp", "desc"),
        startAfter(lastDoc[page - 1]),
        limit(pageSize)
      );
    }
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
    setMatchedServices(list);
    return list;
  } catch (error) {
    console.error("Error fetching services:", error);
  } finally {
    setLoading(false);
  }
};

const localPartnerServicesTotalPages = async (setTotalPages, uid) => {
  let queryToUse = query(
    localServicesCollection,
    where("providerUid", "==", uid),
    orderBy("timestamp", "desc")
  );

  const pages = await getCountFromServer(queryToUse);
  setTotalPages(Math.ceil(pages.data().count));
};

const fetchPartnerlocalServices = async (
  setData,
  setLoading,
  uid,
  lastDoc = [],
  setLastDocs = () => {},
  pageSize = null,
  page = 0
) => {
  setLoading(true);

  let queryToUse = query(
    localServicesCollection,
    where("providerUid", "==", uid),
    orderBy("timestamp", "desc")
  );

  if (pageSize) {
    queryToUse = query(
      localServicesCollection,
      where("providerUid", "==", uid),
      orderBy("timestamp", "desc"),
      limit(pageSize)
    );
  }

  if (page > 0 && lastDoc[page - 1]) {
    queryToUse = query(
      localServicesCollection,
      where("providerUid", "==", uid),
      orderBy("timestamp", "desc"),
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
    console.error("Error fetching services:", error);
  } finally {
    setLoading(false);
  }
};

const localPartnersTotalPages = async (setTotalPages, queryCategory) => {
  let queryToUse = query(
    partnersCollection,
    where("status", "==", queryCategory),
    orderBy("timestamp", "desc")
  );

  const pages = await getCountFromServer(queryToUse);
  setTotalPages(Math.ceil(pages.data().count));
};

const fetchlocalPartners = async (
  setData,
  setMatchedData,
  setLoading,
  queryCategory,
  lastDoc = [],
  setLastDocs = () => {},
  pageSize = null,
  page = 0
) => {
  setLoading(true);

  let queryToUse = query(
    partnersCollection,
    where("status", "==", queryCategory),
    orderBy("timestamp", "desc")
  );

  if (pageSize) {
    queryToUse = query(
      partnersCollection,
      where("status", "==", queryCategory),
      orderBy("timestamp", "desc"),
      limit(pageSize)
    );
  }

  if (page > 0 && lastDoc[page - 1]) {
    queryToUse = query(
      partnersCollection,
      where("status", "==", queryCategory),
      orderBy("timestamp", "desc"),
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
    setMatchedData(list);
    return list;
  } catch (error) {
    console.error("Error fetching services:", error);
  } finally {
    setLoading(false);
  }
};

export {
  fetchlocalRequirements,
  fetchAlllocalRequirements,
  localReuirementsTotalPages,
  localPartnerRequirementsTotalPages,
  fetchlocalPartnerRequirements,
  fetchlocalServices,
  localServicesTotalPages,
  localPartnerServicesTotalPages,
  fetchPartnerlocalServices,
  localPartnersTotalPages,
  fetchlocalPartners,
};
