/**
 * Customer app push (Thaiseva app, com.app.thaiseva / com.thaiseva.ios).
 *
 * Every customer alert is already written to notifications/users/{uid}
 * (booking triggers via customerNotify, food orders from the food portal),
 * so one trigger mirrors each new inbox document to the owner's phones and
 * the alert arrives even when the app is closed. Admin broadcasts (top-level
 * notifications/{id}) go to the CUSTOMER_TOPIC every registered device joins.
 *
 * Tokens live in customerDeviceTokens/{sha256(token)} = {uid, token, platform}.
 * Keying by token means one device belongs to one account: signing in with a
 * different account on the same phone moves the token instead of leaking the
 * previous owner's alerts. Clients never touch this collection (default deny).
 */
import {createHash} from "node:crypto";
import {
  DocumentData, FieldValue, Firestore, getFirestore, QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import {
  getMessaging, Messaging, MulticastMessage,
} from "firebase-admin/messaging";
import * as logger from "firebase-functions/logger";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {
  CallableRequest, HttpsError, onCall,
} from "firebase-functions/v2/https";

export const DEVICE_TOKENS_COLLECTION = "customerDeviceTokens";
export const CUSTOMER_TOPIC = "customers";
const MAX_TOKENS_PER_USER = 10;
// Must match NotificationService.channelKey in the customer app.
export const ANDROID_CHANNEL_ID = "high_importance_channel";
const PLATFORMS = new Set(["android", "ios"]);
// Path-only parents of the per-audience inboxes, never broadcasts.
const INBOX_PARENTS = new Set(["users", "restaurants", "admin", "foodRiders"]);
const STALE_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

type PushDeps = {
  db: Firestore;
  messaging: Pick<Messaging, "sendEachForMulticast" | "send" |
    "subscribeToTopic" | "unsubscribeFromTopic">;
};

const defaultDeps = (): PushDeps =>
  ({db: getFirestore(), messaging: getMessaging()});

export const cleanToken = (value: unknown): string => {
  const token = String(value || "").trim();
  if (token.length < 20 || token.length > 4096 ||
      !/^[A-Za-z0-9_:.-]+$/.test(token)) {
    throw new HttpsError("invalid-argument", "Invalid device token.");
  }
  return token;
};

export const tokenDocId = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const cleanPlatform = (value: unknown): string => {
  const platform = String(value || "").toLowerCase();
  return PLATFORMS.has(platform) ? platform : "android";
};

const requireUid = (request: CallableRequest): string => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  return uid;
};

const updatedMillis = (doc: QueryDocumentSnapshot): number =>
  doc.get("updatedAt")?.toMillis?.() || 0;

export const createRegisterHandler = (deps: () => PushDeps = defaultDeps) =>
  async (request: CallableRequest) => {
    const uid = requireUid(request);
    const token = cleanToken(request.data?.token);
    const {db, messaging} = deps();
    await db.collection(DEVICE_TOKENS_COLLECTION).doc(tokenDocId(token)).set({
      uid,
      token,
      platform: cleanPlatform(request.data?.platform),
      updatedAt: FieldValue.serverTimestamp(),
    });
    // Broadcasts reach every signed-in device through the topic.
    await messaging.subscribeToTopic([token], CUSTOMER_TOPIC).catch((error) =>
      logger.warn("[customerPush] topic subscribe failed", error));

    // Keep only the newest devices per user (reinstalls leave dead tokens).
    const snap = await db.collection(DEVICE_TOKENS_COLLECTION)
      .where("uid", "==", uid).get();
    if (snap.size > MAX_TOKENS_PER_USER) {
      const batch = db.batch();
      [...snap.docs].sort((a, b) => updatedMillis(b) - updatedMillis(a))
        .slice(MAX_TOKENS_PER_USER).forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
    return {registered: true};
  };

export const createUnregisterHandler = (deps: () => PushDeps = defaultDeps) =>
  async (request: CallableRequest) => {
    const uid = requireUid(request);
    const token = cleanToken(request.data?.token);
    const {db, messaging} = deps();
    const ref = db.collection(DEVICE_TOKENS_COLLECTION).doc(tokenDocId(token));
    const removed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.get("uid") !== uid) return false;
      tx.delete(ref);
      return true;
    });
    if (removed) {
      await messaging.unsubscribeFromTopic([token], CUSTOMER_TOPIC)
        .catch((error) =>
          logger.warn("[customerPush] topic unsubscribe failed", error));
    }
    return {unregistered: true};
  };

const text = (value: unknown, max: number): string =>
  String(value ?? "").slice(0, max);

// FCM payload for one inbox or broadcast notification document.
export const buildPushMessage = (
  notificationId: string, note: DocumentData,
) => {
  const title = text(note.title || "Thaiseva", 200);
  const body = text(note.desc || note.message || note.body, 1000);
  const imageUrl = /^https:\/\//.test(String(note.imageUrl || "")) ?
    String(note.imageUrl) : undefined;
  return {
    notification: {title, body, ...(imageUrl ? {imageUrl} : {})},
    // FCM data values must be strings; the app routes taps on these.
    data: {
      notificationId,
      type: text(note.type, 100),
      bookingId: text(note.bookingId, 200),
      bookingCollection: text(note.bookingCollection, 100),
    },
    android: {
      priority: "high" as const,
      notification: {channelId: ANDROID_CHANNEL_ID, tag: notificationId},
    },
    apns: {
      headers: {"apns-priority": "10"},
      payload: {aps: {sound: "default"}},
    },
  };
};

const isStaleTokenError = (error?: {code?: string}): boolean =>
  Boolean(error?.code && STALE_TOKEN_CODES.has(error.code));

// Trigger body: push a new inbox notification to the user's devices.
export const pushToCustomer = async (
  uid: string, notificationId: string, note: DocumentData | undefined,
  deps: PushDeps = defaultDeps(),
): Promise<{sent: number; removed?: number}> => {
  if (!uid || !note) return {sent: 0};
  const {db, messaging} = deps;
  const snap = await db.collection(DEVICE_TOKENS_COLLECTION)
    .where("uid", "==", uid).get();
  const docs = snap.docs.filter((doc) => typeof doc.get("token") === "string");
  if (!docs.length) return {sent: 0};

  const message: MulticastMessage = {
    ...buildPushMessage(notificationId, note),
    tokens: docs.map((doc) => doc.get("token")),
  };
  const response = await messaging.sendEachForMulticast(message);
  const stale = docs.filter((_, i) => {
    const result = response.responses[i];
    if (result.success) return false;
    if (isStaleTokenError(result.error)) return true;
    logger.warn("[customerPush] push failed",
      result.error?.code, result.error?.message);
    return false;
  });
  if (stale.length) {
    const batch = db.batch();
    stale.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  return {sent: response.successCount, removed: stale.length};
};

// Trigger body: push an admin broadcast to every customer device.
export const pushBroadcast = async (
  notificationId: string, note: DocumentData | undefined,
  deps: Pick<PushDeps, "messaging"> = defaultDeps(),
): Promise<{sent: boolean}> => {
  if (!note || INBOX_PARENTS.has(notificationId)) return {sent: false};
  await deps.messaging.send({
    ...buildPushMessage(notificationId, {type: "broadcast", ...note}),
    topic: CUSTOMER_TOPIC,
  });
  return {sent: true};
};

export const registerCustomerDevice = onCall(
  {region: "asia-east2", cors: true, invoker: "public", maxInstances: 20},
  createRegisterHandler(),
);

export const unregisterCustomerDevice = onCall(
  {region: "asia-east2", cors: true, invoker: "public", maxInstances: 20},
  createUnregisterHandler(),
);

// Firestore (default) lives in asia-east2; v2 triggers must share its region.
export const pushCustomerNotification = onDocumentCreated(
  {document: "notifications/users/{uid}/{notificationId}",
    region: "asia-east2"},
  async (event) => {
    const {uid, notificationId} = event.params;
    try {
      await pushToCustomer(uid, notificationId, event.data?.data());
    } catch (error) {
      logger.error("[customerPush] pushCustomerNotification failed", error);
    }
  },
);

export const pushBroadcastNotification = onDocumentCreated(
  {document: "notifications/{notificationId}", region: "asia-east2"},
  async (event) => {
    try {
      await pushBroadcast(event.params.notificationId, event.data?.data());
    } catch (error) {
      logger.error("[customerPush] pushBroadcastNotification failed", error);
    }
  },
);
