import { onSnapshot, orderBy, query, where } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import {
  requirementsCollection,
  travelRequirementsCollection,
} from "../firebase/firebase.config";
import { AuthContext } from "./AuthProvider";

export const RequirementContext = createContext(null);

const RequirementsProvider = ({ children }) => {
  const { user, isAdmin, isSubAdmin, isPartner, userData } =
    useContext(AuthContext);
  const [allRequirements, setAllRequirements] = useState([]);
  const [myRequirements, setMyRequirements] = useState([]);
  const [refetchRequirement, setRefetchRequirement] = useState(false);
  const [queryCategory, setQueryCategory] = useState("All");
  const [travelRequirements, setTravelRequirements] = useState([]);
  const [loadingReq, setLoadingReq] = useState(true);

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  // fetching all loal requirements for admin dashboard
  useEffect(() => {
    if (!(isAdmin || isSubAdmin)) return;

    let unSub = null;
    let isMounted = true;
    setLoadingReq(true);
    const loadData = async () => {
      try {
        const q =
          queryCategory === "All"
            ? query(
                requirementsCollection,
                where("date", ">=", threeDaysAgo),
                orderBy("date", "desc")
              )
            : query(
                requirementsCollection,
                where("serviceCategory", "==", queryCategory),
                where("date", ">=", threeDaysAgo),
                orderBy("date", "desc")
              );
        unSub = onSnapshot(q, (snapshot) => {
          if (!isMounted) return;

          const list = snapshot.docs.map((doc) => doc.data());
          setAllRequirements(list);
          setLoadingReq(false);
        });
      } catch (error) {
        console.error("Error fetching requirements:", error);
        setLoadingReq(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
      if (unSub) unSub();
    };
  }, [isAdmin, isSubAdmin, queryCategory]);

  // fetching all requirements individual partner
  useEffect(() => {
    const loadData = async () => {
      let collection;

      if (userData?.serviceCategory === "Driving") {
        collection = travelRequirementsCollection;
      } else {
        collection = requirementsCollection;
      }
      setLoadingReq(true);
      const q = query(
        collection,
        where("providerUid", "==", user?.uid),
        where("date", ">=", threeDaysAgo),
        orderBy("date", "desc")
      );
      let unSub = onSnapshot(q, (result) => {
        const list = result.docs.map((doc) => doc.data());
        if (list?.length > 0) {
          setMyRequirements(list);
          setLoadingReq(false);
        } else {
          setMyRequirements([]);
          setLoadingReq(false);
        }
      });

      return () => {
        unSub();
      };
    };

    user && isPartner && loadData();
  }, [user, isPartner, userData]);

  // fetching all travel requirements for admin dashboard
  useEffect(() => {
    const loadTravelRequirements = async () => {
      const unSub = onSnapshot(travelRequirementsCollection, (result) => {
        const list = result.docs.map((doc) => doc.data());
        if (list?.length > 0) {
          setTravelRequirements(list);
          setLoadingReq(false);
        } else {
          setTravelRequirements([]);
          setLoadingReq(false);
        }
      });
      return () => {
        unSub();
      };
    };

    (isAdmin || isSubAdmin) && loadTravelRequirements();
  }, [isAdmin, isSubAdmin]);

  // fetching all requirements for individual driver

  // useEffect(()=> {
  //   c
  // }, [])

  const requirementInfo = {
    allRequirements,
    myRequirements,
    travelRequirements,
    setRefetchRequirement,
    queryCategory,
    setQueryCategory,
    loadingReq,
  };
  return (
    <RequirementContext.Provider value={requirementInfo}>
      {children}
    </RequirementContext.Provider>
  );
};

export default RequirementsProvider;
