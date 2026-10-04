# Thaiseva Dashboard User Manual (Comprehensive Edition)

> [!NOTE]
> **Consolidated Specification:** This user guide has been unified into the authoritative **[Admin & Partner Operations User Manual](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/docs/07-user-guides/ADMIN_USER_MANUAL.md)**. Refer to that document for full role workflows, booking dispute flows, and invoice generation guides.

Welcome to the guide for navigating the Thaiseva Dashboard. This manual covers sections, features, and configurations available in the portal, categorized by user role (Admin vs. Partner).

---

## 1. Access & Global Features

### Logging In
- Navigate to the `/login` page.
- Enter your registered email and password. 
- Based on your assigned role (Admin, Sub-Admin, or Partner), the system will automatically route you to your tailored dashboard.

### Dashboard Global Interface
- **Sidebar Navigation:** Located on the left side of the screen. This is dynamically generated based on your permissions. On smaller screens, use the "hamburger" menu icon in the top left to expand the sidebar.
- **Top Header:** 
  - **Breadcrumbs / Current Page:** Displays where you are.
  - **Search/Query Field:** Filter data tables quickly.
  - **Notification Bell:** Click to view alerts (e.g., new bookings, partner requests).
  - **Profile Avatar:** Click to log out or view your account summary.

---

## 2. Admin & Sub-Admin Dashboard Capabilities

Administrators have extensive tools to manage all aspects of the Thaiseva platform. The sidebar for Admins is broken down into specific operational categories.

### 🏠 General Operations (Primary Links)
- **Dashboard:** The main landing page, offering quick glances at recent activities.
- **Manage Notifications:** Send, review, and manage push notifications to app users or partners.
- **Statistics:** A comprehensive analytics page showing data like Total Revenue, User Growth, and Booking Volumes across all sectors.
- **Records (Bookings Record):** A historical log of completed and past bookings across all services.
- **Users Data:** A directory of all registered app users. You can view their profiles and activity.
- **Deletion Requests:** Handle compliance by processing user requests to delete their accounts and data from the system.

### 🤝 General Partners
- **Manage Partners:** Onboard, verify, or deny general service partners who apply to work with Thaiseva. View their submitted documents and approve their "Pending" status to "Verified".

### ⚙️ Website Configuration
Manage the public-facing Thaiseva website and app content directly from the dashboard:
- **Blogs:** Write, edit, and publish blog articles for SEO and marketing.
- **FAQs:** Add or modify Frequently Asked Questions to assist users.
- **Testimonials:** Approve and display customer reviews.
- **Contact Us:** View and respond to inquiries submitted through the public contact form.

### 🏨 Hotel Related Management
- **Hotels:** A directory of all onboarded hotel partners. Admins can manually add new hotels or edit existing hotel profiles.
- **Room Availability:** An administrative override calendar. Admins can view the availability of any hotel and manually block/unblock rooms if a partner is unable to do so themselves.
- **Room Bookings:** Manage all customer reservations for hotels. Approve, modify, or cancel bookings as needed.

### ✈️ Travel & Transport Related
- **Sightseeing Packages:** Build and manage travel itineraries, set pricing, and define inclusions/exclusions.
- **Sightseeing Bookings:** Manage customer purchases of travel packages.
- **Taxi & Van Management:** Register fleet vehicles, assign drivers, and manage transport assets.
- **Van Bookings:** Specific reservations for large group van transport.
- **Car Bookings:** Standard taxi or point-to-point car reservations.
- **Self Drive Bookings:** Manage reservations for rental cars without drivers.

### 💬 Local Assistance & Communication
- **Customer Chat:** Directly chat with app users needing assistance.
- **App Chat:** General support channel for app technical issues.
- **Local Partners:** Manage freelance or independent local guides.
- **Local Requirements:** Review custom requests posted by users needing specific local assistance.
- **Partner Chat:** Dedicated support channel for communicating with verified partners.

### 📍 Prime Locations
- **Shops:** Manage listings of recommended shopping malls or local stores.
- **Clubs:** Manage listings of nightlife venues and clubs.

---

## 3. Partner Dashboard Capabilities

If you are a verified Partner, your dashboard is strictly limited to the tools required to operate your specific business with Thaiseva.

### 👤 Global Partner Features
- **Profile:** View your business profile, edit contact details, and update your banking/payout information.
- **Support:** Submit tickets or view FAQs specifically designed for partners.
- **Messages:** A direct chat window to communicate with Thaiseva Administrators regarding disputes, payouts, or help.

### 🏨 Hotel Partners
*If your service category is "Hotel":*
- **Added Rooms:** Create and manage your room inventory. Upload photos, set amenities (e.g., WiFi, AC, Balcony), and set base pricing.
- **Room Availability (Calendar):** A crucial tool. Use this calendar to block out dates when your hotel is fully booked offline to prevent double-booking on Thaiseva.
- **Bookings:** View all incoming reservations. You will see guest details, check-in/out dates, and payment status.
- **Today Arrivals:** A quick-glance manifest of all guests scheduled to check in today.

### 🚗 Driver & Transport Partners
*If your service category is "Driving" or Transport:*
- **My Services:** Define your typical routes, vehicle type, and availability status.
- **Assigned Rides / Bookings:** View upcoming scheduled rides, pickup locations, and passenger details.

### 🤝 Local Partners & Guides
*If your service category falls under general/local assistance:*
- **My Services:** List the specific skills or tours you offer (e.g., Translation, City Tour).
- **Requirements:** Browse custom requests posted by users (e.g., "Need a translator for a business meeting tomorrow") and accept jobs.

---

## 4. Best Practices & Troubleshooting

- **Caching Issues:** If the dashboard seems stuck or data isn't refreshing, use the reload button on your browser. The dashboard uses real-time Firebase listeners, so it should sync instantly, but a hard refresh resolves localized state issues.
- **Approving Partners (For Admins):** Always ensure legal documents are reviewed before moving a partner from "Pending" to "Verified". Unverified partners cannot access their dashboards.
- **Maintaining Inventory (For Hotel Partners):** It is your responsibility to keep the "Room Availability" calendar updated. Thaiseva is not liable for overbookings caused by outdated calendars.
