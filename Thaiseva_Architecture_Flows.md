# Thaiseva Admin Portal - Architecture & Configuration Flows

This document details the core architecture, data flows, and configurations of the Thaiseva Admin Portal application.

## 1. Core Architecture

The Thaiseva Admin Portal is a React-based single-page application (SPA) built using modern tools and libraries:
- **Framework:** React with Vite
- **Routing:** React Router v6 (`createBrowserRouter`)
- **State Management:** React Context API (AuthContext, PartnerContext, etc.)
- **Styling:** Tailwind CSS
- **Backend & Database:** Firebase (Authentication, Firestore, Storage)

## 2. Authentication & Authorization Flow

Authentication is handled via Firebase Auth combined with Firestore to manage role-based access.

### The AuthProvider (`src/contextAPIs/AuthProvider.jsx`)
- **Login Flow:** Users log in via Firebase Auth (`signInWithEmailAndPassword`).
- **Role Fetching:** On a successful login, the `onAuthStateChanged` listener triggers and fetches the corresponding user document from the `users` collection in Firestore using the user's UID.
- **Roles:** The portal supports three main roles based on the `role` field in Firestore:
  - `Admin`: Full access to the system. (Note: `admin@gmail.com` and `thaiseva_admin@gmail.com` have hardcoded fallback bypasses to ensure access even if Firestore rules block them).
  - `Sub Admin`: Restricted admin access.
  - `Partner`: Access to partner-specific dashboards. Partners also have a `status` field. A partner is `isVerifiedPartner` only if their status is "Verified".

### Protected Routes (`src/routes/`)
- **`PrivetRouter.jsx`**: Ensures the user is logged in. If not, redirects to `/login`.
- **`AdminRoute.jsx`**: Ensures the logged-in user has the `Admin` or `Sub Admin` role. If not, redirects or logs them out.
- **`HeadAdminRoute.jsx`**: Ensures the user is strictly an `Admin` (not a Sub Admin).
- **`PartnerRoute.jsx`**: Ensures the logged-in user has the `Partner` role and is verified.

## 3. Application Data Flow

The application structure separates UI components from data fetching logic.

### Services Layer (`src/services/`)
Data fetching and Firebase transactions are abstracted into service files. For example:
- **`Bookings.js`**: Fetches all types of bookings (travel, car, room). Uses Firestore pagination (`limit`, `startAfter`) for efficient data loading.
- **`UserRecords.js`**: Fetches and paginates user lists from the `users` collection where `isAppUser == true`.
- **`HotelAvailability.js`**: Manages complex inventory logic for hotels. It fetches hotel data, calculates dynamic availability for date ranges, and handles manual room locks or blocks via Firebase Cloud Functions or direct Firestore updates.

### Global State Contexts (`src/contextAPIs/`)
Instead of prop-drilling, the app uses Context Providers to make data globally available:
- **`PartnerProvider`**: Fetches and stores the logged-in partner's specific data (e.g., driver details, hotel details) so the partner dashboard can access it instantly.
- **`StatisticsProvider`**: Fetches system-wide statistics (total bookings, revenue, users) for the Admin Dashboard overview.

## 4. UI Layout & Structure

### The Dashboard Layout (`src/layouts/Dashboard.jsx`)
- **Sidebar Integration:** The dashboard wraps child routes and provides a responsive sidebar navigation. 
- **Dynamic Navigation:** The sidebar renders different links based on whether `isAdmin`, `isSubAdmin`, or `isPartner` is true in the `AuthContext`.
- **Header:** Contains user profile avatars, notification bells, and a quick-chat toggle.

### Main Layout (`src/layouts/Main.jsx`)
- Used for non-dashboard pages like login, onboarding, and public-facing informational pages (Blogs, FAQs, Contact Us).

## 5. Firebase Configuration (`src/firebase/firebase.config.js`)
- Initializes the Firebase app.
- Exports references to Auth, Firestore (`db`), and Storage.
- Defines collection references (e.g., `usersCollection`, `bookingsCollection`) used across the services layer.
