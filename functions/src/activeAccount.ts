import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
export async function assertActiveAccount(uid: string, token: Record<string, unknown>): Promise<void> {
  const [account, profile] = await Promise.all([getAuth().getUser(uid), getFirestore().doc(`users/${uid}`).get()]);
  const validAfter = Date.parse(account.tokensValidAfterTime || "1970-01-01");
  if (account.disabled || profile.data()?.isSuspended === true ||
      Number(token.auth_time || 0) * 1000 < validAfter) {
    throw new HttpsError("permission-denied", "Account inactive. Sign in again.");
  }
}
