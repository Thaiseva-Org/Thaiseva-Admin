# Thaiseva Admin Portal & Partner Dashboard

The official administrative and partner management portal for **Thaiseva**. This system enables admin staff and partners to manage client bookings, onboard new service providers, handle communication, monitor platform statistics, and generate billing invoices.

---

## 🔗 Project Links

*   **Production Admin Portal**: [https://hotel-booking-admin.web.app/dashboard](https://hotel-booking-admin.web.app/dashboard)

---

## 📚 Project Documentation Hub

Complete technical, architectural, API, and operational documentation is consolidated in the [`/docs`](./docs/README.md) hub:

*   🎨 **[Design System & UI Tokens](./docs/01-design-system/DESIGN_SYSTEM_AND_THEME.md)**: Color palettes, Tailwind tokens, CSS variables, and badge components.
*   🏛️ **[System Architecture Document](./docs/02-architecture/SYSTEM_ARCHITECTURE.md)**: SPA structure, serverless Cloud Functions, triggers, and hold sequence flows.
*   🔌 **[API Architecture & Endpoints Specification](./docs/03-api/API_SPECIFICATION.md)**: The single source of truth for mobile apps and website checkouts (`asia-east2`).
*   🌐 **[Third-Party Integrations Guide](./docs/03-api/THIRD_PARTY_INTEGRATIONS.md)**: Stripe webhooks, Google Maps Platform, Zoho ZeptoMail OTP, and WhatsApp.
*   🗄️ **[Firestore Data Schema Dictionary](./docs/04-data/DATA_SCHEMA_DICTIONARY.md)**: Authoritative NoSQL collections, subcollections, and legacy field fallbacks.
*   🔒 **[Security & RBAC Architecture](./docs/05-security/SECURITY_AND_RBAC.md)**: Multi-tenant boundaries, roles matrix, and security rules governance.
*   ⚖️ **[Thailand PDPA & Data Deletion Guide](./docs/05-security/DATA_PRIVACY_PDPA.md)**: Right to erasure, 30-day grace period, and tax retention rules.
*   🚀 **[DevOps & Deployment Runbook](./docs/06-devops/DEPLOYMENT_RUNBOOK.md)**: Local setup, emulator execution, and phased Firebase deployments.
*   📖 **[Admin & Partner Operations Manual](./docs/07-user-guides/ADMIN_USER_MANUAL.md)**: Operational guide for admins, hotels, and fleet operators.
*   🛠️ **[Operations & Incident Runbook](./docs/08-operations/OPERATIONS_RUNBOOK.md)**: SRE guide for stuck holds, failed webhooks, and index errors.
*   🧪 **[Test Strategy & QA Plan](./docs/09-testing/TEST_STRATEGY.md)**: Testing pyramid, concurrency race condition tests, and release gates.

**Base Cloud Functions URL:** `https://asia-east2-<PROJECT_ID>.cloudfunctions.net/<FunctionName>`  
**Auth Header:** `Authorization: Bearer <Firebase ID token>`

---

## 🌟 Core Modules & Features

### 📦 1. Booking Operations Manager
Admin tracking and CRUD interface covering all service categories:
*   **Car bookings**: Driver-inclusive rides with `transportType` car / van / taxi / bike (one list, one API).
*   **Self-drive**: Rental fleet assignment and document verification.
*   **Hotel Room Reservations**: Manage check-in/out dates, guest details, room numbers, and track pricing splits.
*   **Sightseeing & Tour Packages**: Detail itineraries, days/nights layouts, included activities, and authorized travel operators.

### 🤝 2. Partner Onboarding Pipeline
Comprehensive registration flows that handle licensing, payment info, and profiles for:
*   **Hotels/Accommodations**
*   **Local Partners & Service Providers** (via external application route or embedded admin modal with direct status assignment and isolated auth sessions)
*   **Drivers & Logistics Operators**
*   **Restaurants & Dine-In Partnerships**

### 💬 3. Chat Room Infrastructure
Direct, real-time messaging between admins and partners, divided into specific channels powered by Firestore:
*   `Customer Support` (Clients to Admin)
*   `Driver Support` (Drivers to Admin)
*   `Hotel Support` (Hotels to Admin)
*   `Local Partner Support` (General Partners to Admin)
*   `Restaurant Support` (Restaurants to Admin)

### 📈 4. Statistics Dashboard & Visualizations
Built-in business analytics utilizing **Chart.js** and **React ChartJS 2**:
*   Track revenue logs, booking frequencies, and user registrations.
*   Interactive grid representations and graphs comparing partner groups.

### 📄 5. Invoicing & Billing Engine
A reporting service utilizing `@react-pdf/renderer` and `jsPDF` auto-tables:
*   Dynamically compile partner orders, service fees, commissions, and taxes.
*   Supports live client-side PDF preview and download capabilities.

---

## 🛠️ Technology Stack

*   **Frontend Core**: [React 19](https://react.dev/) & [Vite 7](https://vite.dev/) (Module type: ESM)
*   **Routing**: [React Router DOM v7](https://reactrouter.com/)
*   **Styling & UI**: [Material UI v6](https://mui.com/), [Emotion](https://emotion.sh/), [Tailwind CSS v3](https://tailwindcss.com/)
*   **Database & Auth**: [Firebase SDK v12](https://firebase.google.com/) (Firestore, Storage, Authentication)
*   **Backend Triggers**: [Firebase Cloud Functions](https://firebase.google.com/docs/functions) (TypeScript)
*   **Visualizations**: [Chart.js](https://www.chartjs.org/) & [React ChartJS 2](https://react-chartjs-2.js.org/)
*   **Invoicing / Reporting**: [@react-pdf/renderer](https://react-pdf.org/) & [jsPDF](https://github.com/parallax/jsPDF)

---

## 📁 Repository Blueprint

```
├── .firebase/                 # Firebase staging and caching artifacts
├── functions/                 # Firebase Cloud Functions (TypeScript)
│   ├── src/                   # Functions source code (triggers, hooks, and utilities)
│   │   ├── triggers/          # Firestore triggers (e.g. updating stats, hotel listeners)
│   │   ├── utils/             # TypeScript backend helper functions
│   │   └── index.ts           # Functions entry point
│   ├── package.json           # Function-specific dependencies
│   └── tsconfig.json          # TypeScript configurations
├── src/                       # Main React application source code
│   ├── assets/                # Images, animations (Lottie), and static assets
│   ├── components/            # UI components (Shared UI elements, Charts, Map interfaces)
│   │   ├── reports/           # PDF Invoices, tables, and financial invoice layouts
│   │   └── websiteConfig/     # Live site banners, image upload utilities
│   ├── contextAPIs/           # React Context providers (state management)
│   ├── firebase/              # Firebase Client SDK configuration & custom endpoints
│   ├── layouts/               # Admin and Partner page layouts (Sidebar, Navbar, wrappers)
│   ├── pages/                 # Full pages grouped by Dashboard context
│   │   ├── dashboard/         
│   │   │   ├── adminDashboard/# Primary Admin layouts (orders, statistics, requirements)
│   │   │   └── partnerDashboard/# Partner-specific profiles, bookings, and menus
│   │   └── login/             # Portal authentication screen
│   ├── routes/                # Protected routes (`AdminRoute`, `PartnerRoute`, etc.)
│   ├── services/              # API interfaces, database encryption, and records fetchers
│   ├── utils/                 # General helpers, formatters, and sidebar routes
│   └── validation/            # Zod validation schemas
├── firestore.rules            # Security rules for Firestore Database
├── storage.rules              # Security rules for Firebase Cloud Storage
├── firebase.json              # Firebase CLI Hosting and codebase configuration
├── tailwind.config.js         # Tailwind CSS styling tokens config
└── package.json               # Development and runtime dependencies config
```

---

## 🔒 Configuration & Environment Setup

Create a `.env` file in the root directory to store your service API configurations:

```env
# Firebase Client SDK Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=gothai-admin.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=gothai-admin
VITE_FIREBASE_STORAGE_BUCKET=gothai-admin.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Google Maps Configuration
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

---

## 🗄️ Firestore Database Schema Reference

Below is a detailed guide on the primary Firestore database collections and document shapes:

### 1. User & Partner Accounts (`users`, `partners`, `drivers`, `restaurants`)

*   **`users`**: Main identity profiles for staff and users.
    ```typescript
    interface UserRecord {
      uid: string;
      email: string;
      displayName: string;
      role: 'Admin' | 'Partner' | 'Sub Admin';
      status: 'Pending' | 'Verified';
      phoneNo?: string;
      phoneNumber?: string;
      photoURL?: string;
      createdAt: Timestamp;
    }
    ```
*   **`partners`**: Standard Local Partners profiles.
    ```typescript
    interface PartnerRecord {
      uid: string;
      fullName: string;
      email: string;
      address: string;
      phoneNumber: string;
      serviceCategory: string | string[];
      status: 'Pending' | 'Verified';
      paymentInformation: {
        bankName: string;
        accountNumber: string;
        bankAddress: string;
      };
    }
    ```

### 2. Hotel & Accommodation Catalog (`HotelDB`)
*   **`HotelDB/{hotelId}`**: Details of the registered hotel partner.
    ```typescript
    interface HotelRecord {
      hotel: {
        hotelId: string;
        hotelUid: string;
        hotelName: string;
        startingPrice: number;
        totalRooms: number;
        address: string;
        images: {
          logo: string;
          gallery: string[];
        };
        rating: number;
        status: 'Verified' | 'Pending';
      };
    }
    ```
*   **`HotelDB/{hotelId}/rooms/{roomId}`**: Subcollection containing detailed room types.
    ```typescript
    interface RoomRecord {
      roomName: string;
      totalRooms: number; // inventory for availability (default 5)
      maxGuests: number;
      numberOfBeds: number;
      photos: string[];
      amenities: string[];
      pricing: {
        basePrice: number;
        pricePerNightAfterDiscount: number;
      };
    }
    ```
*   **Room Availability (admin):** Hotel Related → **Room Availability**
    *   Hub: `/dashboard/hotel-room-availability` (main statistics)
    *   Detail: `/dashboard/hotel-room-availability/:hotelId` (calendar, auto-book, extra/block)
    *   Service: `src/services/HotelAvailability.js` (Firestore client)
    *   Storage: `HotelDB/{hotelId}/availability`, optional `hotelRoomInventory`
    *   Docs: `documentation/HOTEL_AVAILABILITY_API.md`

### 3. Bookings (`hotelBookingData`, `travelBookingDetails`, `dineInBookings`)
*   **`hotelBookingData`**: Accommodation orders.
    ```typescript
    interface HotelBooking {
      bookingId: string;
      fullName: string;
      guestEmail: string;
      hotelId: string;
      hotelName: string;
      roomName: string;
      checkInDate: string | Timestamp;
      checkOutDate: string | Timestamp;
      amount: number;
      isPaymentDone: boolean;
      status: 'Pending' | 'Accepted' | 'Canceled';
    }
    ```

---

## 🚀 Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) (Version: `24.8.0` recommended)
*   [npm](https://www.npmjs.com/) (Version: `11.6.2` recommended)

### Installation

1.  Clone the repository and navigate to the project directory:
    ```bash
    git clone https://github.com/Thaiseva-Org/Thaiseva-Admin.git
    cd Thaiseva-Admin
    ```

2.  Install dependencies for the frontend application:
    ```bash
    npm install
    ```

3.  Install dependencies for Firebase Cloud Functions:
    ```bash
    cd functions
    npm install
    cd ..
    ```

### Development Scripts

Within the root directory, you can run:

*   `npm run dev`: Runs the app in development mode on [http://localhost:5173](http://localhost:5173).
*   `npm run build`: Compiles the React project into highly optimized static production files inside `/dist`.
*   `npm run preview`: Previews the local production build.
*   `npm run lint`: Analyzes files for code errors or styling warnings.

---

## ☁️ Firebase Infrastructure & Deployment

### Firestore Security Rules
Access is restricted based on administrative clearance check helper functions within `firestore.rules`:
*   `isAdmin()`: Validates request email against admin domains or verifies roles in the `/users/` database document.
*   `isOwner()`: Matches incoming resources against the authentication UID.

### Storage Security Rules
Rules defined in `storage.rules` restrict writes on partner files and banners to authenticated accounts, while keeping public assets read-accessible.

### Deployments
Deployments are managed via the Firebase CLI:

1.  **Build the production frontend**:
    ```bash
    npm run build
    ```

2.  **Deploy everything (Hosting, Cloud Functions, and DB Rules)**:
    ```bash
    firebase deploy
    ```
