export function hasAdminAccess(claims = {}, profile = {}) {
  return profile.isSuspended !== true &&
    (claims.admin === true || ["Admin", "admin"].includes(profile.role));
}
