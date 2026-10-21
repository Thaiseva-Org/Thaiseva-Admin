import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../contextAPIs/AuthProvider";
import { useNavigate } from "react-router-dom";
import { app, db } from "../../firebase/firebase.config";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { loadAdminAccess } from "../../utils/adminAccess";
import {
  FaEnvelope,
  FaLock,
  FaExclamationCircle,
  FaRegEyeSlash,
  FaRegEye,
  AdminPanelSettingsIcon,
  Close,
  CheckCircle,
  DirectionsCarIcon,
  DirectionsBusIcon,
  ApartmentIcon,
  LuggageIcon,
  NightlifeIcon,
  ForumIcon,
  ArrowForwardIosRoundedIcon,
} from "@icons";
import { logo } from "../../assets";

// Core service verticals provided by Thaiseva ecosystem
const THAISEVA_SERVICES = [
  {
    id: "hotels",
    title: "Hotels & Stays",
    tag: "Live Sync",
    tagColor: "bg-emerald-400/20 text-emerald-300 border-emerald-400/30",
    desc: "Resort bookings, room availability & instant hold management.",
    gradient: "from-emerald-400 to-teal-600",
    shadow: "shadow-emerald-500/25",
    icon: <ApartmentIcon sx={{ fontSize: 18 }} />,
  },
  {
    id: "tours",
    title: "Sightseeing Tours",
    tag: "Excursions",
    tagColor: "bg-amber-400/20 text-amber-300 border-amber-400/30",
    desc: "Curated island packages, cultural trips & capacity triage.",
    gradient: "from-amber-400 to-orange-600",
    shadow: "shadow-amber-500/25",
    icon: <LuggageIcon sx={{ fontSize: 18 }} />,
  },
  {
    id: "vans",
    title: "Transfers & Fleet",
    tag: "VIP Fleet",
    tagColor: "bg-cyan-400/20 text-cyan-300 border-cyan-400/30",
    desc: "Airport pickups, VIP vans, city commutes & driver dispatch.",
    gradient: "from-cyan-400 to-blue-600",
    shadow: "shadow-cyan-500/25",
    icon: <DirectionsBusIcon sx={{ fontSize: 18 }} />,
  },
  {
    id: "cars",
    title: "Self-Drive Rentals",
    tag: "Verified",
    tagColor: "bg-sky-400/20 text-sky-300 border-sky-400/30",
    desc: "Sedan & SUV rentals with verified digital license onboarding.",
    gradient: "from-sky-400 to-indigo-600",
    shadow: "shadow-sky-500/25",
    icon: <DirectionsCarIcon sx={{ fontSize: 18 }} />,
  },
  {
    id: "spots",
    title: "Shops & Nightlife",
    tag: "Hotspots",
    tagColor: "bg-pink-400/20 text-pink-300 border-pink-400/30",
    desc: "Curated shopping malls, exclusive beach clubs & premier dining.",
    gradient: "from-pink-400 to-rose-600",
    shadow: "shadow-pink-500/25",
    icon: <NightlifeIcon sx={{ fontSize: 18 }} />,
  },
  {
    id: "concierge",
    title: "24/7 Concierge Chat",
    tag: "Live Support",
    tagColor: "bg-violet-400/20 text-violet-300 border-violet-400/30",
    desc: "Real-time guest, hotel & driver communication dispatch.",
    gradient: "from-purple-400 to-indigo-600",
    shadow: "shadow-purple-500/25",
    icon: <ForumIcon sx={{ fontSize: 18 }} />,
  },
];

/**
 * Full-Page Screen-Fitted Login Component
 * 
 * Fits cleanly within 100vh without vertical overflow/scrolling on desktop.
 * Dual-panel layout showcasing all Thaiseva service verticals on the left.
 */
const Login = () => {
  const { logInUser, logOut, user, isAdmin, loading } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetError, setResetError] = useState("");

  const navigate = useNavigate();

  // Redirect to dashboard if user is authenticated
  useEffect(() => {
    if (user && isAdmin && !loading) {
      navigate("/");
    }
  }, [user, isAdmin, loading, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await logInUser(cleanEmail, password);

      if (res?.user) {
        const access = await loadAdminAccess(res.user, db);
        if (!access.allowed) {
          await logOut();
          setError("This account does not have active administrator access. Contact support@thaiseva.com.");
          return;
        }

        navigate("/dashboard");
      }
    } catch (err) {
      if (getAuth(app).currentUser) await logOut();
      switch (err.code) {
        case "auth/invalid-login-credentials":
        case "auth/invalid-credential":
        case "auth/wrong-password":
          setError("Invalid email or password. Please verify your credentials and try again.");
          break;
        case "auth/user-not-found":
          setError("No account found with this email address.");
          break;
        case "auth/invalid-email":
          setError("The email address provided is improperly formatted.");
          break;
        case "auth/user-disabled":
          setError("This account has been deactivated. Please contact support.");
          break;
        case "auth/too-many-requests":
          setError("Too many attempts. Access temporarily locked for security.");
          break;
        case "auth/network-request-failed":
          setError("Network connection error. Please verify your internet connection.");
          break;
        default:
          setError(err.message || "An unexpected error occurred during sign in. Please try again.");
          break;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");

    const targetEmail = resetEmail.trim() || email.trim();
    if (!targetEmail) {
      setResetError("Please provide your email address to receive password reset instructions.");
      return;
    }

    setResetLoading(true);
    try {
      const auth = getAuth(app);
      await sendPasswordResetEmail(auth, targetEmail);
      setResetSuccess(
        `A password recovery link has been dispatched to ${targetEmail}. Please check your inbox.`
      );
      setResetEmail("");
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        setResetError("No account associated with this email address was found.");
      } else if (err.code === "auth/invalid-email") {
        setResetError("Please provide a valid email address.");
      } else {
        setResetError(err.message || "Unable to send password recovery email. Please try again.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col lg:flex-row bg-gradient-to-br from-blue-100 via-indigo-50 to-purple-100 select-none">
      
      {/* ========================================================= */}
      {/* LEFT PANEL: Comprehensive Service Ecosystem Showcase       */}
      {/* ========================================================= */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[54%] flex-col justify-between p-6 xl:p-9 2xl:p-11 relative overflow-hidden bg-gradient-to-br from-[#070e23] via-[#0d2259] to-[#1e40af] text-white h-full">
        
        {/* Ambient multi-layered luminous background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/3 -right-24 w-80 h-80 bg-indigo-500/25 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 left-1/4 w-96 h-96 bg-sky-400/20 rounded-full blur-3xl" />
          <div className="absolute top-2/3 left-10 w-64 h-64 bg-cyan-400/15 rounded-full blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.9) 1px, transparent 1px)`,
              backgroundSize: "22px 22px",
            }}
          />
        </div>

        {/* Top Header Row */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-2xl shadow-xl border border-white/20 flex items-center">
            <img
              src={logo}
              alt="Thaiseva Logo"
              className="h-8 xl:h-9 w-auto object-contain"
            />
          </div>

          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 text-xs font-semibold text-white/95 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Administrative Console</span>
          </div>
        </div>

        {/* Center Hero & All Services Showcase */}
        <div className="relative z-10 my-auto py-2 xl:py-4 max-w-2xl">
          {/* Eyebrow & Headline */}
          <div className="mb-4 xl:mb-5">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-sky-300/90 mb-1">
              <span>🌴</span>
              <span>All-In-One Hospitality & Tourism Platform</span>
            </div>
            <h1 className="text-xl xl:text-2xl 2xl:text-3xl font-black text-white tracking-tight leading-snug">
              Thailand Operations & Service Verticals
            </h1>
            <p className="text-blue-100/75 text-xs xl:text-[13px] leading-relaxed mt-1 max-w-xl">
              Centralized administrative dispatch across all customer-facing services - connecting global travelers, luxury accommodations, transport fleets, and regional merchants.
            </p>
          </div>

          {/* 6 Core Services Grid (2 Columns, Screen-Fitted) */}
          <div className="grid grid-cols-2 gap-2.5 xl:gap-3.5">
            {THAISEVA_SERVICES.map((service) => (
              <div
                key={service.id}
                className="group relative p-3 xl:p-3.5 rounded-xl xl:rounded-2xl bg-white/[0.07] hover:bg-white/[0.13] border border-white/10 hover:border-white/25 backdrop-blur-md transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-blue-500/10 cursor-default"
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={`w-8 h-8 xl:w-9 xl:h-9 rounded-lg xl:rounded-xl bg-gradient-to-br ${service.gradient} flex items-center justify-center flex-shrink-0 text-white shadow-md ${service.shadow} group-hover:scale-105 transition-transform duration-200`}
                  >
                    {service.icon}
                  </div>
                  <span
                    className={`text-[9px] xl:text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${service.tagColor}`}
                  >
                    {service.tag}
                  </span>
                </div>
                <h2 className="font-bold text-white text-xs xl:text-[13px] tracking-tight mt-2.5 group-hover:text-sky-200 transition-colors truncate">
                  {service.title}
                </h2>
                <p className="text-blue-100/70 text-[10px] xl:text-[11px] leading-snug mt-0.5 line-clamp-2">
                  {service.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* RIGHT PANEL: Authentication Panel (Polished & Refined)     */}
      {/* ========================================================= */}
      <div className="w-full lg:w-1/2 xl:w-[46%] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 h-full overflow-y-auto lg:overflow-hidden relative">
        
        {/* Ambient subtle light halos behind card */}
        <div className="absolute top-1/4 right-10 w-80 h-80 bg-blue-300/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-10 w-80 h-80 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />

        {/* Main Card Container with top accent gradient ribbon */}
        <div className="w-full max-w-[430px] mx-auto bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(30,58,138,0.18),0_0_0_1px_rgba(226,232,240,0.8)] overflow-hidden relative z-10 transition-all">
          
          {/* Top Gradient Ribbon */}
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-400" />

          <div className="p-7 sm:p-8">
            {/* Header */}
            <div className="text-center mb-6">
              {/* Logo on small screens */}
              <img
                src={logo}
                alt="Thaiseva Logo"
                className="h-10 w-auto object-contain mx-auto mb-3 lg:hidden"
              />

              {/* Executive Icon Badge */}
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1e40af] via-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto mb-3.5 shadow-lg shadow-blue-600/30 ring-4 ring-blue-50/80">
                <AdminPanelSettingsIcon sx={{ fontSize: 24 }} />
              </div>

              <h1 className="text-2xl sm:text-[26px] font-black text-slate-900 tracking-tight">
                Sign In to Dashboard
              </h1>
              <p className="text-xs sm:text-[13px] text-slate-500 mt-1.5 leading-relaxed">
                Enter your administrative credentials to continue.
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div
                className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-in fade-in duration-200"
                role="alert"
              >
                <FaExclamationCircle className="text-red-500 text-sm flex-shrink-0 mt-0.5" />
                <div className="flex-1 font-medium leading-tight">{error}</div>
                <button
                  type="button"
                  onClick={() => setError("")}
                  className="text-red-400 hover:text-red-600 p-0.5 rounded transition-colors"
                  aria-label="Dismiss error"
                >
                  <Close sx={{ fontSize: 14 }} />
                </button>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              
              {/* Email Field */}
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  Email Address
                </label>
                <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-white hover:border-slate-300 focus-within:bg-white focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100/80 transition-all duration-200 shadow-2xs">
                  <div className="pl-3.5 pr-2.5 flex items-center pointer-events-none text-slate-400">
                    <FaEnvelope className="text-xs" />
                  </div>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@thaiseva.com"
                    autoComplete="email"
                    required
                    disabled={isSubmitting}
                    className="w-full py-2.5 pr-3 bg-transparent text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none disabled:opacity-60 font-medium"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-bold text-slate-700"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setResetError("");
                      setResetSuccess("");
                      setShowForgotModal(true);
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors focus:outline-none cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-white hover:border-slate-300 focus-within:bg-white focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100/80 transition-all duration-200 shadow-2xs">
                  <div className="pl-3.5 pr-2.5 flex items-center pointer-events-none text-slate-400">
                    <FaLock className="text-xs" />
                  </div>
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    disabled={isSubmitting}
                    className="w-full py-2.5 pr-9 bg-transparent text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none disabled:opacity-60 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <FaRegEye className="text-sm" />
                    ) : (
                      <FaRegEyeSlash className="text-sm" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 mt-1 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-[#1e40af] via-blue-600 to-[#2563eb] hover:from-[#1e3a8a] hover:via-[#1e40af] hover:to-blue-700 active:scale-[0.99] transition-all duration-200 shadow-lg shadow-blue-700/25 hover:shadow-xl hover:shadow-blue-700/35 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-65 disabled:cursor-not-allowed group"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowForwardIosRoundedIcon sx={{ fontSize: 13 }} className="opacity-90 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            {/* Subtle Security & Status Badge */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-slate-600 font-semibold">Console Active</span>
              </div>
              <span className="text-slate-400">Authorized Personnel Only</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3.5 text-center text-[11px] text-slate-400 font-medium">
          © {new Date().getFullYear()} Thaiseva Systems • Enterprise Edition
        </div>
      </div>

      {/* ========================================================= */}
      {/* FORGOT PASSWORD MODAL                                     */}
      {/* ========================================================= */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-[#1e40af] to-blue-500" />
            
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1e40af] flex items-center justify-center">
                    <FaLock className="text-xs" />
                  </div>
                  <h2 className="text-base font-bold text-slate-900">
                    Reset Password
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setResetError("");
                    setResetSuccess("");
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                  aria-label="Close modal"
                >
                  <Close sx={{ fontSize: 16 }} />
                </button>
              </div>

              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Enter your administrative email address to receive password reset instructions.
              </p>

              {resetSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
                  <CheckCircle sx={{ fontSize: 16 }} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="leading-snug">{resetSuccess}</div>
                </div>
              )}

              {resetError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <FaExclamationCircle className="text-red-500 text-xs mt-0.5 flex-shrink-0" />
                  <div className="leading-snug">{resetError}</div>
                </div>
              )}

              {!resetSuccess ? (
                <form onSubmit={handleResetPassword} className="space-y-3.5">
                  <div>
                    <label
                      htmlFor="reset-email"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1"
                    >
                      Email Address
                    </label>
                    <div className="relative flex items-center rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus-within:bg-white focus-within:border-[#1e40af] focus-within:ring-4 focus-within:ring-blue-100 transition-all duration-200">
                      <div className="pl-3 pr-2 flex items-center pointer-events-none text-slate-400">
                        <FaEnvelope className="text-xs" />
                      </div>
                      <input
                        id="reset-email"
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="admin@thaiseva.com"
                        required
                        disabled={resetLoading}
                        className="w-full py-2 pr-3 bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#1e40af] hover:bg-[#1d4ed8] shadow-sm shadow-blue-600/30 transition-all duration-200 flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {resetLoading ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <span>Send Link</span>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="pt-1 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(false);
                      setResetSuccess("");
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#1e40af] hover:bg-[#1d4ed8] transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
