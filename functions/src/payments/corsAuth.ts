/**
 * Shared CORS + Firebase Bearer auth for public booking HTTPS endpoints.
 */
import * as path from "path";
import * as admin from "firebase-admin";
import * as dotenv from "dotenv";
import * as logger from "firebase-functions/logger";

dotenv.config();
dotenv.config({path: path.join(__dirname, "../../.env")});

export const REGION = "asia-east2";

export type Data = Record<string, unknown>;

export type AuthUser = {
  uid: string;
  email?: string;
  token: admin.auth.DecodedIdToken;
};

const allowedWebsiteOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://thaiseva.com",
  "https://www.thaiseva.com",
  "https://thaiseva-85cda.web.app",
  "https://thaiseva-85cda.firebaseapp.com",
  "https://thaiseva-demo.web.app",
  "https://thaiseva-demo.firebaseapp.com",
  "https://gothai-ffea1.web.app",
  "https://gothai-ffea1.firebaseapp.com",
];

export const stringValue = (v: unknown, max = 500) =>
  String(v ?? "")
    .trim()
    .slice(0, max);

export const parsePositiveInt = (v: unknown, fallback = 0) => {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
};

export const parseNumber = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const parseBool = (v: unknown) =>
  v === true || v === "true" || v === 1 || v === "1";

export const normalizeEmail = (v: unknown) => stringValue(v, 200).toLowerCase();

export const applyWebsiteCors = (
  req: {headers: Record<string, unknown>},
  res: {
    set: (k: string, v: string) => void;
  },
) => {
  const origin = stringValue(req.headers.origin);
  const allowed =
    !origin ||
    allowedWebsiteOrigins.includes(origin) ||
    origin.endsWith(".web.app") ||
    origin.endsWith(".firebaseapp.com") ||
    origin.endsWith(".vercel.app") ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:");
  if (allowed) {
    res.set("Access-Control-Allow-Origin", origin || "*");
    res.set("Vary", "Origin");
  }
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  res.set("Access-Control-Max-Age", "3600");
};

/**
 * Strict allowlist for Stripe success/cancel redirects.
 * Do NOT allow arbitrary *.vercel.app / *.web.app (open-redirect / phishing after pay).
 */
export const isAllowedRedirectUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    const u = new URL(url);
    // Production redirects must be HTTPS; localhost HTTP only for dev
    const host = u.hostname.toLowerCase();
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]";
    if (isLocal) {
      return u.protocol === "http:" || u.protocol === "https:";
    }
    if (u.protocol !== "https:") return false;

    const origin = u.origin;
    if (allowedWebsiteOrigins.includes(origin)) return true;

    // Only known Firebase Hosting project suffixes (not every *.web.app on the internet)
    const knownHosting = [
      "thaiseva-85cda.web.app",
      "thaiseva-85cda.firebaseapp.com",
      "thaiseva-demo.web.app",
      "thaiseva-demo.firebaseapp.com",
      "gothai-ffea1.web.app",
      "gothai-ffea1.firebaseapp.com",
      "gothai-admin.web.app",
      "gothai-admin.firebaseapp.com",
    ];
    if (knownHosting.includes(host)) return true;
    if (host === "thaiseva.com" || host === "www.thaiseva.com") return true;

    return false;
  } catch {
    return false;
  }
};

/** Parse JSON body or Firebase callable envelope { data: {...} }. */
export const parseRequestBody = (req: {
  method?: string;
  body?: unknown;
  query?: unknown;
}): Data => {
  if (req.method === "GET") {
    return (req.query || {}) as Data;
  }
  const raw = (req.body || {}) as Data;
  if (raw && typeof raw === "object" && raw.data && typeof raw.data === "object") {
    return raw.data as Data;
  }
  return raw;
};

export const getBearerToken = (req: {
  headers: Record<string, unknown>;
}): string | null => {
  const auth = stringValue(
    req.headers.authorization || req.headers.Authorization,
    4096,
  );
  if (!auth) return null;
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m ? m[1].trim() : null;
};

export class HttpError extends Error {
  statusCode: number;
  reasonCode: string | null;
  details?: Data;

  constructor(
    statusCode: number,
    message: string,
    reasonCode: string | null = null,
    details?: Data,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.reasonCode = reasonCode;
    this.details = details;
  }
}

export const requireAuth = async (req: {
  headers: Record<string, unknown>;
}): Promise<AuthUser> => {
  const token = getBearerToken(req);
  if (!token) {
    throw new HttpError(
      401,
      "Authentication is required. Send Authorization: Bearer <Firebase ID token>.",
      "UNAUTHENTICATED",
    );
  }
  try {
    const decoded = await admin.auth().verifyIdToken(token, true);
    const profile = await admin.firestore().doc(`users/${decoded.uid}`).get();
    if (profile.data()?.isSuspended === true) throw new Error("Account suspended");
    return {
      uid: decoded.uid,
      email: decoded.email,
      token: decoded,
    };
  } catch {
    throw new HttpError(401, "Invalid or expired auth token.", "UNAUTHENTICATED");
  }
};

export const assertUserMatch = (auth: AuthUser, bodyUserId: unknown) => {
  const userId = stringValue(bodyUserId, 128) || auth.uid;
  if (userId !== auth.uid) {
    throw new HttpError(
      403,
      "userId must match the signed-in user.",
      "USER_MISMATCH",
    );
  }
  return userId;
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const rateBuckets = new Map<string, {count: number; resetAt: number}>();

export const clientIp = (req: {
  headers: Record<string, unknown>;
  ip?: string;
}) => {
  const xf = stringValue(
    req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"],
  );
  if (xf) return xf.split(",")[0].trim().slice(0, 80);
  return stringValue(req.ip || "unknown", 80) || "unknown";
};

export const allowRate = (key: string, max = RATE_MAX) => {
  const now = Date.now();
  const cur = rateBuckets.get(key);
  if (!cur || now >= cur.resetAt) {
    rateBuckets.set(key, {count: 1, resetAt: now + RATE_WINDOW_MS});
    if (rateBuckets.size > 5000) {
      for (const [k, v] of rateBuckets) {
        if (now >= v.resetAt) rateBuckets.delete(k);
      }
    }
    return true;
  }
  if (cur.count >= max) return false;
  cur.count += 1;
  return true;
};

export const httpsOpts = {
  region: REGION,
  secrets: ["STRIPE_SECRET_KEY"],
  cors: false as const,
  invoker: "public" as const,
};

type ResLike = {
  set: (k: string, v: string) => void;
  status: (n: number) => {end: () => void; json: (b: unknown) => void};
};

type ReqLike = {
  method?: string;
  headers: Record<string, unknown>;
  body?: unknown;
  query?: unknown;
  ip?: string;
  rawBody?: Buffer;
};

/**
 * Standard POST handler wrapper: CORS, OPTIONS, rate limit, JSON errors.
 */
export const withBookingHttp = (
  handler: (ctx: {
    req: ReqLike;
    res: ResLike;
    body: Data;
    auth: AuthUser;
  }) => Promise<void>,
  opts?: {requireAuth?: boolean; rateMax?: number},
) => {
  const needAuth = opts?.requireAuth !== false;
  const rateMax = opts?.rateMax ?? RATE_MAX;

  return async (req: ReqLike, res: ResLike) => {
    applyWebsiteCors(req, res);

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({success: false, error: "Method Not Allowed"});
      return;
    }

    const ip = clientIp(req);
    if (!allowRate(ip, rateMax)) {
      res.set("Retry-After", "60");
      res.status(429).json({
        success: false,
        error: "Too many requests. Please wait a moment.",
        reasonCode: "RATE_LIMITED",
      });
      return;
    }

    try {
      const body = parseRequestBody(req);
      let auth: AuthUser;
      if (needAuth) {
        auth = await requireAuth(req);
      } else {
        auth = {uid: "", token: {} as admin.auth.DecodedIdToken};
      }
      await handler({req, res, body, auth});
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          reasonCode: error.reasonCode,
          ...(error.details || {}),
        });
        return;
      }
      const msg =
        error instanceof Error ? error.message : "Internal server error";
      // HttpsError from hotel cores
      const he = error as {code?: string; message?: string; httpErrorCode?: {status?: number}};
      if (he?.code && typeof he.code === "string" && he.message) {
        const status =
          he.code === "unauthenticated" ? 401 :
            he.code === "permission-denied" ? 403 :
              he.code === "not-found" ? 404 :
                he.code === "invalid-argument" ? 400 :
                  he.code === "failed-precondition" ? 400 :
                    he.code === "deadline-exceeded" ? 408 :
                      500;
        res.status(status).json({
          success: false,
          error: he.message,
          reasonCode: he.code.toUpperCase().replace(/-/g, "_"),
        });
        return;
      }
      logger.error("[bookingHttp]", error);
      // Do not leak internal Stripe/key messages
      const safe =
        msg.includes("STRIPE_SECRET") || msg.includes("not configured") ?
          "Payment service is not configured." :
          msg.includes("Internal") ?
            "Internal server error" :
            msg.slice(0, 300);
      res.status(500).json({
        success: false,
        error: safe,
        reasonCode: "INTERNAL",
      });
    }
  };
};
