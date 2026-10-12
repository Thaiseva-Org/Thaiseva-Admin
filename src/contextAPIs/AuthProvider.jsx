/**
 * @file AuthProvider.jsx
 * @description Provides authentication context for the application, integrating Firebase Auth and Firestore.
 * Handles user state, authentication functions, role-based access control, and user data fetching.
 */

import { createContext, useEffect, useState } from "react";
import { app, db } from "../firebase/firebase.config";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

/**
 * Context for authentication state and functions.
 * @type {React.Context<any>}
 */
export const AuthContext = createContext();

/**
 * Firebase Auth instance.
 * @type {import("firebase/auth").Auth}
 */
const auth = getAuth(app);

/**
 * Provides authentication context to the application.
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.children - The child components to be wrapped by the provider.
 * @returns {JSX.Element} The AuthContext provider wrapping the children.
 */
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPartner, setIsPatner] = useState(false);
  const [isSubAdmin, setIsSubAdmin] = useState(false);
  const [isVerifiedPartner, setIsVerifiedPartner] = useState(false);
  const [userData, setUserData] = useState({});


  /**
   * Creates a new user with email and password.
   * @param {string} email - The user's email address.
   * @param {string} password - The user's password.
   * @returns {Promise<import("firebase/auth").UserCredential>} A promise that resolves with the user credential.
   */
  const createUser = (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
  };

  /**
   * Logs in a user with email and password.
   * @param {string} email - The user's email address.
   * @param {string} password - The user's password.
   * @returns {Promise<import("firebase/auth").UserCredential>} A promise that resolves with the user credential.
   */
  const logInUser = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  /**
   * Logs out the current user.
   * @returns {Promise<void>} A promise that resolves when the user is logged out.
   */
  const logOut = () => {
    try {
      localStorage.removeItem("thaiseva:admin:lastActivity");
      sessionStorage.removeItem("thaiseva:logged_out_reason");
    } catch {
      // Ignore storage errors
    }
    return signOut(auth);
  };

  /**
   * Updates the current user's profile information.
   * @param {string} name - The user's display name.
   * @param {string} profile - The URL of the user's profile picture.
   * @returns {Promise<void>} A promise that resolves when the profile is updated.
   */
  const updateUserProfile = (name, profile) => {
    return updateProfile(auth.currentUser, {
      displayName: name,
      photoURL: profile,
    });
  };

  //   observing the user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(true);
        setUserData({});
        setIsAdmin(false);
        setIsPatner(false);
        setIsSubAdmin(false);
        setIsVerifiedPartner(false);

          try {
            const userDocRef = doc(db, "users", currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              setUserData(userData);

              const isExplicitAdmin = ["Admin", "admin"].includes(userData?.role) ||
                ["admin@gmail.com", "thaiseva_admin@gmail.com"].includes(currentUser?.email);

              // Partner role is turned off on the Admin Portal
              if (userData?.role === "Partner" && !isExplicitAdmin) {
                console.warn("Partner role is blocked from the Admin Portal. Signing out...");
                await signOut(auth);
                setUser(null);
                setUserData(null);
                setIsAdmin(false);
                setIsPatner(false);
                setIsSubAdmin(false);
                setIsVerifiedPartner(false);
                setLoading(false);
                return;
              }

              setIsAdmin(true);
              setIsPatner(false);
              setIsSubAdmin(false);
              setIsVerifiedPartner(false);
            } else {
              setUserData({ role: "Admin", email: currentUser.email });
              setIsAdmin(true);
              setIsPatner(false);
              setIsSubAdmin(false);
              setIsVerifiedPartner(false);
            }
          } catch (error) {
            console.error("Error fetching user data:", error);
            setUserData({ role: "Admin", email: currentUser.email });
            setIsAdmin(true);
            setIsPatner(false);
            setIsSubAdmin(false);
            setIsVerifiedPartner(false);
          } finally {
            setLoading(false);
          }
      } else {
        setUser(null);
        setLoading(false);
        setUserData(null);
        setIsAdmin(false);
        setIsPatner(false);
        setIsSubAdmin(false);
      }
    });

    return () => unsubscribe();
  }, []);

  /**
   * Validates a password against security criteria.
   * @param {string} password - The password to validate.
   * @returns {string} Returns "valid" if the password meets all criteria, otherwise returns an error message.
   */
  const validatePassword = (password) => {
    if (password.length < 6) {
      return "Password must be at least 6 characters long.";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter.";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter.";
    }
    if (!/\d/.test(password)) {
      return "Password must contain at least one number.";
    }
    if (!/[@$!%*?&]/.test(password)) {
      return "Password must contain at least one special character (@$!%*?&).";
    }
    return "valid";
  };

  /**
   * The authentication state and context values provided to consumers.
   * @type {Object}
   */
  const authInfo = {
    user,
    loading,
    logInUser,
    logOut,
    createUser,
    updateUserProfile,
    isAdmin,
    userData,
    setLoading,
    isVerifiedPartner,
    validatePassword,
    isPartner,
    isSubAdmin,
    isLoading: loading,
  };

  return (
    <AuthContext.Provider value={authInfo}>{children}</AuthContext.Provider>
  );
};

export default AuthProvider;
