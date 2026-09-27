import { Suspense, useContext } from "react";
import { AuthContext } from "../contextAPIs/AuthProvider";
import PendingPartnership from "../components/PendingPartnership";
import Loading from "../components/Loading";
import { SentimentVeryDissatisfiedIcon } from "@icons";
import Unauthorized from "../components/Unauthorized";

const PartnerRoute = ({ children }) => {
  const { userData, loading, isPartner } = useContext(AuthContext);

  if (loading) {
    return <Loading />;
  }
  //Returning account pending message

  if (!isPartner) {
    return <Unauthorized />;
  } else if (userData.status === "Verified") {
    return (
      <Suspense
        fallback={
          <div className="h-full flex items-center">
            <Loading />
          </div>
        }
      >
        {children}
      </Suspense>
    );
  } else if (userData.status === "Pending") {
    return <PendingPartnership />;
  } else {
    return (
      <div className="w-full h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center justify-center text-xl">
          <SentimentVeryDissatisfiedIcon />
          <h2 className="font-bold text-center text-red-500">
            Your account has been suspended temporarily.
          </h2>
        </div>
      </div>
    );
  }
};

export default PartnerRoute;
