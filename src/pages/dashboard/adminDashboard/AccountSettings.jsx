import {useState} from "react";
import {Alert, Box, Button, Paper, Stack, TextField, Typography} from "@mui/material";
import {EmailAuthProvider, getAuth, reauthenticateWithCredential, updatePassword} from "firebase/auth";
import {app} from "../../../firebase/firebase.config";

export default function AccountSettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const user = getAuth(app).currentUser;
  const passwordAccount = user?.providerData.some(provider => provider.providerId === "password");

  const changePassword = async event => {
    event.preventDefault();
    if (busy) return;
    setError(""); setSuccess(false);
    if (newPassword.length < 12) { setError("Use at least 12 characters for your new password."); return; }
    if (newPassword !== confirmation) { setError("The new passwords do not match."); return; }
    if (newPassword === currentPassword) { setError("Choose a different password from your current one."); return; }
    const account = getAuth(app).currentUser;
    if (!account?.email || !passwordAccount) { setError("Please sign in with your email and password."); return; }
    setBusy(true);
    try {
      await reauthenticateWithCredential(account, EmailAuthProvider.credential(account.email, currentPassword));
      if (getAuth(app).currentUser?.uid !== account.uid) throw new Error("Account changed");
      await updatePassword(account, newPassword);
      setSuccess(true);
    } catch (failure) {
      const messages = {
        "auth/invalid-credential": "Your current password is incorrect. Please try again.",
        "auth/wrong-password": "Your current password is incorrect. Please try again.",
        "auth/weak-password": "Choose a stronger password that meets your account requirements.",
        "auth/password-does-not-meet-requirements": "Choose a stronger password that meets your account requirements.",
        "auth/too-many-requests": "Too many attempts. Please wait before trying again.",
        "auth/network-request-failed": "Check your connection and try again.",
        "auth/requires-recent-login": "Please sign in again, then retry changing your password.",
      };
      setError(messages[failure.code] || "Unable to change your password. Please sign in again and retry.");
    } finally {
      setCurrentPassword(""); setNewPassword(""); setConfirmation(""); setBusy(false);
    }
  };

  return <Box sx={{p: {xs: 2, md: 4}, maxWidth: 680}}>
    <Typography variant="h5" component="h1" gutterBottom>Account Settings</Typography>
    <Paper sx={{p: 3}}>
      <Typography variant="h6" component="h2">Change Password</Typography>
      <Typography color="text.secondary" sx={{mt: 1, mb: 2}}>Change the password for your own admin account. Use a unique password of at least 12 characters.</Typography>
      {!passwordAccount ? <Alert severity="info">This account uses another sign-in provider. Change your password with that provider.</Alert> :
        <Stack component="form" spacing={2} onSubmit={changePassword}>
          {error && <Alert severity="error" role="alert">{error}</Alert>}
          {success && <Alert severity="success" role="status">Your password has been changed successfully.</Alert>}
          <TextField label="Current password" type="password" autoComplete="current-password" required disabled={busy} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} />
          <TextField label="New password" type="password" autoComplete="new-password" required disabled={busy} value={newPassword} onChange={event => setNewPassword(event.target.value)} inputProps={{minLength: 12, maxLength: 4096}} />
          <TextField label="Confirm new password" type="password" autoComplete="new-password" required disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} />
          <Button type="submit" variant="contained" disabled={busy}>{busy ? "Changing password…" : "Change Password"}</Button>
        </Stack>}
    </Paper>
  </Box>;
}
