# Firestore Data Architecture & Schema Dictionary

> Privacy/security status updated 11 October 2026: [current verified status](../05-security/DATA_PRIVACY_PDPA.md) supersedes older privacy, role, retention and deployment claims below. One Admin staff role is active; current erasure removes scoped records and queues remaining review, rather than proving complete deletion. Historical gaps remain open, Secret Manager migration is IAM-blocked, and Storage/uploads were not changed. Earlier plans, example rules and compliance assertions are not evidence of live readiness.

This document represents the **authoritative single source of truth** for all Google Cloud Firestore collections, subcollections, document shapes, field mappings, and composite indexes across the Thaiseva ecosystem. It consolidates all data specifications from legacy references into a unified, verified standard.

---

## 1. NoSQL Schema Principles & Storage Patterns

- **Document Identifiers:** Root entities use either Firebase Auth UIDs (`uid`) or unique UUIDv4 strings. Subcollection entities (e.g., room types) use deterministic or slug-based strings (`room_deluxe_ocean`).
- **Timestamp Standardization:**
  - Modern backend functions write Firestore `FieldValue.serverTimestamp()`.
  - Legacy records may contain ISO-8601 strings (`"2026-10-04T05:48:00.000Z"`). The frontend date parser `parseFirestoreDate()` safely unwraps `Timestamp`, `_seconds`, and string variants.
- **Denormalization (Hybrid Snapshots):** To achieve millisecond read speeds without expensive multi-collection joins, snapshots of linked parent records are denormalized at time of order creation (e.g., embedding hotel name, address, and room name inside `hotelBookingData`).
- **Pagination & Cursors:** High-volume collections (`users`, `hotelBookingData`, `car_bookings`) are read using Firestore query cursors (`limit(N)`, `startAfter(lastDocSnapshot)`).

---

## 2. Master Collections Reference

### 2.1 Identity & Partner Collections

#### Collection: `users`
**Purpose:** Primary identity profiles for administrators, sub-admins, partners, and mobile app users.  
**Document ID:** Firebase Auth `UID`.

```typescript
interface UserDocument {
  uid: string;                               // Firebase Auth UID
  email: string;                             // User email address
  displayName?: string;                      // Full name (Staff / Partner standard)
  firstName?: string;                        // App user first name (Legacy)
  lastName?: string;                         // App user last name (Legacy)
  role: 'Admin' | 'Sub Admin' | 'Partner' | 'User'; // Core RBAC role
  status?: 'Pending' | 'Verified' | 'Suspended';    // Partner verification status
  serviceCategory?: string;                  // 'Hotel' | 'Driving' | 'Sightseeing' | 'Local'
  phoneNo?: string;                          // Primary contact phone
  phoneNumber?: string;                      // Legacy contact phone alias
  photoURL?: string;                         // Profile avatar URL
  isAppUser?: boolean;                       // True if consumer mobile app registrant
  isVerified?: boolean;                      // Partner approval flag
  accountDeleted?: boolean;                  // Flagged true upon PDPA deletion execution
  deletedAt?: Timestamp;                     // Deletion execution timestamp
  createdAt: Timestamp;                      // Record creation timestamp
}
```

#### Collection: `partners`
**Purpose:** B2B commercial partner registration, licensing, and payout banking details.  
**Document ID:** Partner User `UID`.

```typescript
interface PartnerDocument {
  uid: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  serviceCategory: string | string[];        // e.g., "Hotel", "Driving", "Local"
  serviceArea?: string;                      // Operating province/city (e.g., "Phuket")
  status: 'Pending' | 'Verified' | 'Rejected';
  paymentInformation: {
    bankName: string;                        // Commercial bank name
    accountNumber: string;                   // Payout account number
    bankAddress?: string;                    // Bank branch details
    accountHolderName?: string;              // Name on bank account
  };
  createdAt: Timestamp;
}
```

#### Collection: `general_partners`
**Purpose:** Partner management and package commission assignment profiles.  
**Document ID:** Partner UID or UUID.

```typescript
interface GeneralPartnerDocument {
  id: string;
  personalInformation: {
    fullName: string;
    email: string;
    phoneNo?: string;
    address?: string;
  };
  serviceCategory: string | string[];
  commissions: {
    [categoryName: string]: {
      type: 'Percentage' | 'Fixed';
      rate: number | string;
    };
  };
  status: 'Pending' | 'Verified';
  createdAt: Timestamp;
}
```

##### Subcollection: `general_partners/{partnerId}/assignedPackages/{packageId}`
Tracks which sightseeing tour packages are allocated to this commercial partner:
```typescript
interface AssignedPackageDocument {
  packageId: string;
  packageName: string;
  assignedAt: Timestamp;
}
```

#### Collection: `drivers`
**Purpose:** Profiles of verified transport and taxi drivers.  
**Document ID:** Driver User `UID`.

```typescript
interface DriverDocument {
  uid: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  license: string;                           // Driver's license number
  address: string;
  location?: { lat: number; lng: number };
  serviceCategory: 'Driving';
  status: 'Pending' | 'Verified' | 'Suspended';
  paymentInformation?: {
    bankName: string;
    accountNumber: string;
    bankAddress: string;
  };
  rating?: number;
}
```

#### Collection: `restaurants`
**Purpose:** Restaurant partner catalog and profiles.  
**Document ID:** Restaurant UID or ID.

```typescript
interface RestaurantDocument {
  uid: string;
  email: string;
  restaurantName: string;
  phoneNumber: string;
  address: string;
  logoURL: string;
  license: string;
  coupon?: string;
  keywords?: string | string[];
  location: { lat: number; lng: number };
  status: 'Pending' | 'Verified';
  serviceCategory: 'Restaurant';
  paymentInformation?: {
    bankName: string;
    accountNumber: string;
    bankAddress: string;
  };
}
```

---

## 2.2 Accommodation Catalog & Real-Time Inventory

```
HotelDB/ {hotelId}
  â”œâ”€â”€ rooms/ {roomId}
  â””â”€â”€ availability/ config & date records

hotelStock/ {hotelId}_{packageId}/nights/ {YYYY-MM-DD}
hotelLocks/ {lockId}
```

#### Root Document: `HotelDB/{hotelId}`
**Document ID:** Unique Hotel ID (e.g., `htl_phuket_resort_01`).

```typescript
interface HotelDocument {
  hotelId: string;
  hotelUid: string;                          // Linked Partner UID
  hotelName: string;
  country: string;                           // Default: "Thailand"
  currency: string;                          // Default: "THB"
  startingPrice: number;                     // Base starting price per night
  discount: number;                          // Percentage discount
  totalRooms: number;                        // Aggregate hotel room count
  address: string;                           // Physical street address
  location: {
    lat: number;                             // Latitude for Google Maps
    lng: number;                             // Longitude for Google Maps
  };
  rating: number;                            // Customer star rating (1.0 - 5.0)
  numberOfReviews: number;
  status: 'Verified' | 'Pending' | 'Draft';
  images: {
    logo: string;                            // Main property banner URL
    gallery: string[];                       // Array of property photo URLs
  };
  features: string[];                        // Amenities: ["Pool", "WiFi", "Spa", "Gym"]
  policies: string;                          // Cancellation and house rules text
  email: string;
  phoneNumber: string;
  updatedAt: Timestamp;
}
```

#### Subcollection: `HotelDB/{hotelId}/rooms/{roomId}`
**Purpose:** Detailed room types and physical inventory allocation.

```typescript
interface RoomDocument {
  id: string;                                // Room Type ID
  roomName: string;                          // e.g., "Deluxe Ocean View"
  packageName?: string;                      // Legacy alias
  totalRooms: number;                        // Max physical inventory (Default: 5)
  quantity?: number;                         // Alias of totalRooms (Legacy)
  maxGuests: number;
  maxAdults: number;
  maxChildren: number;
  numberOfBeds: number;
  bedType: string;                           // "King", "Twin", etc.
  photos: string[];
  amenities: string[];                       // Room-specific amenities
  pricing: {
    basePrice: number;                       // Rack rate
    discountPercent: number;
    pricePerNightAfterDiscount: number;     // Effective nightly charge
    taxIncluded: boolean;
  };
  policies: {
    checkIn: string;                         // e.g., "14:00"
    checkOut: string;                        // e.g., "12:00"
    extraBed?: string;
    extraBedPrice?: number;
    paymentInfo?: string;
    refundable: boolean;
  };
}
```

#### Subcollection: `HotelDB/{hotelId}/availability/config`
Stores hotel booking operational parameters:
```json
{
  "recordType": "config",
  "hotelUid": "string",
  "autoBookingEnabled": true,
  "defaultRoomInventory": 5,
  "bookingOpenFrom": "2026-01-01",
  "bookingOpenTo": null,
  "timezone": "Asia/Bangkok"
}
```

#### Collection: `hotelStock/{hotelId}_{packageId}/nights/{YYYY-MM-DD}`
**Live Real-Time Room Stock Ledger:**
```json
{
  "hotelId": "htl_01",
  "packageId": "room_deluxe",
  "date": "2026-11-01",
  "total": 5,
  "locked": 1,
  "booked": 2,
  "free": 2,
  "updatedAt": "Timestamp"
}
```

#### Collection: `hotelLocks/{lockId}`
**Inventory Reservation Holds & Locks:**
```json
{
  "lockId": "lck_abc123",
  "hotelId": "htl_01",
  "packageId": "room_deluxe",
  "checkIn": "2026-11-01",
  "checkOut": "2026-11-04",
  "rooms": 1,
  "kind": "hold",
  "status": "active",
  "userId": "usr_buyer_99",
  "bookingId": null,
  "expiresAt": "Timestamp",
  "nights": ["2026-11-01", "2026-11-02", "2026-11-03"]
}
```

---

## 2.3 Tour & Sightseeing Packages

#### Collection: `sightseeingPackagesDetails` (Alias: `sightseeingPackages`)
**Purpose:** Guided tour itineraries, adventure activities, and transport combinations.

```typescript
interface TourPackageDocument {
  id: string;
  packageId?: string;                        // Alias of document ID
  packageName?: string;                      // Display name
  title?: string;
  status: 'active' | 'draft' | 'archived';
  meta?: {
    title: string;
    slug: string;
    category: string;                        // "Family", "Adventure", "Culture"
    transportType: string;                   // "Speedboat", "Van", "Bus"
  };
  startingPrice: number;
  discount: number;
  currency: 'THB';
  duration: { days: number; nights: number };
  coverPhoto: string;
  images: string[];
  highlights: string[];
  amenities: string[];
  included: string[];
  excluded: string[];
  itinerary: Array<{
    day: number;
    title: string;
    timeline: Array<{ time: string; activity: string }>;
  }>;
  hotelsIncluded?: Array<{
    hotelId: string;
    hotelName: string;
    roomType: string;
    nights: number;
  }>;
  createdAt: Timestamp;
}
```

---

## 2.4 Transport, Rides & Fleet Management

#### Collection: `car_bookings`
**Purpose:** Primary unified storage for all chauffeur-driven rides (`car`, `van`, `taxi`, `bike`).

```typescript
interface CarBookingDocument {
  bookingId: string;
  transportType: 'car' | 'van' | 'taxi' | 'bike';
  name: string;                              // Passenger full name
  contact: string;                           // Passenger phone number
  email: string;
  pickup: string;                            // Origin address / airport
  drop: string;                              // Destination address
  date: string;                              // Date string (YYYY-MM-DD)
  time: string;                              // Time string (HH:mm)
  seats: number;                             // Passenger count
  flightNumber?: string;
  bookingType: 'scheduled' | 'immediate';
  status: 'Pending' | 'Accepted' | 'Assigned' | 'EnRoute' | 'Completed' | 'Canceled';
  bookingStatus: 'Pending' | 'Accepted' | 'Completed';
  quotedAmount?: number;                     // Quoted price in THB (set by admin)
  driverId?: string;                         // Assigned driver UID
  vehicleId?: string;                        // Assigned vehicle ID
  timestamp: Timestamp;                      // Creation timestamp
}
```

#### Collection: `self_driving_bookings` (Alias: `self_drive_bookings`)
**Purpose:** Unassisted self-drive rental fleet reservations.

```typescript
interface SelfDriveBookingDocument {
  bookingId: string;
  name: string;
  contact: string;
  email: string;
  vehicleCategory: string;                   // "Sedan", "SUV", "Compact"
  pickupLocation: string;
  pickupDate: string;
  pickupTime: string;
  dropoffLocation: string;
  dropoffDate: string;
  dropoffTime: string;
  driverLicenseNumber: string;
  status: 'Pending' | 'Accepted' | 'Completed' | 'Canceled';
  timestamp: Timestamp;
}
```

#### Collection: `transportVehicles`
**Purpose:** Physical fleet assets registered in the Thaiseva fleet.

```typescript
interface TransportVehicleDocument {
  id: string;
  registrationNumber: string;                // License plate (e.g. "1Kor-4567")
  registrationNumberNormalized: string;      // Lowercase alphanumeric for search
  vehicleType: 'car' | 'van' | 'taxi' | 'bike';
  seatCapacity: number;
  companyId?: string;                        // References transportCompanies/{id}
  active: boolean;                           // Operating status flag
}
```

---

## 2.5 Orders, Dining & Financials

#### Collection: `hotelBookingData`
**Purpose:** Complete accommodation order records.

```typescript
interface HotelBookingDocument {
  bookingId: string;
  userId?: string;                           // Customer User UID
  hotelId: string;
  hotelUid?: string;                         // Hotel Partner UID
  hotelName: string;
  roomId: string;
  roomName: string;
  fullName: string;
  guestEmail: string;
  phoneNumber: string;
  checkInDate: Timestamp | string;
  checkOutDate: Timestamp | string;
  numberOfGuests: number;
  amount: number;                            // Total charge in THB
  currency: 'THB';
  paymentMethod: 'STRIPE' | 'THAI_QR';
  isPaymentDone: boolean;
  stripeSessionId?: string;
  status: 'Pending' | 'Accepted' | 'Canceled' | 'Completed';
  createdAt: Timestamp;
}
```

#### Collection: `orders`
**Purpose:** Restaurant food delivery and pickup orders.

```typescript
interface RestaurantOrderDocument {
  orderId: string;
  Restaurant: {
    ownerId: string;                         // Restaurant Partner UID
    restaurantName: string;
  };
  customerInfo: {
    name: string;
    phone: string;
    address: string;
  };
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  totalAmount: number;
  status: 'Pending' | 'Accepted' | 'Preparing' | 'Delivered' | 'Cancelled';
  timestamp: Timestamp;
}
```

#### Collection: `dineInBookings`
**Purpose:** Restaurant table reservations.

```typescript
interface DineInBookingDocument {
  bookingId: string;
  ownerId: string;                           // Restaurant Partner UID
  restaurantName: string;
  guestName: string;
  guestPhone: string;
  numberOfGuests: number;
  bookingDate: string;
  bookingTime: string;
  status: 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';
  bookingTimestamp: Timestamp;
}
```

#### Collection: `partner_invoices` (and `invoices`)
**Purpose:** Historical PDF invoices and billing statements generated for partners.

```typescript
interface PartnerInvoiceDocument {
  invoiceId: string;                         // e.g., "INV-2026-10-001"
  partnerUid: string;
  billingPeriod: {
    startDate: string;
    endDate: string;
  };
  totalGrossBookings: number;
  commissionPercentage: number;
  commissionAmount: number;
  netPayoutAmount: number;
  currency: 'THB';
  status: 'Draft' | 'Issued' | 'Paid';
  pdfStoragePath: string;                    // Firebase Storage reference
  generatedAt: Timestamp;
}
```

---

## 2.6 Dynamic Website Media, CMS & Marketing

### Collection: `image`
**Purpose:** Real-time CMS media assets, dynamic QR codes, and site statistics.
- **Document ID:** Named exactly as the target Slot ID.
- **Real-Time Sync:** Monitored via `onSnapshot` by the consumer website.
- **Safe Fallback:** Inactive or missing slots revert to local static assets.

#### Media Slot Document Schema:
```typescript
interface WebsiteMediaSlotDocument {
  name: string;                              // Slot ID (e.g. "hero")
  url: string;                               // Firebase Storage public URL
  status: 'active' | 'inactive';             // Toggle status
  isActive?: boolean;
  updatedAt: Timestamp;
}
```

#### Dynamic Site Statistics Document: `image/stats`
```typescript
interface SiteStatisticsDocument {
  name: 'stats';
  status: 'active' | 'inactive';
  activeUsers: string;                       // e.g. "800+"
  happyReviews: string;                      // e.g. "600+"
  appDownloads: string;                      // e.g. "1000+"
  appRating: string;                         // e.g. "4.8"
  happyTravelers: string;                    // e.g. "0+"
  verifiedHotels: string;                    // e.g. "5"
  curatedTours: string;                      // e.g. "1"
  localPartners: string;                     // e.g. "0+"
  updatedAt: Timestamp;
}
```

#### Dynamic Slot Directory:
| Slot ID | Media Type | Section / Page | Fallback Asset |
|---|---|---|---|
| `hero` | Image | Services Hero Visual Card | `/images/services-hero-blue.jpg` |
| `heroBg` | Image | Services Hero Background | `/images/About-us-bg.png` |
| `tours-hero-bg` | Image | Sightseeing Header Banner | `/images/tours-bg.jpg` |
| `hotels-hero-bg` | Image | Hotels Header Banner | `/images/hotels-bg.jpg` |
| `blogs-hero-bg` | Image | Blogs Header Banner | `/images/blogs-bg.jpg` |
| `about-leader-harish` | Image | Leadership Team Card | `/images/team/harish.jpg` |
| `qr-ios` | Image (QR) | App Store Download | `/images/qr-ios.png` |
| `qr-android` | Image (QR) | Play Store Download | `/images/qr-android.png` |

#### Collections: `blogs`, `faqs`, `testimonials`, `contactUs`
- **`blogs/{blogId}`**: `title`, `slug`, `content`, `author`, `tags`, `image`, `publishedAt`.
- **`faqs/{faqId}`**: `question`, `answer`, `category`, `order`.
- **`testimonials/{id}`**: `name`, `feedback`, `rating`, `userPhoto`, `status`.
- **`contactUs/{id}`**: `name`, `email`, `phone`, `message`, `status`, `createdAt`.

---

## 2.7 Communication, Reviews & Notifications

#### Collections: `chats` & `messages`
- `chats/{chatId}`: `participants: string[]`, `lastMessage: string`, `lastUpdated: Timestamp`, `unreadCount: number`.
- `chats/{chatId}/messages/{messageId}`: `senderUid`, `text`, `audioUrl` (voice recordings), `timestamp`.

#### Collection: `notifications`
**Purpose:** Push notifications dispatched to app users or partners.
```typescript
interface NotificationDocument {
  id: string;
  title: string;
  body: string;
  targetAudience: 'All' | 'Partners' | 'Users' | 'Drivers';
  sentAt: Timestamp;
  status: 'Sent' | 'Scheduled' | 'Failed';
}
```

#### Collection: `reviews`
**Purpose:** Customer reviews and star ratings for hotels, tours, and drivers.
```typescript
interface ReviewDocument {
  id: string;
  entityId: string;                          // hotelId, packageId, or driverId
  entityType: 'hotel' | 'tour' | 'driver';
  userId: string;
  userName: string;
  rating: number;                            // 1 to 5
  comment: string;
  createdAt: Timestamp;
}
```

---

## 2.8 Compliance & Security (TTL)

#### Collection: `DeletionRequests`
**Purpose:** Customer account deletion requests under Thailand PDPA.
```typescript
interface DeletionRequestDocument {
  id: string;
  uid: string;                               // Target Firebase Auth UID
  userEmail: string;
  userName?: string;
  reason?: string;
  status: 'Pending' | 'Erasure Pending' | 'Completed' | 'Cancelled';
  createdAt: Timestamp;
  completedAt?: Timestamp;
  processedBy?: string;
}
```

#### Collections: `emailOtpChallenges`, `emailOtpRateLimits` & `emailOtpVerificationProofs`
**Purpose:** Signup email OTP challenges, ten-minute single-account verification proofs and fixed-window rate limit counters. All client access is denied.
- **Security:** `hash` stored as `HMAC-SHA256`. Plaintext OTP is never persisted.
- **TTL Index:** Firestore **Time-To-Live (TTL)** policy automatically purges documents when current time exceeds `deleteAfter`.

---

## 3. Legacy Field Fallbacks & Mapping Table

To prevent runtime errors when reading legacy records, the codebase enforces the following fallback precedence:

| Modern Field | Legacy Field Alias | Recommended Code Access Pattern |
|---|---|---|
| `phoneNo` | `phoneNumber` | `doc.phoneNo \|\| doc.phoneNumber \|\| ""` |
| `displayName` | `firstName`, `lastName` | `doc.displayName \|\| `${doc.firstName \|\| ''} ${doc.lastName \|\| ''}`.trim()` |
| `totalRooms` | `quantity` | `Number(doc.totalRooms ?? doc.quantity ?? 5)` |
| `packageId` | `id` | `doc.packageId \|\| doc.id` |
| `pricingStructure.pricePerAdult` | `adultPrice`, `startingPrice` | `doc.pricingStructure?.pricePerAdult ?? doc.adultPrice ?? doc.startingPrice ?? 0` |
| `car_bookings` | `travelBookingDetails` | All driver rides query `car_bookings`; tours query `travelBookingDetails`. |
| `hotelName` | `hotel.hotelName`, `hotelInformation.hotelName` | `doc.hotelName \|\| doc.hotel?.hotelName \|\| doc.hotelInformation?.hotelName` |

---

## 4. Complete Composite Indexes Reference (`firestore.indexes.json`)

The following composite indexes are active and required in production:

| Collection Group | Indexed Fields | Order | Query Target |
|---|---|:---:|---|
| `hotelBookingData` | `hotelUid` (ASC), `status` (ASC), `createdAt` (DESC) | Partner today's arrivals & historical manifests |
| `hotelBookingData` | `packageId` (ASC), `status` (ASC), `createdAt` (ASC) | Package hotel room reconciliation |
| `hotelBookingData` | `hotelUid` (ASC), `packageId` (ASC) | Hotel-specific package inventory |
| `car_bookings` | `status` (ASC), `timestamp` (ASC) | Dispatch queue ordered by trip timing |
| `car_bookings` | `driverId` (ASC), `bookingStatus` (ASC) | Driver assigned ride manifests |
| `car_bookings` | `vehicleId` (ASC), `bookingStatus` (ASC) | Vehicle fleet allocation checks |
| `vanBookings` | `driverId` (ASC), `bookingStatus` (ASC) | Van fleet driver assignments |
| `vanBookings` | `vehicleId` (ASC), `bookingStatus` (ASC) | Van fleet vehicle assignments |
| `transportVehicles` | `registrationNumberNormalized` (ASC), `active` (ASC) | Rapid vehicle plate lookup |
| `hotelBookingHolds` | `status` (ASC), `holdUntil` (ASC) | Expired hold sweepers (`expireHotelStockHolds`) |
| `hotelBookingHolds` | `userId` (ASC), `status` (ASC) | User active checkout hold checks |
| `hotelBookingHolds` | `status` (ASC), `inventoryReserved` (ASC) | Real-time reserved inventory calculations |
| `hotelLocks` | `status` (ASC), `kind` (ASC), `expiresAt` (ASC) | Manual date lock expirations |
| `hotelLocks` | `hotelId` (ASC), `status` (ASC) | Hotel property active lock matrices |
| `orders` | `Restaurant.ownerId` (ASC), `timestamp` (DESC) | Restaurant partner food order feed |
| `dineInBookings` | `ownerId` (ASC), `bookingTimestamp` (DESC) | Restaurant table reservation feed |

### TTL Policy Configuration
Configured in `firestore.indexes.json` under `fieldOverrides`:
- `emailOtpChallenges.deleteAfter` $\rightarrow$ `ttl: true`
- `emailOtpRateLimits.deleteAfter` $\rightarrow$ `ttl: true`

## Verified privacy schema additions (11 October 2026)

`privacyErasureJobs/{uid}` records PROCESSING, RETRY_REQUIRED or PENDING_RECORD_REVIEW, scoped-erasure flags, actor, remainingReview and seven-day reviewDueAt. `privacyRetentionReviews`, `privacyRetentionFailures`, `privacyRetentionRuns` and cursor state track maintenance/review work. Historical DeletionRequests can lack uid and retain passwords; this is a confirmed defect, not the accepted new schema. Four legacy requests require reviewed cleanup. Legacy chat `date` values currently are not supported by the message expiry helper; T2TWorldChatRoom and foodCustomerChats are not covered. See the linked verification report for counts.
