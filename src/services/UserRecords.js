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

export const fetchUserDataPages = async () => {
  let q = query(
    usersCollection,
    where("isAppUser", "==", true),
    orderBy("createdAt", "desc")
  );

  const querySnapshot = await getCountFromServer(q);

  return Math.ceil(querySnapshot.data().count);
};
