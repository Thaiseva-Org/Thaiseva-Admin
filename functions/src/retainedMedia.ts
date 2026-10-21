import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {millis} from "./retentionPolicy";

// Operator-created inventory only. Clients never select a storage path or create grants.
export const getRetainedPrivateFile = onCall({region: "asia-east2", memory: "256MiB", concurrency: 2, maxInstances: 10}, async request => {
  request.rawRequest?.res?.setHeader("Cache-Control", "no-store");
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to open this file.");
  const [account, profile] = await Promise.all([
    admin.auth().getUser(request.auth.uid),
    admin.firestore().doc(`users/${request.auth.uid}`).get(),
  ]);
  const authTime = Number(request.auth.token.auth_time) * 1000;
  const validAfter = Date.parse(account.tokensValidAfterTime || "1970-01-01");
  if (account.disabled || profile.data()?.isSuspended === true || !Number.isFinite(authTime) || authTime <= 0 ||
      !Number.isFinite(validAfter) || authTime < validAfter ||
      !(account.customClaims?.admin === true || ["Admin", "admin"].includes(profile.data()?.role))) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }
  const id = request.data?.fileId;
  if (typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id)) throw new HttpsError("invalid-argument", "A registered file is required.");
  const record = (await admin.firestore().doc(`retainedPrivateFiles/${id}`).get()).data();
  if (!record || record.status !== "PROTECTED" || typeof record.storagePath !== "string") throw new HttpsError("not-found", "File is unavailable.");
  const file = admin.storage().bucket().file(record.storagePath);
  if (!(await file.exists())[0]) throw new HttpsError("not-found", "File is unavailable.");
  const [metadata] = await file.getMetadata();
  if (metadata.metadata?.privateRetainedId !== id || metadata.metadata?.privateRetainedDocument !== "true") throw new HttpsError("permission-denied", "File needs a privacy review.");
  // Lifecycle deletion is asynchronous. Stop previews at the approved deadline
  // even while the object still exists. Only a native storage hold permits review.
  if (record.expiresAt !== undefined && record.expiresAt !== null) {
    const expiresAt = millis(record.expiresAt);
    if (expiresAt === null || (expiresAt <= Date.now() && metadata.temporaryHold !== true && metadata.eventBasedHold !== true)) {
      throw new HttpsError("failed-precondition", "The retention period has ended or needs review.");
    }
  }
  const contentType = String(metadata.contentType || "");
  if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(contentType) ||
      !Number.isFinite(Number(metadata.size)) || Number(metadata.size) > 8 * 1024 * 1024) {
    throw new HttpsError("failed-precondition", "Use the authorized support attachment download for this file.");
  }
  const [bytes] = await file.download();
  if (bytes.length > 8 * 1024 * 1024) throw new HttpsError("resource-exhausted", "File exceeds the preview limit.");
  return {contentBase64: bytes.toString("base64"), contentType, expiresInSeconds: 300};
});
