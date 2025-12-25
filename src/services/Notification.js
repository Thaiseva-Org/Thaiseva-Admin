import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { notificationsCollection } from "../firebase/firebase.config.js";

const fetchNotifications = async (setNotificationData) => {
  try {
    const notifyquery = query(
      notificationsCollection,
      orderBy("datetime", "desc")
    );
    const snapshot = await getDocs(notifyquery);
    const newNotifications = [];
    snapshot?.docs?.forEach((doc) => {
      const data = doc.data();
      newNotifications.push({
        id: doc.id || "N/A",
        ...data,
      });
    });
    setNotificationData(newNotifications);
  } catch (error) {
    console.error("Error fetching notifications: ", error);
  }
};

const addNotification = async (title, message, imageUrl, expiryDate = null) => {
  try {
    const data = {
      title,
      desc: message,
      imageUrl: imageUrl ? imageUrl : "",
      datetime: serverTimestamp(),
    };

    if (expiryDate) {
      data.expiryDate = expiryDate;
    }

    await addDoc(notificationsCollection, data);
  } catch (error) {
    console.error("Error adding notification: ", error);
  }
};

const removeNotification = async (id, setNotificationData) => {
  if (!id) return;
  if (confirm("Are you sure to delete this notification")) {
    try {
      await deleteDoc(doc(notificationsCollection, id));
      setNotificationData((prev) => prev.filter((notif) => notif.id !== id));
    } catch (error) {
      console.error("Error removing notification:", error);
    }
  }
};

export { addNotification, fetchNotifications, removeNotification };
