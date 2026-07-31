/** Normalize Firestore / JS date values to Date or null */

export const toDate = (value) => {
  if (!value) return null;

  if (value.seconds) {
    return new Date(
      value.seconds * 1000 + (value.nanoseconds || 0) / 1000000
    );
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

export const backfillCreatedAt = (booking = {}) =>
  booking.createdAt || booking.orderedAt || booking.timestamp || null;