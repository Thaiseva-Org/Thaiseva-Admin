/** Counts are per stay: at most one extra bed per requested room. */
export const requestedExtraBedCount = (
  data: Record<string, unknown>,
  rooms: number,
): number => {
  const raw = data.extraBedCount ?? data.extraBedCountRequested;
  if (raw == null) {
    return data.extraBed === true || data.extraBedRequested === true ? rooms : 0;
  }
  const count = Number(raw);
  if (!Number.isInteger(count) || count < 0 || count > rooms) {
    throw new Error("extraBedCount must be an integer from 0 to rooms.");
  }
  return count;
};

export const hotelStayAmount = (
  roomPrice: number,
  rooms: number,
  nights: number,
  extraBedPrice: number,
  extraBedCount: number,
): number => Math.round(
  (roomPrice * rooms + extraBedPrice * extraBedCount) * nights * 100,
) / 100;
