import { Suspense, useContext } from "react";
import { AuthContext } from "../contextAPIs/AuthProvider";
import Loading from "../components/Loading";
import Unauthorized from "../components/Unauthorized";

const HeadAdminRoute = ({ children }) => {
  const { isAdmin, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <Loading />
      </div>
    );
  } else if (isAdmin) {
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
  }
  return (
    <Unauthorized />
    // <div className="flex items-center justify-center h-screen">
    //   <h3 className="text-3xl font-bold">Unauthorized Access</h3>
    // </div>
  );
};

export default HeadAdminRoute;
