import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";

const buckets = ["gothai-ffea1.firebasestorage.app", "gothai-ffea1.appspot.com"];
export function orderMediaPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4000) return null;
  let path = value;
  if (value.startsWith("https://")) {
    try {
      const url = new URL(value);
      const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (url.hostname !== "firebasestorage.googleapis.com" || !match || !buckets.includes(match[1])) return null;
      path = decodeURIComponent(match[2]);
    } catch {return null;}
  }
  return /^food_orders\/[A-Za-z0-9_-]+\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/.test(path) &&
    !path.split("/").some(part => part === "." || part === "..") ? path : null;
}

export function canReadOrderMedia(uid: string, claims: Record<string, any>, role: string, order: Record<string, any>): boolean {
  return claims.admin === true || claims.foodMasterAdmin === true || claims.foodRole === "masterAdmin" ||
    ["Admin", "admin"].includes(role) || order.Receiver?.id === uid || order.userId === uid || order.uid === uid ||
    order.Restaurant?.ownerId === uid || order.ownerId === uid ||
    order.assignedRiderId === uid || order.DeliveryPartner?.id === uid;
}

export const getFoodOrderPhoto = onCall({region: "asia-east2", memory: "256MiB", maxInstances: 10}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to view this photo.");
  const uid = request.auth.uid;
  const user = await admin.auth().getUser(uid);
  const profile = (await admin.firestore().doc(`users/${uid}`).get()).data() || {};
  const issuedAt = Number(request.auth.token.auth_time) * 1000;
  const validAfter = user.tokensValidAfterTime ? Date.parse(user.tokensValidAfterTime) : 0;
  if (user.disabled || profile.isSuspended === true || !Number.isFinite(issuedAt) || !Number.isFinite(validAfter) ||
    issuedAt < validAfter) throw new HttpsError("permission-denied", "Sign in again.");
  const orderId = request.data?.orderId;
  const path = orderMediaPath(request.data?.path);
  if (typeof orderId !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(orderId) || !path) {
    throw new HttpsError("invalid-argument", "A valid order and photo path are required.");
  }
  const reference = admin.firestore().doc(`orders/${orderId}`);
  const order = (await reference.get()).data();
  if (!order || !canReadOrderMedia(uid, user.customClaims || {}, profile.role || "", order)) {
    throw new HttpsError("permission-denied", "This photo is not available to your account.");
  }
  const references = Array.isArray(order.Receiver?.locationPhotos) ? order.Receiver.locationPhotos : [];
  const customerUid = order.Receiver?.id || order.userId || order.uid;
  if (!customerUid || path.split("/")[1] !== customerUid || !references.some((value: unknown) => orderMediaPath(value) === path)) {
    throw new HttpsError("permission-denied", "This photo does not belong to this order.");
  }
  const file = admin.storage().bucket().file(path);
  const [metadata] = await file.getMetadata();
  const contentType = String(metadata.contentType || "");
  if (!["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"].includes(contentType) || Number(metadata.size) > 15 * 1024 * 1024) {
    throw new HttpsError("failed-precondition", "This file cannot be previewed as a photo.");
  }
  // Authorize against current assignment on every request. Never mint a permanent token URL.
  if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    const [bytes] = await file.download();
    if (bytes.length > 15 * 1024 * 1024) throw new HttpsError("resource-exhausted", "Photo exceeds the preview limit.");
    return {contentBase64: bytes.toString("base64"), contentType, expiresInSeconds: 300};
  }
  try {
    const [url] = await file.getSignedUrl({version: "v4", action: "read", expires: Date.now() + 5 * 60000});
    return {url, expiresInSeconds: 300};
  } catch (error: any) {
    const permissionError = [403, 7, "PERMISSION_DENIED"].includes(error?.code) ||
      /signBlob|iam\.serviceAccounts\.signBlob|permission denied/i.test(String(error?.message || ""));
    if (!permissionError) throw error;
    // A bounded authenticated response also works where signing IAM is unavailable.
    const [bytes] = await file.download();
    if (bytes.length > 15 * 1024 * 1024) throw new HttpsError("resource-exhausted", "Photo exceeds the preview limit.");
    return {contentBase64: bytes.toString("base64"), contentType, expiresInSeconds: 300};
  }
});
