/**
 * Server-side sightseeing package pricing (never trust client totals).
 */
import * as admin from "firebase-admin";

const db = () => admin.firestore();

const parseNumber = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const loadSightseeingPackage = async (
  packageId: string,
): Promise<Record<string, unknown> | null> => {
  if (!packageId) return null;
  const direct = await db()
    .collection("sightseeingPackagesDetails")
    .doc(packageId)
    .get();
  if (direct.exists) {
    return {id: direct.id, ...(direct.data() || {})};
  }
  const byField = await db()
    .collection("sightseeingPackagesDetails")
    .where("packageId", "==", packageId)
    .limit(1)
    .get();
  if (!byField.empty) {
    const d = byField.docs[0];
    return {id: d.id, ...(d.data() || {})};
  }
  return null;
};

export const adultPriceOf = (pkg: Record<string, unknown>): number => {
  const ps = (pkg.pricingStructure || {}) as Record<string, unknown>;
  return Math.max(
    0,
    parseNumber(
      pkg.price ??
        pkg.startingPrice ??
        (pkg.pricing as Record<string, unknown>)?.adultPrice ??
        ((pkg.pricing as Record<string, unknown>)?.calculator_logic as Record<string, unknown>)?.pricePerAdult ??
        ps.pricePerAdult ??
        pkg.pricePerAdult ??
        pkg.adultPrice ??
        pkg.startingPrice ??
        pkg.price,
      0,
    ),
  );
};

export const childPriceOf = (
  pkg: Record<string, unknown>,
  adult: number,
): number => {
  const ps = (pkg.pricingStructure || {}) as Record<string, unknown>;
  const child = parseNumber(
    ((pkg.pricing as Record<string, unknown>)?.calculator_logic as Record<string, unknown>)?.pricePerChild ?? (pkg.pricing as Record<string, unknown>)?.childPrice ?? ps.pricePerChild ?? pkg.pricePerChild ?? pkg.childPrice,
    NaN,
  );
  if (Number.isFinite(child) && child > 0) return child;
  return adult > 0 ? adult * 0.5 : 0;
};

export const computePackageAmount = (
  pkg: Record<string, unknown>,
  adults: number,
  children: number,
  extraAdults = 0,
): number => {
  const a = adultPriceOf(pkg);
  const c = childPriceOf(pkg, a);
  const ad = Math.min(50, Math.max(1, adults || 1));
  const ch = Math.min(50, Math.max(0, children || 0));
  const subtotal = Math.round(a * ad) + Math.round(c * ch) + Math.round(a * 0.8 * extraAdults);
  const special = pkg.specialRates as Record<string, unknown>;
  const discount = parseNumber((pkg.pricing as Record<string, unknown>)?.discountPct ?? pkg.discount ?? pkg.discountPct ?? (special?.earlyBirdDiscount as Record<string, unknown>)?.discountPercent, 0);
  return Math.max(0, subtotal - (discount > 0 ? Math.round(subtotal * discount / 100) : 0));
};

/**
 * Trusted payable amount for an existing travel booking.
 * Recomputes from package catalog when possible.
 */
export const trustedSightseeingAmount = async (
  data: Record<string, unknown>,
): Promise<number | null> => {
  const packageId = String(data.packageId || data.dataid || "").trim();
  const adults = Math.min(50, Math.max(1, parseNumber(data.adults, 1)));
  const children = Math.min(50, Math.max(0, parseNumber(data.children, 0)));
  if (!packageId) return null;
  const pkg = await loadSightseeingPackage(packageId);
  if (!pkg) return null;
  const amount = computePackageAmount(pkg, adults, children, parseNumber(data.extraAdults, 0));
  return amount > 0 ? amount : null;
};
