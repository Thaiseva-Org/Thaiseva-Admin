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
  const hotelBookingLookback = new Date(
    now.getTime() - 180 * 24 * 60 * 60 * 1000
  );
  const handleSnapshotError = (label, resetState = () => {}) => (error) => {
    console.warn(`${label} listener stopped:`, error.message);
    resetState();
    setLoadingData(false);
    setLoadingPartnerData(false);
  };

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
      try {
        const logoDocRef = doc(settingsCollection, "logo");
        const logoSnap = await getDoc(logoDocRef);
        
        if (logoSnap.exists()) {
          const logoData = logoSnap.data();
          setLogo(logoData.logo);
        }
      } catch (error) {
        if (error.code === 'permission-denied') {
             console.warn("Could not load logo due to permissions (this is normal before full login).");
        } else {
             console.warn("Error loading logo:", error.message);
        }
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

      try {
        const q = query(partnersCollection, where("status", "==", "Pending"));
        const pending = await getCountFromServer(q);
        setTotalRequest(pending.data().count);
      } catch (error) {
        console.warn("Could not load pending partner count:", error.message);
        setTotalRequest(0);
      } finally {
        setLoadingPartnerData(false);
      }
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
    if (!(isAdmin || isSubAdmin)) return;

    setLoadingPartnerData(true);
    const unSub = onSnapshot(
      hotelsCollection,
      (result) => {
        if (result) {
          // Always attach Firestore doc id — many HotelDB docs omit top-level uid
          const list = result.docs.map((docSnap) => {
            const data = docSnap.data() || {};
            const resolvedUid =
              data.uid ||
              data.hotelUid ||
              data.hotel?.hotelUid ||
              docSnap.id;
            return {
              ...data,
              id: data.id || docSnap.id,
              uid: resolvedUid,
            };
          });
          setHotels(list);
          setLoadingPartnerData(false);
        }
      },
      handleSnapshotError("Hotels", () => setHotels([]))
    );

    return () => unSub();
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
    if (!(isPartner && userData?.serviceCategory === "Hotel" && user)) return;

    const unSub = onSnapshot(
      query(hotelPackageDetails, where("hotelUid", "==", user.uid)),
      (result) => {
        const list = result.docs.map((doc) => doc.data());
        setMyRooms(list);
      },
      handleSnapshotError("My rooms", () => setMyRooms([]))
    );

    return () => unSub();
  }, [user, isPartner, userData]);

  // loading all room's services data
  useEffect(() => {
    if (!(isAdmin || isSubAdmin)) return;

    setLoadingData(true);
    const unSub = onSnapshot(
      query(hotelPackageDetails, orderBy("updatedAt", "desc")),
      (result) => {
        const list = result.docs.map((doc) => doc.data());
        setRooms(list);
        setLoadingData(false);
      },
      handleSnapshotError("Room services", () => setRooms([]))
    );

    return () => unSub();
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
    if (!(isAdmin || isSubAdmin)) return;

    setLoadingData(true);
    const unSub = onSnapshot(
      query(
        roomBookingCollection,
        where("createdAt", ">=", hotelBookingLookback),
        orderBy("createdAt", "desc")
      ),
      (result) => {
        const list = result.docs.map((doc) => {
          return { ...doc.data(), bookingId: doc.id };
        });
        setRoomBookings(list);
        setLoadingData(false);
      },
      handleSnapshotError("Room bookings", () => setRoomBookings([]))
    );

    return () => unSub();
  }, [isAdmin, isSubAdmin, refetch, rowsPerPage, page]);

  // loading individual room bookings
  useEffect(() => {
    if (!(isPartner && userData?.serviceCategory === "Hotel" && user)) return;

    const unSub = onSnapshot(
      query(
        roomBookingCollection,
        where("hotelUid", "==", user.uid),
        where("createdAt", ">=", hotelBookingLookback),
        orderBy("createdAt", "desc")
      ),
      (result) => {
        const list = result.docs.map((doc) => {
          return { ...doc.data(), bookingId: doc.id };
        });
        setMyRoomBookings(list);
        setLoadingData(false);
      },
      handleSnapshotError("My room bookings", () => setMyRoomBookings([]))
    );

    return () => unSub();
  }, [isPartner, userData, user]);

  // loading all car bookings
  useEffect(() => {
    if (!(isAdmin || isSubAdmin)) return;

    setLoadingData(true);
    const unSub = onSnapshot(
      query(
        carBookingsCollection,
        where("timestamp", ">=", last24Hours),
        orderBy("timestamp", "desc")
      ),
      (result) => {
        const list = result.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
          };
        });

        setCarBookings(list);
        setLoadingData(false);
      },
      handleSnapshotError("Car bookings", () => setCarBookings([]))
    );

    return () => unSub();
  }, [isAdmin, isSubAdmin]);

  // loading all self drive bookings
  useEffect(() => {
    if (!(isAdmin || isSubAdmin)) return;

    setLoadingData(true);
    const unSub = onSnapshot(
      query(
        selfDriveBookingCollection,
        where("time", ">=", last24Hours),
        orderBy("time", "desc")
      ),
      (result) => {
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
      },
      handleSnapshotError("Self-drive bookings", () => setSelfDriveBookings([]))
    );

    return () => unSub();
  }, [isAdmin, isSubAdmin]);

  // loading all travel / sightseeing package bookings (full collection, realtime)
  useEffect(() => {
    if (!(isAdmin || isSubAdmin)) return;

    setLoadingData(true);
    const unSub = onSnapshot(
      query(travelBookingCollection),
      (result) => {
        const getBookingTimeMs = (booking) => {
          const t =
            booking?.orderedAt || booking?.createdAt || booking?.timestamp;
          if (!t) return 0;
          if (typeof t.toMillis === "function") return t.toMillis();
          if (typeof t.seconds === "number") {
            return (
              t.seconds * 1000 +
              Math.floor((t.nanoseconds || 0) / 1_000_000)
            );
          }
          if (t instanceof Date) return t.getTime();
          const parsed = new Date(t);
          return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
        };

        const list = result.docs.map((snap) => {
          const data = snap.data() || {};
          const guestName =
            data?.fullName ||
            data?.guestDetails?.name?.replace("not_present", "").trim() ||
            data?.name ||
            "";
          // Always keep Firestore document id last so it cannot be overwritten
          return {
            ...data,
            name: guestName,
            id: snap.id,
          };
        });
        // Sort client-side (latest first) — supports Timestamp, Date, ISO strings
        list.sort((a, b) => getBookingTimeMs(b) - getBookingTimeMs(a));
        setTravelBookings(list);
        setLoadingData(false);
      },
      handleSnapshotError("Travel bookings", () => setTravelBookings([]))
    );

    return () => unSub();
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
    if (!(isAdmin || isSubAdmin)) return;

    const unsub = onSnapshot(
      doc(db, "chatRooms", "CustomerSupport"),
      async (docSnap) => {
        const data = docSnap.data();

        if (!data) {
          setChatCount(0);
          return;
        }

        const unreadChats = Object.values(data).filter((chat) => chat.isRead === false);

        const userChecks = await Promise.all(
          unreadChats.map(async (chat) => {
            const uid = chat?.userInfo?.uid;
            if (!uid) return true;

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

                return !isRestaurant;
              }
            } catch (error) {
              console.warn("Could not fetch chat user (permissions):", error.message);
            }
            return true;
          })
        );

        const customerUnreadCount = userChecks.filter(Boolean).length;
        setChatCount(customerUnreadCount);
      },
      handleSnapshotError("Customer chats", () => setChatCount(0))
    );

    return () => unsub();
  }, [isAdmin, isSubAdmin]);

  // Count restaurant chat messages separately
  useEffect(() => {
    if (!(isAdmin || isSubAdmin)) return;

    const unsub = onSnapshot(
      doc(db, "chatRooms", "CustomerSupport"),
      async (docSnap) => {
        const data = docSnap.data();

        if (!data) {
          setRestaurantChatCount(0);
          return;
        }

        const unreadChats = Object.values(data).filter((chat) => chat.isRead === false);

        const restaurantChecks = await Promise.all(
          unreadChats.map(async (chat) => {
            const uid = chat?.userInfo?.uid;
            if (!uid) return false;

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

                return isRestaurant;
              }
            } catch (error) {
              console.warn("Could not fetch chat user for restaurant (permissions):", error.message);
            }
            return false;
          })
        );

        const restaurantUnreadCount = restaurantChecks.filter(Boolean).length;
        setRestaurantChatCount(restaurantUnreadCount);
      },
      handleSnapshotError("Restaurant chats", () => setRestaurantChatCount(0))
    );

    return () => unsub();
  }, [isAdmin, isSubAdmin]);

  // Count hotel chat messages separately
  useEffect(() => {
    if (!(isAdmin || isSubAdmin)) return;

    const unsub = onSnapshot(
      doc(db, "chatRooms", "HotelSupport"),
      async (docSnap) => {
        const data = docSnap.data();

        if (!data) {
          setHotelChatCount(0);
          return;
        }

        const unreadCount = Object.values(data).filter((chat) => chat.isRead === false).length;
        setHotelChatCount(unreadCount);
      },
      handleSnapshotError("Hotel chats", () => setHotelChatCount(0))
    );

    return () => unsub();
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
