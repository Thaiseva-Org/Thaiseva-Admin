type BookingData = Record<string, unknown>;

const MISSING_VALUES = new Set([
  "",
  "-",
  "n/a",
  "na",
  "not available",
  "not_present",
  "undefined",
  "null",
]);

export const icon = {
  accepted: "\u2705",
  amount: "\u{1F4B0}",
  booking: "\u{1F194}",
  calendar: "\u{1F4C5}",
  cancelled: "\u274C",
  customer: "\u{1F464}",
  hotel: "\u{1F3E8}",
  package: "\u{1F4E6}",
  phone: "\u{1F4DE}",
  route: "\u{1F4CD}",
  transport: "\u{1F697}",
  new: "\u{1F195}",
};

const isRecord = (value: unknown): value is BookingData => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const getPathValue = (data: BookingData, path: string): unknown => {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!isRecord(current)) return undefined;
    return current[key];
  }, data);
};

const cleanString = (value: string): string | null => {
  const cleaned = value.replace(/not_present/g, "").trim();
  if (MISSING_VALUES.has(cleaned.toLowerCase())) return null;
  return cleaned;
};

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (isRecord(value) && typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }

  if (isRecord(value) && typeof value.seconds === "number") {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

const formatDateObject = (date: Date): string => {
  const hasTime =
    date.getUTCHours() !== 0 ||
    date.getUTCMinutes() !== 0 ||
    date.getUTCSeconds() !== 0;

  const options: Intl.DateTimeFormatOptions = hasTime ?
    {
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      month: "short",
      timeZone: "Asia/Bangkok",
      year: "numeric",
    } :
    {
      day: "2-digit",
      month: "short",
      timeZone: "Asia/Bangkok",
      year: "numeric",
    };

  return new Intl.DateTimeFormat("en-GB", options).format(date);
};

export const formatValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;

  const date = toDate(value);
  if (date) return formatDateObject(date);

  if (typeof value === "string") {
    const cleaned = cleanString(value);
    if (!cleaned) return null;

    const parsedDate = new Date(cleaned);
    if (
      /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(cleaned) &&
      !Number.isNaN(parsedDate.getTime())
    ) {
      return formatDateObject(parsedDate);
    }

    return cleaned;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    const items = value.map(formatValue).filter(Boolean);
    return items.length ? items.join(", ") : null;
  }

  return null;
};

export const pick = (
  data: BookingData,
  paths: string[],
  fallback = "N/A",
): string => {
  for (const path of paths) {
    const formatted = formatValue(getPathValue(data, path));
    if (formatted) return formatted;
  }

  return fallback;
};

export const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

export const code = (value: string): string => {
  return `<code>${escapeHtml(value)}</code>`;
};

export const money = (data: BookingData, paths: string[]): string => {
  const amount = pick(data, paths, "N/A");
  if (amount === "N/A") return amount;
  return `\u0E3F${amount}`;
};

export const customerName = (data: BookingData): string => {
  return pick(data, [
    "customerName",
    "fullName",
    "guestDetails.name",
    "name",
    "firstName",
    "displayName",
  ], "Unknown Customer");
};

export const customerPhone = (data: BookingData): string => {
  return pick(data, [
    "guestPhone",
    "guestDetails.phoneNumber",
    "guestDetails.phone",
    "contact",
    "phone",
    "phoneNumber",
    "phoneNo",
  ], "N/A");
};

export const hotelName = (
  data: BookingData,
  fallback = "Unknown Hotel",
): string => {
  return pick(data, [
    "hotelName",
    "hotel.hotelName",
    "hotelInformation.hotelName",
    "hotel",
  ], fallback);
};

export const packageName = (
  data: BookingData,
  fallback = "Unknown Package",
): string => {
  return pick(data, [
    "title",
    "packageName",
    "selectedPackageName",
    "packageDetails.packageName",
    "roomName",
  ], fallback);
};
