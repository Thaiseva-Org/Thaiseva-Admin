export type RetentionData = Record<string, any>;
export const POLICY_VERSION = "2026-10-13";
export function millis(value: any): number | null {
  let result: number;
  if (value && typeof value.toMillis === "function") result = value.toMillis();
  else if (value instanceof Date) result = value.getTime();
  else if (value && typeof value.seconds === "number") result = value.seconds * 1000;
  else if (typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value)) result = Date.parse(value);
  else return null;
  return Number.isFinite(result) && result > 0 ? result : null;
}
export function cutoff(now: Date, years = 0, days = 0): number {
  const date = new Date(now);
  date.setUTCFullYear(date.getUTCFullYear() - years);
  date.setUTCDate(date.getUTCDate() - days);
  return date.getTime();
}
export function held(data: RetentionData): boolean {
  return data.legalHold === true || data.retentionHold === true ||
    data.disputeOpen === true || data.chargebackOpen === true;
}
export function messageMillis(message: RetentionData): number | null {
  return millis(message.createdAt ?? message.timestamp ?? message.sentAt ?? message.date);
}
export function expiredMessages(messages: any[], now: Date): any[] {
  return messages.filter(message => {
    if (!message || typeof message !== "object" || held(message)) return true;
    const timestamp = messageMillis(message);
    return timestamp === null || timestamp > cutoff(now, 2);
  });
}
export function bookingAction(data: RetentionData, now: Date): "DELETE" | "LOCATION" | "KEEP" | "REVIEW" {
  if (held(data)) return "KEEP";
  const status = String(data.bookingStatus ?? data.status ?? "").toLowerCase();
  if (!["completed", "done", "cancelled", "canceled", "rejected"].includes(status)) return "KEEP";
  const created = millis(data.createdAt ?? data.timestamp ?? data.orderedAt);
  // Use the date for the current outcome, never an obsolete earlier outcome.
  const finished = ["completed", "done"].includes(status) ? millis(data.completedAt) :
    ["cancelled", "canceled"].includes(status) ? millis(data.cancelledAt ?? data.canceledAt) : millis(data.rejectedAt);
  if (created === null || finished === null) return "REVIEW";
  if (Math.max(created, finished) <= cutoff(now, 5)) return "DELETE";
  if (["completed", "done"].includes(status) && finished <= cutoff(now, 0, 90)) return "LOCATION";
  return "KEEP";
}
export const LOCATION_FIELDS = ["pickupLocation", "destination", "dropLocation", "pickup", "drop",
  "pickupLat", "pickupLng", "dropLat", "dropLng", "latitude", "longitude", "coordinates",
  "route", "locationHistory", "tripLocations", "liveLocation"];
