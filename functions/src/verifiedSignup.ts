import { randomUUID } from "node:crypto";
import { Auth, getAuth } from "firebase-admin/auth";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import {
  CallableRequest, HttpsError, onCall,
} from "firebase-functions/v2/https";
import { digest, normalizeEmail, OtpError } from "./otp/core";

const hashKey = defineSecret("OTP_HASH_KEY");

export function createVerifiedSignupHandler({
  db, auth, getHashKey, now = Date.now,
}: {
  db: Firestore;
  auth: Pick<Auth, "createUser" | "getUserByEmail">;
  getHashKey: () => string;
  now?: () => number;
}) {
  return async (request: CallableRequest) => {
    const {email: rawEmail, password, verificationToken} = request.data || {};
    let email: string;
    try {
      email = normalizeEmail(rawEmail);
    } catch (error) {
      if (error instanceof OtpError) {
        throw new HttpsError("invalid-argument", error.message);
      }
      throw error;
    }
    if (typeof password !== "string" || password.length < 6 ||
        password.length > 4096 || typeof verificationToken !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(verificationToken)) {
      throw new HttpsError("invalid-argument",
        "Provide a valid email, password and verification proof.");
    }
    const key = getHashKey();
    if (key.length < 32) {
      throw new HttpsError("failed-precondition",
        "Email verification is not configured.");
    }
    const ref = db.collection("emailOtpVerificationProofs")
      .doc(digest(key, "signup-proof", verificationToken));
    const emailHash = digest(key, "signup-email", email);
    const proposedUid = `email-signup-${randomUUID()}`;
    // Auth and Firestore cannot share a transaction. Claim a stable UID so
    // retries can finish the same account without creating another one.
    const uid = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const proof = snapshot.data();
      if (!proof || proof.emailHash !== emailHash ||
          !(proof.expiresAt > now())) {
        throw new HttpsError("unauthenticated",
          "Email verification has expired. Request a new code.");
      }
      if (proof.consumedBy === null) {
        transaction.update(ref, {consumedBy: proposedUid});
        return proposedUid;
      }
      if (typeof proof.consumedBy === "string" &&
          /^email-signup-[0-9a-f-]{36}$/.test(proof.consumedBy)) {
        return proof.consumedBy;
      }
      throw new HttpsError("unauthenticated",
        "Email verification has already been used.");
    });
    try {
      await auth.createUser({uid, email, password, emailVerified: true});
    } catch (error) {
      const code = (error as {code?: string}).code;
      if (code === "auth/uid-already-exists" ||
          code === "auth/email-already-exists") {
        const existing = await auth.getUserByEmail(email);
        if (existing.uid !== uid || !existing.emailVerified) {
          throw new HttpsError("already-exists",
            "This email already has an account. Please sign in.");
        }
      } else {
        throw new HttpsError("internal",
          "Could not create the account. Please try again.");
      }
    }
    // The client signs in with its password; a proof grants no login token.
    return {created: true};
  };
}

export const createVerifiedAccount = onCall({
  region: "asia-east2",
  cors: true,
  invoker: "public",
  enforceAppCheck: true,
  secrets: [hashKey],
  timeoutSeconds: 60,
  maxInstances: 10,
}, (request) => createVerifiedSignupHandler({
  db: getFirestore(),
  auth: getAuth(),
  getHashKey: () => hashKey.value(),
})(request));
