import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {getStorage} from "firebase-admin/storage";
import {requireSuperAdmin} from "./privilegedAccounts";

const REGION = "asia-east2";

const db = () => admin.firestore();
const auth = () => admin.auth();

async function isCallerAdmin(
  callerUid: string,
): Promise<boolean> {
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
  return role === "Admin" || role === "admin";
}

/**
 * Removes the login and direct profile/uploads, then queues business-record review.
 * A request is never described as fully erased while retained records await review.
 */
export async function deleteAuthAccountKeepData(uid: string, actorUid = "system"): Promise<void> {
  if (!uid) {
    throw new HttpsError("invalid-argument", "uid is required.");
  }

  const job = db().collection("privacyErasureJobs").doc(uid);
  await job.set({status: "PROCESSING", actorUid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
  await db().collection("auditLogs").add({action: "START_CUSTOMER_ERASURE", actorUid,
    targetUid: uid, createdAt: admin.firestore.FieldValue.serverTimestamp()});
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

  // These are user-scoped operational records, not booking/payment ledgers.
  for (const record of [`users/${uid}`, `Users/${uid}`, `cart/${uid}`,
    `foodCustomerSupportChats/${uid}`, `chats/${uid}_CustomerSupport`, `userDevices/${uid}`,
    `notifications/users/${uid}`]) {
    // notifications/users/{uid} is a collection, not a document.
    if (record.startsWith("notifications/")) {
      await db().recursiveDelete(db().collection(record));
    } else {
      await db().recursiveDelete(db().doc(record));
    }
  }
  const directory = db().doc("chatRooms/CustomerSupport");
  await db().runTransaction(async tx => {
    const snapshot = await tx.get(directory);
    if (!snapshot.exists) return;
    const data = snapshot.data() || {};
    for (const [key, value] of Object.entries(data)) {
      if ((value as {userInfo?: {uid?: string}})?.userInfo?.uid === uid) {
        tx.update(directory, new admin.firestore.FieldPath(key), admin.firestore.FieldValue.delete());
      }
    }
  });
  for (const folder of ["users", "chat", "chats", "chatMedia"]) {
    await getStorage().bucket().deleteFiles({prefix: `${folder}/${uid}/`});
  }
  await job.set({
    status: "PENDING_RECORD_REVIEW", profileErased: true, uploadsErased: true,
    operationalRecordsErased: true, actorUid,
    remainingReview: ["bookings", "orders", "sharedMessages", "legacyUploads", "logs", "exports", "backups"],
    reviewDueAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 86400000),
    reviewOwner: "Admin",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
}

async function markDeletionRequestCompleted(
  requestId: string,
  processedBy: "admin",
): Promise<void> {
  await db().collection("DeletionRequests").doc(requestId).update({
    status: "Erasure Pending",
    loginDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
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
    );

    if (!callerIsAdmin) {
      throw new HttpsError("permission-denied", "Admin access required.");
    }
    await requireSuperAdmin(request.auth.uid, request.auth.token);

    const uid = request.data?.uid as string | undefined;
    const requestId = request.data?.requestId as string | undefined;

    if (typeof uid !== "string" || !uid || uid.includes("/") || uid === request.auth.uid) {
      throw new HttpsError("invalid-argument", "uid is required.");
    }
    if (typeof requestId !== "string" || !requestId || requestId.includes("/")) {
      throw new HttpsError("invalid-argument", "A deletion request is required.");
    }
    const deletionRequest = await db().collection("DeletionRequests").doc(requestId).get();
    if (!deletionRequest.exists || deletionRequest.data()?.uid !== uid ||
        !["Pending", "Erasure Pending"].includes(deletionRequest.data()?.status)) {
      throw new HttpsError("failed-precondition", "The deletion request must match this customer and be pending.");
    }

    const target = await db().collection("users").doc(uid).get();
    const targetAuth = await auth().getUser(uid).catch((error: {code?: string}) => {
      if (error.code === "auth/user-not-found") return null;
      throw error;
    });
    const claims = targetAuth?.customClaims || {};
    if (claims.admin === true || claims.foodMasterAdmin === true ||
        ["masterAdmin", "restaurantOwner"].includes(claims.foodRole) ||
        ["Admin", "admin", "Sub Admin", "Partner", "restaurantOwner"].includes(target.data()?.role)) {
      throw new HttpsError("failed-precondition", "Staff and partner accounts require a separate offboarding process.");
    }
    try {
      await deleteAuthAccountKeepData(uid, request.auth.uid);
    } catch (error) {
      await db().collection("privacyErasureJobs").doc(uid).set({status: "RETRY_REQUIRED",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
      throw error;
    }

    if (requestId) {
      await markDeletionRequestCompleted(requestId, "admin");
    }

    return {success: true, uid, status: "Erasure Pending"};
  },
);
