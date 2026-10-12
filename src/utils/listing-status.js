// Explicit booleans win; legacy records without visibility fields remain active.
export function isListingActive(record = {}) {
  if (typeof record.isActive === 'boolean') return record.isActive;
  if (typeof record.hotel?.isActive === 'boolean') return record.hotel.isActive;
  return String(record.status || record.hotel?.status || '').toLowerCase() !== 'inactive';
}

export const listingStatusFields = (isActive) => ({ isActive, status: isActive ? 'Active' : 'Inactive' });
