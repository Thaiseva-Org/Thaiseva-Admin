import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";

export function identityMediaPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4000) return null;
  let path = value;
  if (value.startsWith("https://")) {
    try {
      const url = new URL(value);
      const match = url.pathname.match(/^\/v0\/b\/(gothai-ffea1\.(?:firebasestorage\.app|appspot\.com))\/o\/(.+)$/);
      if (url.hostname !== "firebasestorage.googleapis.com" || !match) return null;
      path = decodeURIComponent(match[2]);
    } catch {return null;}
  }
  return /^users\/[A-Za-z0-9_-]+\/(?:passports|licences)\/[A-Za-z0-9._-]+$/.test(path) &&
    !path.split("/").some(part => part === "." || part === "..") ? path : null;
}

export function canReadIdentityMedia(uid: string, claims: Record<string, unknown>, role: string, path: string): boolean {
  return claims.admin === true || ["Admin", "admin"].includes(role) || path.split("/")[1] === uid;
}

export const getIdentityDocument = onCall({region: "asia-east2", memory: "256MiB", concurrency: 2, maxInstances: 10}, async request => {
  request.rawRequest?.res?.setHeader("Cache-Control", "no-store");
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to open this document.");
  const path = identityMediaPath(request.data?.path);
  if (!path) throw new HttpsError("invalid-argument", "A supported identity-document path is required.");
  const uid = request.auth.uid;
  const account = await admin.auth().getUser(uid);
  const profile = (await admin.firestore().doc(`users/${uid}`).get()).data() || {};
  const authTime = Number(request.auth.token.auth_time) * 1000;
  const validAfter = Date.parse(account.tokensValidAfterTime || "1970-01-01");
  if (account.disabled || profile.isSuspended === true || !Number.isFinite(authTime) ||
      !Number.isFinite(validAfter) || authTime < validAfter ||
      !canReadIdentityMedia(uid, account.customClaims || {}, profile.role || "", path)) {
    throw new HttpsError("permission-denied", "This document is not available to your account.");
  }
  const file = admin.storage().bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("not-found", "Document is unavailable.");
  const [metadata] = await file.getMetadata();
  const contentType = String(metadata.contentType || "");
  const size = Number(metadata.size);
  if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(contentType) ||
      !Number.isFinite(size) || size > 8 * 1024 * 1024) {
    throw new HttpsError("failed-precondition", "This document cannot be previewed safely.");
  }
  // Authenticated bounded content avoids signing-IAM dependencies and permanent bearer links.
  const [bytes] = await file.download();
  if (bytes.length > 8 * 1024 * 1024) throw new HttpsError("resource-exhausted", "Document exceeds the preview limit.");
  return {contentBase64: bytes.toString("base64"), contentType, expiresInSeconds: 300};
});
