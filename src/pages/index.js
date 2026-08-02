import { lazy } from "react";

// ========== Client Orders Pages ==========
const TravelBookings = lazy(() =>
  import(
    "./dashboard/adminDashboard/clientOrders/travelBookings/TravelBookings"
  )
);
const RoomBookings = lazy(() =>
  import("./dashboard/adminDashboard/clientOrders/roomBookings/RoomBookings")
);
const CarBookings = lazy(() =>
  import("./dashboard/adminDashboard/clientOrders/carBookings/CarBookings")
);
const VanBookings = lazy(() =>
  import("./dashboard/adminDashboard/clientOrders/vanBookings/VanBookings")
);
const SelfDriveBookings = lazy(() =>
  import(
    "./dashboard/adminDashboard/clientOrders/carBookings/SelfDriveBookings"
  )
);
// ========== Client Orders Pages End ==========

// ========== Our Services Pages ==========
const RoomServices = lazy(() =>
  import("./dashboard/adminDashboard/ourServices/roomServices/RoomServices")
);
const TravelServices = lazy(() =>
  import("./dashboard/adminDashboard/ourServices/travelServices/TravelServices")
);
const AddSightseeingPackage = lazy(() =>
  import("./dashboard/adminDashboard/ourServices/travelServices/AddSightseeingPackage")
);
const LocalServices = lazy(() =>
  import("./dashboard/adminDashboard/ourServices/localServices/LocalServices")
);
// ----- not in use for now -----
const CarServices = lazy(() =>
  import("./dashboard/adminDashboard/ourServices/carServices/CarServices")
);
const SelfDriveServices = lazy(() =>
  import("./dashboard/adminDashboard/ourServices/carServices/SelfDriveService")
);
const FoodServices = lazy(() =>
  import("./dashboard/adminDashboard/ourServices/foodServices/FoodServices")
);
// ========== Our Services Pages End ==========

// ========== Our Partners Pages ==========
const Hotels = lazy(() =>
  import("./dashboard/adminDashboard/ourPartners/hotels/Hotels")
);
const HotelRoomsPage = lazy(() =>
  import("./dashboard/adminDashboard/ourPartners/hotels/HotelRoomsPage")
);
const HotelRoomAvailabilityPage = lazy(() =>
  import("./dashboard/adminDashboard/ourPartners/hotels/HotelRoomAvailabilityPage")
);
const HotelRoomAvailabilityHub = lazy(() =>
  import("./dashboard/adminDashboard/ourPartners/hotels/HotelRoomAvailabilityHub")
);
const AddHotelForm = lazy(() =>
  import("./dashboard/adminDashboard/ourPartners/hotels/AddHotelForm")
);
const Vans = lazy(() =>
  import("./dashboard/adminDashboard/ourPartners/vans/Vans")
);
const LocalPartners = lazy(() =>
  import("./dashboard/adminDashboard/ourPartners/localPartners/LocalPartners")
);
// ----- not in use for now -----
const Drivers = lazy(() =>
  import("./dashboard/adminDashboard/ourPartners/drivers/Drivers")
);
const Restaurants = lazy(() =>
  import("./dashboard/adminDashboard/ourPartners/restaurants/Restaurants")
);
const ManagePartners = lazy(() =>
  import("./dashboard/adminDashboard/ourPartners/ManagePartners")
);
// ========== Our Partners Pages End ==========

// ========== Primary Admin Pages ==========
const SubAdmins = lazy(() =>
  import("./dashboard/adminDashboard/subAdmins/SubAdmins")
);
const AdminStatistics = lazy(() =>
  import("./dashboard/adminDashboard/adminStatistics/AdminStatistics")
);
const Invoices = lazy(() =>
  import("./dashboard/adminDashboard/invoices/Invoices")
);
const NewNotficationsScreen = lazy(() =>
  import("./dashboard/adminDashboard/notifications/NewNotification.jsx")
);
const UserData = lazy(() =>
  import("./dashboard/adminDashboard/userData/UserData.jsx")
);
const TodayBookings = lazy(() =>
  import("./dashboard/adminDashboard/todayBookingData/TodayBookings.jsx")
);
const DeletionRequests = lazy(() =>
  import("./dashboard/adminDashboard/deletionRequests/DeletionRequests.jsx")
);
// ----- not in use for now -----
const Coupons = lazy(() =>
  import("./dashboard/adminDashboard/coupons/Coupons")
);
// ========== Primary Admin Pages End ==========

// ========== Requirement Pages ==========
const LocalRequirements = lazy(() =>
  import("./dashboard/adminDashboard/requirements/LocalRequirements")
);
// ----- not in use for now -----
const TravelRequirements = lazy(() =>
  import(
    "./dashboard/adminDashboard/requirements/travelRequirements/TravelRequirements"
  )
);
// ========== Requirement Pages End ==========

// ========== Chats Pages ==========
const CustomerChat = lazy(() =>
  import("./dashboard/communication/customerSupport/CustomerChat")
);
const HotelSupport = lazy(() =>
  import("./dashboard/communication/hotelSupport/HotelSupport")
);
const LocalPartnerSupport = lazy(() =>
  import("./dashboard/communication/localPartnerSupport/LocalPartnerSupport")
);
const RestaurantChat = lazy(() =>
  import("./dashboard/communication/restaurantSupport/RestaurantChat")
);
const ChatWithAdmin = lazy(() =>
  import("./dashboard/partnerDashboard/messages/ChatWithAdmin")
);
// ----- not in use for now -----
const DriverChat = lazy(() =>
  import("./dashboard/communication/driverSupport/DriverChat")
);
// ========== Chats Pages End ==========

// ========== Onboarding Forms Pages ==========
const Login = lazy(() => import("./login/Login"));
const PartnerOnboarding = lazy(() => import("./forms/PartnerOnboarding"));
const HotelOnboarding = lazy(() => import("./forms/HotelOnboarding"));
// ----- not in use for now -----
const DriverOnBoarding = lazy(() => import("./forms/DriverOnBoarding"));
// ========== Onboarding Forms Pages End ==========

// ========== Partner Pages ==========
const MyServices = lazy(() =>
  import("./dashboard/partnerDashboard/myServices/MyServices")
);
const PartnerProfile = lazy(() =>
  import("./dashboard/partnerDashboard/PartnerProfile/PartnerProfile")
);
const Support = lazy(() =>
  import("./dashboard/partnerDashboard/support/Support")
);
const AddedRooms = lazy(() =>
  import("./dashboard/partnerDashboard/hotel/addedRooms/AddedRooms")
);
const CreateRoom = lazy(() =>
  import("./dashboard/partnerDashboard/hotel/addedRooms/CreateRoom")
);
const TodayArriving = lazy(() =>
  import("./dashboard/partnerDashboard/hotel/bookings/TodayArriving")
);
// ----- not in use for now -----
const AddedMenu = lazy(() =>
  import("./dashboard/partnerDashboard/restaurants/addedMenu/AddedMenu")
);
// ========== Partner Pages End ==========

// ========== Clubs and Shops Pages ==========
const ShoppingMalls = lazy(() => import("./ShoppingMalls"));
const Clubs = lazy(() => import("./Clubs"));
// ========== Clubs and Shops Pages End ==========

// ========== Partner Dashboard Pages ==========
const PendingPartnership = lazy(() =>
  import("../components/PendingPartnership.jsx")
);
const MyDrivingRequirements = lazy(() =>
  import(
    "./dashboard/partnerDashboard/myRequirements/MyDrivingRequirements.jsx"
  )
);
const MyLocalRequirements = lazy(() =>
  import("./dashboard/partnerDashboard/myRequirements/MyLocalRequirements")
);
const Bookings = lazy(() =>
  import("./dashboard/partnerDashboard/hotel/bookings/Bookings")
);
const FoodOrders = lazy(() =>
  import("./dashboard/partnerDashboard/restaurants/foodOrders/FoodOrders")
);
// ========== Partner Dashboard Pages End ==========

// ========== Dashboard Pages ==========
const AdminDashboard = lazy(() =>
  import("./dashboard/adminDashboard/AdminDashboard")
);
const PartnerDashboard = lazy(() =>
  import("./dashboard/partnerDashboard/PartnerDashboard")
);
// ========== Dashboard Pages End ==========

// ========== Dashboard Pages End ==========

// ========== Website Config Pages ==========
const Blogs = lazy(() =>
  import("./dashboard/adminDashboard/websiteConfig/Blogs")
);
const Services = lazy(() =>
  import("./dashboard/adminDashboard/websiteConfig/Services")
);
const FAQs = lazy(() =>
  import("./dashboard/adminDashboard/websiteConfig/FAQs")
);
const Testimonials = lazy(() =>
  import("./dashboard/adminDashboard/websiteConfig/Testimonials")
);
const ContactUs = lazy(() =>
  import("./dashboard/adminDashboard/websiteConfig/ContactUs")
);
// ========== Website Config Pages End ==========

const NotFound = lazy(() => import("./NotFound"));

export {
  // Client Orders export
  TravelBookings,
  RoomBookings,
  CarBookings,
  SelfDriveBookings,

  // Our Services export
  RoomServices,
  TravelServices,
  AddSightseeingPackage,
  LocalServices,
  CarServices,
  SelfDriveServices,
  FoodServices,

  // Our Partners export
  Hotels,
  AddHotelForm,
  LocalPartners,
  Drivers,
  Restaurants,
  ManagePartners,

  // Primary Admin export
  SubAdmins,
  AdminStatistics,
  Invoices,
  NewNotficationsScreen,
  UserData,
  TodayBookings,
  DeletionRequests,
  Coupons,

  // Requirement export
  TravelRequirements,
  LocalRequirements,

  // Chats export
  CustomerChat,
  HotelSupport,
  LocalPartnerSupport,
  RestaurantChat,
  ChatWithAdmin,
  DriverChat,

  // Onboarding Forms export
  Login,
  PartnerOnboarding,
  HotelOnboarding,
  DriverOnBoarding,

  // partners export
  MyServices,
  PartnerProfile,
  Support,
  AddedRooms,
  CreateRoom,
  TodayArriving,
  AddedMenu,

  // Clubs and Shops export
  ShoppingMalls,
  Clubs,

  // Partner Dashboard exports
  PendingPartnership,
  MyDrivingRequirements,
  MyLocalRequirements,
  Bookings,
  FoodOrders,

  // Dashboard exports
  AdminDashboard,
  PartnerDashboard,
  NotFound,
  HotelRoomsPage,
  HotelRoomAvailabilityPage,
  HotelRoomAvailabilityHub,
  Vans,
  VanBookings,

  // Website Config export
  Blogs,
  Services,
  FAQs,
  Testimonials,
  ContactUs,
};
