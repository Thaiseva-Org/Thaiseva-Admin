import {getFirestore, FieldValue, FieldPath} from "firebase-admin/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getAuth} from "firebase-admin/auth";
import {requireSuperAdmin} from "./privilegedAccounts";
import {deleteAuthAccountKeepData} from "./accountDeletion";
import {bookingAction, expiredMessages, held, millis, cutoff, LOCATION_FIELDS, POLICY_VERSION} from "./retentionPolicy";

const collections = ["hotelBookingData", "travelBookingDetails", "car_bookings", "self_driving_bookings",
  "vanBookings", "bookings", "orders", "foodOrders", "dineInBookings", "foodCustomerSupportChats",
  "foodRestaurantChats", "chats", "messages", "ContactMessages", "DeletionRequests"];
export async function maintainRetention(dryRun: boolean): Promise<Record<string, unknown>> {
  const db = getFirestore();
  const now = new Date();
  const counts = {scanned: 0, deleted: 0, locationsRemoved: 0, messagesRemoved: 0,
    accountsErased: 0, reviewRequired: 0, failures: 0};
  // Bound work, persist cursors and revisit every document over subsequent daily runs.
  for (const collection of collections) {
    const stateRef = db.collection("privacyRetentionState").doc(collection);
    const state = await stateRef.get();
    let query = db.collection(collection).orderBy(FieldPath.documentId()).limit(100);
    if (state.data()?.cursor) query = query.startAfter(state.data()?.cursor);
    const page = await query.get();
    for (const document of page.docs) {
      counts.scanned++;
      try {
        if (collection === "DeletionRequests") {
          const data = document.data();
          const requested = millis(data.createdAt);
          if (!["Pending", "Erasure Pending"].includes(data.status) || held(data)) continue;
          const existingJob = await db.collection("privacyErasureJobs").doc(data.uid || "invalid").get();
          if (existingJob.data()?.profileErased === true) continue;
          if (requested === null || typeof data.uid !== "string" || !data.uid || data.uid.includes("/")) {
            counts.reviewRequired++; continue;
          }
          if (requested > cutoff(now, 0, 30)) continue;
          const profile = await db.collection("users").doc(data.uid).get();
          const user = await getAuth().getUser(data.uid).catch(error => {
            if (error.code === "auth/user-not-found") return null;
            throw error;
          });
          const claims = user?.customClaims || {};
          if (claims.admin || claims.foodMasterAdmin || (claims.foodRole && claims.foodRole !== "customer") ||
            ["Admin", "admin", "Sub Admin", "Partner", "restaurantOwner", "hotelOwner", "rider", "driver"].includes(profile.data()?.role)) {
            counts.reviewRequired++; continue;
          }
          // Staff may cancel during the grace period. Lock the request before any erasure.
          if (!dryRun) {
            const locked = await db.runTransaction(async tx => {
              const fresh = await tx.get(document.ref);
              if (!["Pending", "Erasure Pending"].includes(fresh.data()?.status) || held(fresh.data() || {})) return false;
              tx.update(document.ref, {status: "Erasure Pending", processedBy: "retentionScheduler",
                processingAt: FieldValue.serverTimestamp()});
              return true;
            });
            if (!locked) continue;
            await deleteAuthAccountKeepData(data.uid, "retentionScheduler");
            await document.ref.update({loginDeletedAt: FieldValue.serverTimestamp()});
          }
          counts.accountsErased++; continue;
        }
        if ((collection === "chats" || collection.endsWith("Chats")) && !held(document.data())) {
          const childState = db.collection("privacyRetentionState").doc(`messages_${collection}_${document.id}`);
          const childCursor = (await childState.get()).data()?.cursor;
          let childQuery = document.ref.collection("messages").orderBy(FieldPath.documentId()).limit(100);
          if (childCursor) childQuery = childQuery.startAfter(childCursor);
          const children = await childQuery.get();
          for (const child of children.docs) {
            await db.runTransaction(async tx => {
              const [parent, fresh] = await Promise.all([tx.get(document.ref), tx.get(child.ref)]);
              if (!parent.exists || !fresh.exists || held(parent.data() || {}) || held(fresh.data() || {})) return;
              const data = fresh.data() || {};
              const timestamp = millis(data.createdAt ?? data.timestamp ?? data.sentAt);
              if (timestamp !== null && timestamp <= cutoff(now, 2)) {
                counts.messagesRemoved++;
                if (!dryRun) tx.delete(child.ref);
              } else if (timestamp === null) {
                counts.reviewRequired++;
                if (!dryRun) tx.set(db.collection("privacyRetentionReviews").doc(`${collection}_${document.id}_${child.id}`),
                  {recordPath: child.ref.path, reason: "MISSING_LIFECYCLE_DATE", status: "PENDING", updatedAt: FieldValue.serverTimestamp()});
              }
            });
          }
          if (!dryRun) await childState.set({cursor: children.size === 100 ? children.docs[99].id : null});
        }
        await db.runTransaction(async tx => {
          const fresh = await tx.get(document.ref);
          const data = fresh.data();
          if (!data || held(data)) return;
          if (collection === "ContactMessages" || collection === "messages") {
            const timestamp = millis(data.createdAt ?? data.timestamp ?? data.sentAt);
            if (timestamp === null) {
              counts.reviewRequired++;
              if (!dryRun) tx.set(db.collection("privacyRetentionReviews").doc(`${collection}_${document.id}`),
                {recordPath: document.ref.path, reason: "MISSING_LIFECYCLE_DATE", status: "PENDING", updatedAt: FieldValue.serverTimestamp()});
            } else if (timestamp <= cutoff(now, collection === "messages" ? 2 : 0, collection === "ContactMessages" ? 90 : 0)) {
              counts.deleted++;
              if (!dryRun) tx.delete(document.ref);
            }
          } else if (collection.endsWith("Chats") || collection === "chats") {
            if (!Array.isArray(data.messages)) {
              if (collection !== "chats") counts.reviewRequired++;
              return;
            }
            const retained = expiredMessages(data.messages, now);
            const removed = data.messages.length - retained.length;
            counts.messagesRemoved += removed;
            if (removed && !dryRun) tx.update(document.ref, {messages: retained,
              retentionProcessedAt: FieldValue.serverTimestamp()});
            if (retained.some(message => millis(message.createdAt ?? message.timestamp ?? message.sentAt) === null)) counts.reviewRequired++;
          } else {
            const action = bookingAction(data, now);
            if (action === "REVIEW") {
              counts.reviewRequired++;
              if (!dryRun) tx.set(db.collection("privacyRetentionReviews").doc(`${collection}_${document.id}`),
                {recordPath: document.ref.path, reason: "MISSING_LIFECYCLE_DATE", status: "PENDING", updatedAt: FieldValue.serverTimestamp()});
            }
            if (action === "DELETE") {
              // Child records/attachments need explicit cleanup; do not leave orphaned data.
              const children = await document.ref.listCollections();
              if (children.length) {counts.reviewRequired++; return;}
              counts.deleted++;
              if (!dryRun) tx.delete(document.ref);
            }
            if (action === "LOCATION" && ["car_bookings", "self_driving_bookings", "vanBookings"].includes(collection)) {
              const update: Record<string, unknown> = {};
              for (const field of LOCATION_FIELDS) if (field in data) update[field] = FieldValue.delete();
              if (Object.keys(update).length) {
                counts.locationsRemoved++;
                if (!dryRun) tx.update(document.ref, {...update, locationErasedAt: FieldValue.serverTimestamp()});
              }
            }
          }
        });
      } catch {
        counts.failures++;
        if (!dryRun && collection === "DeletionRequests") {
          await db.collection("privacyRetentionFailures").doc(document.id).set({requestId: document.id,
            status: "RETRY_REQUIRED", updatedAt: FieldValue.serverTimestamp()}, {merge: true});
        }
      }
    }
    if (!dryRun) await stateRef.set({cursor: page.size === 100 ? page.docs[page.size - 1].id : null,
      updatedAt: FieldValue.serverTimestamp()});
  }
  const result = {policyVersion: POLICY_VERSION, dryRun, ...counts,
    remainingScope: ["partner documents/offboarding dates", "legacy chat schemas and uploads",
      "external analytics anonymization/retention", "exports", "backups", "records missing lifecycle dates"]};
  await db.collection("privacyRetentionRuns").add({...result, createdAt: FieldValue.serverTimestamp()});
  return result;
}
export const previewPrivacyRetention = onCall({region: "asia-east2"}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  await requireSuperAdmin(request.auth.uid, request.auth.token);
  return maintainRetention(true);
});
export const runPrivacyRetention = onSchedule({region: "asia-east2", schedule: "every day 03:00",
  timeZone: "Asia/Bangkok", timeoutSeconds: 540, memory: "512MiB", maxInstances: 1}, async () => {
  await maintainRetention(false);
});
