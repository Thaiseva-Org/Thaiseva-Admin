import { Tooltip } from "@mui/material";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import { AdminChatContext } from "../../../contextAPIs/AdminChatProvider";
import { AuthContext } from "../../../contextAPIs/AuthProvider";
import { PartnerContext } from "../../../contextAPIs/PartnerProvider";
import { db, usersCollection } from "../../../firebase/firebase.config";

const Chats = ({ setOpenSidebar, filterType }) => {
  const [chats, setChats] = useState({});
  const [filteredChats, setFilteredChats] = useState([]);
  const [userDataCache, setUserDataCache] = useState({});
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  const { user } = useContext(AuthContext);
  const { dispatch, data } = useContext(AdminChatContext);
  const { chatRoom } = useContext(PartnerContext);

  useEffect(() => {
    const getChats = async () => {
      const unsub = onSnapshot(doc(db, "chatRooms", chatRoom), (doc) => {
        setChats(doc.data() || {});
      });

      () => {
        return unsub();
      };
    };

    user.uid && getChats();
  }, [user, chatRoom]);

  // Fetch user data from users collection to get serviceCategory/role
  useEffect(() => {
    const fetchUserData = async () => {
      if (!chats || Object.keys(chats).length === 0) {
        setIsLoadingUserData(false);
        return;
      }

      // Get all user IDs that we need to fetch
      const userIds = Object.values(chats)
        .map(chat => chat?.userInfo?.uid)
        .filter(uid => uid && !userDataCache[uid]);

      if (userIds.length === 0) {
        setIsLoadingUserData(false);
        return;
      }

      setIsLoadingUserData(true);

      // Fetch all user data
      const fetchPromises = userIds.map(async (uid) => {
        try {
          const userDocRef = doc(db, "users", uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            return {
              uid,
              serviceCategory: userData.serviceCategory,
              role: userData.role,
            };
          }
        } catch (error) {
          console.warn("Could not fetch chat user metadata (permissions):", error.message);
        }
        return { uid, notFound: true };
      });

      const results = await Promise.all(fetchPromises);
      
      // Update cache with all fetched data
      const newCache = { ...userDataCache };
      results.forEach(result => {
        if (result && !result.notFound) {
          newCache[result.uid] = {
            serviceCategory: result.serviceCategory,
            role: result.role,
          };
        } else if (result && result.notFound) {
          newCache[result.uid] = { notFound: true };
        }
      });
      
      setUserDataCache(newCache);
      setIsLoadingUserData(false);
    };

    fetchUserData();
  }, [chats]);

  useEffect(() => {
    if (chats && Object.keys(chats).length > 0) {
      let filtered = Object.entries(chats).filter((item) =>
        item[1]?.userInfo?.displayName
          ?.toLowerCase()
          .includes(data.searchData.toLowerCase())
      );

      // Only apply filter if we have user data loaded or if filterType is not set
      if (filterType && Object.keys(userDataCache).length > 0) {
        // Apply filter based on filterType prop
        if (filterType === "customer") {
          // Show only regular customers (exclude restaurants)
          filtered = filtered.filter((item) => {
            const userInfo = item[1]?.userInfo;
            const uid = userInfo?.uid;
            const cachedData = userDataCache[uid];
            
            const isRestaurant = 
              userInfo?.serviceCategory === "Restaurant" ||
              userInfo?.role === "Restaurant" ||
              cachedData?.serviceCategory === "Restaurant" ||
              cachedData?.role === "Restaurant";
            
            console.log('Customer Filter - User:', userInfo?.displayName, 'isRestaurant:', isRestaurant, 'cached:', cachedData);
            
            return !isRestaurant; // Exclude restaurants
          });
        } else if (filterType === "restaurant") {
          // Show only restaurants
          filtered = filtered.filter((item) => {
            const userInfo = item[1]?.userInfo;
            const uid = userInfo?.uid;
            const cachedData = userDataCache[uid];
            
            const isRestaurant = 
              userInfo?.serviceCategory === "Restaurant" ||
              userInfo?.role === "Restaurant" ||
              cachedData?.serviceCategory === "Restaurant" ||
              cachedData?.role === "Restaurant";
            
            console.log('Restaurant Filter - User:', userInfo?.displayName, 'isRestaurant:', isRestaurant, 'cached:', cachedData);
            
            return isRestaurant; // Include only restaurants
          });
        }
      }

      setFilteredChats(filtered);
    } else {
      setFilteredChats([]);
    }
  }, [data.searchData, chats, filterType, userDataCache]);

  const handleSelect = async (userInfo) => {
    dispatch({ type: "CHANGE_USER", payload: userInfo[1].userInfo });

    setOpenSidebar(false);
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Loading State */}
      {isLoadingUserData && filterType && (
        <div className="flex flex-col items-center justify-center p-8 gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-200 border-t-primary-600"></div>
          <span className="text-sm text-neutral-600 font-medium">Loading conversations...</span>
        </div>
      )}

      {/* Chat List */}
      {!isLoadingUserData && filteredChats &&
        filteredChats
          ?.sort((a, b) => b[1].date - a[1].date)
          .map((chat) => (
            <Tooltip key={chat[0]} arrow title="Click to open chat" placement="right">
              <div
                className={`p-4 flex items-start gap-3 cursor-pointer transition-all duration-200 border-b border-neutral-100
                  hover:bg-primary-50 group relative
                  ${chat[1]?.isRead === false ? "bg-primary-50/50" : "bg-white"}`}
                onClick={() => handleSelect(chat)}
              >
                {/* Avatar with Online Status */}
                <div className="relative flex-shrink-0">
                  <img
                    loading="lazy"
                    src={chat[1].userInfo?.photoURL}
                    alt={chat[1]?.userInfo?.displayName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md"
                  />
                  {chat[1]?.isRead === false && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 border-2 border-white rounded-full"></span>
                  )}
                </div>

                {/* Chat Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className={`font-semibold text-neutral-800 truncate ${
                      chat[1]?.isRead === false ? "text-primary-700" : ""
                    }`}>
                      {chat[1]?.userInfo?.displayName
                        ? chat[1]?.userInfo?.displayName.length > 20
                          ? chat[1]?.userInfo?.displayName?.slice(0, 20) + "..."
                          : chat[1]?.userInfo?.displayName
                        : "No Username"}
                    </p>
                    <span className="text-xs text-neutral-500 flex-shrink-0">
                      {new Date(chat[1]?.date?.seconds * 1000).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>

                  {/* Last Message Preview */}
                  <div className="flex items-center gap-2">
                    {chat[1]?.lastMessage?.text && (
                      <p className={`text-sm truncate ${
                        chat[1]?.isRead === false 
                          ? "text-neutral-700 font-medium" 
                          : "text-neutral-500"
                      }`}>
                        {chat[1]?.lastMessage?.text?.length > 30
                          ? chat[1]?.lastMessage?.text?.slice(0, 30) + "..."
                          : chat[1]?.lastMessage?.text}
                      </p>
                    )}
                    {chat[1]?.audioUrl && (
                      <span className="flex items-center gap-1 text-sm text-neutral-500">
                        <span>🎤</span> Voice message
                      </span>
                    )}
                    {chat[1]?.imgUrl && (
                      <span className="flex items-center gap-1 text-sm text-neutral-500">
                        <span>🖼️</span> Image
                      </span>
                    )}
                    {chat[1]?.fileUrl && (
                      <span className="flex items-center gap-1 text-sm text-neutral-500">
                        <span>📎</span> File
                      </span>
                    )}
                  </div>
                </div>

                {/* Unread Badge */}
                {chat[1]?.isRead === false && (
                  <span className="absolute top-4 right-4 px-2 py-0.5 bg-primary-500 text-white text-xs font-semibold rounded-full">
                    New
                  </span>
                )}
              </div>
            </Tooltip>
          ))}

      {/* Empty State */}
      {!isLoadingUserData && filteredChats.length === 0 && Object.keys(chats).length > 0 && (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-3">
            <span className="text-3xl">💬</span>
          </div>
          <p className="text-neutral-600 font-medium">No conversations found</p>
          <p className="text-sm text-neutral-400 mt-1">Try searching for someone else</p>
        </div>
      )}

      {/* No Chats State */}
      {!isLoadingUserData && Object.keys(chats).length === 0 && (
        <div className="flex flex-col items-center justify-center p-8 text-center h-full">
          <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-4xl">📭</span>
          </div>
          <p className="text-neutral-600 font-medium text-lg">No messages yet</p>
          <p className="text-sm text-neutral-400 mt-2">Start a conversation to see it here</p>
        </div>
      )}
    </div>
  );
};

export default Chats;
