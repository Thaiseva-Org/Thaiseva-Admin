import * as admin from "firebase-admin";
import {HttpsError} from "firebase-functions/v2/https";

/** Server-side APIs must reject still-valid tokens once account erasure begins. */
export async function assertAccountNotErasing(uid: string): Promise<void> {
  if ((await admin.firestore().doc(`privacyAccountRestrictions/${uid}`).get()).exists) {
    throw new HttpsError("permission-denied", "This account is being erased and cannot create or access account data.");
  }
}


export async function assertTransactionNotErasing(tx: admin.firestore.Transaction, uid: string): Promise<void> {
  if ((await tx.get(admin.firestore().doc(`privacyAccountRestrictions/${uid}`))).exists) {
    throw new HttpsError("permission-denied", "Account erasure is in progress.");
  }
}

/** Cleans up a private upload which finished after account erasure began. */
export async function finishAccountUpload(uid: string, path: string): Promise<void> {
  try { await assertAccountNotErasing(uid); }
  catch (error) {
    const parts = path.split("/");
    const scoped = path.startsWith(`users/${uid}/`) || path.startsWith(`customer-support-v2/${uid}/`) ||
      (parts[0] === "private-chat" && (parts[3] === uid ||
        (parts[1] === "chats" && parts[2] === `${uid}_CustomerSupport`) ||
        (parts[1] === "foodCustomerSupportChats" && parts[2] === uid)));
    if (scoped && error instanceof HttpsError && error.code === "permission-denied") {
      await admin.storage().bucket().file(path).delete({ignoreNotFound: true});
    }
    throw error;
  }
}
