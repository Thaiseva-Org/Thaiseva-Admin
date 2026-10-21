import * as admin from "firebase-admin";
import {onDocumentWritten} from "firebase-functions/v2/firestore";

// Intentionally omit identity/contact/account fields and all arbitrary URLs.
export function publicPartnerView(data: Record<string, unknown>): Record<string, string> {
  const view: Record<string, string> = {};
  for (const field of ["Registered Business", "City", "Country"]) {
    const value = data[field];
    if (typeof value === "string" && value.trim()) view[field] = value.trim().slice(0, 200);
  }
  return view;
}

export function publicConditionsView(data: Record<string, unknown>): {conditions: string | string[]} | null {
  // Only source records dedicated to public conditions qualify for publication.
  if (Object.keys(data).some(key => key !== "conditions")) return null;
  if (typeof data.conditions === "string") return {conditions: data.conditions};
  if (Array.isArray(data.conditions) && data.conditions.every(value => typeof value === "string")) {
    return {conditions: data.conditions};
  }
  return null;
}

export const syncPublicPartnerDirectory = onDocumentWritten({
  document: "T2T_world/{category}/Users/{partnerId}", region: "asia-east2",
}, async event => {
  const source = admin.firestore().doc(`T2T_world/${event.params.category}/Users/${event.params.partnerId}`);
  const target = admin.firestore().doc(`publicPartnerDirectory/${event.params.category}/partners/${event.params.partnerId}`);
  // Read the current source inside a transaction so delayed events cannot
  // republish an obsolete/deleted version or race a newer event.
  await admin.firestore().runTransaction(async tx => {
    const current = await tx.get(source);
    if (current.exists) tx.set(target, publicPartnerView(current.data() || {}));
    else tx.delete(target);
  });
});

export const syncPublicSelfDriveConditions = onDocumentWritten({
  document: "self_drive_conditions_and_documents/{documentId}", region: "asia-east2",
}, async event => {
  const source = admin.firestore().doc(`self_drive_conditions_and_documents/${event.params.documentId}`);
  const target = admin.firestore().doc(`publicSelfDriveConditions/${event.params.documentId}`);
  await admin.firestore().runTransaction(async tx => {
    const current = await tx.get(source);
    const view = current.exists ? publicConditionsView(current.data() || {}) : null;
    if (view) tx.set(target, view);
    else tx.delete(target);
  });
});
