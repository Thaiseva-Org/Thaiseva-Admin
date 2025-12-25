import {
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import {
  // restaurentsCollection,
  // foodMenuCollection,
  carBookingsCollection,
  db,
  hotelPackageDetails,
  hotelsCollection,
  partnersCollection,
  // hotelPackages,
  roomBookingCollection,
  selfDriveBookingCollection,
  settingsCollection,
  travelBookingCollection,
} from "../firebase/firebase.config";
import { AuthContext } from "./AuthProvider";

export const PartnerContext = createContext();

const PartnerProvider = ({ children }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const { user, isAdmin, isSubAdmin, userData, isPartner } =
    useContext(AuthContext);
  const [chatRoom, setChatRoom] = useState("CustomerSupport");
  const [chatCount, setChatCount] = useState(0);
  const [restaurantChatCount, setRestaurantChatCount] = useState(0);
  const [hotelChatCount, setHotelChatCount] = useState(0);
  const [partners, setPartners] = useState([]);
  const [refetch, setRefetch] = useState(false);
  const [queryText, setQueryText] = useState("Verified");
  const [queryCategory, setQueryCategory] = useState("All");
  const [totalRequest, setTotalRequest] = useState(0);
  const [loadingPartnerData, setLoadingPartnerData] = useState(true);
  const [partnerDetails, setPartnerDetails] = useState({});
  const [drivers, setDrivers] = useState([]);
  const [driverRequest, setDriverRequest] = useState(0);
  const [hotels, setHotels] = useState([]);
  // const [restaurants, setRestaurants] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [myRoomBookings, setMyRoomBookings] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [roomBookings, setRoomBookings] = useState([]);
  const [myRooms, setMyRooms] = useState([]);
  // const [myFoodMenu, setMyFoodMenu] = useState([]);
  // const [foodMenu, setFoodMenu] = useState([]);
  const [carBookings, setCarBookings] = useState([]);
  const [selfDriveBookings, setSelfDriveBookings] = useState([]);
  const [travelBookings, setTravelBookings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [logo, setLogo] = useState("");
  // const [adminHomeData, setAdminHomeData] = useState({
  //   Confidential: {},
  //   Food: {},
  //   Hotel: {},
  //   Service_Categories: {},
  //   SpecialOffers: {},
  //   Travel: {},
  //   categories: {},
  //   contact_info: {},
  //   homeBanners: {},
  //   logo: {},
  //   todayBestOffer: {},
  //   whats_new: {},
  // });
  const [invoices, setInvoices] = useState();
  const [uid, setUid] = useState("");

  const contactInfo = {
    email: "thaiseva@gmail.com",
    phone: "01723646378",
  };

  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // loading home data
  // useEffect(() => {
  //   const loadData = async () => {
  //     const logoSnapshot = await getDocs(query(settingsCollection));
  //     const homeData = logoSnapshot.docs.map((item) => {
  //       const data = item.data();
  //       return { id: item.id, ...data };
  //     });
  //     setAdminHomeData(homeData);
  //   };

  //   user && loadData();
  // }, [refetch, user]);

  // loading logo
  useEffect(() => {
    const loadLogo = async () => {
      const logoSnapshot = await getDocs(
        query(settingsCollection, where("id", "==", "logo"))
      );
      const logo = logoSnapshot.docs?.[0].data();
      if (logo) {
        setLogo(logo.logo);
      }
    };

    user && loadLogo();
  }, [refetch, user]);

  // loading service categories
  // useEffect(() => {
  //   const loadCategories = async () => {
  //     const querySnapshot = await getDocs(
  //       query(settingsCollection, where("id", "==", "Service_Categories"))
  //     );
  //     const list = querySnapshot.docs?.map((doc) => doc.data());
  //     if (list[0]?.categories?.length > 0) {
  //       setCategories(list[0].categories);
  //     }
  //   };

  //   loadCategories();
  // }, [refetch]);

  // loading all partners data
  useEffect(() => {
    const loadPatnersData = async () => {
      setLoadingPartnerData(true);
      // const querySnapshot = await getDocs(
      //   query(partnersCollection, where("status", "==", queryText))
      // );

      // if (querySnapshot) {
      //   const list = querySnapshot.docs.map((doc) => doc.data());
      //   setPartners(list); // Set the state with the list of data
      // }

      const q = query(partnersCollection, where("status", "==", "Pending"));
      const pending = await getCountFromServer(q);
      setTotalRequest(pending.data().count);
      setLoadingPartnerData(false);
    };

    (isAdmin || isSubAdmin) && loadPatnersData();
  }, [refetch, isAdmin, isSubAdmin, queryText, queryCategory]);

  // loading Driver's data
  useEffect(() => {
    const loadData = async (user) => {
      let collection;

      // if (userData?.serviceCategory === "Driving") {
      //   collection = driversCollection;
      // } else
      if (userData?.serviceCategory === "Hotel") {
        collection = hotelsCollection;
      } else {
        collection = partnersCollection;
      }
      const docSnap = await getDoc(doc(collection, uid || user.uid));
      if (docSnap.exists()) {
        setPartnerDetails(docSnap.data());
      }
    };

    isPartner && (user || uid) && loadData(user);
  }, [user, userData, isPartner, refetch, uid]);

  // loading all drivers
  // useEffect(() => {
  //   const loadDrivers = async () => {
  //     setLoadingPartnerData(true);

  //     const snapshot = await getDocs(
  //       query(driversCollection, where("status", "==", queryText))
  //     );
  //     const list = snapshot.docs.map((doc) => doc.data());
  //     setDrivers(list);

  //     const pending = await getDocs(
  //       query(driversCollection, where("status", "==", "Pending"))
  //     );
  //     setDriverRequest(pending.docs?.length);
  //     setLoadingPartnerData(false);
  //   };

  //   (isAdmin || isSubAdmin) && loadDrivers();
  // }, [isAdmin, isSubAdmin, queryText, refetch]);

  // loading all hotels
  useEffect(() => {
    const loadHotels = async () => {
      setLoadingPartnerData();
      const unSub = onSnapshot(hotelsCollection, (result) => {
        if (result) {
          const list = result.docs.map((doc) => doc.data());
          if (list?.length > 0) {
            setHotels(list);
            setLoadingPartnerData(false);
          } else {
            setHotels([]);
            setLoadingPartnerData(false);
          }
        }
      });

      return () => {
        unSub();
      };
    };

    (isAdmin || isSubAdmin) && loadHotels();
  }, [isAdmin, isSubAdmin]);

  // loading all restaurants
  // useEffect(() => {
  //   const loadHotels = async () => {
  //     setLoadingData(true);
  //     const unSub = onSnapshot(restaurentsCollection, (result) => {
  //       if (result) {
  //         const list = result.docs.map((doc) => doc.data());
  //         let menu = [];
  //         if (list?.length > 0) {
  //           list.forEach((restaurant) => {
  //             const { items } = restaurant || {};
  //             if (items?.length > 0) {
  //               items?.forEach((item) =>
  //                 menu.push({
  //                   ...item,
  //                   restaurantName: restaurant.name,
  //                   email: restaurant.email,
  //                   phone: restaurant.phone,
  //                 })
  //               );
  //             }
  //           });
  //           setRestaurants(list);
  //           setFoodMenu(menu);
  //           setLoadingData(false);
  //         } else {
  //           setRestaurants([]);
  //           setLoadingData(false);
  //         }
  //       }
  //     });

  //     return () => {
  //       unSub();
  //     };
  //   };

  //   (isAdmin || isSubAdmin) && loadHotels();
  // }, [isAdmin, isSubAdmin]);

  // rooms for individual hotel owner room service
  useEffect(() => {
    const loadData = (user, hotelPackages) => {
      const unSub = onSnapshot(
        // query(hotelPackages, where("hotelUid", "==", user.uid)),
        query(hotelPackages, where("hotelUid", "==", user.uid)),
        (result) => {
          if (result.docs.length > 0) {
            const list = result.docs.map((doc) => doc.data());
            setMyRooms(list);
          }
          if (result.docs.length == 0) {
            setMyRooms([]);
          }
        }
      );

      return () => {
        unSub();
      };
    };
    isPartner &&
      userData?.serviceCategory === "Hotel" &&
      loadData(user, hotelPackageDetails);
  }, [user, isPartner, userData]);

  // loading all room's services data
  useEffect(() => {
    const loadData = () => {
      setLoadingData(true);
      const unSub = onSnapshot(
        query(hotelPackageDetails, orderBy("updatedAt", "desc")),
        (result) => {
          if (result.docs.length > 0) {
            const list = result.docs.map((doc) => doc.data());
            setRooms(list);
            setLoadingData(false);
          }
          if (result.docs.length == 0) {
            setRooms([]);
            setLoadingData(false);
          }
        }
      );

      return () => {
        unSub();
      };
    };
    (isAdmin || isSubAdmin) && loadData();
  }, [isAdmin, isSubAdmin]);

  // menu for individual restaurant
  // useEffect(() => {
  //   const loadData = (user, foodMenuCollection) => {
  //     const unSub = onSnapshot(
  //       query(foodMenuCollection, where("restaurantUid", "==", user.uid)),
  //       (result) => {
  //         if (result.docs.length > 0) {
  //           const list = result.docs.map((doc) => doc.data());
  //           setMyFoodMenu(list);
  //         }
  //         if (result.docs.length == 0) {
  //           setMyFoodMenu([]);
  //         }
  //       }
  //     );

  //     return () => {
  //       unSub();
  //     };
  //   };
  //   user && loadData(user, foodMenuCollection);
  // }, [user]);

  // loading all room bookings
  useEffect(() => {
    const loadBookings = () => {
      setLoadingData(true);
      const unSub = onSnapshot(
        query(
          roomBookingCollection,
          where("createdAt", ">=", last24Hours),
          orderBy("createdAt", "desc")
        ),
        (result) => {
          if (result.docs.length > 0) {
            const list = result.docs.map((doc) => {
              return { ...doc.data(), bookingId: doc.id };
            });
            setRoomBookings(list);
            setLoadingData(false);
          }
          if (result.docs.length == 0) {
            setRoomBookings([]);
            setLoadingData(false);
          }
        }
      );

      return () => {
        unSub();
      };
    };

    (isAdmin || isSubAdmin) && loadBookings();
  }, [isAdmin, isSubAdmin, refetch, rowsPerPage, page]);

  // loading individual room bookings
  useEffect(() => {
    const loadBookings = (userData) => {
      const unSub = onSnapshot(
        query(
          roomBookingCollection,
          where("hotelUid", "==", userData?.uid),
          where("createdAt", ">=", last24Hours),
          orderBy("createdAt", "desc")
        ),
        (result) => {
          if (result.docs.length > 0) {
            const list = result.docs.map((doc) => {
              return { ...doc.data(), bookingId: doc.id };
            });
            setMyRoomBookings(list);
            setLoadingData(false);
          }
          if (result.docs.length == 0) {
            setMyRoomBookings([]);
            setLoadingData(false);
          }
        }
      );

      return () => {
        unSub();
      };
    };

    isPartner && userData?.serviceCategory === "Hotel" && loadBookings(user);
  }, [isPartner, userData, user]);

  // loading all car bookings
  useEffect(() => {
    const loadData = () => {
      setLoadingData(true);
      const unSub = onSnapshot(
        query(
          carBookingsCollection,
          where("timestamp", ">=", last24Hours),
          orderBy("timestamp", "desc")
        ),
        (result) => {
          if (result.docs.length > 0) {
            const list = result.docs.map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
              };
            });

            setCarBookings(list);
            setLoadingData(false);
          }
          if (result.docs.length == 0) {
            setCarBookings([]);
            setLoadingData(false);
          }
        }
      );

      return () => {
        unSub();
      };
    };
    (isAdmin || isSubAdmin) && loadData();
  }, [isAdmin, isSubAdmin]);

  // loading all self drive bookings
  useEffect(() => {
    const loadData = () => {
      setLoadingData(true);
      const unSub = onSnapshot(
        query(
          selfDriveBookingCollection,
          where("time", ">=", last24Hours),
          orderBy("time", "desc")
        ),
        (result) => {
          if (result.docs.length > 0) {
            const list = result.docs.map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                name: data?.username?.trim(),
                ...data,
              };
            });

            setSelfDriveBookings(list);
            setLoadingData(false);
          }
          if (result.docs.length == 0) {
            setSelfDriveBookings([]);
            setLoadingData(false);
          }
        }
      );

      return () => {
        unSub();
      };
    };
    (isAdmin || isSubAdmin) && loadData();
  }, [isAdmin, isSubAdmin]);

  // loading all travel bookings
  useEffect(() => {
    const loadData = () => {
      setLoadingData(true);
      const unSub = onSnapshot(
        query(
          travelBookingCollection
        ),
        (result) => {
          if (result.docs.length > 0) {
            const list = result.docs.map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                name: data?.guestDetails?.name
                  ?.replace("not_present", "")
                  .trim(),
                ...data,
              };
            });
            // Sort client-side
            list.sort((a, b) => {
              const timeA = a.orderedAt?.seconds || a.timestamp?.seconds || 0;
              const timeB = b.orderedAt?.seconds || b.timestamp?.seconds || 0;
              return timeB - timeA;
            });
            setTravelBookings(list);
            setLoadingData(false);
          }
          if (result.docs.length == 0) {
            setTravelBookings([]);
            setLoadingData(false);
          }
        }
      );

      return () => {
        unSub();
      };
    };
    (isAdmin || isSubAdmin) && loadData();
  }, [isAdmin, isSubAdmin]);

  // loading all partner's payments
  // useEffect(() => {
  //   const loadPayments = async () => {
  //     setLoadingData(true);
  //     const snap = await getDocs(invoicesCollection);
  //     if (snap.docs.length > 0) {
  //       const list = snap?.docs.map((doc) => doc.data());
  //       if (list?.length > 0) {
  //         setInvoices(list);
  //         setLoadingData(false);
  //       }
  //     }
  //   };

  //   isAdmin && loadPayments();
  // }, [isAdmin, refetch]);

  useEffect(() => {
    const getChats = async () => {
      const unsub = onSnapshot(
        doc(db, "chatRooms", "CustomerSupport"),
        async (docSnap) => {
          const data = docSnap.data();

          if (!data) {
            setChatCount(0);
            return;
          }

          // Filter out restaurant chats by checking user data
          const unreadChats = Object.values(data).filter((chat) => chat.isRead === false);

          // Fetch user data to check if they are restaurants
          const userChecks = await Promise.all(
            unreadChats.map(async (chat) => {
              const uid = chat?.userInfo?.uid;
              if (!uid) return true; // Include if no uid

              try {
                const userDocRef = doc(db, "users", uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  const isRestaurant =
                    userData.serviceCategory === "Restaurant" ||
                    userData.role === "Restaurant" ||
                    chat?.userInfo?.serviceCategory === "Restaurant" ||
                    chat?.userInfo?.role === "Restaurant";

                  return !isRestaurant; // Return true if NOT a restaurant (i.e., is a customer)
                }
              } catch (error) {
                console.error("Error fetching user data:", error);
              }
              return true; // Include by default if error
            })
          );

          // Count only non-restaurant unread chats
          const customerUnreadCount = userChecks.filter(Boolean).length;
          setChatCount(customerUnreadCount);
        }
      );

      return () => {
        unsub();
      };
    };

    (isAdmin || isSubAdmin) && getChats();
  }, [isAdmin, isSubAdmin]);

  // Count restaurant chat messages separately
  useEffect(() => {
    const getRestaurantChats = async () => {
      const unsub = onSnapshot(
        doc(db, "chatRooms", "CustomerSupport"),
        async (docSnap) => {
          const data = docSnap.data();

          if (!data) {
            setRestaurantChatCount(0);
            return;
          }

          // Filter to get only restaurant chats
          const unreadChats = Object.values(data).filter((chat) => chat.isRead === false);

          // Fetch user data to check if they are restaurants
          const restaurantChecks = await Promise.all(
            unreadChats.map(async (chat) => {
              const uid = chat?.userInfo?.uid;
              if (!uid) return false; // Exclude if no uid

              try {
                const userDocRef = doc(db, "users", uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  const isRestaurant =
                    userData.serviceCategory === "Restaurant" ||
                    userData.role === "Restaurant" ||
                    chat?.userInfo?.serviceCategory === "Restaurant" ||
                    chat?.userInfo?.role === "Restaurant";

                  return isRestaurant; // Return true if IS a restaurant
                }
              } catch (error) {
                console.error("Error fetching user data for restaurant:", error);
              }
              return false; // Exclude by default if error
            })
          );

          // Count only restaurant unread chats
          const restaurantUnreadCount = restaurantChecks.filter(Boolean).length;
          setRestaurantChatCount(restaurantUnreadCount);
        }
      );

      return () => {
        unsub();
      };
    };

    (isAdmin || isSubAdmin) && getRestaurantChats();
  }, [isAdmin, isSubAdmin]);

  // Count hotel chat messages separately
  useEffect(() => {
    const getHotelChats = async () => {
      const unsub = onSnapshot(
        doc(db, "chatRooms", "HotelSupport"),
        async (docSnap) => {
          const data = docSnap.data();

          if (!data) {
            setHotelChatCount(0);
            return;
          }

          // Count unread hotel chats
          const unreadCount = Object.values(data).filter((chat) => chat.isRead === false).length;
          setHotelChatCount(unreadCount);
        }
      );

      return () => {
        unsub();
      };
    };

    (isAdmin || isSubAdmin) && getHotelChats();
  }, [isAdmin, isSubAdmin]);

  const partnersInfo = {
    partners,
    setLoadingData,
    setPartners,
    refetch,
    setRefetch,
    setQueryText,
    queryText,
    setQueryCategory,
    queryCategory,
    totalRequest,
    loadingPartnerData,
    partnerDetails,
    drivers,
    hotels,
    rooms,
    myRoomBookings,
    loadingData,
    setPartnerDetails,
    driverRequest,
    setChatRoom,
    chatCount,
    restaurantChatCount,
    hotelChatCount,
    chatRoom,
    roomBookings,
    myRooms,
    carBookings,
    selfDriveBookings,
    travelBookings,
    logo,
    contactInfo,
    categories,
    invoices,
    setUid,
    setPage,
    setRowsPerPage,
    page,
    rowsPerPage,
  };
  return (
    <PartnerContext.Provider value={partnersInfo}>
      {children}
    </PartnerContext.Provider>
  );
};

export default PartnerProvider;
