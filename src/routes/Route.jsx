import { createBrowserRouter } from "react-router-dom";
import PrivetRouter from "./PrivetRouter";
import PartnerRoute from "./PartnerRoute";
import AdminRoute from "./AdminRoute";
import HeadAdminRoute from "./HeadAdminRoute";
import { Main, Dashboard } from "../layouts";
import GlobalError from "../components/GlobalError";
import {
  TravelBookings,
  RoomBookings,
  CarBookings,
  SelfDriveBookings,
  RoomServices,
  TravelServices,
  AddSightseeingPackage,
  LocalServices,
  Hotels,
  LocalPartners,
  Restaurants,
  ManagePartners,
  SubAdmins,
  AdminStatistics,
  NewNotficationsScreen,
  UserData,
  DeletionRequests,
  TodayBookings,
  LocalRequirements,
  CustomerChat,
  HotelSupport,
  LocalPartnerSupport,
  ChatWithAdmin,
  RestaurantChat,
  Login,
  PartnerOnboarding,
  MyServices,
  PartnerProfile,
  Support,
  AddedRooms,
  CreateRoom,
  TodayArriving,
  ShoppingMalls,
  Clubs,
  NotFound,
  HotelRoomsPage,
  AddHotelForm,
  Vans,
  VanBookings,
  Blogs,
  Services,
  FAQs,
  Testimonials,
  ContactUs
} from "../pages";
import StatisticsProvider from "../contextAPIs/StatisticsProvider";
import { Suspense } from "react";
import Loading from "../components/Loading";
import ScrollToTop from "../components/ScrollToTop";

export const router = createBrowserRouter([
  {
    path: "/",
    errorElement: <GlobalError />,
    element: (
      <Suspense
        fallback={
          <div className="h-screen flex items-center">
            <Loading />
          </div>
        }
      >
        <ScrollToTop />
        <Main />
      </Suspense>
    ),
    children: [],
  },
  {
    path: "/dashboard",
    element: (
      <PrivetRouter>
        <ScrollToTop />
        <Dashboard />
      </PrivetRouter>
    ),
    children: [
      {
        path: "/dashboard/bookings-record",
        element: (
          <AdminRoute>
            <TodayBookings />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/user-data",
        element: (
          <AdminRoute>
            <UserData />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/deletion-requests",
        element: (
          <AdminRoute>
            <DeletionRequests />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/shopping-malls",
        element: (
          <AdminRoute>
            <ShoppingMalls />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/clubs",
        element: (
          <AdminRoute>
            <Clubs />
          </AdminRoute>
        ),
      },
      // {
      //   path: "/dashboard/coupons",
      //   element: (
      //     <AdminRoute>
      //       <Coupons />
      //     </AdminRoute>
      //   ),
      // },
      /* =================================================
                          Requirements
      =================================================*/

      // {
      //   path: "/dashboard/travel-requirements",
      //   element: (
      //     <PrivetRouter>
      //       <TravelRequirements />
      //     </PrivetRouter>
      //   ),
      // },
      {
        path: "/dashboard/local-requirements",
        element: (
          <AdminRoute>
            <LocalRequirements />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/admin-statistics",
        element: (
          <AdminRoute>
            <StatisticsProvider>
              <AdminStatistics />
            </StatisticsProvider>
          </AdminRoute>
        ),
      },
      /* =================================================
                          Client's Orders
      =================================================*/
      {
        path: "/dashboard/room-bookings",
        element: (
          <AdminRoute>
            <RoomBookings />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/travel-bookings",
        element: (
          <AdminRoute>
            <TravelBookings />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/car-bookings",
        element: (
          <AdminRoute>
            <CarBookings />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/van-bookings",
        element: (
          <AdminRoute>
            <VanBookings />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/self-drive-bookings",
        element: (
          <AdminRoute>
            <SelfDriveBookings />
          </AdminRoute>
        ),
      },

      /* =================================================
                          Our Services
      =================================================*/
      {
        path: "/dashboard/local-services",
        element: (
          <AdminRoute>
            <LocalServices />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/room-services",
        element: (
          <AdminRoute>
            <RoomServices />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/travel-services",
        element: (
          <AdminRoute>
            <TravelServices />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/travel-services/add",
        element: (
          <AdminRoute>
            <AddSightseeingPackage />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/travel-services/edit/:packageId",
        element: (
          <AdminRoute>
            <AddSightseeingPackage />
          </AdminRoute>
        ),
      },
      // {
      //   path: "/dashboard/food-services",
      //   element: (
      //     <AdminRoute>
      //       <FoodServices />
      //     </AdminRoute>
      //   ),
      // },
      // {
      //   path: "/dashboard/car-services",
      //   element: (
      //     <AdminRoute>
      //       <CarServices />
      //     </AdminRoute>
      //   ),
      // },
      // {
      //   path: "/dashboard/selfdrive-service",
      //   element: (
      //     <AdminRoute>
      //       <SelfDriveServices />
      //     </AdminRoute>
      //   ),
      // },
      {
        path: "/dashboard/notifications",
        element: (
          <AdminRoute>
            <NewNotficationsScreen />
          </AdminRoute>
        ),
      },


      /* =================================================
                          Website Configuration
      =================================================*/
      {
        path: "/dashboard/website-config/blogs",
        element: (
          <AdminRoute>
            <Blogs />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/website-config/services",
        element: (
          <AdminRoute>
            <Services />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/website-config/faqs",
        element: (
          <AdminRoute>
            <FAQs />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/website-config/testimonials",
        element: (
          <AdminRoute>
            <Testimonials />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/website-config/contact-us",
        element: (
          <AdminRoute>
            <ContactUs />
          </AdminRoute>
        ),
      },

      /* =================================================
                         Our Partners
      =================================================*/
      {
        path: "/dashboard/restaurants",
        element: (
          <AdminRoute>
            <Restaurants />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/hotels",
        element: (
          <AdminRoute>
            <Hotels />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/vans",
        element: (
          <AdminRoute>
            <Vans />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/hotels/add",
        element: (
          <AdminRoute>
            <AddHotelForm />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/hotels/edit/:hotelId",
        element: (
          <AdminRoute>
            <AddHotelForm />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/hotels/:hotelId/rooms",
        element: (
          <AdminRoute>
            <HotelRoomsPage />
          </AdminRoute>
        ),
      },
      // {
      //   path: "/dashboard/drivers",
      //   element: (
      //     <AdminRoute>
      //       <Drivers />
      //     </AdminRoute>
      //   ),
      // },
      {
        path: "/dashboard/manage-partners",
        element: (
          <AdminRoute>
            <ManagePartners />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/local-partners",
        element: (
          <AdminRoute>
            <LocalPartners />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/customer-chat",
        element: (
          <AdminRoute>
            <CustomerChat />
          </AdminRoute>
        ),
      },
      // {
      //   path: "/dashboard/driver-chat",
      //   element: (
      //     <AdminRoute>
      //       <DriverChat />
      //     </AdminRoute>
      //   ),
      // },
      {
        path: "/dashboard/partner-chat",
        element: (
          <AdminRoute>
            <LocalPartnerSupport />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/hotel-chat",
        element: (
          <AdminRoute>
            <HotelSupport />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard/restaurant-chat",
        element: (
          <AdminRoute>
            <RestaurantChat />
          </AdminRoute>
        ),
      },

      /* =================================================
                    Partner dashboard routes
      =================================================*/
      {
        path: "/dashboard/my-services",
        element: (
          <PartnerRoute>
            <MyServices />
          </PartnerRoute>
        ),
      },
      {
        path: "/dashboard/profile/:category/:uid",
        element: (
          <PrivetRouter>
            <PartnerRoute>
              <PartnerProfile />
            </PartnerRoute>
          </PrivetRouter>
        ),
      },
      {
        path: "/dashboard/support",
        element: (
          <PrivetRouter>
            <PartnerRoute>
              <Support />
            </PartnerRoute>
          </PrivetRouter>
        ),
      },
      {
        path: "/dashboard/added-rooms",
        element: (
          <PrivetRouter>
            <PartnerRoute>
              <AddedRooms />
            </PartnerRoute>
          </PrivetRouter>
        ),
      },
      {
        path: "/dashboard/today-arrival",
        element: (
          <PrivetRouter>
            <PartnerRoute>
              <TodayArriving />
            </PartnerRoute>
          </PrivetRouter>
        ),
      },
      {
        path: "/dashboard/added-rooms/room-details",
        element: (
          <PrivetRouter>
            <PartnerRoute>
              <CreateRoom />
            </PartnerRoute>
          </PrivetRouter>
        ),
      },
      // {
      //   path: "/dashboard/added-menu",
      //   element: (
      //     <PrivetRouter>
      //       <PartnerRoute>
      //         <AddedMenu />
      //       </PartnerRoute>
      //     </PrivetRouter>
      //   ),
      // },
      {
        path: "/dashboard/messages",
        element: (
          <PrivetRouter>
            <PartnerRoute>
              <ChatWithAdmin />
            </PartnerRoute>
          </PrivetRouter>
        ),
      },
      {
        path: "/dashboard/sub-admins",
        element: (
          <HeadAdminRoute>
            <SubAdmins />
          </HeadAdminRoute>
        ),
      },
    ],
  },

  /* =================================================
                     Onboarding Forms
    =================================================*/
  {
    path: "/partner-onboarding",
    element: (
      <Suspense
        fallback={
          <div className="h-screen flex items-center">
            <Loading />
          </div>
        }
      >
        <PartnerOnboarding />
      </Suspense>
    ),
  },
  // {
  //   path: "/driver-onboarding",
  //   element: (
  //     <Suspense
  //       fallback={
  //         <div className="h-full flex items-center">
  //           <Loading />
  //         </div>
  //       }
  //     >
  //       <DriverOnBoarding />
  //     </Suspense>
  //   ),
  // },
  // {
  //   path: "/hotel-onboarding",
  //   element: (
  //     <Suspense
  //       fallback={
  //         <div className="h-screen flex items-center">
  //           <Loading />
  //         </div>
  //       }
  //     >
  //       <HotelOnboarding />
  //     </Suspense>
  //   ),
  // },
  {
    path: "/login",
    element: (
      <Suspense
        fallback={
          <div className="h-screen flex items-center">
            <Loading />
          </div>
        }
      >
        <Login />
      </Suspense>
    ),
  },
  {
    path: "*",
    element: (
      <Suspense
        fallback={
          <div className="h-screen flex items-center">
            <Loading />
          </div>
        }
      >
        <NotFound />
      </Suspense>
    ),
  },
]);
