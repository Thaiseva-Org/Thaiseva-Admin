import * as admin from "firebase-admin";
import {randomUUID} from "node:crypto";
import {onCall, HttpsError} from "firebase-functions/v2/https";

const collections = ["chats", "foodCustomerSupportChats", "foodRestaurantChats"];
const maxBytes = 8 * 1024 * 1024;
const types = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "video/mp4"]);

export function chatMediaPath(value: unknown): string[] | null {
  if (typeof value !== "string" || value.length > 800) return null;
  const match = value.match(/^private-chat\/(chats|foodCustomerSupportChats|foodRestaurantChats)\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/([a-f0-9-]{36})$/);
  return match ? match.slice(1) : null;
}

export function canAccessChat(uid: string, claims: Record<string, unknown>, role: string, collection: string, id: string, data: Record<string, any>): boolean {
  if (!collections.includes(collection)) return false;
  const administrator = claims.admin === true || ["Admin", "admin"].includes(role);
  const foodAdministrator = claims.foodMasterAdmin === true || claims.foodRole === "masterAdmin";
  if (administrator || foodAdministrator) return true;
  if (collection === "chats" && id.endsWith("_CustomerSupport")) return id === uid + "_CustomerSupport";
  if (collection === "foodCustomerSupportChats") return id === uid && data.customerId === uid;
  if (collection === "foodRestaurantChats") return id === uid && data.ownerId === uid;
  return ["userId", "authUid", "senderId", "receiverId", "createdBy", "customerId", "partnerId", "hotelUid", "driverId"].some(key => data[key] === uid) ||
    (Array.isArray(data.participants) && data.participants.includes(uid));
}

async function authorize(request: any, collection: unknown, id: unknown) {
  request.rawRequest?.res?.setHeader("Cache-Control", "no-store");
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to access chat attachments.");
  if (typeof collection !== "string" || !collections.includes(collection) || typeof id !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw new HttpsError("invalid-argument", "Select a supported chat.");
  const uid = request.auth.uid;
  const [user, profile, chat] = await Promise.all([admin.auth().getUser(uid), admin.firestore().doc(`users/${uid}`).get(), admin.firestore().doc(`${collection}/${id}`).get()]);
  const authTime = Number(request.auth.token.auth_time) * 1000;
  const validAfter = Date.parse(user.tokensValidAfterTime || "1970-01-01");
  if (user.disabled || profile.data()?.isSuspended === true || !Number.isFinite(authTime) || !Number.isFinite(validAfter) || authTime < validAfter || !chat.exists ||
    !canAccessChat(uid, user.customClaims || {}, profile.data()?.role || "", collection, id, chat.data() || {})) throw new HttpsError("permission-denied", "This chat attachment is unavailable.");
  return {uid, collection, id};
}

export const uploadPrivateChatAttachment = onCall({region: "asia-east2", memory: "256MiB", concurrency: 2, maxInstances: 10}, async request => {
  const access = await authorize(request, request.data?.collection, request.data?.chatId);
  const contentType = String(request.data?.contentType || "").split(";")[0].trim().toLowerCase();
  const encoded = request.data?.contentBase64;
  if (!types.has(contentType) || typeof encoded !== "string" || !encoded.length || encoded.length > Math.ceil(maxBytes / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new HttpsError("invalid-argument", "Use a supported file up to 8 MiB.");
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > maxBytes) throw new HttpsError("invalid-argument", "Use a file up to 8 MiB.");
  const path = `private-chat/${access.collection}/${access.id}/${access.uid}/${randomUUID()}`;
  await admin.storage().bucket().file(path).save(bytes, {resumable: false, contentType, metadata: {cacheControl: "private, no-store", metadata: {}}});
  return {path, contentType};
});

export const getPrivateChatAttachment = onCall({region: "asia-east2", memory: "256MiB", concurrency: 2, maxInstances: 10}, async request => {
  const parts = chatMediaPath(request.data?.path);
  if (!parts) throw new HttpsError("invalid-argument", "A private chat attachment path is required.");
  await authorize(request, parts[0], parts[1]);
  const file = admin.storage().bucket().file(request.data.path);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("not-found", "Attachment is unavailable.");
  const [metadata] = await file.getMetadata();
  if (!types.has(String(metadata.contentType)) || !Number.isFinite(Number(metadata.size)) || Number(metadata.size) > maxBytes) throw new HttpsError("failed-precondition", "Attachment cannot be opened safely.");
  const [bytes] = await file.download();
  if (bytes.length > maxBytes) throw new HttpsError("resource-exhausted", "Attachment exceeds the preview limit.");
  return {contentBase64: bytes.toString("base64"), contentType: metadata.contentType, expiresInSeconds: 300};
});
