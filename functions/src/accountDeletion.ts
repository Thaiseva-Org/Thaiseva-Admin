import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {getStorage} from "firebase-admin/storage";
import {requireSuperAdmin} from "./privilegedAccounts";
import {held, millis} from "./retentionPolicy";
import {ERASURE_VERSION, nestedHold, treeReviewReason, recordErasureReview, eraseAdditionalPersonalRecords, inventoryBusinessRecords, linkedRecords, restrictScopedStorage, customerStoragePrefixes} from "./erasureScope";
import {getMessaging} from "firebase-admin/messaging";

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
  if (!uid || uid.includes("/")) {
    throw new HttpsError("invalid-argument", "uid is required.");
  }

  // A request/profile hold requires a reviewed decision before destructive work.
  const profile = await db().collection("users").doc(uid).get();
  const legacyProfile = await db().collection("Users").doc(uid).get();
  if (nestedHold(profile.data() || {}) || nestedHold(legacyProfile.data() || {})) {
    throw new HttpsError("failed-precondition", "This account has a retention hold; review it before erasure.");
  }

  const inventory = await inventoryBusinessRecords(uid);
  let attachmentHold = inventory.attachmentHold;
  const bookingAttachmentReview = attachmentHold;
  const supportPaths = [`foodCustomerSupportChats/${uid}`, `chats/${uid}_CustomerSupport`, `customerSupportV2/${uid}`];
  for (const path of supportPaths) {
    if (await treeReviewReason(db().doc(path))) attachmentHold = true;
  }
  for (const name of ["customerSupportMessagesV2", "customerSupportAttachmentsV2"]) {
    const matches = await linkedRecords(name, uid, ["customerId"]);
    if (!matches.complete) attachmentHold = true;
    for (const document of matches.records) {
      if (await treeReviewReason(document.ref)) attachmentHold = true;
    }
  }

  const job = db().collection("privacyErasureJobs").doc(uid);
  await job.set({status: "PROCESSING", actorUid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
  await db().collection("auditLogs").add({action: "START_CUSTOMER_ERASURE", actorUid,
    targetUid: uid, createdAt: admin.firestore.FieldValue.serverTimestamp()});
  // Keep a minimal suppression record: no name, email, reason or credentials.
  // This closes the old-ID-token window and supports reapplying erasure after restores.
  await db().doc(`privacyAccountRestrictions/${uid}`).set({status: "ERASURE_STARTED",
    purpose: "Prevent account-data recreation and reapply erasure after restoration",
    updatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
  await db().doc(`privacyRestrictedProfilePhotos/${uid}.jpg`).set({restricted: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
  try {
    await auth().revokeRefreshTokens(uid);
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

  if (await restrictScopedStorage(uid)) attachmentHold = true;

  // These are user-scoped operational records, not booking/payment ledgers.
  const preservedOperationalPaths: string[] = [];
  for (const record of [`users/${uid}`, `Users/${uid}`, `cart/${uid}`,
    `foodCustomerSupportChats/${uid}`, `chats/${uid}_CustomerSupport`, `customerSupportV2/${uid}`, `userDevices/${uid}`,
    `foodCustomerChats/${uid}`, `notifications/users/${uid}`]) {
    // notifications/users/{uid} is a collection, not a document.
    if (record.startsWith("notifications/")) {
      const page = await db().collection(record).get();
      for (const document of page.docs) {
        const reason = await treeReviewReason(document.ref);
        if (reason) {
          preservedOperationalPaths.push(document.ref.path);
          await recordErasureReview(uid, document.ref.path, reason);
        } else await db().recursiveDelete(document.ref);
      }
    } else {
      const reference = db().doc(record);
      const reason = await treeReviewReason(reference);
      if (!(attachmentHold && supportPaths.includes(record)) && !reason) {
        await db().recursiveDelete(reference);
        if ((await reference.get()).exists) throw new Error("Operational record cleanup verification failed");
      } else {
        preservedOperationalPaths.push(record);
        await recordErasureReview(uid, record, reason || "HELD_ATTACHMENT_DEPENDENCY");
      }
    }
  }
  // Push tokens are keyed by token hash, so find this user's devices by uid.
  const devices = await db().collection("customerDeviceTokens")
    .where("uid", "==", uid).get();
  const tokenDevices = devices.docs.filter(device => typeof device.data().token === "string");
  for (let offset = 0; offset < tokenDevices.length; offset += 1000) {
    const page = tokenDevices.slice(offset, offset + 1000);
    const result = await getMessaging().unsubscribeFromTopic(page.map(device => device.data().token), "customers");
    const retryable = result.errors.some(item => !["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"].includes(item.error.code));
    if (retryable) throw new Error("Notification topic removal needs a retry");
  }
  await Promise.all(devices.docs.map((device) => device.ref.delete()));
  preservedOperationalPaths.push(...await eraseAdditionalPersonalRecords(uid));
  if (preservedOperationalPaths.length) attachmentHold = true;
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
  if (!attachmentHold) {
    for (const name of ["customerSupportMessagesV2", "customerSupportAttachmentsV2"]) {
      let page = await db().collection(name).where("customerId", "==", uid).limit(200).get();
      while (!page.empty) {
        for (const record of page.docs) await db().recursiveDelete(record.ref);
        page = await db().collection(name).where("customerId", "==", uid).limit(200).get();
      }
    }
  }
  await Promise.all(["upload", "request"].map(kind => db().doc(`customerSupportRateLimits/${uid}_${kind}`).delete()));
  const erasedStoragePrefixes = attachmentHold ? [] : customerStoragePrefixes(uid);
  for (const prefix of erasedStoragePrefixes) {
    await getStorage().bucket().deleteFiles({prefix});
    const [remaining] = await getStorage().bucket().getFiles({prefix, maxResults: 1, autoPaginate: false});
    if (remaining.length) throw new Error("Stored-file cleanup verification failed");
  }
  if (!attachmentHold) {
    await getStorage().bucket().file(`profile_pics/${uid}.jpg`).delete({ignoreNotFound: true});
    if ((await getStorage().bucket().file(`profile_pics/${uid}.jpg`).exists())[0]) throw new Error("Profile-photo cleanup verification failed");
  } else await recordErasureReview(uid, `storage/uid-scoped/${uid}`, "HELD_ATTACHMENT_DEPENDENCY");
  const profileErased = !(await db().doc(`users/${uid}`).get()).exists && !(await db().doc(`Users/${uid}`).get()).exists;
  await job.set({
    cleanupVersion: ERASURE_VERSION, cleanupFinished: true,
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    inventoryComplete: inventory.complete, retainedBusinessRecordCount: inventory.count,
    status: "PENDING_RECORD_REVIEW", profileErased, uploadsErased: !attachmentHold,
    operationalRecordsErased: preservedOperationalPaths.length === 0, preservedOperationalPaths, attachmentHold, bookingAttachmentReview, actorUid,
    erasedStoragePrefixes, erasedStorageObjects: attachmentHold ? [] : [`profile_pics/${uid}.jpg`],
    remainingReview: ["bookings", "orders", "partnerOrderViews", "sharedMessages", "legacyUploads", "logs", "exports", "backups", ...(attachmentHold ? ["heldAttachments"] : [])],
    reviewDueAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 86400000),
    reviewOwner: "Admin",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
}

type ProcessingResult = "processed" | "already-processed" | "skipped" | "review-required" | "busy" | "eligible";

/** Shared by the create trigger, manual action and scheduled recovery. */
export async function processDeletionRequest(requestId: string, actorUid: string, dryRun = false, force = false): Promise<ProcessingResult> {
  const reference = db().collection("DeletionRequests").doc(requestId);
  const initial = (await reference.get()).data();
  if (!initial || !["Pending", "Erasure Pending"].includes(initial.status)) return "skipped";
  const uid = initial.uid;
  const review = async (reason: string): Promise<ProcessingResult> => {
    if (!dryRun) await db().collection("privacyRetentionReviews").doc(`DeletionRequests_${requestId}`).set({
      recordPath: reference.path, reason, status: "PENDING",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return "review-required";
  };
  if (typeof uid !== "string" || !uid || uid.includes("/")) return review("LEGACY_REQUEST_IDENTITY_REVIEW");
  const targetAuth = await auth().getUser(uid).catch((error: {code?: string}) => {
    if (error.code === "auth/user-not-found") return null;
    throw error;
  });
  const job = db().collection("privacyErasureJobs").doc(uid);
  const result = await db().runTransaction(async tx => {
    const [request, currentJob, profile, legacyProfile] = await Promise.all([
      tx.get(reference), tx.get(job), tx.get(db().doc(`users/${uid}`)), tx.get(db().doc(`Users/${uid}`)),
    ]);
    const data = request.data();
    if (!data || data.uid !== uid || !["Pending", "Erasure Pending"].includes(data.status)) return "skipped";
    if (held(data) || nestedHold(profile.data() || {}) || nestedHold(legacyProfile.data() || {})) return "RETENTION_HOLD";
    const claims = targetAuth?.customClaims || {};
    const customerRoles = ["", "customer", "user"];
    if (claims.admin || claims.foodMasterAdmin || (claims.foodRole && claims.foodRole !== "customer") ||
        [profile.data()?.role, legacyProfile.data()?.role].some(role => !customerRoles.includes(String(role || "").trim().toLowerCase()))) {
      return "STAFF_PARTNER_OFFBOARDING_REQUIRED";
    }
    // The UID lease also serializes duplicate request documents for one customer.
    if ((millis(currentJob.data()?.processingLeaseUntil) || 0) > Date.now()) return "busy";
    if (currentJob.data()?.cleanupVersion === ERASURE_VERSION && currentJob.data()?.cleanupFinished === true &&
        (millis(currentJob.data()?.updatedAt) || 0) > Date.now() - 23 * 3600000 && !force) {
      if (!dryRun && (!data.loginDeletedAt || data.processingError || currentJob.data()?.status === "RETRY_REQUIRED")) {
        tx.update(reference, {status: "Erasure Pending", loginDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
          processingError: admin.firestore.FieldValue.delete(), processedBy: actorUid});
        tx.set(job, {status: "PENDING_RECORD_REVIEW", processingLeaseUntil: admin.firestore.FieldValue.delete(),
          processingRequestId: admin.firestore.FieldValue.delete()}, {merge: true});
        tx.delete(db().collection("privacyRetentionFailures").doc(requestId));
      }
      return "already-processed";
    }
    if (dryRun) return "eligible";
    tx.set(job, {processingLeaseUntil: admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60000),
      processingRequestId: requestId}, {merge: true});
    tx.update(reference, {status: "Erasure Pending", processedBy: actorUid,
      password: admin.firestore.FieldValue.delete(), confirmPassword: admin.firestore.FieldValue.delete(), currentPassword: admin.firestore.FieldValue.delete(),
      processingAt: admin.firestore.FieldValue.serverTimestamp()});
    return "locked";
  });
  if (result === "RETENTION_HOLD" || result === "STAFF_PARTNER_OFFBOARDING_REQUIRED") return review(result);
  if (result !== "locked") return result;
  try {
    await deleteAuthAccountKeepData(uid, actorUid);
    // Commit the request result and release together; a retry repairs partial work.
    const batch = db().batch();
    batch.update(reference, {status: "Erasure Pending", loginDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
      processedBy: actorUid, processingError: admin.firestore.FieldValue.delete()});
    batch.set(job, {processingLeaseUntil: admin.firestore.FieldValue.delete(),
      processingRequestId: admin.firestore.FieldValue.delete()}, {merge: true});
    batch.delete(db().collection("privacyRetentionFailures").doc(requestId));
    await batch.commit();
    return "processed";
  } catch (error) {
    const batch = db().batch();
    batch.set(job, {status: "RETRY_REQUIRED", processingLeaseUntil: admin.firestore.FieldValue.delete(),
      processingRequestId: admin.firestore.FieldValue.delete(), updatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
    batch.update(reference, {processingError: "Cleanup needs a retry. Retained records still require review."});
    batch.set(db().collection("privacyRetentionFailures").doc(requestId), {requestId,
      status: "RETRY_REQUIRED", updatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
    await batch.commit();
    throw error;
  }
}

export const autoProcessDeletionRequest = onDocumentCreated({
  document: "DeletionRequests/{requestId}", region: REGION, retry: true,
  timeoutSeconds: 540, memory: "512MiB",
}, async event => {
  if (!event.data) return;
  const result = await processDeletionRequest(event.params.requestId, "automaticDeletion");
  if (result === "busy") throw new Error("Account cleanup is already running; retry after its lease.");
});

export const deleteUserFunction = onCall(
  { region: REGION, timeoutSeconds: 540, memory: "512MiB" },
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
    if (held(deletionRequest.data() || {})) {
      throw new HttpsError("failed-precondition", "This request has a retention hold; review it before erasure.");
    }

    const result = await processDeletionRequest(requestId, request.auth.uid, false, true);
    if (result === "review-required") throw new HttpsError("failed-precondition", "This account needs retention or staff/partner offboarding review.");
    if (result === "busy") throw new HttpsError("aborted", "Account cleanup is already running. Refresh shortly.");
    if (result === "skipped") throw new HttpsError("failed-precondition", "This deletion request is no longer pending.");

    return {success: true, uid, status: "Erasure Pending"};
  },
);
