// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { collection, doc, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import "firebase/functions"; // For Firebase Cloud Functions
// import { firebase } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

// // Your web app's Firebase configuration
// const firebaseConfig = {
//   apiKey: import.meta.env.VITE_apiKey,
//   authDomain: import.meta.env.VITE_authDomain,
//   projectId: import.meta.env.VITE_projectId,
//   storageBucket: import.meta.env.VITE_storageBucket,
//   messagingSenderId: import.meta.env.VITE_messagingSenderId,
//   appId: import.meta.env.VITE_appId,
//   measurementId: import.meta.env.VITE_measurementId,
// };

export const firebaseConfig = {
  apiKey: "AIzaSyDvHdzKSxIRgfcFbr-B2mvqo5eh6mosd7g",
  authDomain: "thaiseva-85cda.firebaseapp.com",
  databaseURL:
    "https://thaiseva-85cda-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "thaiseva-85cda",
  storageBucket: "thaiseva-85cda.appspot.com",
  messagingSenderId: "113396010755",
  appId: "1:113396010755:web:0d67f7c8a63fdc83572336",
  measurementId: "G-KPT7PCS3Q9",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const partnersCollection = collection(db, "partners");
const agentsCollection = collection(db, "agents");
const usersCollection = collection(db, "users");
const driversCollection = collection(db, "drivers");
const shopCollection = collection(db, "shops");
const clubCollection = collection(db, "clubs");
const requirementsCollection = collection(db, "allRequirements");
const serviceCategoriesDoc = doc(db, "settings/Service_Categories");
const localServicesCollection = collection(db, "localServices");
const restaurentsCollection = collection(db, "restaurants");
const hotelsCollection = collection(db, "hotels");
const travelRequirementsCollection = collection(db, "travelRequirements");
const travelServicesCollection = collection(db, "sightseeingPackages");
const travelServicesDetailsCollection = collection(
  db,
  "sightseeingPackagesDetails"
);
const hotelPackages = collection(db, "hotelPackages");
const hotelPackageDetails = collection(db, "hotelPackageDetails");
const roomBookingCollection = collection(db, "hotelBookingData");
const foodMenuCollection = collection(db, "foodMenu");
const travelBookingCollection = collection(db, "travelBookingDetails");
const selfDriveBookingCollection = collection(db, "self_driving_bookings");
const settingsCollection = collection(db, "settings");
const chatRoomsCollection = collection(db, "chatRooms");
const chatsCollection = collection(db, "chats");
const hotelStatisticsCollection = collection(db, "hotel_statistics");
const statisticsCollection = collection(db, "statistics");
const carDetailsCollection = collection(db, "carDetails");
const carBookingsCollection = collection(db, "car_bookings");
// const carBookingsCollection = collection(db, "travelBookingDetails");
const invoicesCollection = collection(db, "partner_invoices");
const notificationsCollection = collection(db, "notifications");
// const notificationsTemplateCollection = collection(db, "notificationsTemplate");
const couponsCollection = collection(db, "coupons");

// Use the 'firebase' instance created above to call functions
const deleteUserFromAuth = httpsCallable(
  getFunctions(app),
  "deleteUserFunction"
); // Use httpsCallable

const storage = getStorage();

export {
  app,
  db,
  notificationsCollection,
  partnersCollection,
  agentsCollection,
  usersCollection,
  deleteUserFromAuth,
  shopCollection,
  clubCollection,
  driversCollection,
  requirementsCollection,
  serviceCategoriesDoc,
  localServicesCollection,
  restaurentsCollection,
  hotelsCollection,
  travelRequirementsCollection,
  travelServicesCollection,
  travelServicesDetailsCollection,
  // notificationsTemplateCollection,
  hotelStatisticsCollection,
  travelBookingCollection,
  hotelPackages,
  roomBookingCollection,
  hotelPackageDetails,
  foodMenuCollection,
  settingsCollection,
  chatRoomsCollection,
  chatsCollection,
  statisticsCollection,
  carDetailsCollection,
  selfDriveBookingCollection,
  carBookingsCollection,
  invoicesCollection,
  couponsCollection,
  storage,
};
