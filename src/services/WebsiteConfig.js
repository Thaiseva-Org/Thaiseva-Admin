import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, faqCollection, testimonialCollection } from "../firebase/firebase.config";

export async function getAdminFAQs() {
  const q = query(faqCollection, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function saveFAQ(faqData, id = null) {
  if (id) {
    await updateDoc(doc(db, "FaqDB", id), {
      ...faqData,
      updatedAt: serverTimestamp(),
    });
    return id;
  }

  const docRef = await addDoc(faqCollection, {
    ...faqData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteFAQ(id) {
  await deleteDoc(doc(db, "FaqDB", id));
}

export async function getAdminTestimonials() {
  const q = query(testimonialCollection, orderBy("displayOrder", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function saveTestimonial(testimonialData, id = null) {
  if (id) {
    await updateDoc(doc(db, "TestimonialDB", id), {
      ...testimonialData,
      updatedAt: serverTimestamp(),
    });
    return id;
  }

  const docRef = await addDoc(testimonialCollection, {
    ...testimonialData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteTestimonial(id) {
  await deleteDoc(doc(db, "TestimonialDB", id));
}
