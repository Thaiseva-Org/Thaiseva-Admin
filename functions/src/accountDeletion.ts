import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

const ADMIN_EMAILS = new Set([
  "admin@gmail.com",
  "thaiseva_admin@gmail.com",
]);

const REGION = "asia-east2";

const db = () => admin.firestore();
const auth = () => admin.auth();

async function isCallerAdmin(
  callerUid: string,
  callerEmail?: string,
): Promise<boolean> {
  if (callerEmail && ADMIN_EMAILS.has(callerEmail)) {
    return true;
  }

  try {
    const authUser = await auth().getUser(callerUid);
    if (authUser.customClaims?.admin === true) {
      return true;
    }
  } catch (error) {
    logger.warn("Could not load caller auth profile", { callerUid, error });
  }

  const userDoc = await db().collection("users").doc(callerUid).get();
  if (!userDoc.exists) {
    return false;
  }

  const role = userDoc.data()?.role;
  return role === "Admin" || role === "admin" || role === "Sub Admin";
}

/**
 * Deletes Firebase Auth login only. Firestore business data is intentionally kept.
 */
export async function deleteAuthAccountKeepData(uid: string): Promise<void> {
  if (!uid) {
    throw new HttpsError("invalid-argument", "uid is required.");
  }

  try {
    await auth().deleteUser(uid);
    logger.info("Deleted Firebase Auth account", { uid });
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;
    if (code === "auth/user-not-found") {
      logger.warn("Auth user already deleted", { uid });
    } else {
      throw error;
    }
  }

  const userRef = db().collection("users").doc(uid);
  const userSnap = await userRef.get();

  if (userSnap.exists) {
    await userRef.set(
      {
        accountDeleted: true,
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
}

async function markDeletionRequestCompleted(
  requestId: string,
  processedBy: "admin",
): Promise<void> {
  await db().collection("DeletionRequests").doc(requestId).update({
    status: "Completed",
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    processedBy,
  });
}

export const deleteUserFunction = onCall(
  { region: REGION },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const callerIsAdmin = await isCallerAdmin(
      request.auth.uid,
      request.auth.token.email,
    );

    if (!callerIsAdmin) {
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    const uid = request.data?.uid as string | undefined;
    const requestId = request.data?.requestId as string | undefined;

    if (!uid) {
      throw new HttpsError("invalid-argument", "uid is required.");
    }

    await deleteAuthAccountKeepData(uid);

    if (requestId) {
      await markDeletionRequestCompleted(requestId, "admin");
    }

    return { success: true, uid };
  },
);
