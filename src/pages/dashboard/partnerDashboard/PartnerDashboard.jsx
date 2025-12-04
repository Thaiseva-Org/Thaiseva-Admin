import { Suspense, useContext } from "react";
import { AuthContext } from "../../../contextAPIs/AuthProvider";
import {
  PendingPartnership,
  MyDrivingRequirements,
  MyLocalRequirements,
  Bookings,
  FoodOrders,
} from "../..";
import Loading from "../../../components/Loading";

const PartnerDashboard = () => {
  const { userData, isVerifiedPartner } = useContext(AuthContext);

  if (!isVerifiedPartner) {
    return (
      <Suspense
        fallback={
          <div className="h-full flex items-center">
            <Loading />
          </div>
        }
      >
        <PendingPartnership />
      </Suspense>
    );
  }

  if (userData?.serviceCategory === "Driving") {
    return (
      <Suspense
        fallback={
          <div className="h-full flex items-center">
            <Loading />
          </div>
        }
      >
        <MyDrivingRequirements />
      </Suspense>
    );
  } else if (userData?.serviceCategory === "Hotel") {
    return (
      <Suspense
        fallback={
          <div className="h-full flex items-center">
            <Loading />
          </div>
        }
      >
        <Bookings />
      </Suspense>
    );
  } else if (userData?.serviceCategory === "Restaurant") {
    return (
      <Suspense
        fallback={
          <div className="h-full flex items-center">
            <Loading />
          </div>
        }
      >
        <FoodOrders />
      </Suspense>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center">
          <Loading />
        </div>
      }
    >
      <MyLocalRequirements />
    </Suspense>
  );
};

export default PartnerDashboard;
