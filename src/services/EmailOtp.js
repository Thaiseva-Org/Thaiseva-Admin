import { getAuth, signInWithCustomToken } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase/firebase.config";

const functions = getFunctions(app, "asia-east2");
if (import.meta.env.DEV && import.meta.env.VITE_OTP_USE_EMULATOR === "true") {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

export async function sendEmailOtp(email) {
  return (await httpsCallable(functions, "sendEmailOtp")({ email })).data;
}

export async function resendEmailOtp(email, challengeId) {
  return (await httpsCallable(functions, "resendEmailOtp")({ email, challengeId })).data;
}

export async function verifyEmailOtp(email, challengeId, code) {
  const { data } = await httpsCallable(functions, "verifyEmailOtp")({ email, challengeId, code });
  return signInWithCustomToken(getAuth(app), data.customToken);
}
