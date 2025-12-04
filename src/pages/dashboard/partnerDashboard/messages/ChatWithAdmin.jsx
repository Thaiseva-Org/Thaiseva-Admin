import { useContext, useEffect } from "react";
import { AuthContext } from "../../../../contextAPIs/AuthProvider";

import PartnerChats from "./PartnerChats";
import { PartnerChatContext } from "../../../../contextAPIs/PartnerChatProvider";
import { PartnerContext } from "../../../../contextAPIs/PartnerProvider";

const ChatWithAdmin = () => {
  const { logo } = useContext(PartnerContext);
  const { dispatch } = useContext(PartnerChatContext);
  const { userData } = useContext(AuthContext);

  let adminUid = "";
  let displayName = "";
  if (userData?.serviceCategory === "Driving") {
    adminUid = "_DriversSupport";
    displayName = "Driver Support";
  } else if (userData?.serviceCategory === "Hotel") {
    adminUid = "_HotelSupport";
    displayName = "Hotel Support";
  } else if (userData?.serviceCategory === "Restaurant") {
    adminUid = "_RestaurantSupport";
    displayName = "Restaurant Support";
  } else {
    adminUid = "_LocalPartnerSupport";
    displayName = "Local Partner Support";
  }
  useEffect(() => {
    // taking the admin details for messaging
    const handleSelect = async () => {
      const adminInfo = {
        uid: adminUid,
        displayName: displayName,
        photoURL: logo, // todo : thaiseva logo
      };

      dispatch({ type: "CHANGE_USER", payload: adminInfo });
    };

    userData && handleSelect();
  }, [userData, logo, adminUid, displayName, dispatch]);

  return (
    <div className="overflow-hidden  h-[calc(100vh-8.0rem)] max-md:h-[calc(100vh-5.5rem)] shadow rounded-lg flex relative">
      <div className="w-full h-full">
        <PartnerChats />
      </div>
    </div>
  );
};

export default ChatWithAdmin;
