/**
 * @file Banners.jsx
 * @description Backwards-compatibility wrapper for Website Media & Banner Configuration.
 *
 * Architecture Note:
 * Website banner management has been unified into the comprehensive {@link WebsiteMedia}
 * management suite. This component acts as a lightweight proxy to preserve existing route
 * references and dynamic imports without breaking legacy navigation links.
 *
 * @module AdminDashboard/WebsiteConfig/Banners
 * @see {@link WebsiteMedia}
 */

import WebsiteMedia from "./WebsiteMedia";

/**
 * Banners Component.
 *
 * Proxy component rendering the unified WebsiteMedia management interface.
 *
 * @returns {JSX.Element} The rendered WebsiteMedia component.
 */
const Banners = () => {
  return <WebsiteMedia />;
};

export default Banners;

