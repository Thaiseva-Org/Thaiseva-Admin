/**
 * @fileoverview Service for interacting with user records in Firestore.
 * Provides functions to fetch user data, with support for pagination.
 */

import {
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { usersCollection } from "../firebase/firebase.config";

/**
 * Fetches all app users ordered by creation date in descending order.
 * 
 * @async
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of user objects. Returns an empty array if an error occurs.
 */
export const usersData = async () => {
  try {
    const q = query(
      usersCollection,
      where("isAppUser", "==", true),
      orderBy("createdAt", "desc")
    );
    const result = await getDocs(q);
    const list = result.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return list;
  } catch (error) {
    console.error("Error fetching users data:", error);
    return [];
  }
};

/**
 * Fetches a paginated list of app users.
 * 
 * @async
 * @param {number} page - The current page index (0-indexed).
 * @param {Array<Object>} lastDocs - An array containing the last document snapshot for each fetched page.
 * @param {number} size - The number of user records to fetch per page.
 * @returns {Promise<{data: Array<Object>, lastDoc: Object|null}>} A promise that resolves to an object containing the fetched user `data` array and the `lastDoc` snapshot for pagination.
 */
export const fetchUserData = async (page, lastDocs, size) => {
  let q = query(
    usersCollection,
    where("isAppUser", "==", true),
    orderBy("createdAt", "desc"),
    limit(size)
  );

  if (page > 0 && lastDocs[page - 1]) {
    q = query(
      usersCollection,
      where("isAppUser", "==", true),
      orderBy("createdAt", "desc"),
      startAfter(lastDocs[page - 1]),
      limit(size)
    );
  }

  const querySnapshot = await getDocs(q);
  const newData = querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const lastDoc =
    querySnapshot.docs.length > 0
      ? querySnapshot.docs[querySnapshot.docs.length - 1]
      : null;

  return { data: newData, lastDoc };
};

/**
 * Fetches the total count of app users to calculate the total number of pages.
 * 
 * @async
 * @returns {Promise<number>} A promise that resolves to the total count of app users.
 */
export const fetchUserDataPages = async () => {
  let q = query(
    usersCollection,
    where("isAppUser", "==", true),
    orderBy("createdAt", "desc")
  );

  const querySnapshot = await getCountFromServer(q);

  return Math.ceil(querySnapshot.data().count);
};
