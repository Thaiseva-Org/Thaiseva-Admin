import * as admin from "firebase-admin";
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import {millis} from "./retentionPolicy";

const status = (data: Record<string, any>) => String(data.bookingStatus || data.status || "").toLowerCase();

export async function recordLifecycleTransition(
  reference: admin.firestore.DocumentReference,
  before: Record<string, any>, after: Record<string, any>, committedAt: admin.firestore.Timestamp,
): Promise<void> {
  const outcome = status(after);
  if (status(before) === outcome) return;
  const field = ["completed", "done"].includes(outcome) ? "completedAt" :
    ["cancelled", "canceled"].includes(outcome) ? "cancelledAt" : outcome === "rejected" ? "rejectedAt" : null;
  if (!field) return;
  const eventTime = millis(committedAt);
  if (eventTime === null) throw new Error("A server commit timestamp is required.");
  await admin.firestore().runTransaction(async tx => {
    const current = await tx.get(reference);
    const data = current.data();
    // Ignore obsolete events and duplicate retries. Never infer historical dates.
    if (!data || status(data) !== outcome || (millis(data[field]) || 0) >= eventTime) return;
    tx.update(reference, {[field]: committedAt});
  });
}

export const recordHotelPrivacyLifecycle = onDocumentUpdated({
  document: "hotelBookingData/{bookingId}", region: "asia-east2", retry: true,
}, async event => {
  if (!event.data) return;
  await recordLifecycleTransition(event.data.after.ref, event.data.before.data(),
    event.data.after.data(), event.data.after.updateTime);
});
