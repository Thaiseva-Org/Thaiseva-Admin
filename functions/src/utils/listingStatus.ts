export function isListingActive(record: Record<string, unknown> = {}): boolean {
  if (typeof record.isActive === "boolean") return record.isActive;
  const hotel = (record.hotel || {}) as Record<string, unknown>;
  if (typeof hotel.isActive === "boolean") return hotel.isActive;
  return String(record.status || hotel.status || "").toLowerCase() !== "inactive";
}
