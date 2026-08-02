# Frontend Mapping Strategy

## 📌 Executive Summary
This document outlines the data mapping strategy for the Thaiseva Frontend Website. To ensure security, performance, and optimal user experience, we have categorized all database fields from the Admin Dashboard into three distinct tiers:

1.  **✅ Public Display:** Data intended for the end-user interface to drive engagement and conversion.
2.  **👻 Hidden Logic:** Data required by the frontend client for functionality (routing, calculations, filtering) but not directly rendered in the UI.
3.  **🔒 Admin Only:** Sensitive operational data that must be filtered out at the API level and **never** exposed to the frontend.

---

## 🏗️ Method: Data Structure Analysis
The following schema analysis is based on the **Sightseeing Packages** and **Hotel Partners** modules found in the Admin Dashboard source code.

---

## 1. Sightseeing Packages (`sightseeingPackagesDetails`)

### ✅ Public Display (Visible to User)
*These fields form the core content of the product page.*

| Field Name | Component / UI Element | Purpose |
| :--- | :--- | :--- |
| `title` / `packageName` | **Hero Section** | Main header of the tour page. |
| `price` / `startingPrice` | **Pricing Card** | Display "Starts from ฿{price}". |
| `coverPhoto` / `thumbnailImage` | **Card & Hero** | Main visual hook for listings. |
| `images` / `packageImages` | **Image Gallery** | Carousel or grid of tour photos. |
| `description` / `about` | **Overview Tab** | Detailed textual description of the experience. |
| `location` | **Map / Header** | "Visit {location}" breadcrumb or tag. |
| `period` / `duration` | **Info Bar** | e.g., "5 Days / 4 Nights". |
| `highlights` / `amenities` | **Highlights Section** | Bullet points of key features (e.g., "Instant Confirmation"). |
| `included` | **"What's Included"** | Green checkmark list (e.g., "Hotel Pickup", "Lunch"). |
| `excluded` | **"What's Excluded"** | Red cross list (e.g., "Tips", "Flights"). |
| `itinerary` | **Timeline UI** | Day-by-day breakdown with activities. |
| `transportType` | **Icon/Tag** | e.g., 🚐 Van, 🚤 Speedboat. |
| `packageType` | **Category Tag** | e.g., "Family Friendly", "Couple". |
| `rating` | **Review Stars** | Display average rating (e.g., ⭐ 4.8). |
| `discount` | **Discount Badge** | "Save 20%" badge on cards. |

### 👻 Hidden Logic (Frontend Use Only)
*These fields are sent to the browser for functional reasons but are not explicitly drawn.*

| Field Name | Usage Logic |
| :--- | :--- |
| `id` / `packageId` | **Routing**: Used in URL slugs (`/tours/:id`) and API calls. |
| `pricePerChild` | **Calculator**: Used to calculate total cost in the booking form. |
| `extraAdultPrice` | **Calculator**: Used for add-on pricing logic. |
| `pickupFromHotel` | **Condition**: Boolean to show/hide "Enter Hotel Name" input field. |
| `dropToAirport` | **Condition**: Boolean to show/hide "Enter Flight No" input field. |
| `specialRates` | **Pricing Engine**: Logic for seasonal pricing adjustments. |
| `hotelsIncluded` | **Reference**: ID linking to Hotel objects (if not fully expanded for display). |

### 🔒 Admin Only (Strictly Private)
*These fields must be stripped from the JSON response before it leaves the server.*

| Field Name | Security / Privacy Reason |
| :--- | :--- |
| `supplierCost` (Implicit) | **Business Logic**: Never reveal net margins or costs. |
| `createdByUser` | **Privacy**: Internal admin ID who created the listing. |
| `internalNotes` | **Operations**: Private notes for sensitive operational details. |
| `timestamp` | **Irrelevant**: Creation date is rarely needed for users; use `updatedAt` for sitemaps only. |

---

## 2. Hotels & Accommodation (`HotelDB`)

### ✅ Public Display (Visible to User)
| Field Name | Component / UI Element | Purpose |
| :--- | :--- | :--- |
| `hotelName` | **Header** | Name of the property. |
| `address` & `country` | **Location Info** | Full address for display. |
| `description` | **About Section** | Property description. |
| `policies` | **Policy Accordion** | Check-in/out times, refundable rules. |
| `images` (Logo/Gallery) | **Gallery** | Visual tour of the property. |
| `features` / `amenities` | **Amenities Grid** | Icons for Pool, Wifi, Gym, etc. |
| `petsAllowed` | **Filter Tag** | "Paw Friendly" badge. |
| `nearbyAttractions` | **Map Overlays** | List of points of interest nearby. |
| `rooms` (Sub-collection) | **Room List** | List of available room types (Name, Bed config, Max Guests). |
| `rating` | **Stars** | 1-5 Star rating display. |

### 👻 Hidden Logic (Frontend Use Only)
| Field Name | Usage Logic |
| :--- | :--- |
| `hotelId` / `uid` | **Routing**: Used for unique URL generation. |
| `location` (Lat/Lng) | **Google Maps**: Coordinates for placing the map pin. |
| `totalRooms` | **Inventory**: Hotel-level capacity; per-type `rooms.totalRooms` used by admin Room Availability calendar. |
| `availability/config` subcollection doc | **Admin / future app**: auto-book ON/OFF, default 5 rooms/type, bookable window (see `HOTEL_AVAILABILITY_API.md`). |
| `status` | **Search Filter**: Ensure only "Verified" hotels are shown. |

### 🔒 Admin Only (Strictly Private)
| Field Name | Security / Privacy Reason |
| :--- | :--- |
| `email` | **Platform Integrity**: Prevent users from bypassing the platform to book directly. |
| `phoneNumber` | **Platform Integrity**: Prevent direct off-platform contact. |
| `hotelUid` | **Database Security**: Internal link to the Partner User account. |
| `commissionRate` | **Business Secrets**: Internal agreement details. |
| `updatedAt` / `createdAt` | **Internal**: Backend sorting/auditing dates. |

---

## 🛡️ Implementation Checklist
- [ ] **API Layer:** Ensure your API endpoints (e.g., `/api/tours/:id`) use a DTO (Data Transfer Object) pattern to select *only* the Public and Hidden fields.
- [ ] **Frontend**: Ensure sensitive fields like `supplierCost` or `partnerEmail` are **undefined** in the browser console network inspector.
- [ ] **Validation:** Check that `Hidden Logic` fields (like `pricePerChild`) are present in the API response but not rendered as raw text.
