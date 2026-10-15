import { doc, getDoc } from "firebase/firestore";
import { hasAdminAccess } from "./adminAccessPolicy.js";

export async function loadAdminAccess(user, db) {
  const token = await user.getIdTokenResult();
  // A failed profile read deliberately rejects access, even with cached claims.
  const snapshot = await getDoc(doc(db, "users", user.uid));
  const profile = snapshot.exists() ? snapshot.data() : {};
  return { allowed: hasAdminAccess(token.claims, profile), profile };
}
