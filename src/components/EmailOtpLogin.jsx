import { useEffect, useState } from "react";
import { sendEmailOtp, resendEmailOtp, verifyEmailOtp } from "../services/EmailOtp";

export default function EmailOtpLogin() {
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  const [retryAt, setRetryAt] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const remaining = Math.max(0, Math.ceil(((challenge?.expiresAt || 0) - now) / 1000));
  const wait = Math.max(0, Math.ceil((Math.max(challenge?.resendAt || 0, retryAt) - now) / 1000));

  async function perform(action) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (action === "verify") {
        await verifyEmailOtp(email, challenge.challengeId, code);
        setMessage("Signed in successfully.");
      } else {
        const next = action === "resend" ?
          await resendEmailOtp(email, challenge.challengeId) : await sendEmailOtp(email);
        setChallenge(next);
        setCode("");
        setNow(Date.now());
        setMessage(next.message);
      }
    } catch (failure) {
      if (failure.details?.retryAfterSeconds) {
        setRetryAt(Date.now() + failure.details.retryAfterSeconds * 1000);
      }
      const messages = {
        "functions/unauthenticated": "Invalid or expired code. Check the latest email or request a new code.",
        "functions/resource-exhausted": "Too many requests or attempts. Please wait before trying again.",
        "functions/failed-precondition": "Email sign-in is being configured. Please use password sign-in for now.",
        "functions/unavailable": "Email delivery is unavailable. Please wait and try again.",
      };
      setError(messages[failure.code] || "Unable to complete email sign-in. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault();
      perform(challenge ? "verify" : "send");
    }}>
      <p className="text-sm text-gray-600">Sign in with a secure code sent to your account email.</p>
      <label className="block text-sm font-bold text-gray-700" htmlFor="otp-email">Email</label>
      <input id="otp-email" type="email" autoComplete="email" required maxLength={254}
        disabled={busy || Boolean(challenge)} value={email}
        onChange={(event) => setEmail(event.target.value.trim().toLowerCase())}
        className="w-full border-2 rounded-lg px-3 py-2" placeholder="Enter your account email" />
      {challenge && <>
        <label className="block text-sm font-bold text-gray-700" htmlFor="otp-code">Verification code</label>
        <input id="otp-code" type="text" inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]{6}" maxLength={6} required autoFocus disabled={busy}
          value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          className="w-full border-2 rounded-lg px-3 py-3 text-center text-2xl tracking-widest"
          placeholder="000000" aria-describedby="otp-expiry" />
        <p id="otp-expiry" className="text-sm text-gray-600">{remaining > 0 ?
          `Code expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` :
          "Code expired. Request a new code."}</p>
      </>}
      {message && <p role="status" className="text-sm text-blue-700">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy || (!challenge && wait > 0) ||
        (Boolean(challenge) && (remaining === 0 || code.length !== 6))}
        className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg disabled:opacity-50">
        {busy ? "Please wait…" : challenge ? "Verify and sign in" : wait > 0 ? `Try again in ${wait}s` : "Send sign-in code"}
      </button>
      {challenge && <div className="flex justify-between gap-3 text-sm">
        <button type="button" disabled={busy || wait > 0} onClick={() => perform("resend")}
          className="text-blue-600 disabled:text-gray-400">{wait > 0 ? `Resend in ${wait}s` : "Resend code"}</button>
        <button type="button" disabled={busy} onClick={() => {
          setChallenge(null); setCode(""); setError(""); setMessage("");
        }} className="text-gray-600">Change email</button>
      </div>}
    </form>
  );
}
