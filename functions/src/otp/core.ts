import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const POLICY = {
  expiresMs: 5 * 60_000,
  cooldownMs: 60_000,
  windowMs: 15 * 60_000,
  maxSends: 5,
  maxAttempts: 5,
};

export class OtpError extends Error {
  constructor(
    public readonly code:
      | "invalid-argument"
      | "resource-exhausted"
      | "unauthenticated",
    message: string,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
  }
}

export function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new OtpError("invalid-argument", "Enter a valid email address.");
  }
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    throw new OtpError("invalid-argument", "Enter a valid email address.");
  }
  return email;
}

export const generateOtp = (): string =>
  randomInt(0, 1_000_000).toString().padStart(6, "0");

export function digest(secret: string, ...parts: string[]): string {
  return createHmac("sha256", secret)
    .update(JSON.stringify(parts))
    .digest("hex");
}

export interface OtpState {
  challengeId: string;
  hash: string;
  expiresAt: number;
  sentAt: number;
  windowStart: number;
  sends: number;
  attempts: number;
  lockedUntil: number;
  status: "pending" | "sent" | "failed" | "consumed";
}

export function reserveOtp(
  previous: OtpState | undefined,
  next: Pick<OtpState, "challengeId" | "hash">,
  now: number
): OtpState {
  if (previous && previous.lockedUntil > now) {
    throw new OtpError(
      "resource-exhausted",
      "Too many attempts. Try again later.",
      Math.ceil((previous.lockedUntil - now) / 1000)
    );
  }
  if (previous && previous.sentAt + POLICY.cooldownMs > now) {
    throw new OtpError(
      "resource-exhausted",
      "Please wait before requesting another code.",
      Math.ceil((previous.sentAt + POLICY.cooldownMs - now) / 1000)
    );
  }
  const sameWindow = previous && previous.windowStart + POLICY.windowMs > now;
  if (sameWindow && previous.sends >= POLICY.maxSends) {
    throw new OtpError(
      "resource-exhausted",
      "Too many requests. Try again later.",
      Math.ceil((previous.windowStart + POLICY.windowMs - now) / 1000)
    );
  }
  return {
    ...next,
    expiresAt: now + POLICY.expiresMs,
    sentAt: now,
    windowStart: sameWindow ? previous.windowStart : now,
    sends: sameWindow ? previous.sends + 1 : 1,
    attempts: sameWindow ? previous.attempts : 0,
    lockedUntil: 0,
    status: "pending",
  };
}

// Return the failed attempt state so callers commit it before throwing.
export function checkOtp(
  state: OtpState | undefined,
  challengeId: string,
  hash: string,
  now: number
): { state?: OtpState; valid?: boolean; error?: OtpError } {
  const invalid = new OtpError(
    "unauthenticated",
    "Invalid or expired code. Request a new code if needed."
  );
  if (
    !state ||
    state.lockedUntil > now ||
    state.status !== "sent" ||
    state.expiresAt <= now ||
    state.challengeId !== challengeId
  ) {
    return { error: invalid };
  }
  const matches =
    state.hash.length === hash.length &&
    timingSafeEqual(Buffer.from(state.hash, "hex"), Buffer.from(hash, "hex"));
  if (matches) {
    return {
      state: { ...state, hash: "", status: "consumed" },
      valid: true,
    };
  }
  const attempts = state.attempts + 1;
  return {
    state: {
      ...state,
      attempts,
      lockedUntil: attempts >= POLICY.maxAttempts ? now + POLICY.windowMs : 0,
    },
    error: invalid,
  };
}

export interface RateState {
  windowStart: number;
  count: number;
}
export function takeRate(
  previous: RateState | undefined,
  now: number,
  max: number
): RateState {
  const current =
    previous && previous.windowStart + POLICY.windowMs > now ?
      previous :
      { windowStart: now, count: 0 };
  if (current.count >= max) {
    throw new OtpError(
      "resource-exhausted",
      "Too many requests. Try again later.",
      Math.ceil((current.windowStart + POLICY.windowMs - now) / 1000)
    );
  }
  return { ...current, count: current.count + 1 };
}
