import { CloseIcon } from "@icons";
import { SearchIcon } from "@icons";
import { Tooltip } from "@mui/material";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useContext, useState } from "react";
import { AdminChatContext } from "../../../contextAPIs/AdminChatProvider";
import { db } from "../../../firebase/firebase.config";

const Search = ({ setOpenSidebar }) => {
  const [username, setUsername] = useState("");
  const [oppositeUser, setOppositeUser] = useState(null);
  const [error, setError] = useState(false);
  const { dispatch } = useContext(AdminChatContext) || {};

  const handleSearch = async (value) => {
    try {
      await dispatch({ type: "CHANGE_FILTER", payload: value });
    } catch (error) {
      setError(true);
    }
  };

  const handleKey = (e) => {
    e.code === "Enter" && handleSearch(username);
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setUsername(value);
    handleSearch(value);
  };

  const handleSelect = async () => {
    let adminUid = "";
    let chatRoom = "";
    if (oppositeUser?.serviceCategory === "Driving") {
      adminUid = "_DriversSupport";
      chatRoom = "DriversSupport";
    } else if (oppositeUser?.serviceCategory === "Hotel") {
      adminUid = "_HotelSupport";
      chatRoom = "HotelSupport";
    } else if (oppositeUser?.serviceCategory === "Restaurant") {
      adminUid = "_RestaurantSupport";
      chatRoom = "RestaurantSupport";
    } else {
      adminUid = "_LocalPartnerSupport";
      chatRoom = "LocalPartnerSupport";
    }

    const conversationId = oppositeUser.uid + adminUid;

    try {
      const res = await getDoc(doc(db, "chats", conversationId));

      if (!res.exists()) {
        await setDoc(doc(db, "chats", conversationId), { messages: [] });
        dispatch({
          type: "CHANGE_USER",
          payload: {
            uid: oppositeUser.uid,
            displayName: oppositeUser.displayName,
            photoURL: oppositeUser.photoURL,
          },
        });

        await updateDoc(doc(db, "chatRooms", chatRoom), {
          [conversationId + ".userInfo"]: {
            uid: oppositeUser.uid,
            displayName: oppositeUser.displayName,
            photoURL: oppositeUser.photoURL,
            serviceCategory: oppositeUser.serviceCategory || null,
            role: oppositeUser.role || null,
          },
          [conversationId + ".date"]: serverTimestamp(),
        });
      } else {
        dispatch({ type: "CHANGE_USER", payload: oppositeUser });
      }
    } catch (error) {
      console.log(error);
    }
    setOpenSidebar(false);
    setOppositeUser(null);
    setUsername("");
  };

  return (
    <div className="border-b border-neutral-200">
      {/* Modern Search Input */}
      <div className="p-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full pl-10 pr-10 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none 
                     focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-200 
                     transition-all duration-200 text-neutral-800 placeholder-neutral-400"
            onKeyDown={handleKey}
            onChange={handleSearchChange}
            value={username}
          />
          <button
            onClick={() => setOpenSidebar(false)}
            className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 pb-3">
          <p className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg px-3 py-2">
            User Not Found!
          </p>
        </div>
      )}

      {/* Search Result */}
      {oppositeUser && (
        <Tooltip arrow title="Tap to chat" placement="top">
          <div
            className="mx-4 mb-3 p-3 flex items-center gap-3 cursor-pointer bg-primary-50 hover:bg-primary-100 
                     border border-primary-200 rounded-xl transition-all duration-200"
            onClick={handleSelect}
          >
            <img
              src={oppositeUser?.photoURL}
              alt=""
              className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md"
            />
            <div className="flex-1">
              <p className="font-semibold text-neutral-800">{oppositeUser?.displayName}</p>
              <p className="text-xs text-neutral-500">Click to start chat</p>
            </div>
          </div>
        </Tooltip>
      )}
    </div>
  );
};

export default Search;
