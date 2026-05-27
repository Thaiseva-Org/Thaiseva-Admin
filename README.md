# Thaiseva Admin Portal & Partner Dashboard

The official administrative and partner management portal for **Thaiseva**. This system enables admin staff and partners to manage client bookings, onboard new service providers, handle communication, monitor platform statistics, and generate billing invoices.

---

## 🔗 Project Links

*   **Production Admin Portal**: [https://hotel-booking-admin.web.app/dashboard](https://hotel-booking-admin.web.app/dashboard)

---

## 🌟 Key Features

*   **📦 Comprehensive Booking Manager**: Admin tracking and CRUD interface for car rentals (Self-Drive & with Driver), vans, hotel rooms, and sightseeing packages.
*   **🤝 Structured Partner Onboarding**: Step-by-step registration for:
    *   Hotels/Accommodations
    *   Local Partners
    *   Drivers & Transportation
    *   Restaurants & Dine-In Partners
*   **💬 Real-time Communication**: Firebase-backed chat rooms categorized by support type (Customer Support, Driver Support, Hotel Support, Local Partner Support, and Restaurant Support) with real-time syncing.
*   **🗺️ Interactive Geo-Tracking**: Integrated Google Maps for partner onboarding and direction configurations.
*   **⚙️ Configuration Manager**: Live content modifications including FAQ seeding, banner uploads, and promotional banners for the main customer application.
*   **📈 Stat Tracker & Charts**: Visualizes earnings and user registration metrics using interactive bar and line charts.
*   **📄 Automated Invoices**: Generate billing invoices using custom PDF layouts compiled client-side.

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

## 📁 Repository Structure

```
├── .firebase/                 # Firebase staging and caching artifacts
├── functions/                 # Firebase Cloud Functions (TypeScript)
│   ├── src/                   # Functions source code (triggers, hooks, and utilities)
│   └── package.json           # Function-specific dependencies
├── src/                       # Main React application source code
│   ├── assets/                # Images, fonts, and static vectors
│   ├── components/            # Shared UI components (Charts, Maps, Banners, Tables)
│   ├── contextAPIs/           # React Context state management providers
│   ├── firebase/              # Firebase Client SDK initializer and configuration
│   ├── layouts/               # Layout components (Sidebar, Navbar, wrappers)
│   ├── pages/                 # Routing pages (Admin/Partner Dashboards, Forms)
│   ├── routes/                # Route definitions & protection layers (PrivetRouter)
│   ├── services/              # API interfaces, database encryption, and records fetchers
│   └── utils/                 # Helper functions, formatters, and links definitions
├── firestore.rules            # Security rules for Firestore Database
├── storage.rules              # Security rules for Firebase Cloud Storage
├── firebase.json              # Firebase CLI Hosting and codebase configuration
├── tailwind.config.js         # Tailwind CSS styling tokens config
└── package.json               # Development and runtime dependencies config
```

---

## 🔒 Configuration & Environment Setup

The application connects to Firebase and Google Maps services. Create a `.env` file in the root directory:

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
