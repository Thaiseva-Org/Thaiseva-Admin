import { useContext, useEffect, useState } from "react";
import BestOfferBanners from "../../../components/BestOfferBanners";
import CategoriesAndLogo from "../../../components/CategoriesAndLogo";
import FoodBanners from "../../../components/FoodBanners";
import HomeBanners from "../../../components/HomeBanners";
import HotelBanners from "../../../components/HotelBanners";
import HotelMiniBanners from "../../../components/HotelMiniBanners";
import ItemsBanners from "../../../components/ItemsBanner";
// import LocalAssistance from "../../../components/LocalAssistance";
// import NewOfferBanner from "../../../components/NewOffersBanner";
import NotificationBanner from "../../../components/NotificationBanner";
// import NotificationOffers from "../../../components/NotificationOffers";
import LoadingContent from "../../../components/LoadingContent";
import PageHeading from "../../../components/PageHeading";
import SightseeingBanners from "../../../components/SightseeingBanners";
import SpecialOffers from "../../../components/SpecialOffers";
import TravelBanners from "../../../components/TravelBanners";
import { AuthContext } from "../../../contextAPIs/AuthProvider";
import { fetchDashboardData } from "../../../services/AdminDashboard";

const AdminDashboard = () => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const [dashboardData, setDashboardData] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (isAdmin || isSubAdmin) {
      fetchDashboardData(setDashboardData, setLoading);
    }
  }, [isAdmin, isSubAdmin]);

  if (loading) {
    return <LoadingContent />;
  }
  return (
    <div>
      <PageHeading text="Admin Dashboard" />
      <div className="p-4">
        {/* Seed button removed as per user request */}
      </div>

      <div>
        <CategoriesAndLogo
          logo={dashboardData.filter((item) => item.id === "logo")?.[0]?.logo}
          categories={
            dashboardData.filter(
              (item) => item.id === "Service_Categories"
            )?.[0]?.categories
          }
        />
        {/* home banners container */}
        <HomeBanners
          homeBanners={
            dashboardData.filter((item) => item.id === "homeBanners")?.[0]
              ?.banners
          }
        />
        <BestOfferBanners
          bestOfferBanners={
            dashboardData.filter((item) => item.id === "todayBestOffer")?.[0]
              ?.banners
          }
        />
        <FoodBanners
          foodBanners={
            dashboardData.filter((item) => item.id === "Food")?.[0]?.banners
          }
        />
        <ItemsBanners
          itemsBanners={
            dashboardData.filter((item) => item.id === "whats_new")?.[0]
              ?.banners
          }
        />
        <HotelBanners
          hotelBanners={
            dashboardData.filter((item) => item.id === "HotelBanners")?.[0]
              ?.banners
          }
        />
        <HotelMiniBanners
          hotelMiniBanners={
            dashboardData.filter((item) => item.id === "Hotel")?.[0]?.banners
          }
        />
        <TravelBanners
          travelBanners={
            dashboardData.filter((item) => item.id === "Travel")?.[0]?.banners
          }
        />
        <SightseeingBanners
          sightseeingBanners={
            dashboardData.filter(
              (item) => item.id === "SightseeingBanners"
            )?.[0]?.banners
          }
        />
        <SpecialOffers
          specialOffers={
            dashboardData.filter((item) => item.id === "SpecialOffers")?.[0]
              ?.banners
          }
        />
        <NotificationBanner />

        {/* <LocalAssistance /> */}
        {/* <NewOfferBanner /> */}
        {/* <NotificationOffers/> */}
      </div>
    </div>
  );
};

export default AdminDashboard;
