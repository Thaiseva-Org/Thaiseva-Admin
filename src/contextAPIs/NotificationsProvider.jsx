import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { db } from "../firebase/firebase.config";

const NotificationsContext = createContext();

import {
  NewOrderImage1,
  NewOrderImage2,
  NewOrderImage3,
} from "../assets/index.js";
import { AuthContext } from "./AuthProvider.jsx";

const NewOrderImages = [NewOrderImage1, NewOrderImage2, NewOrderImage3];

const getRandomImage = (arr) => arr[Math.floor(Math.random() * arr.length)];

const getRelatedImage = () => {
  return getRandomImage(NewOrderImages);
};

export const NotificationsProvider = ({ children }) => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);

  const CreateNewNotificationToUser = async (title, desc, id) => {
    try {
      const notifyColRef = collection(db, `notifications/users/${id}`);
      await addDoc(notifyColRef, {
        title: title,
        desc: desc,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error processing notifications: ", error);
    }
  };
  useEffect(() => {
    const fetchLastVisit = async () => {
      try {
        const pathPrefix = `notifications/admin/messages`;
        let lastVisitTimestamp = new Date(
          new Date().getTime() - 12 * 60 * 60 * 1000
        );
        const notifyColRef = collection(db, pathPrefix);
        const notifyquery = query(notifyColRef, orderBy("timestamp", "desc"));

        const unsubscribe = onSnapshot(
          notifyquery,
          async (snapshot) => {
            try {
              const batch = writeBatch(db);
              const newNotifications = [];

              snapshot?.docs?.map((doc) => {
                const data = doc.data();
                if (
                  data.timestamp?.toDate &&
                  data.timestamp.toDate() <= lastVisitTimestamp
                ) {
                  batch.delete(doc.ref);
                } else {
                  newNotifications.push({
                    id: doc.id || "N/A",
                    imageUrl: getRelatedImage(),
                    ...data,
                  });
                }
              });
              setNotifications(newNotifications);
              if (batch._mutations.length > 0) {
                await batch.commit();
              }
            } catch (error) {
              console.error("Error processing notification: ", error);
            }
          },
          (error) => {
            console.error("Error with onSnapshot: ", error);
          }
        );

        return () => unsubscribe();
      } catch (error) {
        console.error("Error fetching last visit: ", error);
      }
    };

    (isAdmin || isSubAdmin) && fetchLastVisit();
  }, [isAdmin, isSubAdmin]);
  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        CreateNewNotificationToUser,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => useContext(NotificationsContext);
