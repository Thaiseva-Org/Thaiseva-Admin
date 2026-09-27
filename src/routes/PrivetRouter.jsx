/**
 * @file PrivetRouter.jsx
 * @description A private route wrapper component that protects routes requiring authentication.
 * It checks the user's authentication status and conditionally renders the children components
 * or redirects to the login page.
 */

import { Suspense, useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../contextAPIs/AuthProvider";
import Loading from "../components/Loading";

/**
 * A wrapper component for protecting private routes.
 * 
 * It consumes the AuthContext to check if a user is currently authenticated
 * and if the authentication state is still loading.
 * 
 * - If the state is loading, it displays a loading spinner.
 * - If the user is authenticated, it renders the child components wrapped in a Suspense boundary.
 * - If the user is not authenticated, it redirects to the login page.
 *
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.children - The child components to render if the user is authenticated.
 * @returns {React.ReactElement} The rendered children, a loading indicator, or a redirect component.
 */
const PrivetRouter = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (user) {
    return (
      <Suspense
        fallback={
          <div className="h-screen flex items-center">
            <Loading />
          </div>
        }
      >
        {children}
      </Suspense>
    );
  }
  return <Navigate to="/login"></Navigate>;
};

export default PrivetRouter;
