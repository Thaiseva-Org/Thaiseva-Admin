import * as admin from "firebase-admin";
import {createHash} from "node:crypto";
import {getStorage} from "firebase-admin/storage";
import {held, millis, bookingRetentionReviewReason} from "./retentionPolicy";

export const ERASURE_VERSION = 2;
export const OWNED_RECORD_FIELDS = ["uid", "userId", "authUid", "uId", "customerId", "Receiver.id"];
export const BUSINESS_COLLECTIONS = ["hotelBookingData", "travelBookingDetails", "car_bookings",
  "self_driving_bookings", "vanBookings", "bookings", "orders", "foodOrders", "dineInBookings"];
const PERSONAL_COLLECTIONS: Record<string, string[]> = {
  reviews: ["uid", "userId"], feedbackandratings: ["uid", "userId", "customerId"],
  messages: ["senderId", "userId"], ContactMessages: ["uid", "userId"],
};
export function nestedHold(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== "object") return false;
  if (depth > 20) return true; // Unmapped/deep structures require review.
  if (Array.isArray(value)) return value.some(item => nestedHold(item, depth + 1));
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  const data = value as Record<string, unknown>;
  return held(data) || Object.values(data).some(item => nestedHold(item, depth + 1));
}

/** Exact indexed UID matches only: never infer ownership from an email or path substring. */
export async function linkedRecords(collection: string, uid: string, fields = OWNED_RECORD_FIELDS) {
  const records = new Map<string, admin.firestore.QueryDocumentSnapshot>();
  let complete = true;
  for (const field of fields) {
    let query = admin.firestore().collection(collection).where(field, "==", uid)
      .orderBy(admin.firestore.FieldPath.documentId()).limit(100);
    for (let pageNumber = 0; pageNumber < 10; pageNumber++) {
      const page = await query.get();
      page.docs.forEach(record => records.set(record.ref.path, record));
      if (page.size < 100) break;
      if (pageNumber === 9) {complete = false; break;}
      query = query.startAfter(page.docs[page.docs.length - 1]);
    }
  }
  return {records: [...records.values()], complete};
}

export async function recordErasureReview(uid: string, path: string, reason: string) {
  const id = createHash("sha256").update(path).digest("hex");
  const reference = admin.firestore().doc(`privacyErasureJobs/${uid}/records/${id}`);
  await reference.set({recordPath: path, reason, status: "PENDING", owner: "Admin",
    reviewDueAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 86400000),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
}

/** A parent can be missing while its subcollections still contain personal data. */
export async function treeReviewReason(reference: admin.firestore.DocumentReference,
  budget = {remaining: 1000}, depth = 0): Promise<string | null> {
  if (--budget.remaining < 0 || depth > 10) return "SUBCOLLECTION_INVENTORY_LIMIT";
  const snapshot = await reference.get();
  const data = snapshot.data() || {};
  if (nestedHold(data)) return "RETENTION_HOLD";
  const until = data.retentionUntil ?? data.retainUntil;
  if (until !== undefined && (millis(until) === null || millis(until)! > Date.now())) return "RETENTION_DEADLINE_REVIEW";
  if (bookingRetentionReviewReason(data) === "ACCOUNTING_RETENTION_MAPPING_REQUIRED") return "ACCOUNTING_RETENTION_MAPPING_REQUIRED";
  const children = await reference.listCollections();
  for (const child of children) {
    let query = child.orderBy(admin.firestore.FieldPath.documentId()).limit(100);
    while (true) {
      const page = await query.get();
      for (const document of page.docs) {
        const reason = await treeReviewReason(document.ref, budget, depth + 1);
        if (reason) return reason;
      }
      if (page.size < 100) break;
      query = query.startAfter(page.docs[page.docs.length - 1]);
    }
  }
  return null;
}

/** Removes non-ledger customer content, including descendants, while preserving holds. */
export async function eraseAdditionalPersonalRecords(uid: string): Promise<string[]> {
  const preserved: string[] = [];
  for (const [collection, fields] of Object.entries(PERSONAL_COLLECTIONS)) {
    const matches = await linkedRecords(collection, uid, fields);
    if (!matches.complete) {
      preserved.push(collection);
      await recordErasureReview(uid, collection, "UID_QUERY_LIMIT");
    }
    for (const document of matches.records) {
      const identities = fields.map(field => document.get(field)).filter(value => typeof value === "string" && value);
      const reason = identities.some(value => value !== uid) ? "CONFLICTING_IDENTITY" : await treeReviewReason(document.ref);
      if (reason) {
        preserved.push(document.ref.path);
        await recordErasureReview(uid, document.ref.path, reason);
      } else {
        await admin.firestore().recursiveDelete(document.ref);
        const remaining = await document.ref.get();
        if (remaining.exists) throw new Error("Personal record cleanup verification failed");
        const reviewId = createHash("sha256").update(document.ref.path).digest("hex");
        await admin.firestore().doc(`privacyErasureJobs/${uid}/records/${reviewId}`).delete();
      }
    }
  }
  return preserved;
}

export async function inventoryBusinessRecords(uid: string): Promise<{attachmentHold: boolean; complete: boolean; count: number}> {
  let attachmentHold = false, complete = true, count = 0;
  for (const collection of BUSINESS_COLLECTIONS) {
    const matches = await linkedRecords(collection, uid);
    complete = complete && matches.complete;
    if (!matches.complete) await recordErasureReview(uid, collection, "UID_QUERY_LIMIT");
    for (const document of matches.records) {
      count++;
      const reason = await treeReviewReason(document.ref);
      if (reason) attachmentHold = true;
      await recordErasureReview(uid, document.ref.path, reason || "BUSINESS_RECORD_RETENTION_DECISION");
      if (collection === "orders") {
        const view = await admin.firestore().doc(`partnerOrderViews/${document.id}`).get();
        if (view.exists) await recordErasureReview(uid, view.ref.path, "DERIVED_ORDER_COPY_RETENTION_DECISION");
      }
    }
  }
  return {attachmentHold: attachmentHold || !complete, complete, count};
}


const CUSTOMER_STORAGE_FOLDERS = ["users", "chat", "chats", "chatMedia", "uploads", "food_orders", "customer-support-v2"];
export const customerStoragePrefixes = (uid: string): string[] => [
  ...CUSTOMER_STORAGE_FOLDERS.map(folder => `${folder}/${uid}/`),
  `private-chat/chats/${uid}_CustomerSupport/`, `private-chat/foodCustomerSupportChats/${uid}/`,
];
/** Held bytes stay private: bearer download links must not bypass deletion restrictions. */
export async function restrictScopedStorage(uid: string): Promise<boolean> {
  let storageHold = false;
  const restrict = async (file: import("@google-cloud/storage").File) => {
    const [metadata] = await file.getMetadata();
    if (metadata.temporaryHold || metadata.eventBasedHold ||
        (metadata.retentionExpirationTime && (!Number.isFinite(Date.parse(String(metadata.retentionExpirationTime))) || Date.parse(String(metadata.retentionExpirationTime)) > Date.now()))) {
      storageHold = true;
      await recordErasureReview(uid, `storage/${file.name}`, "STORAGE_RETENTION_HOLD");
    }
    await file.setMetadata({cacheControl: "private, no-store", metadata: {firebaseStorageDownloadTokens: null}});
  };
  for (const prefix of customerStoragePrefixes(uid)) {
    for await (const file of getStorage().bucket().getFilesStream({prefix})) await restrict(file);
  }
  const profile = getStorage().bucket().file(`profile_pics/${uid}.jpg`);
  if ((await profile.exists())[0]) await restrict(profile);
  return storageHold;
}
