import { randomUUID } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import {
  onCall,
  HttpsError,
  CallableRequest,
} from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import {
  checkOtp,
  digest,
  generateOtp,
  normalizeEmail,
  OtpError,
  OtpState,
  POLICY,
  RateState,
  reserveOtp,
  takeRate,
} from "./otp/core";
import { MailConfig, sendZohoOtp, validateMailConfig } from "./otp/zoho";

const zohoKey = defineSecret("ZOHO_MAIL_API_KEY");
const hashKey = defineSecret("OTP_HASH_KEY");
const apiUrl = defineString("ZOHO_MAIL_API_URL", {
  default: "https://api.zeptomail.com/v1.1/email",
});
const from = defineString("OTP_FROM_EMAIL", { default: "" });
const senderName = defineString("OTP_SENDER_NAME", { default: "Thaiseva" });
const businessDomain = defineString("OTP_BUSINESS_DOMAIN", { default: "" });
const replyTo = defineString("OTP_REPLY_TO_EMAIL", { default: "" });

const options = {
  region: "asia-east2",
  secrets: [zohoKey, hashKey],
  enforceAppCheck: process.env.OTP_ENFORCE_APP_CHECK !== "false",
  timeoutSeconds: 60,
  maxInstances: 10,
};

function secret(): string {
  const key = hashKey.value();
  if (key.length < 32) {
    throw new HttpsError(
      "failed-precondition",
      "OTP security configuration is incomplete."
    );
  }
  return key;
}

function config(): MailConfig {
  const value = {
    apiKey: zohoKey.value(),
    apiUrl: apiUrl.value(),
    from: from.value(),
    senderName: senderName.value(),
    businessDomain: businessDomain.value(),
    replyTo: replyTo.value(),
  };
  try {
    validateMailConfig(value);
  } catch {
    throw new HttpsError(
      "failed-precondition",
      "Email delivery configuration is incomplete."
    );
  }
  return value;
}

function convert(error: unknown): never {
  if (error instanceof HttpsError) throw error;
  if (error instanceof OtpError) {
    throw new HttpsError(
      error.code,
      error.message,
      error.retryAfterSeconds ?
        { retryAfterSeconds: error.retryAfterSeconds } :
        undefined
    );
  }
  logger.error("Email OTP operation failed", {
    type: error instanceof Error ? error.name : "unknown",
  });
  throw new HttpsError(
    "internal",
    "Unable to process this request. Please try again later."
  );
}

function input(request: CallableRequest): Record<string, unknown> {
  if (
    !request.data ||
    typeof request.data !== "object" ||
    Array.isArray(request.data)
  ) {
    throw new HttpsError("invalid-argument", "Provide an email address.");
  }
  return request.data;
}

async function rateLimit(
  request: CallableRequest,
  key: string,
  action: "send" | "verify"
): Promise<void> {
  const db = getFirestore();
  // Use the runtime IP, never an IP supplied in the request body.
  const ip =
    request.rawRequest.ip ||
    request.rawRequest.socket.remoteAddress ||
    "unknown";
  const ref = db.collection("emailOtpRateLimits").doc(digest(key, action, ip));
  const globalRef = db.collection("emailOtpRateLimits").doc(`global-${action}`);
  await db.runTransaction(async (tx) => {
    const [snapshot, global] = await Promise.all([
      tx.get(ref),
      tx.get(globalRef),
    ]);
    const now = Date.now();
    const next = takeRate(
      snapshot.data() as RateState | undefined,
      now,
      action === "send" ? 20 : 50
    );
    const total = takeRate(
      global.data() as RateState | undefined,
      now,
      action === "send" ? 500 : 2000
    );
    const deleteAfter = Timestamp.fromMillis(now + 24 * 60 * 60_000);
    tx.set(ref, { ...next, deleteAfter });
    tx.set(globalRef, { ...total, deleteAfter });
  });
}

async function eligibleUser(email: string): Promise<string | null> {
  try {
    const user = await getAuth().getUserByEmail(email);
    if (user.disabled) return null;
    const profile = await getFirestore()
      .collection("users")
      .doc(user.uid)
      .get();
    const data = profile.data();
    if (
      !data ||
      !["Admin", "Sub Admin", "Partner"].includes(data.role) ||
      data.isSuspended === true ||
      ["Suspended", "Blocked", "Deleted", "Rejected"].includes(data.status)
    ) {
      return null;
    }
    return user.uid;
  } catch (error) {
    if ((error as { code?: string }).code === "auth/user-not-found") {
      return null;
    }
    throw error;
  }
}

async function issue(request: CallableRequest, resend: boolean) {
  try {
    const data = input(request);
    const email = normalizeEmail(data.email);
    if (
      resend &&
      (typeof data.challengeId !== "string" || data.challengeId.length > 100)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Provide the previous challenge ID."
      );
    }
    const mail = config();
    const key = secret();
    await rateLimit(request, key, "send");
    const uid = await eligibleUser(email);
    const challengeId = randomUUID();
    const code = generateOtp();
    const ref = getFirestore()
      .collection("emailOtpChallenges")
      .doc(digest(key, "email", email));
    const state = await getFirestore().runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const previous = snapshot.data() as OtpState | undefined;
      if (resend && (!previous || previous.challengeId !== data.challengeId)) {
        throw new HttpsError(
          "unauthenticated",
          "Request a new code to continue."
        );
      }
      const now = Date.now();
      const next = reserveOtp(
        previous,
        {
          challengeId,
          uid,
          hash: digest(key, "login", email, challengeId, code),
        },
        now
      );
      tx.set(ref, {
        ...next,
        deleteAfter: Timestamp.fromMillis(now + 24 * 60 * 60_000),
      });
      return next;
    });
    try {
      // Unknown accounts get the same response and limits, without an email.
      if (uid) await sendZohoOtp(mail, email, code, challengeId);
      await getFirestore().runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (current.data()?.challengeId === challengeId) {
          tx.update(ref, { status: "sent" });
        }
      });
    } catch {
      await getFirestore().runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (current.data()?.challengeId === challengeId) {
          tx.update(ref, { status: "failed", hash: "" });
        }
      });
      logger.warn("Zoho OTP delivery failed", { challengeId });
      throw new HttpsError(
        "unavailable",
        "Email could not be sent. Please wait and try again."
      );
    }
    return {
      challengeId,
      expiresAt: state.expiresAt,
      resendAt: state.sentAt + POLICY.cooldownMs,
      message:
        "If this email belongs to an eligible account, " +
        "a sign-in code has been sent.",
    };
  } catch (error) {
    return convert(error);
  }
}

export const sendEmailOtp = onCall(options, (request) => issue(request, false));
export const resendEmailOtp = onCall(options, (request) =>
  issue(request, true)
);

export const verifyEmailOtp = onCall(options, async (request) => {
  try {
    const data = input(request);
    const email = normalizeEmail(data.email);
    if (
      typeof data.code !== "string" ||
      !/^\d{6}$/.test(data.code) ||
      typeof data.challengeId !== "string" ||
      data.challengeId.length > 100
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Enter the six-digit code and challenge ID."
      );
    }
    const key = secret();
    await rateLimit(request, key, "verify");
    const challengeId = data.challengeId;
    const hash = digest(key, "login", email, challengeId, data.code);
    const ref = getFirestore()
      .collection("emailOtpChallenges")
      .doc(digest(key, "email", email));
    const result = await getFirestore().runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const outcome = checkOtp(
        snapshot.data() as OtpState | undefined,
        challengeId,
        hash,
        Date.now()
      );
      if (outcome.state) tx.update(ref, { ...outcome.state });
      return outcome;
    });
    if (result.error) throw result.error;
    // Recheck eligibility to catch suspension or email changes.
    const uid = await eligibleUser(email);
    if (!uid || uid !== result.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Unable to sign in to this account."
      );
    }
    const customToken = await getAuth().createCustomToken(uid);
    return { customToken };
  } catch (error) {
    return convert(error);
  }
});
