import { useContext } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AuthContext } from "../contextAPIs/AuthProvider";
import Loading from "../components/Loading";

const Main = () => {
  const { user, loading } = useContext(AuthContext);
  // console.log(user)

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center">
        <Loading />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
};

export default Main;
