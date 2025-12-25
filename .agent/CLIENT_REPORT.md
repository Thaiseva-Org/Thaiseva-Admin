# Client Report: Thaiseva Admin Portal

## 1. Website Functionality Overview

The **Thaiseva Admin Portal** is a comprehensive administration suite designed to manage a multi-faceted travel and service marketplace. It serves as the central hub for operations, allowing administrators to manage services, bookings, users, and financial aspects of the platform.

### Core Functional Modules:

#### A. Service Management
The platform allows for the creation, editing, and management of various service verticals:
*   **Room Services (Hotels)**: Complete management of hotel profiles, including general information, policies, amenities, and media (logos, galleries).
*   **Travel Services (Sightseeing)**: Creation of complex tour packages with daily itineraries, inclusion/exclusion lists, pricing structures (adult/child), and associated hotel stays.
*   **Car/Transportation Services**: Management of taxi and transfer services.
*   **Self-Drive Services**: Management of rental vehicles for self-drive.
*   **Food & Local Services**: Management of restaurant partners and local service requirements.

#### B. Booking & Order Management
The portal consolidates bookings from all service verticals into a unified view for processing:
*   **Booking Categories**: Segregated views for Taxi, Self-drive, Room, and Travel (Sightseeing) bookings.
*   **Order Processing**: Features to view booking details, track statuses, and manage customer orders.
*   **Invoicing**: functionality to generate and manage invoices for bookings.

#### C. User & Partner Management
*   **User Management**: View and manage registered app users/clients.
*   **Partner Management**: Dedicated sections for managing relationships with service providers (Drivers, Hotels, Restaurants, Local Partners).
*   **Sub-Admin Management**: Role-based access control for delegated administration.

#### D. Dashboard & Analytics
*   **Administrator Dashboard**: High-level statistics on business performance.
*   **Partner Dashboard**: Specific views for partners to view their performance (inferred).
*   **Statistics**: Detailed charts and metrics on sales, user growth, and service popularity.

#### E. Communication & Utilities
*   **Notifications System**: Mechanism to send and manage platform notifications.
*   **Coupons Management**: Creation and management of promotional codes and discounts.

---

## 2. Data Architecture Analysis

The application utilizes **Firebase Firestore** as its primary database. Below is the detailed schema analysis of the core data entities.

### A. Hotel Data Model (`HotelDB`)
The "Gold Standard" structure for hotel entities includes:

| Field Group | Key Data Points |
| :--- | :--- |
| **Identity** | `hotelId` (UUID), `hotelName` |
| **Location** | `address`, `country`, `latitude`, `longitude` |
| **Media** | `images` object containing `logo` and `gallery` (Array of URLs) |
| **Details** | `description`, `features` (amenities), `policies` (Check-in/out, etc.), `petsAllowed` |
| **Pricing** | `startingPrice`, `currency` (Default: THB), `discount` |
| **Contact** | `phoneNumber`, `email` |
| **Rooms** | Nested collection or array of `TargetRoom` objects (see below) |

**Room Data Structure (`TargetRoom`):**
*   **Basics**: `roomName`, `maxGuests`, `numberOfBeds`, `bedType`
*   **Pricing**: `basePrice`, `discountPercent`, `pricePerNightAfterDiscount`
*   **Features**: `amenities`, `foodInfo` (Breakfast included/type), `photos`
*   **Policies**: `refundable`, `paymentInfo`

### B. Sightseeing/Travel Package Model (`travelServicesCollection`)
Detailed structure for tour packages:

| Field Group | Key Data Points |
| :--- | :--- |
| **Identity** | `packageId`, `packageName` |
| **Duration** | `duration` object (`days`, `nights`) |
| **Itinerary** | Array of `Day` objects, each containing a `timeline` of activities (time + description) |
| **Pricing** | `pricingStructure`: `pricePerAdult`, `pricePerChild`, `extraAdultPrice` |
| **Inclusions** | `included` (list), `excluded` (list), `hotelsIncluded` (list of associated hotels) |
| **Media** | `thumbnailImage`, `packageImages` (Gallery) |
| **Logistics** | `transportType`, `pickupDropDetails` (Airport/Hotel pickup flags) |

### C. User Data Model (`usersCollection`)
Data stored for registered clients:

| Field | Description |
| :--- | :--- |
| **Identity** | `firstName`, `uid` |
| **Contact** | `phoneNo`, `email` |
| **Profile** | `profilePic` (URL), `userLocation1` |
| **Meta** | `createdAt` (Timestamp), `isAppUser` (Boolean flag) |

### D. Booking Data Models
Bookings are segregated into four primary collections, but share common temporal fields for querying:

1.  **Car Bookings (`carBookingsCollection`)**: Queryable by `timestamp`.
2.  **Self-Drive Bookings (`selfDriveBookingCollection`)**: Queryable by `time`.
3.  **Room Bookings (`roomBookingCollection`)**: Queryable by `orderedAt`.
4.  **Travel Bookings (`travelBookingCollection`)**: Queryable by `orderedAt`.

---

## 3. Recommendations (Agent Observations)

1.  **Data Consistency**: There is an active effort to standardize data structures (evidenced by `hotelTransformation.js` and `sightseeingTransformation.js`). Ensure all legacy data is migrated to these "Gold Standard" formats to prevent UI breakages.
2.  **Validation**: The forms (like `AddSightseeingPackage`) have good client-side validation using `react-hook-form`. Ensure similar validation exists on the backend (Firestore Rules) to prevent malformed data injection.
3.  **Optimization**: The dashboard fetches data heavily. Consider implementing pagination or infinite scroll for all large lists (Users, Bookings) if not already fully implemented across all modules.
