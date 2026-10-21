/**
 * Push in-app / website notifications for a customer.
 *
 * Writes to: notifications/users/{uid}/{autoId}
 * (same path the app & website already listen on)
 *
 * Fields include both `message` and `desc` for client compatibility.
 */
import {getFirestore, Timestamp, FieldValue} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

export type CustomerNotifyInput = {
  userId: string;
  title: string;
  message: string;
  /** e.g. hotel-booking | sightseeing-booking | transport-booking */
  type: string;
  bookingId?: string;
  bookingCollection?: string;
  /** Extra payload for clients */
  data?: Record<string, unknown>;
  /**
   * Idempotency key under customerNotificationEvents/{key}.
   * Prevents duplicate fan-out when triggers retry.
   */
  eventKey?: string;
};

const db = () => getFirestore();

export const resolveCustomerUid = (
  data: Record<string, unknown>,
): string => {
  for (const field of ["userId", "authUid", "uId", "uid", "customerId"]) {
    const v = data[field];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};

/**
 * Notify customer (app + website via Firestore inbox).
 * Safe to call multiple times with the same eventKey (deduped).
 */
export const notifyCustomer = async (
  input: CustomerNotifyInput,
): Promise<{ok: boolean; skipped?: boolean}> => {
  const uid = String(input.userId || "").trim();
  if (!uid) {
    logger.warn("[customerNotify] missing userId", {title: input.title});
    return {ok: false};
  }

  if (input.eventKey) {
    const eventRef = db().doc(`customerNotificationEvents/${input.eventKey}`);
    try {
      await eventRef.create({
        createdAt: Timestamp.now(),
        userId: uid,
        title: input.title,
        type: input.type,
      });
    } catch (error) {
      const code = (error as {code?: number | string}).code;
      if (code === 6 || code === "already-exists") {
        return {ok: true, skipped: true};
      }
      logger.warn("[customerNotify] event reserve failed", error);
    }
  }

  try {
    const payload: Record<string, unknown> = {
      title: input.title,
      // Both keys - mobile/web clients vary
      message: input.message,
      desc: input.message,
      type: input.type,
      bookingId: input.bookingId || null,
      bookingCollection: input.bookingCollection || null,
      read: false,
      isRead: false,
      timestamp: Timestamp.now(),
      createdAt: FieldValue.serverTimestamp(),
      ...(input.data || {}),
    };

    await db()
      .collection("notifications")
      .doc("users")
      .collection(uid)
      .add(payload);

    logger.info(
      `[customerNotify] uid=${uid} type=${input.type} title=${input.title}`,
    );

    if (input.eventKey) {
      await db()
        .doc(`customerNotificationEvents/${input.eventKey}`)
        .set({completedAt: Timestamp.now()}, {merge: true})
        .catch(() => undefined);
    }

    return {ok: true};
  } catch (error) {
    logger.error("[customerNotify] write failed", error);
    return {ok: false};
  }
};

export const moneyText = (data: Record<string, unknown>): string => {
  const n = Number(
    data.finalAmount ??
      data.AmountOffered ??
      data.amountTHB ??
      data.totalAmount ??
      data.price ??
      data.amount ??
      0,
  );
  if (!Number.isFinite(n) || n <= 0) return "";
  return `฿${Math.round(n).toLocaleString("en-US")}`;
};
