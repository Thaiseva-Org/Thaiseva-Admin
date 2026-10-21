import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";

export function driverDocumentPath(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > 4000) return null;
  let path = value;
  if (value.startsWith("https://")) {
    try {
      const url = new URL(value);
      const match = url.pathname.match(/^\/v0\/b\/(?:gothai-ffea1\.(?:firebasestorage\.app|appspot\.com)|thaiseva-85cda\.appspot\.com)\/o\/(.+)$/);
      if (url.hostname !== "firebasestorage.googleapis.com" || !match) return null;
      // Historical driver records retain the previous project's URL. Only the
      // matching owner-marked object in the current bucket can be served.
      path = decodeURIComponent(match[1]);
    } catch {return null;}
  }
  return /^(?:[0-9]+-file|users\/[A-Za-z0-9_-]+\/(?:files|licences)\/[A-Za-z0-9._-]+)$/.test(path) &&
    !path.split("/").some(part => part === "." || part === "..") ? path : null;
}

async function checkedCaller(request: {auth?: {uid: string; token: Record<string, unknown>}}) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to open this document.");
  const account = await admin.auth().getUser(request.auth.uid);
  const profile = (await admin.firestore().doc(`users/${account.uid}`).get()).data() || {};
  const authTime = Number(request.auth.token.auth_time) * 1000;
  const validAfter = Date.parse(account.tokensValidAfterTime || "1970-01-01");
  if (account.disabled || profile.isSuspended === true || !Number.isFinite(authTime) ||
      !Number.isFinite(validAfter) || authTime < validAfter) {
    throw new HttpsError("permission-denied", "This document is not available to your account.");
  }
  return {uid: account.uid, isAdmin: account.customClaims?.admin === true || ["Admin", "admin"].includes(profile.role)};
}

export const getDriverDocument = onCall({region: "asia-east2", memory: "256MiB", concurrency: 2, maxInstances: 10}, async request => {
  request.rawRequest?.res?.setHeader("Cache-Control", "no-store");
  const caller = await checkedCaller(request);
  const driverId = request.data?.driverId;
  if (typeof driverId !== "string" || !/^[A-Za-z0-9_-]+$/.test(driverId)) throw new HttpsError("invalid-argument", "A driver is required.");
  if (!caller.isAdmin && caller.uid !== driverId) throw new HttpsError("permission-denied", "This document is not available to your account.");
  const driver = (await admin.firestore().doc(`drivers/${driverId}`).get()).data();
  const path = driverDocumentPath(driver?.driverInformation?.license);
  if (!path) throw new HttpsError("not-found", "Document is unavailable.");
  const file = admin.storage().bucket().file(path);
  if (!(await file.exists())[0]) throw new HttpsError("not-found", "Document is unavailable.");
  const [metadata] = await file.getMetadata();
  // The stored record alone cannot authorize reading another driver's legacy file.
  if (metadata.metadata?.privateDriverOwner !== driverId) throw new HttpsError("permission-denied", "Document needs a privacy review.");
  const contentType = String(metadata.contentType || "");
  if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(contentType) ||
      !Number.isFinite(Number(metadata.size)) || Number(metadata.size) > 8 * 1024 * 1024) {
    throw new HttpsError("failed-precondition", "This document cannot be previewed safely.");
  }
  const [bytes] = await file.download();
  if (bytes.length > 8 * 1024 * 1024) throw new HttpsError("resource-exhausted", "Document exceeds the preview limit.");
  return {contentBase64: bytes.toString("base64"), contentType, expiresInSeconds: 300};
});

export const uploadDriverDocument = onCall({region: "asia-east2", memory: "256MiB", concurrency: 2, maxInstances: 10}, async request => {
  const caller = await checkedCaller(request);
  const {contentBase64, contentType} = request.data || {};
  if (!["image/jpeg", "image/png"].includes(contentType) || typeof contentBase64 !== "string" ||
      !contentBase64.length || contentBase64.length > 11200000 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(contentBase64)) {
    throw new HttpsError("invalid-argument", "Upload a JPG or PNG licence up to 8 MB.");
  }
  const bytes = Buffer.from(contentBase64, "base64");
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!bytes.length || bytes.length > 8 * 1024 * 1024 || !(contentType === "image/jpeg" ? jpeg : png)) {
    throw new HttpsError("invalid-argument", "Upload a valid JPG or PNG licence up to 8 MB.");
  }
  const path = `users/${caller.uid}/licences/${admin.firestore().collection("drivers").doc().id}`;
  await admin.storage().bucket().file(path).save(bytes, {resumable: false, metadata: {
    contentType, cacheControl: "private, no-store", metadata: {privateDriverDocument: "true", privateDriverOwner: caller.uid},
  }});
  return {path};
});
