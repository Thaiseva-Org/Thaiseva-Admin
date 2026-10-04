# Technical Data Specification for Thaiseva

> [!NOTE]
> **Consolidated Specification:** This data specification has been unified into the authoritative **[Firestore Data Architecture & Schema Dictionary](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/docs/04-data/DATA_SCHEMA_DICTIONARY.md)** and the **[Cloud Functions API Specification](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/docs/03-api/API_SPECIFICATION.md)**.

## 📌 Context
This document translates the "Frontend Mapping Strategy" into a concrete technical architecture. It defines the database schema, relationship strategy, and the precise API response format required for the frontend application.

**Target Database System:** NoSQL Document Store (Google Firestore)
**API Style:** RESTful (JSON)

---

## 1. Database Schema Design

### A. Module: Sightseeing Packages
**Collection Name:** `sightseeing_packages` (or `sightseeingPackagesDetails`)

This collection stores the core tour products. Fields are grouped logically to reduce root-level clutter.

| Field Name | Data Type | Indexing | Description / Nesting |
| :--- | :--- | :--- | :--- |
| `id` | String (UUID) | 🔑 Primary | Unique Document ID. |
| `status` | String | ✅ | Enum: `active`, `draft`, `archived`. |
| `meta` | Object | - | **Basic Info** |
| ├── `title` | String | ✅ (Text) | Display Name (`packageName`). |
| ├── `slug` | String | ✅ | URL-friendly ID. |
| ├── `category` | String | ✅ | e.g., "Family", "Adventure". |
| ├── `transportType`| String | ✅ | e.g., "Van", "Speedboat". |
| `pricing` | Object | ✅ (Sort) | **Financial Logic** |
| ├── `adultPrice` | Number | ✅ | Base price (`startingPrice`). |
| ├── `childPrice` | Number | - | Calculator logic. |
| ├── `extraAdult` | Number | - | Add-on logic. |
| ├── `discountPct` | Number | - | Marketing (`discount`). |
| `location` | Object | - | **Geo Info** |
| ├── `name` | String | ✅ | Display string (e.g., "Bangkok"). |
| ├── `coordinates` | GeoPoint | - | Optional Lat/Lng. |
| `media` | Object | - | **Visuals** |
| ├── `cover` | String (URL)| - | Thumbnail/Hero image. |
| ├── `gallery` | Array[URL] | - | List of image URLs. |
| `details` | Object | - | **Content** |
| ├── `description` | String | - | Full text HTML/Markdown. |
| ├── `duration` | Object | - | `{ days: 4, nights: 3 }`. |
| ├── `inclusions` | Array[Str] | - | "Included" items. |
| ├── `exclusions` | Array[Str] | - | "Excluded" items. |
| `itinerary` | Array[Obj] | - | List of `{ day: 1, title: "", activities: [] }`. |
| `logistics` | Object | - | **Hidden Logic** for Forms |
| ├── `reqHotel` | Boolean | - | `pickupFromHotel` triggers input. |
| ├── `reqFlight` | Boolean | - | `dropToAirport` triggers input. |
| `admin_data` | Object | 🚫 No Index | **Internal Only (Do Not Send to Client)** |
| ├── `supplierCost` | Number | - | Net cost. |
| ├── `notes` | String | - | Internal operations notes. |
| ├── `ownerId` | String | ✅ | Admin User ID. |
| ├── `createdAt` | Timestamp | ✅ | Audit. |

### B. Module: Hotels & Accommodation
**Collection Name:** `hotels` (or `HotelDB`)

Stores partner hotel profiles. Room types are stored as a **Sub-collection** to keep the main document lightweight.

| Field Name | Data Type | Indexing | Description / Nesting |
| :--- | :--- | :--- | :--- |
| `id` | String (UUID) | 🔑 Primary | Hotel ID. |
| `info` | Object | - | **Public Profile** |
| ├── `name` | String | ✅ (Text) | Hotel Name. |
| ├── `description` | String | - | About text. |
| ├── `rating` | Number | ✅ | 1-5 Stars. |
| `location` | Object | ✅ (Geo) | **Maps** |
| ├── `address` | String | - | Full text address. |
| ├── `geo` | GeoPoint | ✅ | For "Near Me" queries. |
| ├── `nearby` | Array[Str] | - | List of attractions. |
| `amenities` | Object | - | `{ pool: true, wifi: true, custom: [] }` |
| `media` | Object | - | `{ logo: URL, gallery: [URL] }` |
| `policies` | Object | - | `{ checkIn: "14:00", checkOut: "12:00" }` |
| `admin_data` | Object | 🚫 | **Internal Only** |
| ├── `contact` | Object | - | `{ email, phone }` (Private partner contact). |
| ├── `commission` | Number | - | % cut taken by platform. |
| ├── `uid` | String | ✅ | Linked Partner Account ID. |

**Sub-Collection:** `rooms` (Child of `hotels`)
*   `name` (String)
*   `capacity` (Number) - Max guests.
*   `price` (Number) - Nightly rate.
*   `stock` (Number) - **Hidden Logic** for availability.

---

## 2. Data Relationships

### Relationship Breakdown: Hotels ↔ Sightseeing Packages
*Scenario: A 3-Day Tour Package includes a stay at "Marriott Bangkok".*

**Strategy: Hybrid Reference (Denormalization)**

We will store a **Reference ID** along with a **Minified Snapshot** inside the Package document.

**Implementation in `sightseeing_packages` schema:**
```json
"hotelsIncluded": [
  {
    "hotelId": "ref_12345",
    "name": "Marriott Bangkok",
    "stars": 5,
    "roomType": "Deluxe" 
  }
]
```

**Pros & Cons:**
*   **✅ Performance:** We can render the package page immediately without performing a secondary database query to fetch the hotel name.
*   **✅ Simplicity:** The frontend gets all necessary display info in one meaningful chunk.
*   **❌ Sync Maintenance:** If "Marriott Bangkok" changes its name, the Package document contains stale data. (Solution: Cloud Function triggers to update linked documents, or accept that historical package data reflects the state *at time of creation*).

---

## 3. The "Ideal" API Response (JSON)

**Endpoint:** `GET /api/public/package/pkg_987654`

This API response represents a **clean DTO**. It strips out `admin_data` entirely. It includes `hidden logic` required for the React forms to work.

```json
{
  "status": "success",
  "data": {
    "id": "pkg_987654",
    "meta": {
      "title": "Grand Bangkok City Tour",
      "category": "Family",
      "rating": 4.8,
      "reviews": 124
    },
    "pricing": {
      "displayPrice": 1500,
      "currency": "THB",
      "discount": {
        "active": true,
        "badgeText": "Save 10%"
      },
      "calculator_logic": {
        "pricePerAdult": 1500,
        "pricePerChild": 800,
        "extraAdultSupplement": 1200
      }
    },
    "media": {
      "heroImage": "https://storage.googleapis.com/.../grand_bkk.jpg",
      "gallery": [
        "https://.../img1.jpg",
        "https://.../img2.jpg"
      ]
    },
    "details": {
      "duration": "1 Day",
      "location": "Bangkok, Thailand",
      "description": "<p>Experience the vibrant streets...</p>",
      "highlights": ["Temple Visit", "River Cruise", "Lunch Included"],
      "inclusions": ["Guide", "Transport", "Lunch"],
      "exclusions": ["Tips", "Personal Expenses"]
    },
    "itinerary": [
      {
        "day": 1,
        "title": "City Exploration",
        "schedule": [
          { "time": "09:00", "activity": "Pickup from Hotel" },
          { "time": "10:00", "activity": "Grand Palace Visit" }
        ]
      }
    ],
    "form_config": {
      "requiresHotelPickup": true,
      "requiresFlightDetails": false,
      "availableDates": ["Mon", "Wed", "Fri"]
    },
    "linked_partners": [
      {
        "type": "hotel",
        "id": "htl_555",
        "name": "Riverside Hotel (Lunch Stop)"
      }
    ]
  }
}
```

### 🛡️ Security Check
1.  **Missing:** `supplierCost` is nowhere to be found.
2.  **Missing:** `internalNotes` are stripped.
3.  **Missing:** `createdByUser` admin ID is hidden.
4.  **Present:** `calculator_logic` exists so the frontend knows how to sum up the cart locally before sending to checkout.
5.  **Present:** `form_config` helps the UI decide whether to render the "Hotel Name" input box.
