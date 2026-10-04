import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../contextAPIs/AuthProvider";
// import { Box, Button, Grid, Modal, Paper, TextField } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { FaEnvelope, FaLock, FaExclamationCircle, FaUser, FaRegEyeSlash, FaRegEye } from "@icons";
// import { IoRestaurant } from "react-icons/io5";
import { logo } from "../../assets";
import EmailOtpLogin from "../../components/EmailOtpLogin";

// const style = {
//   position: "absolute",
//   top: "50%",
//   left: "50%",
//   transform: "translate(-50%, -50%)",
//   width: 400,
//   bgcolor: "background.paper",
//   border: "2px solid blue",
//   boxShadow: 24,
//   p: 4,
// };

const Login = () => {
  const { logInUser, user } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showpsw, setShowpsw] = useState(false);
  const [error, setError] = useState("");
  const [loginMethod, setLoginMethod] = useState("password");
  const navigate = useNavigate();

  // const handleLogin = (e) => {
  //   e.preventDefault();
  //   const form = e.target;
  //   const email = form.email.value;
  //   const password = form.password.value;

  //   logInUser(email, password)
  //     .then((res) => {
  //       const loggedUser = res.user;
  //       localStorage.setItem("email", email);
  //       localStorage.setItem("password", password);
  //       if (loggedUser) {
  //         navigate("/dashboard");
  //       }
  //     })
  //     .catch((error) => setError(error.message));
  // };

  const handleLogin = (e) => {
    e.preventDefault();
    // const form = e.target;
    // const email = form.email.value;
    // const password = form.password.value;
    if (!email) {
      setError("Please provide email");
      return;
    }
    if (!password) {
      setError("Please provide password");
      return;
    }

    logInUser(email, password)
      .then((res) => {
        const loggedUser = res.user;
        // localStorage.setItem("email", email);
        // localStorage.setItem("password", password);
        if (loggedUser) {
          navigate("/dashboard");
        }
      })
      .catch((error) => {
        if (error.code === "auth/email-already-in-use") {
          setError("This email is already in use. Please log in.");
        } else if (
          error.code === "auth/invalid-login-credentials" ||
          error.code === "auth/wrong-password"
        ) {
          setError("Please check your email or password.");
        } else if (error.code === "auth/user-not-found") {
          setError("No account found with this email. Please sign up.");
        } else if (error.code === "auth/weak-password") {
          setError("Password is too weak.");
        } else if (error.code === "auth/network-request-failed") {
          setError("Network error. Please check your internet connection.");
        } else {
          // console.error(error);
          setError("An unexpected error occurred. Please try again.");
        }
      });
  };

  // const [open, setOpen] = useState(false);
  // const handleOpen = () => setOpen(true);
  // const handleClose = () => setOpen(false);

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100">
        <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg">
          <div className="text-center mb-8">
            <img src={logo} alt="Thaiseva" className="w-[50%] m-auto" />
            {/* <h1 className="text-4xl font-bold text-gray-800">Thaiseva</h1> */}
            {/* <h2 className="text-2xl font-semibold text-gray-600 mt-2">
              {"Sign In"}
            </h2> */}
          </div>
          <div className="flex gap-2 mb-6" aria-label="Sign-in method">
            {["password", "otp"].map((method) => (
              <button key={method} type="button" aria-pressed={loginMethod === method}
                onClick={() => { setLoginMethod(method); setError(""); }}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold ${loginMethod === method ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}>
                {method === "password" ? "Password" : "Email code"}
              </button>
            ))}
          </div>
          {loginMethod === "otp" ? <EmailOtpLogin /> : <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label
                className="block text-gray-700 text-sm font-bold mb-2"
                htmlFor="email"
              >
                Email
              </label>
              <div className="flex items-center border-2 rounded-lg px-3 py-2 focus-within:border-blue-500 transition duration-300">
                <FaEnvelope className="text-gray-400 mr-2" />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full focus:outline-none"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>
            <div>
              <label
                className="block text-gray-700 text-sm font-bold mb-2"
                htmlFor="password"
              >
                Password
              </label>
              <div className="flex items-center border-2 rounded-lg px-3 py-2 focus-within:border-blue-500 transition duration-300">
                <FaLock className="text-gray-400 mr-2" />
                <input
                  type={`${showpsw ? "text" : "password"}`}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full focus:outline-none"
                  placeholder="Enter your password"
                  required
                />
                {showpsw ? (
                  <FaRegEye
                    onClick={() => setShowpsw((p) => !p)}
                    className="text-gray-400 ml-2 cursor-pointer"
                  />
                ) : (
                  <FaRegEyeSlash
                    onClick={() => setShowpsw((p) => !p)}
                    className="text-gray-400 ml-2 cursor-pointer"
                  />
                )}
              </div>
            </div>
            {error && (
              <div
                className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
                role="alert"
              >
                <FaExclamationCircle className="inline mr-2" />
                <span className="block sm:inline">{error}</span>
              </div>
            )}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-300 "
            >
              {"Sign In"}
            </button>
          </form>}
          <div className="mt-3 text-center">
            <p className="text-blue-500 hover:text-blue-600 text-sm">
              {"Want to be a partner?"}
            </p>
          </div>
          <div className="grid gap-3 grid-cols-1 mt-3">
            <button
              onClick={() => {
                navigate("/partner-onboarding");
              }}
              className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-3 px-4 rounded-lg flex items-center justify-center hover:bg-gray-50 focus:outline-none focus:shadow-outline transition duration-300"
            >
              <FaUser className="mr-4 text-blue-500 " /> Local Assistance
            </button>
            {/* <button
              onClick={() => {
                navigate("/driver-onboarding");
              }}
              className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-3 px-4 rounded-lg flex items-center justify-center hover:bg-gray-50 focus:outline-none focus:shadow-outline transition duration-300"
            >
              <FaCar className="mr-4 text-blue-500 " /> Driver
            </button>
            <Link
              to="https://thaiseva-food-portal.web.app/"
              className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-3 px-4 rounded-lg flex items-center justify-center hover:bg-gray-50 focus:outline-none focus:shadow-outline transition duration-300"
            >
              <IoRestaurant className="mr-4 text-blue-500 " /> Restaurant
            </Link> */}
          </div>
        </div>
      </div>
      {/* <div className="w-screen h-screen flex items-center justify-center md:px-10 p-2 py-12 bg-[var(--primary-bg)]">
        <Paper
          elevation={3}
          sx={{
            p: { xs: 2, sm: 3, md: 4 },
            mx: "auto",
            height: "fit-content",
            width: { xs: "100%", sm: "50%", md: "40%" },
          }}
          className="shadow-xl shadow-black"
        >
          <h3 className="text-center text-[var(--primary-bg)] font-bold text-2xl mb-3">
            Login
          </h3>
          <Box component="form" onSubmit={handleLogin}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  label="Email"
                  type="email"
                  name="email"
                  defaultValue=""
                  fullWidth
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Password"
                  type="password"
                  name="password"
                  defaultValue=""
                  fullWidth
                />
              </Grid>
            </Grid>
            {error && <span className="text-red-500">{error}</span>}
            <Box textAlign="center" sx={{ my: 2 }}>
              <Button
                type="submit"
                variant="contained"
                sx={{ backgroundColor: "var(--primary-bg)" }}
              >
                Login
              </Button>
            </Box>

            <div>
              Want to be a partner?{" "}
              <div
                onClick={handleOpen}
                className="text-[blue] underline inline-block"
              >
                Click Here
              </div>
            </div>
          </Box>
        </Paper>
        <Modal
          open={open}
          onClose={handleClose}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          <Box sx={style}>
            <h3 className="font-bold text-xl text-slate-600">
              Which type of partner do you want to be?
            </h3>

            <ul className="list-disc pl-4">
              <li>
                <Link
                  to="/partner-onboarding"
                  className="online-block text-blue-600 hover:text-blue-800 underline"
                >
                  Local Partner
                </Link>
              </li>
              <li>
                <Link
                  to="/driver-onboarding"
                  className="online-block text-blue-600 hover:text-blue-800 underline"
                >
                  Driving
                </Link>
              </li>
              <li>
                <Link
                  to="https://thaiseva-food-portal.web.app/"
                  className="online-block text-blue-600 hover:text-blue-800 underline"
                >
                  Restaurant
                </Link>
              </li>
              <li>
                <Link
                  to="/hotel-onboarding"
                  className="online-block text-blue-600 hover:text-blue-800 underline"
                >
                  Hotel Booking
                </Link>
              </li>
            </ul>
          </Box>
        </Modal>
      </div> */}
    </>
  );
};

export default Login;
