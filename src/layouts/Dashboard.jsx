import { ExpandLess, ExpandMore } from "@mui/icons-material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Collapse,
  CssBaseline,
  Drawer,
  Fade,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  Toolbar,
  Typography,
} from "@mui/material";
import PropTypes from "prop-types";
import * as React from "react";
import { useContext } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { format } from "timeago.js";
import { logo } from "../assets";
import { AdminChatContext } from "../contextAPIs/AdminChatProvider";
import { AuthContext } from "../contextAPIs/AuthProvider";
import { PartnerContext } from "../contextAPIs/PartnerProvider";
import { AdminDashboard, PartnerDashboard } from "../pages";
import AdminRoute from "../routes/AdminRoute";
import PartnerRoute from "../routes/PartnerRoute";

import { useNotifications } from "../contextAPIs/NotificationsProvider";
import {
  AdminPanelSettingsIcon,
  ChatBubbleRoundedIcon,
  HailIcon,
  // DirectionsCarIcon,
  HandshakeIcon,
  LocalHotelIcon,
  MenuIcon,
  PersonIcon,
  SupportAgentIcon,
  TaskAltIcon,
  TaskIcon,
} from "../utils/Icons";
import {
  hotellinks,
  localAssislinks,
  newprimaryLinks,
  partnerStatus,
  primelocationslinks,
  restaurantlinks,
  // restaurantlinks,
  // driverRequest,
  Travellinks,
} from "../utils/RouteLinks";
import { DRAWER_WIDTH, NAVBAR_HEIGHT } from "../utils/constants";

// const drawerWidth = "245px";

function Dashboard(props) {
  const { notifications } = useNotifications();
  const { window } = props;
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [anchorE2, setAnchorE2] = React.useState(null);
  const {
    setQueryText,
    totalRequest,
    setChatRoom,
    chatCount,
    restaurantChatCount,
    hotelChatCount,
    travelBookings,
    carBookings,
    selfDriveBookings,
    // driverRequest,
    roomBookings,
  } = React.useContext(PartnerContext);
  const [activeStatus, setActiveStatus] = React.useState(0);
  const { logOut, isAdmin, isSubAdmin, isPartner, user, userData } =
    React.useContext(AuthContext);
  // const [openCommuincationMenu, setOpenCommunicationMenu] =
  //   React.useState(false);
  const location = useLocation(); // to track the url
  const { dispatch } = useContext(AdminChatContext);
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleChangeQueryText = (text, i) => {
    setQueryText(text);
    setActiveStatus(i);
  };

  if (userData?.isSuspended) {
    return (
      <div className="h-screen w-full flex items-center justify-center text-red-500 text-xl font-bold">
        <h3 className="text-xl">Your account has been banned permanently.</h3>
      </div>
    );
  }

  let partnerNavRoutes = [
    {
      icon: <PersonIcon />,
      url: `/profile/${userData?.serviceCategory}/${user?.uid}`,
      label: "Profile",
    },
  ];

  if (isPartner) {
    if (userData?.serviceCategory === "Hotel") {
      partnerNavRoutes[2] = {
        icon: <LocalHotelIcon />,
        url: "/added-rooms",
        label: "Added Rooms",
      };
      partnerNavRoutes[3] = {
        icon: <TaskIcon />,
        url: "",
        label: "Bookings",
      };
      partnerNavRoutes[4] = {
        icon: <HailIcon />,
        url: "/today-arrival",
        label: "Today Arrivals",
      };
    } else if (
      userData?.serviceCategory !== "Driving" &&
      userData?.serviceCategory !== "Hotel"
    ) {
      partnerNavRoutes[1] = {
        icon: <TaskAltIcon />,
        url: "",
        label: "Requirements",
      };
      partnerNavRoutes[2] = {
        icon: <TaskIcon />,
        url: "/my-services",
        label: "My Services",
      };
    } else {
      partnerNavRoutes.push({
        icon: <TaskAltIcon />,
        url: "",
        label: "Requirements",
      });
    }

    partnerNavRoutes.push({
      icon: <SupportAgentIcon />,
      url: "/support",
      label: "Support",
    });
    partnerNavRoutes.push({
      icon: <ChatBubbleRoundedIcon />,
      url: "/messages",
      label: "Messages",
    });
  }

  const handleLogOut = () => {
    logOut();
  };

  // handling changing chat room
  const handleChatRooom = (link) => {
    // console.log(link);
    setChatRoom(
      (link === "/dashboard/customer-chat" && "CustomerSupport") ||
      (link === "/dashboard/driver-chat" && "DriversSupport") ||
      (link === "/dashboard/partner-chat" && "LocalPartnerSupport") ||
      (link === "/dashboard/hotel-chat" && "HotelSupport") ||
      (link === "/dashboard/restaurant-chat" && "CustomerSupport")
    );

    dispatch({
      type: "CHANGE_USER",
      payload: {},
    });
  };

  // showig dashboard title based on user category
  let text = "";
  if (isAdmin || isSubAdmin) {
    text = "Admin Dashboard";
  } else if (isPartner) {
    if (userData.serviceCategory === "Hotel") {
      text = "Hotel Dashboard";
    } else if (userData.serviceCategory === "Driving") {
      text = "Driver Dashboard";
    } else {
      text = "Partner Dashboard";
    }
  }

  // const drawer = (
  //   <div className="bg-[var(--primary-bg)] bg-white text-[var(--drawer-inactive-color)] dashboard-menu">
  //     <Toolbar className="my-4">
  //       {/* <div className="text-2xl font-bold text-yellow-300">Thaiseva</div> */}
  //       <img
  //         src={logo}
  //         style={{
  //           userSelect: "none",
  //           WebkitUserDrag: "none",
  //           pointerEvents: "none", // Optional
  //         }}
  //       />
  //     </Toolbar>
  //     {/* <Divider /> */}
  //     <List sx={{ pt: 0.5, pb: 0.5 }} className="dashboard-menu">
  //       {(isAdmin || isSubAdmin) && (
  //         <>
  //           {/* partner route with child */}

  //           <>
  //             {primaryLinks?.map((item) => (
  //               <Link to={item?.link} key={item?.link}>
  //                 <ListItem
  //                   sx={{ py: 1.5, mb: 0.5 }}
  //                   className={`justify-between relative py-3 px-4 pl-5 hover:bg-[var(--drawer-hover-color)] ${
  //                     location.pathname === item?.link
  //                       ? "sidebar-active-tab"
  //                       : ""
  //                   }`}
  //                 >
  //                   {item?.icon}
  //                   <span className="grow ml-2">{item?.label}</span>
  //                   {/* <div
  //                     className={`triangle h-6 w-6 bg-white absolute right-0 top-auto z-10 ${
  //                       location.pathname === item?.link ? "block" : "hidden"
  //                     }`}
  //                   ></div> */}
  //                 </ListItem>
  //               </Link>
  //             ))}

  //             <div className="text-[var(--drawer-heading-color)] border-b-2 mt-4 mb-2 border-[var(--drawer-heading-color)] pl-2 text-lg font-bold  py-1 z-10 overflow-hidden">
  //               Client&apos;s Orders
  //             </div>
  //             {clientOrderLinks?.map((route, i) => (
  //               <Link to={route.url} key={i}>
  //                 <ListItem
  //                   sx={{ py: 1.5, mb: 0.5 }}
  //                   className={`justify-between relative py-3 px-4 pl-5 hover:bg-[var(--drawer-hover-color)] ${
  //                     location.pathname === route.url
  //                       ? "sidebar-active-tab"
  //                       : ""
  //                   }`}
  //                 >
  //                   {route.icon}
  //                   <span className="grow ml-2">{route.lable}</span>
  //                   {/* <div
  //                     className={`triangle h-6 w-6 bg-white absolute right-0 top-auto z-10 ${
  //                       location.pathname === route.url ? "block" : "hidden"
  //                     }`}
  //                   ></div> */}
  //                 </ListItem>
  //               </Link>
  //             ))}

  //             {/* <Divider /> */}
  //             <div className="text-[var(--drawer-heading-color)] border-b-2 mt-4 mb-2 border-[var(--drawer-heading-color)] pl-2 text-lg font-bold  py-1 z-10 overflow-hidden">
  //               Our Services
  //             </div>
  //             {ourServiceLinks?.map((route, i) => (
  //               <Link to={route.url} key={i}>
  //                 <ListItem
  //                   sx={{ py: 1.5, mb: 0.5 }}
  //                   className={`justify-between relative py-3 px-4 pl-5 hover:bg-[var(--drawer-hover-color)] ${
  //                     location.pathname === route.url
  //                       ? "sidebar-active-tab"
  //                       : ""
  //                   }`}
  //                 >
  //                   {route.icon}
  //                   <span className="grow ml-2">{route.lable}</span>
  //                   {/* {
  //                     <div
  //                       className={`triangle h-6 w-6 bg-white absolute right-0 top-auto z-10 ${
  //                         location.pathname === route.url ? "block" : "hidden"
  //                       }`}
  //                     ></div>
  //                   } */}
  //                 </ListItem>
  //               </Link>
  //             ))}

  //             <div className="text-[var(--drawer-heading-color)] border-b-2 mt-4 mb-2 border-[var(--drawer-heading-color)] pl-2 text-lg font-bold py-1 z-10 overflow-hidden">
  //               Our Partners
  //             </div>
  //             {ourPartnerLinks?.map((route, i) => (
  //               <Link to={route.url} key={i}>
  //                 <ListItem
  //                   sx={{ py: 1.5, mb: 0.5 }}
  //                   className={`justify-between relative py-3 px-4 pl-5 hover:bg-[var(--drawer-hover-color)] ${
  //                     location.pathname === route.url
  //                       ? "sidebar-active-tab"
  //                       : ""
  //                   }`}
  //                 >
  //                   {route.icon}
  //                   <span className="grow ml-2">{route.lable}</span>
  //                   {/* <div
  //                     className={`triangle h-6 w-6 bg-white absolute right-0 top-auto z-10 ${
  //                       location.pathname === route.url ? "block" : "hidden"
  //                     }`}
  //                   ></div> */}
  //                 </ListItem>
  //               </Link>
  //             ))}
  //             {/* <Divider /> */}
  //             <Link to={"/dashboard/drivers"}>
  //               <ListItem
  //                 open={location.pathname === "/dashboard/drivers"}
  //                 sx={{ py: 1.5 }}
  //                 className={`justify-between relative py-3 px-4 pl-5 hover:bg-[var(--drawer-hover-color)] ${
  //                   location.pathname === "/dashboard/drivers"
  //                     ? "sidebar-active-tab"
  //                     : ""
  //                 }`}
  //               >
  //                 <DirectionsCarIcon />
  //                 <span className="grow ml-2">Drivers</span>
  //                 {location.pathname === "/dashboard/drivers" ? (
  //                   <ExpandLess />
  //                 ) : (
  //                   <ExpandMore />
  //                 )}
  //                 {/* <div
  //                   className={`triangle h-6 w-6 bg-white absolute  right-0 top-auto z-10 ${
  //                     location.pathname === "/dashboard/drivers"
  //                       ? "block"
  //                       : "hidden"
  //                   }`}
  //                 ></div> */}
  //               </ListItem>
  //             </Link>
  //             <Collapse
  //               component="li"
  //               in={location.pathname === "/dashboard/drivers"}
  //               timeout="auto"
  //               unmountOnExit
  //             >
  //               <List disablePadding sx={{ pl: "1.25rem" }}>
  //                 {(isAdmin || isSubAdmin) &&
  //                   partnerStatus?.map((item, i) => (
  //                     <ListItem
  //                       key={i}
  //                       disablePadding
  //                       // sx={{
  //                       //   color: "black",
  //                       //   pl: 2,
  //                       //   m: 0,
  //                       //   bgcolor: `${
  //                       //     activeStatus === i && "var(--secondary-bg)"
  //                       //   }`,
  //                       // }}
  //                       className={`justify-between relative hover:bg-[var(--drawer-hover-color)] ${
  //                         activeStatus === i ? "in-sidebar-active-tab" : ""
  //                       }`}
  //                       onClick={() => handleChangeQueryText(item.queryText, i)}
  //                     >
  //                       <ListItemButton
  //                         sx={{ py: 1 }}
  //                         className="space-x-2 p-0"
  //                       >
  //                         <span>{item.icon}</span>
  //                         {item.queryText === "Pending" ? (
  //                           <Badge
  //                             color="secondary"
  //                             badgeContent={`${
  //                               item.queryText === "Pending" && driverRequest
  //                             }`}
  //                           >
  //                             <ListItemText
  //                               primary={item.label}
  //                               sx={{ ml: 0 }}
  //                             />
  //                           </Badge>
  //                         ) : (
  //                           <ListItemText primary={item.label} sx={{ ml: 0 }} />
  //                         )}
  //                       </ListItemButton>
  //                     </ListItem>
  //                   ))}
  //               </List>
  //             </Collapse>
  //             {/* <Divider /> */}
  //             <Link to={"/dashboard/local-partners"}>
  //               <ListItem
  //                 open={location.pathname === "/dashboard/local-partners"}
  //                 sx={{ py: 1.5, mt: 0.5 }}
  //                 className={`justify-between relative py-3 px-4 pl-5 hover:bg-[var(--drawer-hover-color)]  ${
  //                   location.pathname === "/dashboard/local-partners"
  //                     ? "sidebar-active-tab"
  //                     : ""
  //                 }`}
  //               >
  //                 <HandshakeIcon />
  //                 <span className="grow ml-2">Local Partners</span>
  //                 {location.pathname === "/dashboard/local-partners" ? (
  //                   <ExpandLess />
  //                 ) : (
  //                   <ExpandMore />
  //                 )}
  //                 {/* <div
  //                   className={`triangle h-6 w-6 bg-white absolute  right-0 top-auto z-10 ${
  //                     location.pathname === "/dashboard/local-partners"
  //                       ? "block"
  //                       : "hidden"
  //                   }`}
  //                 ></div> */}
  //               </ListItem>
  //             </Link>
  //             {/* <Divider /> */}
  //           </>

  //           <Collapse
  //             component="li"
  //             in={location.pathname === "/dashboard/local-partners"}
  //             timeout="auto"
  //             unmountOnExit
  //           >
  //             <List disablePadding sx={{ pl: "1.25rem" }}>
  //               {(isAdmin || isSubAdmin) &&
  //                 partnerStatus?.map((item, i) => (
  //                   <ListItem
  //                     key={item.queryText}
  //                     disablePadding
  //                     // sx={{
  //                     //   color: "white",
  //                     //   pl: 2,
  //                     //   m: 0,
  //                     //   bgcolor: `${
  //                     //     activeStatus === i && "var(--secondary-bg)"
  //                     //   }`,
  //                     // }}
  //                     className={`justify-between relative  hover:bg-[var(--drawer-hover-color)] ${
  //                       activeStatus === i ? "in-sidebar-active-tab" : ""
  //                     }`}
  //                     onClick={() => handleChangeQueryText(item.queryText, i)}
  //                   >
  //                     <ListItemButton sx={{ py: 1 }} className="space-x-2">
  //                       <span>{item.icon}</span>
  //                       {item.queryText === "Pending" ? (
  //                         <Badge
  //                           color="secondary"
  //                           badgeContent={`${
  //                             item.queryText === "Pending" && totalRequest
  //                           }`}
  //                         >
  //                           <ListItemText primary={item.label} sx={{ ml: 0 }} />
  //                         </Badge>
  //                       ) : (
  //                         <ListItemText primary={item.label} sx={{ ml: 0 }} />
  //                       )}
  //                     </ListItemButton>
  //                   </ListItem>
  //                 ))}
  //             </List>
  //           </Collapse>
  //           {(isAdmin || isSubAdmin) && (
  //             <Link to={"/dashboard/customer-chat"}>
  //               <ListItem
  //                 open={openCommuincationMenu}
  //                 onClick={() => setOpenCommunicationMenu((p) => !p)}
  //                 sx={{ py: 1.5, mt: 0.5 }}
  //                 className={`justify-between relative py-3 px-4 pl-5 hover:bg-[var(--drawer-hover-color)]  ${
  //                   location.pathname === "/dashboard/customer-chat" ||
  //                   location.pathname === "/dashboard/partner-chat" ||
  //                   location.pathname === "/dashboard/driver-chat" ||
  //                   location.pathname === "/dashboard/hotel-chat"
  //                     ? "sidebar-active-tab"
  //                     : ""
  //                 }`}
  //                 // className={` flex justify-between relative`}
  //               >
  //                 <SupportAgentIcon />
  //                 <span className="grow ml-2">Communication</span>
  //                 {location.pathname === "/dashboard/customer-chat" ||
  //                 location.pathname === "/dashboard/partner-chat" ||
  //                 location.pathname === "/dashboard/driver-chat" ||
  //                 location.pathname === "/dashboard/hotel-chat" ? (
  //                   <ExpandLess />
  //                 ) : (
  //                   <ExpandMore />
  //                 )}
  //               </ListItem>
  //             </Link>
  //           )}
  //           <Collapse
  //             component="li"
  //             in={
  //               location.pathname === "/dashboard/customer-chat" ||
  //               location.pathname === "/dashboard/partner-chat" ||
  //               location.pathname === "/dashboard/driver-chat" ||
  //               location.pathname === "/dashboard/hotel-chat"
  //             }
  //             timeout="auto"
  //             unmountOnExit
  //           >
  //             <List disablePadding sx={{ pl: "1.25rem" }}>
  //               {(isAdmin || isSubAdmin) &&
  //                 communicationChild?.map((item) => (
  //                   <Link
  //                     key={item.link}
  //                     to={item.link}
  //                     className="w-full flex justify-between relative"
  //                   >
  //                     <ListItem
  //                       disablePadding
  //                       // sx={{
  //                       //   color: "white",
  //                       //   pl: 2,
  //                       //   m: 0,
  //                       //   bgcolor: `${
  //                       //     location.pathname === "/dashboard/" + item.link &&
  //                       //     "var(--secondary-bg)"
  //                       //   }`,
  //                       // }}
  //                       className={`justify-between relative  hover:bg-[var(--drawer-hover-color)] ${
  //                         location.pathname === "/dashboard/" + item.link
  //                           ? "in-sidebar-active-tab"
  //                           : ""
  //                       }`}
  //                       onClick={() => handleChatRooom(item.link)}
  //                     >
  //                       <ListItemButton sx={{ py: 1 }} className="space-x-2">
  //                         <span>{item.icon}</span>
  //                         <ListItemText primary={item.label} sx={{ ml: 0 }} />
  //                         {/* <div
  //                           className={`triangle h-6 w-6 bg-white absolute right-0 top-auto z-10  ${
  //                             location?.pathname === "/dashboard/" + item?.link
  //                               ? "block"
  //                               : "hidden"
  //                           }`}
  //                         ></div> */}
  //                       </ListItemButton>
  //                     </ListItem>
  //                   </Link>
  //                 ))}
  //             </List>
  //           </Collapse>

  //           {isAdmin && (
  //             <ListItem
  //               disablePadding
  //               sx={{ mt: 0.5 }}
  //               // sx={{
  //               // color: "white",
  //               // m: 0,
  //               // bgcolor: `${
  //               //   location.pathname === "/dashboard/sub-admins" &&
  //               //   "var(--secondary-bg)"
  //               // }`,
  //               // }}
  //               className={`justify-between relative  hover:bg-[var(--drawer-hover-color)] ${
  //                 location.pathname === "/dashboard/sub-admins"
  //                   ? "sidebar-active-tab"
  //                   : ""
  //               }`}
  //             >
  //               <Link
  //                 to="/dashboard/sub-admins"
  //                 className="w-full flex justify-between relative"
  //               >
  //                 <ListItemButton sx={{ py: 1 }} className="space-x-2 w-full">
  //                   <span>
  //                     <AdminPanelSettingsIcon />
  //                   </span>
  //                   <ListItemText primary="Sub Admins" sx={{ ml: 0 }} />
  //                   {/* <div
  //                     className={`triangle h-6 w-6 bg-white absolute right-0 top-auto z-10  ${
  //                       location?.pathname === "/dashboard/sub-admins"
  //                         ? "block"
  //                         : "hidden"
  //                     }`}
  //                   ></div> */}
  //                 </ListItemButton>
  //               </Link>
  //             </ListItem>
  //           )}
  //         </>
  //       )}

  //       {isPartner &&
  //         partnerNavRoutes.map((item, i) => (
  //           <Link to={`/dashboard${item.url}`} key={i}>
  //             <ListItem
  //               disablePadding
  //               // sx={{
  //               //   color: "white",
  //               //   p: 0,
  //               //   m: 0,
  //               //   bgcolor: `${
  //               //     location.pathname === "/dashboard" + item.url &&
  //               //     "var(--secondary-bg)"
  //               //   }`,
  //               // }}
  //               className={`justify-between relative  hover:bg-[var(--drawer-hover-color)] ${
  //                 location.pathname === `/dashboard/${item.url}`
  //                   ? "sidebar-active-tab"
  //                   : ""
  //               }`}
  //             >
  //               <ListItemButton sx={{ py: 1 }} className="space-x-2 w-full">
  //                 <span> {item.icon}</span>
  //                 <ListItemText primary={item.label} sx={{ ml: 1 }} />
  //               </ListItemButton>
  //               {/* <div
  //                 className={`triangle h-6 w-6 bg-white absolute right-0 top-auto z-10  ${
  //                   location.pathname === "/dashboard" + item.url
  //                     ? "block"
  //                     : "hidden"
  //                 }`}
  //               ></div> */}
  //             </ListItem>
  //           </Link>
  //         ))}
  //     </List>
  //   </div>
  // );

  const newdrawer = (
    <div className="bg-[var(--primary-bg)] bg-white text-[var(--drawer-inactive-color)] dashboard-menu mb-5">
      {/* <Toolbar className="my-2"> */}
      {/* <div className="mb-4 w-full"> */}
      {/* header start */}
      <div className="p-6 pt-3 gap-2 flex relative">
        <img src={logo} className="mix-blend-multiply" alt="" />
        {/* <p className='md:text-3xl text-xl text-gray-800 font-bold'>Thaiseva</p> */}
        <div className="absolute bottom-3.5 left-0 select-none text-center w-full text-sm text-[#122159] font-medium">
          {isAdmin
            ? "Admin Dashboard"
            : isSubAdmin
              ? "Subadmin Dashboard"
              : isPartner
                ? "Partner Dashboard"
                : ""}
        </div>
      </div>
      {/* <img
        src={logo}
        className="w-full h-16 max-sm:h-14 object-cover p-1"
        style={{
          userSelect: "none",
          WebkitUserDrag: "none",
          pointerEvents: "none",
        }}
      /> */}
      {/* </div> */}
      {/* </Toolbar> */}
      <List sx={{ pt: 0.5, pb: 0.5 }} className="dashboard-menu">
        {(isAdmin || isSubAdmin) && (
          <>
            {newprimaryLinks?.map((item) => (
              <Link to={item?.link} key={item?.link}>
                <ListItem
                  sx={{ py: 1.5, mb: 0.5 }}
                  className={`justify-between relative py-3 px-4 pl-5 hover:bg-[var(--drawer-hover-color)] ${location.pathname === item?.link ? "sidebar-active-tab" : ""
                    }`}
                >
                  {item?.icon}
                  <span className="grow ml-2">{item?.label}</span>
                </ListItem>
              </Link>
            ))}
            {isAdmin && (
              <ListItem
                disablePadding
                sx={{ mt: 0.5 }}
                className={`justify-between relative  hover:bg-[var(--drawer-hover-color)] ${location.pathname === "/dashboard/sub-admins"
                  ? "sidebar-active-tab"
                  : ""
                  }`}
              >
                <Link
                  to="/dashboard/sub-admins"
                  className="w-full flex justify-between relative"
                >
                  <ListItemButton sx={{ py: 1 }} className="space-x-2 w-full">
                    <span>
                      <AdminPanelSettingsIcon />
                    </span>
                    <ListItemText primary="Sub Admins" sx={{ ml: 0 }} />
                  </ListItemButton>
                </Link>
              </ListItem>
            )}

            <div className="text-[var(--drawer-heading-color)] border-b-2 mt-4 mb-2 border-[var(--drawer-heading-color)] pl-2 text-lg font-bold  py-1 z-10 overflow-hidden">
              Hotel Related
            </div>
            {hotellinks?.map((route, i) => (
              <Link to={route.url} key={i}>
                <ListItem
                  sx={{ py: 1.5, mb: 0.5 }}
                  className={`justify-between relative py-3 px-4 pl-5 hover:bg-[var(--drawer-hover-color)] ${location.pathname === route.url ? "sidebar-active-tab" : ""
                    }`}
                  onClick={
                    route?.url === "/dashboard/hotel-chat"
                      ? () => handleChatRooom(route.url)
                      : undefined
                  }
                >
                  {route.icon}
                  <span className="grow ml-2">{route.lable}</span>
                  {route.url === "/dashboard/hotel-chat" && hotelChatCount > 0 && (
                    <Badge color="primary" badgeContent={`${hotelChatCount}`} />
                  )}
                  {route.url === "/dashboard/room-bookings" && roomBookings.filter((item) => item.status === "Pending").length > 0 && (
                    <Badge
                      color="primary"
                      badgeContent={`${roomBookings.filter((item) => item.status === "Pending")
                        .length
                        }`}
                    />
                  )}
                </ListItem>
              </Link>
            ))}

            <div className="text-[var(--drawer-heading-color)] border-b-2 mt-4 mb-2 border-[var(--drawer-heading-color)] pl-2 text-lg font-bold  py-1 z-10 overflow-hidden">
              Travel Related
            </div>
            {Travellinks?.map((route, i) => (
              <Link to={route.url} key={i}>
                <ListItem
                  sx={{ py: 1.5, mb: 0.5 }}
                  className={`justify-between relative py-3 px-4 pl-5 hover:bg-[var(--drawer-hover-color)] ${location.pathname === route.url ? "sidebar-active-tab" : ""
                    }`}
                  onClick={
                    route?.url === "/dashboard/driver-chat"
                      ? () => handleChatRooom(route.url)
                      : undefined
                  }
                >
                  {route.icon}
                  <span className="grow ml-2">{route.lable}</span>
                  {route.url === "/dashboard/travel-bookings" && travelBookings.filter((item) => item.status === "Pending").length > 0 && (
                    <Badge
                      color="primary"
                      badgeContent={`${travelBookings.filter(
                        (item) => item.status === "Pending"
                      ).length
                        }`}
                    />
                  )}
                  {route.url === "/dashboard/car-bookings" && carBookings.filter((item) => item.status === "pending").length > 0 && (
                    <Badge
                      color="primary"
                      badgeContent={`${carBookings.filter((item) => item.status === "pending")
                        .length
                        }`}
                    />
                  )}
                  {route.url === "/dashboard/self-drive-bookings" && selfDriveBookings.filter((item) => item.status === "pending").length > 0 && (
                    <Badge
                      color="primary"
                      badgeContent={`${selfDriveBookings.filter(
                        (item) => item.status === "pending"
                      ).length
                        }`}
                    />
                  )}
                </ListItem>
              </Link>
            ))}
            {/* <Link to={"/dashboard/drivers"}>
              <ListItem
                open={location.pathname === "/dashboard/drivers"}
                sx={{ py: 1.5 }}
                className={`justify-between relative py-3 px-4 pl-5 hover:bg-[var(--drawer-hover-color)] ${
                  location.pathname === "/dashboard/drivers"
                    ? "sidebar-active-tab"
                    : ""
                }`}
              >
                <DirectionsCarIcon />
                <span className="grow ml-2">Drivers</span>
                {location.pathname === "/dashboard/drivers" ? (
                  <ExpandLess />
                ) : (
                  <ExpandMore />
                )}
              </ListItem>
            </Link> */}
            {/* <Collapse
              component="li"
              in={location.pathname === "/dashboard/drivers"}
              timeout="auto"
              className="w-full overflow-hidden"
              unmountOnExit
            >
              <List disablePadding sx={{ pl: "1.25rem" }}>
                {(isAdmin || isSubAdmin) &&
                  partnerStatus?.map((item, i) => (
                    <ListItem
                      key={i}
                      disablePadding
                      className={`justify-between relative hover:bg-[var(--drawer-hover-color)] ${
                        activeStatus === i ? "in-sidebar-active-tab" : ""
                      }`}
                      onClick={() => handleChangeQueryText(item.queryText, i)}
                    >
                      <ListItemButton sx={{ py: 1 }} className="space-x-2 p-0">
                        <span>{item.icon}</span>
                        {item.queryText === "Pending" ? (
                          <Badge
                            color="secondary"
                            badgeContent={`${
                              item.queryText === "Pending" && driverRequest
                            }`}
                          >
                            <ListItemText primary={item.label} sx={{ ml: 0 }} />
                          </Badge>
                        ) : (
                          <ListItemText primary={item.label} sx={{ ml: 0 }} />
                        )}
                      </ListItemButton>
                    </ListItem>
                  ))}
              </List>
            </Collapse> */}

            <div className="text-[var(--drawer-heading-color)] border-b-2 mt-4 mb-2 border-[var(--drawer-heading-color)] pl-2 text-lg font-bold  py-1 z-10 overflow-hidden">
              Local Assistance
            </div>
            {localAssislinks?.map((route, i) => (
              <Link to={route.url} key={i}>
                <ListItem
                  sx={{ py: 1.5, mb: 0.5 }}
                  className={`justify-between relative py-3 px-4 pl-5 hover:bg-[var(--drawer-hover-color)] ${location.pathname === route.url ? "sidebar-active-tab" : ""
                    }`}
                  onClick={
                    route?.url === "/dashboard/customer-chat" ||
                      route.url === "/dashboard/partner-chat"
                      ? () => handleChatRooom(route.url)
                      : undefined
                  }
                // onClick={
                //   route?.url === "/dashboard/partner-chat"
                //     ? () => handleChatRooom(route.url)
                //     : undefined
                // }
                >
                  {route.icon}
                  <span className="grow ml-2">{route.lable}</span>
                  {route.url === "/dashboard/customer-chat" && chatCount > 0 && (
                    <Badge color="primary" badgeContent={`${chatCount}`} />
                  )}
                </ListItem>
              </Link>
            ))}


            <div className="text-[var(--drawer-heading-color)] border-b-2 mt-4 mb-2 border-[var(--drawer-heading-color)] pl-2 text-lg font-bold  py-1 z-10 overflow-hidden">
              Prime Locations
            </div>
            {primelocationslinks?.map((item) => (
              <Link to={item?.link} key={item?.link}>
                <ListItem
                  sx={{ py: 1.5, mb: 0.5 }}
                  className={`justify-between relative py-3 px-4 pl-5 hover:bg-[var(--drawer-hover-color)] ${location.pathname === item?.link ? "sidebar-active-tab" : ""
                    }`}
                  onClick={
                    item?.link === "/dashboard/customer-chat"
                      ? () => handleChatRooom(item.link)
                      : undefined
                  }
                >
                  {item?.icon}
                  <span className="grow ml-2">{item?.label}</span>
                </ListItem>
              </Link>
            ))}

            <div className="text-[var(--drawer-heading-color)] border-b-2 mt-4 mb-2 border-[var(--drawer-heading-color)] pl-2 text-lg font-bold  py-1 z-10 overflow-hidden">
              Restaurant Related
            </div>
            {restaurantlinks?.map((route, i) => (
              <Link to={route.url} key={i}>
                <ListItem
                  sx={{ py: 1.5, mb: 0.5 }}
                  className={`justify-between relative py-3 px-4 pl-5 hover:bg-[var(--drawer-hover-color)] ${location.pathname === route.url ? "sidebar-active-tab" : ""
                    }`}
                  onClick={
                    route?.url === "/dashboard/restaurant-chat"
                      ? () => handleChatRooom(route.url)
                      : undefined
                  }
                >
                  {route.icon}
                  <span className="grow ml-2">{route.lable}</span>
                  {route.url === "/dashboard/restaurant-chat" && restaurantChatCount > 0 && (
                    <Badge color="primary" badgeContent={`${restaurantChatCount}`} />
                  )}
                </ListItem>
              </Link>
            ))}

            {/* <div className="text-[var(--drawer-heading-color)] border-b-2 mt-4 mb-2 border-[var(--drawer-heading-color)] pl-2 text-lg font-bold  py-1 z-10 overflow-hidden">
              Restaurant Related
            </div>
            {restaurantlinks?.map((route, i) => (
              <Link to={route.url} key={i}>
                <ListItem
                  sx={{ py: 1.5, mb: 0.5 }}
                  className={`justify-between relative py-3 px-4 pl-5 hover:bg-[var(--drawer-hover-color)] ${
                    location.pathname === route.url ? "sidebar-active-tab" : ""
                  }`}
                >
                  {route.icon}
                  <span className="grow ml-2">{route.lable}</span>
                </ListItem>
              </Link>
            ))} */}
          </>
        )}

        {isPartner &&
          partnerNavRoutes.map((item, i) => (
            <NavLink
              sx={{ py: 1.5, mb: 0.5 }}
              to={`/dashboard${item.url}`}
              key={i}
              end={item.url === ``}
              // className={({ isActive }) =>
              //   `justify-between relative py-3 px-4 pl-5 hover:bg-[var(--drawer-hover-color)] ${
              //     isActive ? "sidebar-active-tab" : ""
              //   }`
              // }
              className={({ isActive }) =>
                `hover:bg-[var(--drawer-hover-color)] flex w-full p-3 pl-6 ${isActive ? "sidebar-active-tab" : ""
                }`
              }
            >
              {item.icon}
              <span className="grow ml-2">{item.label}</span>
            </NavLink>
          ))}
        {/* <> */}
        {/* <ListItem
                sx={{ py: 1.5, mb: 0.5 }}
                className={({ isActive }) =>
                  `justify-between relative py-3 px-4 pl-5 hover:bg-[var(--drawer-hover-color)] ${
                    isActive ? "sidebar-active-tab" : ""
                  }`
                }
              >
                {item.icon}
                {console.log(item.url, location.pathname)}
                <span className="grow ml-2">{item.label}</span>
                <ListItemButton sx={{ py: 1 }} className="space-x-2 w-full">
                <span> {item.icon}</span>
                <ListItemText primary={item.label} sx={{ ml: 1 }} />
                </ListItemButton>
              </ListItem> */}
        {/* </> */}
      </List>
    </div>
  );

  const container =
    window !== undefined ? () => window().document.body : undefined;

  const avaterMenu = Boolean(anchorEl);
  const notificationOpen = Boolean(anchorE2);
  const handleNClick = (event) => {
    setAnchorE2(event.currentTarget);
  };
  const handleNClose = () => {
    setAnchorE2(null);
  };
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <Box sx={{ display: "flex" }} className="h-100vh w-[100%]">
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${DRAWER_WIDTH})` },
          ml: { sm: `${DRAWER_WIDTH}` },
          // backgroundColor: "var(--primary-bg)",
          boxShadow: "none",
        }}
        className="shadow-none"
      >
        <Toolbar
          sx={{ display: "flex", justifyContent: "space-between" }}
          className={`bg-white text-black h-[${NAVBAR_HEIGHT}] shadow-none`}
        >
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 1, display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ fontWeight: "bold" }}
          >
            {<div className="font-bold block">{text}</div>}
          </Typography>
          <div className="flex">
            {(isAdmin || isSubAdmin) && (
              <div className="flex gap-2 items-center">
                <div
                  id="n-fade-button"
                  aria-controls={
                    notificationOpen ? "notification-menu" : undefined
                  }
                  aria-haspopup="true"
                  aria-expanded={notificationOpen ? "true" : undefined}
                  onClick={handleNClick}
                >
                  <i
                    className={`relative text-2xl text-blue-700 cursor-pointer bi bi-bell-fill lg:me-10 ${notifications.length > 0 &&
                      "drop-shadow-[0px_0px_10px_rgba(239,68,68,0.5)]"
                      }`}
                  >
                    <NotificationsIcon fontSize="medium" />
                    {notifications?.length > 0 && (
                      <div className="bg-red-500 absolute text-sm flex justify-center items-center w-[0.6rem] h-[0.6rem] text-white rounded-full top-1 right-0 shadow shadow-red-500"></div>
                    )}
                  </i>
                </div>

                <div>
                  <Menu
                    id="notification-menu"
                    MenuListProps={{
                      "aria-labelledby": "n-fade-button",
                    }}
                    anchorEl={anchorE2}
                    open={notificationOpen}
                    onClose={handleNClose}
                    TransitionComponent={Fade}
                    sx={{ mt: 0.5, ml: -10 }}
                  >
                    <div
                      className={`p-3 py-2 rounded-xl max-h-[300px] no-scrollbar overflow-auto w-[18rem]`}
                    >
                      <div className="flex items-center justify-between w-full h-8">
                        <p className="m-auto font-semibold text-slate-600">
                          {notifications?.length > 0
                            ? "Notification"
                            : "No Notifications"}
                        </p>
                      </div>
                      {notifications.map((item, index) => (
                        <div key={index} className="flex gap-4 mt-6 w-full">
                          <img
                            src={`${item.imageUrl}`}
                            className="h-[3rem] w-[3rem] object-cover rounded-md"
                            alt=""
                          />
                          <div className="w-full">
                            <p className="text-base text-slate-800 font-medium">
                              {item.message}
                            </p>
                            {/* <p className="mt-1 text-slate-500">{item.message}</p> */}
                            <p className="mt-1 text-xs text-end w-full text-slate-500">
                              {format(item.timestamp.toDate())}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Menu>
                </div>
              </div>
            )}
            <div className="flex gap-2 items-center">
              {(isPartner || isSubAdmin) && (
                <div className="flex flex-col justify-end">
                  <p className="max-md:hidden block font-bold text-md text-end">
                    {user.displayName}
                  </p>
                  <p className="max-md:hidden block text-xs text-end">
                    {user.email}
                  </p>
                </div>
              )}
              <Avatar
                alt="Cindy Baker"
                src={user?.photoURL}
                className="border-2 bg-white border-yellow-300 cursor-pointer"
                id="fade-button"
                aria-controls={avaterMenu ? "fade-menu" : undefined}
                aria-haspopup="true"
                aria-expanded={avaterMenu ? "true" : undefined}
                onClick={handleClick}
              />

              <div>
                <Menu
                  id="fade-menu"
                  MenuListProps={{
                    "aria-labelledby": "fade-button",
                  }}
                  anchorEl={anchorEl}
                  open={avaterMenu}
                  onClose={handleClose}
                  TransitionComponent={Fade}
                  sx={{ mt: 0.5 }}
                >
                  <button
                    onClick={handleLogOut}
                    className="h-fit font-bold text-white rounded-lg py-1 px-2 text-xs m-2 bg-[var(--button-bg-color)]"
                  >
                    Log Out
                  </button>
                </Menu>
              </div>
            </div>
          </div>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{
          width: { sm: DRAWER_WIDTH },
          flexShrink: { sm: 0 },
        }}
        aria-label="mailbox folders"
      >
        {/* The implementation can be swapped with js to avoid SEO duplication of links. */}
        <Drawer
          container={container}
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: "block", sm: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              scrollbarWidth: "none",
              border: "none",
              width: DRAWER_WIDTH,
              // bgcolor: "var(--primary-bg)",
            },
          }}
          className="dashboard-menu overflow-x-hidden"
        >
          {newdrawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", sm: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: DRAWER_WIDTH,
              scrollbarWidth: "none",
              border: "none",
              // overflow: "hidden",
              // scrollbar-width: "none",
              // bgcolor: "var(--primary-bg)",
            },
          }}
          open
          className="dashboard-menu overflow-x-hidden"
        >
          {newdrawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { sm: 4, xs: 2 },
          width: {
            sm: `calc(100% - ${DRAWER_WIDTH}px)`,
            xs: `calc(100% - ${DRAWER_WIDTH}px)`,
          },
          overflow: "auto",
          height: {
            xs: "calc(100vh - 3.5rem)",
            sm: "calc(100vh - 4.0rem)",
          },
        }}
        className="bg-gradient-to-r from-[var(--main-bg-gradient-color-1)] to-[var(--main-bg-gradient-color-2)] mt-[4.0rem] max-sm:mt-[3.5rem]"
      >
        {/* <Toolbar className="h-4"></Toolbar> */}

        {location.pathname === "/dashboard" &&
          (((isAdmin || isSubAdmin) && (
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          )) ||
            (isPartner && (
              <PartnerRoute>
                <PartnerDashboard />
              </PartnerRoute>
            )))}
        {(isAdmin || isSubAdmin || isPartner) && <Outlet />}
      </Box>
    </Box>
  );
}

Dashboard.propTypes = {
  /**
   * Injected by the documentation to work in an iframe.
   * You won't need it on your project.
   */
  window: PropTypes.func,
};

export default Dashboard;
