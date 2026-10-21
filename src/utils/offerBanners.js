export const MAX_OFFER_BANNERS = 12;
export function bannerItems(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(item => item && typeof item === 'object').map((item, index) => ({
    ...item, id: typeof item.id === 'string' && item.id ? item.id : `legacy-${index}`,
  }));
}
export function safeBannerDestination(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  if (/^\/(?!\/)/.test(raw)) return raw;
  try { const url = new URL(raw); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
export function saveBanner(items, banner, editing) {
  const current = bannerItems(items);
  if (!editing && current.some(item => item.id === banner.id)) return current;
  if (editing && !current.some(item => item.id === banner.id)) throw new Error('This banner was removed. Reload before editing.');
  if (!editing && current.length >= MAX_OFFER_BANNERS) throw new Error(`Keep up to ${MAX_OFFER_BANNERS} banners.`);
  return editing ? current.map(item => item.id === banner.id ? {...item, ...banner} : item) : [...current, banner];
}
export function moveBanner(items, id, direction) {
  const current = bannerItems(items), index = current.findIndex(item => item.id === id), target = index + direction;
  if (index < 0 || target < 0 || target >= current.length) return current;
  [current[index], current[target]] = [current[target], current[index]];
  return current;
}
