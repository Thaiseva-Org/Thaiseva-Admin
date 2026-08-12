// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { collection, doc, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import "firebase/functions"; // For Firebase Cloud Functions
// import { firebase } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_apiKey,
  authDomain: import.meta.env.VITE_authDomain,
  projectId: import.meta.env.VITE_projectId,
  storageBucket: import.meta.env.VITE_storageBucket,
  messagingSenderId: import.meta.env.VITE_messagingSenderId,
  appId: import.meta.env.VITE_appId,
  measurementId: import.meta.env.VITE_measurementId,
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
const hotelsCollection = collection(db, "HotelDB");
const travelRequirementsCollection = collection(db, "travelRequirements");
const travelServicesCollection = collection(db, "sightseeingPackages");
const travelServicesDetailsCollection = collection(
  db,
  "sightseeingPackagesDetails"
);
const hotelPackages = collection(db, "hotelPackages");
const hotelPackageDetails = collection(db, "hotelPackageDetails");
// Legacy compatibility only. New records use
// HotelDB/{hotelId}/availability/{availabilityId}.
const hotelAvailabilityAdjustments = collection(
  db,
  "hotelAvailabilityAdjustments"
);
const hotelRoomInventory = collection(db, "hotelRoomInventory");
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
const managePartnersCollection = collection(db, "manage_partners");
const generalPartnersCollection = collection(db, "general_partners");
const vanCompaniesCollection = collection(db, "vanCompanies");
const transportCompaniesCollection = collection(db, "transportCompanies");
const transportDriversCollection = collection(db, "transportDrivers");
const transportVehiclesCollection = collection(db, "transportVehicles");
const transportEarningsCollection = collection(db, "transportEarnings");
const deletionRequestsCollection = collection(db, "DeletionRequests");
const contactMessagesCollection = collection(db, "ContactMessages");

// Website Config Collections
const contentCollection = collection(db, "ContentDB");
const blogCollection = collection(db, "BlogDB");
const offerCollection = collection(db, "OfferDB");
const serviceCollection = collection(db, "ServiceDB");
const testimonialCollection = collection(db, "TestimonialDB");
const faqCollection = collection(db, "FaqDB");

// Use the 'firebase' instance created above to call functions
const deleteUserFromAuth = httpsCallable(
  getFunctions(app, "asia-east2"),
  "deleteUserFunction"
);

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
  hotelAvailabilityAdjustments,
  hotelRoomInventory,
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
  managePartnersCollection,
  generalPartnersCollection,
  vanCompaniesCollection,
  transportCompaniesCollection,
  transportDriversCollection,
  transportVehiclesCollection,
  transportEarningsCollection,
  deletionRequestsCollection,
  storage,
  contactMessagesCollection,

  // Website Config Collections
  contentCollection,
  blogCollection,
  offerCollection,
  serviceCollection,
  testimonialCollection,
  faqCollection,
};
