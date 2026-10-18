import {createHash} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";

export const bookingCollections: Record<string, string> = {
  hotel: "hotelBookingData",
  sightseeing: "travelBookingDetails",
  car: "car_bookings",
  selfDrive: "self_driving_bookings",
};
export const ownerFields = ["authUid", "userId", "uId", "uid"];
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export function id(value: unknown, label = "ID"): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(value)) {
    throw new HttpsError("invalid-argument", `Invalid ${label}.`);
  }
  return value;
}
export function text(value: unknown, max = 4000): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > max)
    throw new HttpsError(
      "invalid-argument",
      `Text exceeds ${max} characters or has an invalid type.`,
    );
  return value.trim();
}
export function ownsBooking(data: Record<string, any>, uid: string): boolean {
  // authUid is authoritative when present; never grant access through provider IDs.
  if (typeof data.authUid === "string" && data.authUid) return data.authUid === uid;
  if (typeof data.userId === "string" && data.userId) return data.userId === uid;
  return [data.uId, data.uid].includes(uid);
}
export function words(value: string): string[] {
  return (
    value
      .normalize("NFKC")
      .toLowerCase()
      .match(/[\p{L}\p{M}\p{N}_-]+/gu) || []
  );
}
export function searchTerms(value: string): string[] {
  // Prefix matching, capped to bound index size. Not a fuzzy/substring search engine.
  const terms = new Set<string>();
  for (const word of words(value)) {
    for (let n = 2; n <= Math.min(word.length, 48); n++) terms.add(word.slice(0, n));
    if (terms.size >= 1200) break;
  }
  return [...terms].slice(0, 1200);
}
export function extractLinks(value: string): string[] {
  const links = new Set<string>();
  for (const match of value.match(/https?:\/\/[^\s<>"']+/gi) || []) {
    try {
      const url = new URL(match.replace(/[),.;!?]+$/, ""));
      if (!url.username && !url.password && url.href.length <= 2000) links.add(url.href);
    } catch {
      /* Invalid links stay plain text. */
    }
    if (links.size >= 10) break;
  }
  return [...links];
}
export function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function validatedFile(
  encoded: unknown,
  mime: unknown,
): {bytes: Buffer; contentType: string; category: string} {
  if (
    typeof encoded !== "string" ||
    !encoded.length ||
    encoded.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)
  )
    throw new HttpsError("invalid-argument", "Use a supported attachment up to 8 MiB.");
  const bytes = Buffer.from(encoded, "base64");
  const contentType = String(mime || "")
    .toLowerCase()
    .split(";")[0]
    .trim();
  const starts = (hex: string) => bytes.subarray(0, hex.length / 2).toString("hex") === hex;
  const ascii = (start: number, end: number) => bytes.subarray(start, end).toString("ascii");
  const valid =
    (contentType === "image/jpeg" && starts("ffd8ff")) ||
    (contentType === "image/png" && starts("89504e470d0a1a0a")) ||
    (contentType === "image/gif" && ["GIF87a", "GIF89a"].includes(ascii(0, 6))) ||
    (contentType === "image/webp" && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") ||
    (contentType === "application/pdf" && ascii(0, 5) === "%PDF-") ||
    (["audio/webm", "video/webm"].includes(contentType) && starts("1a45dfa3")) ||
    (contentType === "audio/ogg" && ascii(0, 4) === "OggS") ||
    (contentType === "audio/mpeg" &&
      (ascii(0, 3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 224) === 224))) ||
    (["video/mp4", "audio/mp4"].includes(contentType) && ascii(4, 8) === "ftyp");
  if (!valid || bytes.length > MAX_FILE_BYTES || !bytes.length)
    throw new HttpsError(
      "invalid-argument",
      "File content does not match a supported image, PDF, audio or video format (8 MiB maximum).",
    );
  return {bytes, contentType, category: contentType === "application/pdf" ? "documents" : "media"};
}
