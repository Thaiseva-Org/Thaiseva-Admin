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
import { PartnerContext } from "./PartnerProvider";

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
  const { roomBookings, travelBookings, carBookings, selfDriveBookings } = useContext(PartnerContext);
  const [dbNotifications, setDbNotifications] = useState([]);
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

  // Fetch Firestore Notifications
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
              setDbNotifications(newNotifications);
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

  // Merge DB Notifications with Pending Bookings
  useEffect(() => {
    let pendingItems = [];

    // 1. Room Bookings
    roomBookings?.forEach(b => {
      if (b.status === 'Pending' || b.bookingStatus === 'PENDING') {
        pendingItems.push({
          id: `room-${b.id}`,
          message: `New Room Booking: ${b.hotelName || 'Hotel'} (${b.rooms} Rooms) by ${b.name || 'Guest'}`,
          timestamp: b.createdAt || b.checkInDate, // Fallback
          imageUrl: NewOrderImage1,
          type: 'room'
        });
      }
    });

    // 2. Travel Bookings
    travelBookings?.forEach(b => {
      if (b.status === 'Pending' || b.bookingStatus === 'PENDING' || b.status === "Not Reviewed") {
        pendingItems.push({
          id: `travel-${b.id}`,
          message: `New Sightseeing Booking: ${b.packageDetails?.packageName || 'Package'} by ${b.name || 'Guest'}`,
          timestamp: b.orderedAt || b.timestamp,
          imageUrl: NewOrderImage2,
          type: 'travel'
        });
      }
    });

    // 3. Car Bookings
    carBookings?.forEach(b => {
      if (b.status === 'pending') {
        pendingItems.push({
          id: `car-${b.id}`,
          message: `New Taxi Booking: ${b.pickupLocation} -> ${b.dropoffLocation}`,
          timestamp: b.timestamp,
          imageUrl: NewOrderImage3,
          type: 'taxi'
        });
      }
    });

    // 4. Self Drive
    selfDriveBookings?.forEach(b => {
      if (b.status === 'pending') {
        pendingItems.push({
          id: `drive-${b.id}`,
          message: `New Self-Drive Request: ${b.carName} by ${b.name}`,
          timestamp: b.time,
          imageUrl: NewOrderImage1,
          type: 'drive'
        });
      }
    });

    // Merge and Sort
    const allNotifications = [...dbNotifications, ...pendingItems].sort((a, b) => {
      const timeA = a.timestamp?.seconds ? a.timestamp.seconds : (new Date(a.timestamp).getTime() / 1000);
      const timeB = b.timestamp?.seconds ? b.timestamp.seconds : (new Date(b.timestamp).getTime() / 1000);
      return timeB - timeA;
    });

    setNotifications(allNotifications);

  }, [dbNotifications, roomBookings, travelBookings, carBookings, selfDriveBookings]);

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
