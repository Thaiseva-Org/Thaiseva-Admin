import {useState} from "react";
import {Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Alert} from "@mui/material";
import {EmailAuthProvider, GoogleAuthProvider, getAuth, reauthenticateWithCredential, reauthenticateWithPopup} from "firebase/auth";
import {app} from "../firebase/firebase.config";

// Passwords stay in component state only and are cleared on completion/cancel.
export default function useRecentAuthAction() {
  const [pending, setPending] = useState(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (action) => {
    const user = getAuth(app).currentUser;
    if (!user) throw new Error("Please sign in.");
    const token = await user.getIdTokenResult();
    if (Date.now() / 1000 - Number(token.claims.auth_time || 0) > 240) {
      await new Promise((resolve, reject) => {
        setPassword(""); setError(""); setPending({resolve, reject});
      });
    }
    return action();
  };
  const cancel = () => {
    pending?.reject(new Error("Verification cancelled."));
    setPending(null); setPassword(""); setError("");
  };
  const verify = async () => {
    setBusy(true); setError("");
    try {
      const user = getAuth(app).currentUser;
      if (!user) throw new Error("Please sign in.");
      if (user.providerData.some((provider) => provider.providerId === "password")) {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      } else {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
      }
      await user.getIdToken(true);
      pending.resolve(); setPending(null); setPassword("");
    } catch {
      setError("Verification failed. Check your password or sign in again.");
    } finally { setBusy(false); }
  };
  const dialog = <Dialog open={!!pending} onClose={busy ? undefined : cancel}>
    <DialogTitle>Verify your identity</DialogTitle>
    <DialogContent>
      <p>Please verify your current sign-in before this sensitive action.</p>
      {error && <Alert severity="error">{error}</Alert>}
      {getAuth(app).currentUser?.providerData.some((provider) => provider.providerId === "password") &&
        <TextField autoFocus label="Current password" type="password" autoComplete="current-password" value={password}
          onChange={(event) => setPassword(event.target.value)} fullWidth margin="normal" />}
    </DialogContent>
    <DialogActions><Button disabled={busy} onClick={cancel}>Cancel</Button><Button disabled={busy} onClick={verify}>Verify</Button></DialogActions>
  </Dialog>;
  return {run, dialog};
}
