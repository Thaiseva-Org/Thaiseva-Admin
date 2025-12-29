// import {Shop } from "@mui/icons-material";
import {
  AccountBalanceWalletIcon,
  ApartmentIcon,
  BedIcon,
  Shop,
  NotificationsRounded,
  BeenhereIcon,
  Diversity1Icon,
  DriveEtaIcon,
  FastfoodIcon,
  ForumIcon,
  HomeIcon,
  HowToRegIcon,
  LocalHotelIcon,
  LocalTaxiIcon,
  LuggageIcon,
  ManageAccountsIcon,
  NoCrashIcon,
  PersonAddAlt1Icon,
  PersonAddDisabledIcon,
  ReceiptIcon,
  RestaurantIcon,
  SignalCellularAltIcon,
  TaskAltIcon,
  TravelExploreIcon,
  NightlifeIcon,
  ReceiptLongRoundedIcon,
  GroupRoundedIcon,
} from "./Icons";

export const primaryLinks = [
  { icon: <HomeIcon />, link: "/dashboard", label: "Dashboard" },
  {
    icon: <SignalCellularAltIcon />,
    link: "/dashboard/admin-statistics",
    label: "Statistics",
  },
  {
    icon: <NotificationsRounded />,
    link: "/dashboard/notifications",
    label: "Manage Notifications",
  },
  { icon: <ReceiptIcon />, link: "/dashboard/invoices", label: "Invoices" },
  {
    icon: <LocalTaxiIcon />,
    link: "/dashboard/travel-requirements",
    label: "Travel Requirements",
  },
  {
    icon: <TaskAltIcon />,
    link: "/dashboard/local-requirements",
    label: "Local Requirements",
  },
  {
    icon: <Shop />,
    link: "/dashboard/shopping-malls",
    label: "Shops",
  },
];

export const clientOrderLinks = [
  {
    url: "/dashboard/room-bookings",
    lable: "Room Bookings",
    icon: <BeenhereIcon />,
  },
  {
    url: "/dashboard/travel-bookings",
    lable: "Travel Bookings",
    icon: <TravelExploreIcon />,
  },
  {
    url: "/dashboard/car-bookings",
    lable: "Car Bookings",
    icon: <NoCrashIcon />,
  },
];

export const partnerStatus = [
  {
    icon: <HowToRegIcon />,
    queryText: "Verified",
    label: "Verified",
  },
  {
    icon: <PersonAddAlt1Icon />,
    queryText: "Pending",
    label: "Requests",
  },
  {
    icon: <PersonAddDisabledIcon />,
    queryText: "Denied",
    label: "Denied",
  },
];

export const communicationChild = [
  {
    icon: <ForumIcon />,
    link: "customer-chat",
    label: "Customer Chat",
  },
  { icon: <Diversity1Icon />, link: "partner-chat", label: "Partner Chat" },
  { icon: <DriveEtaIcon />, link: "driver-chat", label: "Driver Chat" },
  { icon: <BedIcon />, link: "hotel-chat", label: "Hotel Chat" },
];

export const ourPartnerLinks = [
  {
    url: "/dashboard/restaurants",
    lable: "Restaurants",
    icon: <RestaurantIcon />,
  },
  { url: "/dashboard/hotels", lable: "Hotels", icon: <ApartmentIcon /> },
  {
    url: "/dashboard/partner-commissions",
    lable: "Commissions",
    icon: <AccountBalanceWalletIcon />,
  },
];

export const ourServiceLinks = [
  {
    url: "/dashboard/local-services",
    lable: "Local Services",
    icon: <ManageAccountsIcon />,
  },
  // {
  //   url: "/dashboard/room-services",
  //   lable: "Room Services",
  //   icon: <LocalHotelIcon />,
  // },
  {
    url: "/dashboard/travel-services",
    lable: "Travel Services",
    icon: <LuggageIcon />,
  },
  {
    url: "/dashboard/food-services",
    lable: "Food Services",
    icon: <FastfoodIcon />,
  },
  {
    url: "/dashboard/car-services",
    lable: "Car Services",
    icon: <FastfoodIcon />,
  },
];

export const newprimaryLinks = [
  { icon: <HomeIcon />, link: "/dashboard", label: "Dashboard" },
  {
    icon: <NotificationsRounded />,
    link: "/dashboard/notifications",
    label: "Manage Notifications",
  },
  {
    icon: <SignalCellularAltIcon />,
    link: "/dashboard/admin-statistics",
    label: "Statistics",
  },
  // { icon: <ReceiptIcon />, link: "/dashboard/invoices", label: "Invoices" },
  {
    icon: <ReceiptLongRoundedIcon />,
    link: "/dashboard/bookings-record",
    label: "Records",
  },
  {
    icon: <GroupRoundedIcon />,
    link: "/dashboard/user-data",
    label: "Users Data",
  },
];

export const hotellinks = [
  { url: "/dashboard/hotels", lable: "Hotels", icon: <ApartmentIcon /> },
  // {
  //   url: "/dashboard/room-services",
  //   lable: "Room Services",
  //   icon: <LocalHotelIcon />,
  // },
  {
    url: "/dashboard/room-bookings",
    lable: "Room Bookings",
    icon: <BeenhereIcon />,
  },

  // { icon: <BedIcon />, url: "/dashboard/hotel-chat", lable: "Hotel Chat" },
];

export const Travellinks = [
  {
    url: "/dashboard/travel-services",
    lable: "Sightseeing Packages",
    icon: <LuggageIcon />,
  },
  // {
  //   url: "/dashboard/car-services",
  //   lable: "Taxi Services",
  //   icon: <FastfoodIcon />,
  // },
  // {
  //   url: "/dashboard/selfdrive-service",
  //   lable: "Self Drive Services",
  //   icon: <FastfoodIcon />,
  // },
  {
    url: "/dashboard/travel-bookings",
    lable: "Sightseeing Bookings",
    icon: <TravelExploreIcon />,
  },

  {
    url: "/dashboard/car-bookings",
    lable: "Taxi Bookings",
    icon: <LocalTaxiIcon />,
  },
  {
    url: "/dashboard/self-drive-bookings",
    lable: "Self Drive Bookings",
    icon: <NoCrashIcon />,
  },
  // {
  //   icon: <LocalTaxiIcon />,
  //   url: "/dashboard/travel-requirements",
  //   lable: "Travel Requirements",
  // },
  // {
  //   icon: <DriveEtaIcon />,
  //   url: "/dashboard/driver-chat",
  //   lable: "Driver Chat",
  // },
];

export const localAssislinks = [
  {
    icon: <ForumIcon />,
    url: "/dashboard/customer-chat",
    lable: "Customer Chat",
  },
  {
    url: "/dashboard/local-partners",
    lable: "Local Partners",
    icon: <ManageAccountsIcon />,
  },
  {
    icon: <TaskAltIcon />,
    url: "/dashboard/local-requirements",
    lable: "Local Requirements",
  },
  {
    icon: <Diversity1Icon />,
    url: "/dashboard/partner-chat",
    lable: "Partner Chat",
  },
];

export const restaurantlinks = [
  {
    icon: <RestaurantIcon />,
    url: "/dashboard/restaurants",
    lable: "Restaurants",
  },
  {
    icon: <FastfoodIcon />,
    url: "/dashboard/restaurant-chat",
    lable: "Restaurant Chat",
  },
  // {
  //   url: "/dashboard/food-services",
  //   lable: "Food Services",
  //   icon: <FastfoodIcon />,
  // },
];

export const primelocationslinks = [
  {
    icon: <Shop />,
    link: "/dashboard/shopping-malls",
    label: "Shops",
  },
  {
    icon: <NightlifeIcon />,
    link: "/dashboard/clubs",
    label: "Clubs",
  },
];

export const partnerManagementLinks = [
  {
    icon: <ManageAccountsIcon />,
    link: "/dashboard/manage-partners",
    label: "Manage Partners",
  },
];
