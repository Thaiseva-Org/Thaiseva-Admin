const NOTE_FIELD_KEYS = [
  "specialNotes",
  "specialNote",
  "specialRequests",
  "specialRequest",
  "customerNotes",
  "customerNote",
  "bookingNotes",
  "bookingNote",
  "instructions",
  "remarks",
  "remark",
  "notes",
  "note",
];

const isMeaningfulNote = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(isMeaningfulNote);
  if (typeof value === "object") return Object.values(value).some(isMeaningfulNote);
  return true;
};

const formatNoteValue = (value) => {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.filter(isMeaningfulNote).map(formatNoteValue).join(", ");
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value)
      .filter(([, nestedValue]) => isMeaningfulNote(nestedValue))
      .map(([key, nestedValue]) => `${key}: ${formatNoteValue(nestedValue)}`)
      .join(", ");
  }
  return String(value);
};

export const getBookingSpecialNotes = (booking = {}) => {
  for (const key of NOTE_FIELD_KEYS) {
    if (isMeaningfulNote(booking[key])) {
      return formatNoteValue(booking[key]);
    }
  }

  for (const nested of [booking.guestDetails, booking.customerDetails, booking.bookingDetails]) {
    if (!nested) continue;
    for (const key of NOTE_FIELD_KEYS) {
      if (isMeaningfulNote(nested[key])) {
        return formatNoteValue(nested[key]);
      }
    }
  }

  return "";
};
