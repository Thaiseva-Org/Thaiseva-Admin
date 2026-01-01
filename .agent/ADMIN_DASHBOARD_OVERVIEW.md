# Thaiseva Admin Dashboard - Development Overview

## Table of Contents
1. [Project Architecture](#project-architecture)
2. [Routing Structure](#routing-structure)
3. [Navigation Sections](#navigation-sections)
4. [Components Overview](#components-overview)
5. [Data Models & Firebase Collections](#data-models--firebase-collections)
6. [Context APIs & State Management](#context-apis--state-management)
7. [Services Layer](#services-layer)

---

## Project Architecture

### Tech Stack
- **Frontend Framework**: React 18 with Vite
- **Routing**: React Router v6
- **UI Library**: Material-UI (MUI)
- **Styling**: TailwindCSS
- **Backend**: Firebase (Firestore, Storage, Functions, Authentication)
- **Maps**: Google Maps API (@react-google-maps/api)
- **Notifications**: Notistack

### Project Structure
```
src/
├── assets/              # Images, animations (JSON)
├── components/          # Reusable UI components (62 files)
├── contextAPIs/         # Global state management (7 providers)
├── firebase/            # Firebase configuration
├── layouts/             # Main layout components (Dashboard, Main)
├── pages/               # Page components (71 files)
│   ├── dashboard/       # Dashboard-specific pages
│   ├── forms/           # Onboarding forms
│   └── login/           # Authentication pages
├── routes/              # Route definitions and guards
├── services/            # Business logic & API calls (8 files)
└── utils/               # Helper functions, constants, icons
```

---

## Routing Structure

### Main Routes (Route.jsx)

#### 1. **Root Route** (`/`)
- **Component**: `Main.jsx`
- **Purpose**: Landing/public pages
- **Children**: None currently defined

#### 2. **Dashboard Route** (`/dashboard`)
- **Component**: `Dashboard.jsx`
- **Guard**: `PrivetRouter` (requires authentication)
- **Children**: All admin dashboard routes

#### 3. **Onboarding Routes**
- `/partner-onboarding` → `PartnerOnboarding`
- `/hotel-onboarding` → `HotelOnboarding`

#### 4. **Authentication**
- `/login` → `Login`

#### 5. **404 Handler**
- `*` → `NotFound`

---

## Navigation Sections

The admin dashboard is organized into **6 main navigation sections**:

### 1. **Primary Links** (Top Level)
Located in: `src/utils/RouteLinks.jsx` → `newprimaryLinks`

| Label | Route | Component | Icon | Purpose |
|-------|-------|-----------|------|---------|
| Dashboard | `/dashboard` | `AdminDashboard` | HomeIcon | Main overview/statistics |
| Manage Notifications | `/dashboard/notifications` | `NewNotficationsScreen` | NotificationsRounded | Push notification management |
| Statistics | `/dashboard/admin-statistics` | `AdminStatistics` | SignalCellularAltIcon | Analytics & charts |
| Records | `/dashboard/bookings-record` | `TodayBookings` | ReceiptLongRoundedIcon | Booking records |
| Users Data | `/dashboard/user-data` | `UserData` | GroupRoundedIcon | User management |
| Sub Admins | `/dashboard/sub-admins` | `SubAdmins` | AdminPanelSettingsIcon | Admin only |

### 2. **Hotel Related Section**
Located in: `src/utils/RouteLinks.jsx` → `hotellinks`

| Label | Route | Component | Icon | Purpose |
|-------|-------|-----------|------|---------|
| Hotels | `/dashboard/hotels` | `Hotels` | ApartmentIcon | Hotel partner management |
| Room Services | `/dashboard/room-services` | `RoomServices` | LocalHotelIcon | Room packages/services |
| Room Bookings | `/dashboard/room-bookings` | `RoomBookings` | BeenhereIcon | Hotel booking orders |
| Hotel Chat | `/dashboard/hotel-chat` | `HotelSupport` | BedIcon | Hotel partner support chat |

**Badge Indicators**:
- Hotel Chat: Shows `hotelChatCount` (unread messages)
- Room Bookings: Shows pending bookings count

### 3. **Travel Related Section**
Located in: `src/utils/RouteLinks.jsx` → `Travellinks`

| Label | Route | Component | Icon | Purpose |
|-------|-------|-----------|------|---------|
| Sightseeing Packages | `/dashboard/travel-services` | `TravelServices` | LuggageIcon | Travel package management |
| Sightseeing Bookings | `/dashboard/travel-bookings` | `TravelBookings` | TravelExploreIcon | Travel booking orders |
| Taxi Bookings | `/dashboard/car-bookings` | `CarBookings` | LocalTaxiIcon | Taxi service bookings |
| Self Drive Bookings | `/dashboard/self-drive-bookings` | `SelfDriveBookings` | NoCrashIcon | Self-drive car bookings |

**Badge Indicators**:
- Travel Bookings: Shows pending count
- Car Bookings: Shows pending count
- Self Drive Bookings: Shows pending count

### 4. **Local Assistance Section**
Located in: `src/utils/RouteLinks.jsx` → `localAssislinks`

| Label | Route | Component | Icon | Purpose |
|-------|-------|-----------|------|---------|
| Customer Chat | `/dashboard/customer-chat` | `CustomerChat` | ForumIcon | Customer support chat |
| Local Services | `/dashboard/local-services` | `LocalServices` | ManageAccountsIcon | Local service management |
| Local Requirements | `/dashboard/local-requirements` | `LocalRequirements` | TaskAltIcon | Customer requirements |
| Partner Chat | `/dashboard/partner-chat` | `LocalPartnerSupport` | Diversity1Icon | Local partner support |

**Expandable Section**: Local Partners
- Route: `/dashboard/local-partners` → `LocalPartners`
- Icon: HandshakeIcon
- **Sub-items** (filtered by status):
  - Verified Partners
  - Pending Requests (shows `totalRequest` badge)
  - Denied Partners

**Badge Indicators**:
- Customer Chat: Shows `chatCount`

### 5. **Prime Locations Section**
Located in: `src/utils/RouteLinks.jsx` → `primelocationslinks`

| Label | Route | Component | Icon | Purpose |
|-------|-------|-----------|------|---------|
| Shops | `/dashboard/shopping-malls` | `ShoppingMalls` | Shop | Shopping mall management |
| Clubs | `/dashboard/clubs` | `Clubs` | NightlifeIcon | Nightlife/club management |

### 6. **Restaurant Related Section**
Located in: `src/utils/RouteLinks.jsx` → `restaurantlinks`

| Label | Route | Component | Icon | Purpose |
|-------|-------|-----------|------|---------|
| Restaurants | `/dashboard/restaurants` | `Restaurants` | RestaurantIcon | Restaurant partner management |
| Restaurant Chat | `/dashboard/restaurant-chat` | `RestaurantChat` | FastfoodIcon | Restaurant support chat |

**Badge Indicators**:
- Restaurant Chat: Shows `restaurantChatCount`

---

## Components Overview

### Key Reusable Components (src/components/)

#### Banner Management
- `HomeBanners.jsx` - Home screen banners
- `HotelBanners.jsx` - Hotel section banners
- `HotelMiniBanners.jsx` - Small hotel banners
- `FoodBanners.jsx` - Food/restaurant banners
- `TravelBanners.jsx` - Travel section banners
- `SightseeingBanners.jsx` - Sightseeing banners
- `ItemsBanner.jsx` - Item/product banners
- `BestOfferBanners.jsx` - Special offers
- `NewOffersBanner.jsx` - New offers
- `NotificationBanner.jsx` - Notification banners

#### Forms
- `AddBannerForm.jsx` - Banner creation/editing
- `AddShopForm.jsx` - Shop/mall addition
- `SightSeeingForm.jsx` - Sightseeing package form
- `CategoriesAndLogo.jsx` - Category management

#### Data Display
- `ShopsCard.jsx` - Shop display card
- `ServiceBox.jsx` - Service display
- `PartnerInvoices.jsx` - Invoice management
- `NotificationCard.jsx` - Notification display

#### Charts & Analytics
- `BarEarningChart.jsx` - Earnings bar chart
- `LineAndBarChart.jsx` - Combined chart

#### Communication
- `NotificationButton.jsx` - Notification trigger
- `RedirectWhatsApp.jsx` - WhatsApp integration

#### Utilities
- `Loading.jsx` - Loading animation
- `LoadingContent.jsx` - Content loader
- `SearchBar.jsx` - Search functionality
- `TimeAgo.jsx` - Relative time display
- `CropImageHelper.jsx` - Image cropping
- `Map.jsx` - Google Maps display
- `DirectionMap.jsx` - Directional maps
- `StaticMap.jsx` - Static map display
- `PlacesSearchBox.jsx` - Location search

#### Actions
- `ActionButtons.jsx` - Common action buttons
- `DeleteButton.jsx` - Delete action
- `UpdateButton.jsx` - Update action
- `IconButton.jsx` - Icon-based button
- `ImageButtons.jsx` - Image action buttons
- `ViewDetailsIcon.jsx` - View details trigger
- `AddRequirementIcon.jsx` - Add requirement

#### Layout
- `PageHeading.jsx` - Page title component
- `SubTitle.jsx` - Section subtitle
- `ViewAll.jsx` - View all link

#### Security
- `Secured.jsx` - Security wrapper
- `Unauthorized.jsx` - Unauthorized access handler

---

## Data Models & Firebase Collections

### Firebase Configuration (src/firebase/firebase.config.js)

#### Core Collections

1. **Users & Authentication**
   - `users` - Customer/user data
   - `agents` - Agent accounts
   - `partners` - Local service partners
   - `drivers` - Driver accounts (deprecated)

2. **Partners & Services**
   - `hotels` - Hotel partners
   - `restaurants` - Restaurant partners
   - `shops` - Shopping malls/stores
   - `clubs` - Nightlife venues
   - `localServices` - Local assistance services
   - `sightseeingPackages` - Travel packages
   - `sightseeingPackagesDetails` - Package details
   - `hotelPackages` - Hotel room packages
   - `hotelPackageDetails` - Room package details
   - `carDetails` - Taxi/car service details

3. **Bookings & Orders**
   - `hotelBookingData` - Room reservations
     - Fields: `orderedAt`, `hotelUid`, `status`, customer info
   - `travelBookingDetails` - Sightseeing bookings
     - Fields: `orderedAt`, `status`, package details
   - `car_bookings` - Taxi bookings
     - Fields: `timestamp`, `status`, car details
   - `self_driving_bookings` - Self-drive bookings
     - Fields: `time`, `status`, car details

4. **Requirements & Communication**
   - `allRequirements` - Customer requirements
   - `travelRequirements` - Travel-specific requirements
   - `chatRooms` - Chat room metadata
   - `chats` - Chat messages

5. **Content & Notifications**
   - `notifications` - Push notifications
   - `foodMenu` - Restaurant menus
   - `coupons` - Discount coupons

6. **Analytics & Finance**
   - `statistics` - General statistics
   - `hotel_statistics` - Hotel-specific stats
   - `partner_invoices` - Partner payment records

7. **Settings**
   - `settings` - App configuration
   - `settings/Service_Categories` - Service category definitions

### Data Flow Example: Room Booking

```javascript
// Booking Creation
{
  id: "auto-generated",
  hotelUid: "hotel-partner-id",
  orderedAt: Timestamp,
  status: "Pending" | "Confirmed" | "Cancelled",
  customerUid: "user-id",
  roomDetails: {...},
  checkIn: Date,
  checkOut: Date,
  totalAmount: Number,
  paymentStatus: String
}

// Fetched via: services/Bookings.js → fetchBookings()
// Displayed in: pages/dashboard/adminDashboard/clientOrders/RoomBookings.jsx
```

---

## Context APIs & State Management

Located in: `src/contextAPIs/`

### 1. **AuthProvider.jsx**
**Purpose**: User authentication & authorization

**Provides**:
- `user` - Current Firebase user
- `userData` - User profile data
- `isAdmin` - Admin role check
- `isSubAdmin` - Sub-admin role check
- `isPartner` - Partner role check
- `logOut()` - Sign out function

**Used by**: All protected routes via `PrivetRouter`, `AdminRoute`, `PartnerRoute`

### 2. **PartnerProvider.jsx**
**Purpose**: Partner & booking data management (largest provider - 20KB)

**Provides**:
- `partners` - All partners list
- `hotels` - Hotel partners
- `restaurants` - Restaurant partners
- `localPartners` - Local service partners
- `travelBookings` - Travel booking orders
- `roomBookings` - Hotel booking orders
- `carBookings` - Taxi bookings
- `selfDriveBookings` - Self-drive bookings
- `totalRequest` - Pending partner requests count
- `chatCount` - Customer chat unread count
- `hotelChatCount` - Hotel chat unread count
- `restaurantChatCount` - Restaurant chat unread count
- `setQueryText()` - Filter partners by status
- `setChatRoom()` - Switch chat room

**Real-time Listeners**: Uses Firebase `onSnapshot` for live updates

### 3. **RequirementsProvider.jsx**
**Purpose**: Customer requirements management

**Provides**:
- `requirements` - All requirements
- `localRequirements` - Local assistance requirements
- `travelRequirements` - Travel requirements
- `refreshRequirements()` - Reload data

### 4. **AdminChatProvider.jsx**
**Purpose**: Admin chat state

**Provides**:
- `data` - Chat state (user, messages)
- `dispatch()` - Chat actions (CHANGE_USER, etc.)

### 5. **PartnerChatProvider.jsx**
**Purpose**: Partner chat state

**Provides**:
- Similar to AdminChatProvider for partner chats

### 6. **NotificationsProvider.jsx**
**Purpose**: Push notification management

**Provides**:
- `notifications` - All notifications
- `unreadCount` - Unread notification count
- `markAsRead()` - Mark notification read
- `deleteNotification()` - Remove notification

### 7. **StatisticsProvider.jsx**
**Purpose**: Analytics data for admin statistics page

**Provides**:
- `statistics` - Dashboard metrics
- `loading` - Data loading state
- Revenue, booking counts, user growth data

**Used by**: `pages/dashboard/adminDashboard/adminStatistics/AdminStatistics.jsx`

---

## Services Layer

Located in: `src/services/`

### 1. **Bookings.js**
**Functions**:
- `fetchBookings(category, startDate, endDate, pagination)` - Fetch bookings by type
- `fetchBookingsTotalPages()` - Get total pages for pagination
- `fetchHotelBookings(hotelId, dates)` - Hotel-specific bookings
- `fetchHotelBookingsTotalPages()` - Hotel booking pagination

**Supports**: Room, Travel, Taxi, Self-Drive bookings

### 2. **DailyRecords.js**
**Functions**:
- `fetchDailyRecords(date)` - Get daily booking summary
- Aggregates all booking types for a specific date

### 3. **UserRecords.js**
**Functions**:
- `fetchUsers(filters, pagination)` - Get user list
- `getUserStatistics()` - User analytics

### 4. **LocalRelated.js**
**Functions**:
- `fetchLocalServices()` - Get local services
- `fetchLocalPartners(status)` - Get partners by verification status
- `updatePartnerStatus()` - Approve/deny partners
- `fetchShops()` - Get shopping malls
- `fetchClubs()` - Get nightlife venues

### 5. **Earning.js**
**Functions**:
- `fetchEarnings(period)` - Revenue data
- `calculateCommissions()` - Partner commission calculations

### 6. **Notification.js**
**Functions**:
- `sendNotification(data)` - Send push notification
- `scheduleNotification()` - Schedule future notification

### 7. **AdminDashboard.js**
**Functions**:
- `fetchDashboardStats()` - Overview statistics
- Aggregates data from multiple collections

### 8. **DataEncrypter.js**
**Functions**:
- `encrypt(data)` - Encrypt sensitive data
- `decrypt(data)` - Decrypt data

---

## Route Guards

### PrivetRouter
- **File**: `src/routes/PrivetRouter.jsx`
- **Purpose**: Requires authentication
- **Redirects to**: `/login` if not authenticated

### AdminRoute
- **File**: `src/routes/AdminRoute.jsx`
- **Purpose**: Requires admin or sub-admin role
- **Shows**: `Unauthorized` component if not admin

### PartnerRoute
- **File**: `src/routes/PartnerRoute.jsx`
- **Purpose**: Requires partner role
- **Shows**: `Unauthorized` component if not partner

### HeadAdminRoute
- **File**: `src/routes/HeadAdminRoute.jsx`
- **Purpose**: Requires head admin role (for Sub Admins management)
- **Shows**: `Unauthorized` component if not head admin

---

## Key Features

### Real-time Updates
- Partner requests (via `PartnerProvider`)
- Chat messages (via `AdminChatProvider`, `PartnerChatProvider`)
- Booking status changes
- Notification counts

### Pagination
- Implemented in booking lists
- Uses Firestore `startAfter` cursor
- Page size configurable

### Search & Filters
- Partner status filtering (Verified, Pending, Denied)
- Date range filtering for bookings
- Search bars in various sections

### Chat System
- Multiple chat rooms:
  - Customer Support (`CustomerSupport`)
  - Hotel Support (`HotelSupport`)
  - Partner Support (`LocalPartnerSupport`)
  - Restaurant Support (uses `CustomerSupport` room)
- Real-time messaging
- Unread count badges

### Notification System
- Push notification management
- Banner notifications (multiple types)
- In-app notification center
- Scheduled notifications

---

## Component Connection Map

### Example: Room Bookings Flow

1. **Navigation**: Dashboard sidebar → "Hotel Related" → "Room Bookings"
2. **Route**: `/dashboard/room-bookings` (AdminRoute protected)
3. **Component**: `pages/dashboard/adminDashboard/clientOrders/RoomBookings.jsx`
4. **Data Source**: 
   - Context: `PartnerProvider` → `roomBookings`
   - Service: `services/Bookings.js` → `fetchBookings()`
5. **Firebase**: `roomBookingCollection` (Firestore)
6. **Sub-components**:
   - `SearchBar` for filtering
   - `ActionButtons` for approve/reject
   - `ViewDetailsIcon` for booking details

### Example: Hotel Management Flow

1. **Navigation**: Dashboard sidebar → "Hotel Related" → "Hotels"
2. **Route**: `/dashboard/hotels` (AdminRoute protected)
3. **Component**: `pages/dashboard/adminDashboard/ourPartners/Hotels.jsx`
4. **Data Source**:
   - Context: `PartnerProvider` → `hotels`
   - Firebase: Real-time listener on `hotelsCollection`
5. **Sub-components**:
   - `ShopsCard` (reused for hotel display)
   - `AddShopForm` (for adding hotels)
   - `UpdateButton`, `DeleteButton`

---

## Environment Variables

Located in: `.env`

Required variables:
- `VITE_Google_Api_Key` - Google Maps API key
- Firebase config (hardcoded in firebase.config.js currently)

---

## Development Notes

### Deprecated Features
- Driver management (commented out in routes)
- Food services (commented out)
- Car services (partially deprecated)
- Coupons (route exists but commented)

### Active Development Areas
- Admin statistics dashboard
- Notification management system
- Partner onboarding flows
- Booking management

### Code Organization
- **Layouts**: `Dashboard.jsx` contains all sidebar navigation logic (1299 lines)
- **Route definitions**: Centralized in `routes/Route.jsx`
- **Navigation links**: Defined in `utils/RouteLinks.jsx`
- **Icons**: Centralized exports in `utils/Icons.jsx`

---

## Quick Reference: All Admin Dashboard Routes

| Section | Route | Component | Guard |
|---------|-------|-----------|-------|
| **Primary** | | | |
| | `/dashboard` | AdminDashboard | AdminRoute |
| | `/dashboard/notifications` | NewNotficationsScreen | AdminRoute |
| | `/dashboard/admin-statistics` | AdminStatistics | AdminRoute |
| | `/dashboard/bookings-record` | TodayBookings | AdminRoute |
| | `/dashboard/user-data` | UserData | AdminRoute |
| | `/dashboard/sub-admins` | SubAdmins | HeadAdminRoute |
| **Hotel** | | | |
| | `/dashboard/hotels` | Hotels | AdminRoute |
| | `/dashboard/room-services` | RoomServices | AdminRoute |
| | `/dashboard/room-bookings` | RoomBookings | AdminRoute |
| | `/dashboard/hotel-chat` | HotelSupport | AdminRoute |
| **Travel** | | | |
| | `/dashboard/travel-services` | TravelServices | AdminRoute |
| | `/dashboard/travel-bookings` | TravelBookings | AdminRoute |
| | `/dashboard/car-bookings` | CarBookings | AdminRoute |
| | `/dashboard/self-drive-bookings` | SelfDriveBookings | AdminRoute |
| **Local** | | | |
| | `/dashboard/customer-chat` | CustomerChat | AdminRoute |
| | `/dashboard/local-services` | LocalServices | AdminRoute |
| | `/dashboard/local-requirements` | LocalRequirements | AdminRoute |
| | `/dashboard/partner-chat` | LocalPartnerSupport | AdminRoute |
| | `/dashboard/local-partners` | LocalPartners | AdminRoute |
| **Prime Locations** | | | |
| | `/dashboard/shopping-malls` | ShoppingMalls | AdminRoute |
| | `/dashboard/clubs` | Clubs | AdminRoute |
| **Restaurant** | | | |
| | `/dashboard/restaurants` | Restaurants | AdminRoute |
| | `/dashboard/restaurant-chat` | RestaurantChat | AdminRoute |

---

## Getting Started

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Firebase Setup
1. Configure Firebase project
2. Update `.env` with Google Maps API key
3. Ensure Firestore indexes are deployed (firestore.indexes.json)
4. Deploy Firebase functions if needed

---

*Last Updated: 2025-11-23*
*Project: Thaiseva Admin Portal Web App*
   ![improve ui card in booking rooms
   ](image.png)