import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";

export function safeExportText(value: unknown): string {
  const text = String(value ?? "");
  // Customer-provided CSV values must remain text when opened in a spreadsheet.
  return /^[\t\r\n]|^\s*[=+\-@]/.test(text) ? "'" + text : text;
}

export function assertRecentSignIn(token: Record<string, unknown>, now = Date.now()): void {
  const age = now / 1000 - Number(token.auth_time || 0);
  if (!Number.isFinite(age) || age < -60 || age > 300) {
    throw new HttpsError("failed-precondition", "Please sign in again before this action.");
  }
}

export async function requireSuperAdmin(uid: string, token: Record<string, unknown>): Promise<void> {
  const profile = await admin.firestore().doc(`users/${uid}`).get();
  const role = profile.data()?.role;
  const account = await admin.auth().getUser(uid);
  if (account.disabled || profile.data()?.isSuspended === true ||
      Number(token.auth_time || 0) * 1000 < Date.parse(account.tokensValidAfterTime || "1970-01-01")) {
    throw new HttpsError("permission-denied", "This account is inactive. Sign in again.");
  }
  // Sub-admins do not provision administrators or export customer databases.
  if (account.customClaims?.admin !== true && !["Admin", "admin"].includes(role)) {
    throw new HttpsError("permission-denied", "Super administrator access required.");
  }
  assertRecentSignIn(token);
}

export const createSubAdmin = onCall({region: "asia-east2"}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Please sign in.");
  await requireSuperAdmin(request.auth.uid, request.auth.token);
  const {email, password, displayName, photoURL} = request.data || {};
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== "string" || password.length < 12 || password.length > 128 ||
      typeof displayName !== "string" || !displayName.trim() || displayName.length > 100 ||
      typeof photoURL !== "string" || !/^https:\/\//.test(photoURL) || photoURL.length > 2048) {
    throw new HttpsError("invalid-argument", "Provide a name, valid email/photo, and a password of 12–128 characters.");
  }
  let uid: string | undefined;
  try {
    const account = await admin.auth().createUser({email: email.trim().toLowerCase(), password, displayName: displayName.trim(), photoURL});
    uid = account.uid;
    const batch = admin.firestore().batch();
    batch.create(admin.firestore().doc(`users/${uid}`), {
      uid, email: account.email, displayName: account.displayName, photoURL,
      role: "Admin", createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.create(admin.firestore().collection("auditLogs").doc(), {
      action: "CREATE_ADMIN", actorUid: request.auth.uid, targetUid: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();
    return {uid};
  } catch (error) {
    if (uid) await admin.auth().deleteUser(uid);
    if ((error as {code?: string}).code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "This email is already registered.");
    }
    throw new HttpsError("internal", "Could not create the staff account.");
  }
});

export const exportCustomerData = onCall({region: "asia-east2", timeoutSeconds: 120}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Please sign in.");
  await requireSuperAdmin(request.auth.uid, request.auth.token);
  const records: Record<string, unknown>[] = [];
  let cursor: admin.firestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let query = admin.firestore().collection("users").orderBy(admin.firestore.FieldPath.documentId()).limit(500);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    for (const document of snapshot.docs) {
      const data = document.data();
      if (["Admin", "admin", "Sub Admin"].includes(data.role)) continue;
      records.push({
        firstName: safeExportText(data.firstName || data.name || data.displayName || ""),
        phoneNo: safeExportText(data.phoneNo || data.phoneNumber || ""), email: safeExportText(data.email || ""),
        userLocation1: safeExportText(data.userLocation1 || data.address || ""), profilePic: safeExportText(data.profilePic || data.photoURL || ""),
        createdAt: data.createdAt && typeof data.createdAt.seconds === "number" ?
          {seconds: data.createdAt.seconds, nanoseconds: data.createdAt.nanoseconds || 0} : null,
      });
    }
    if (records.length > 10000) throw new HttpsError("resource-exhausted", "Export exceeds the safe limit; use a scoped export.");
    if (snapshot.size < 500) break;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }
  // Log before returning any personal data; a logging failure blocks the export.
  await admin.firestore().collection("auditLogs").add({
    action: "EXPORT_CUSTOMER_DATA", actorUid: request.auth.uid, recordCount: records.length,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return {records};
});
