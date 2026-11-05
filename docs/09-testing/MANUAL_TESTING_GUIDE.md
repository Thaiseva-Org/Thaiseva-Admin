# 📋 ThaiSeva Admin Portal: Complete Manual Testing Guide

**Document Version:** 2.1 (Self-Contained In-App Quality Assurance Manual)  
**Target Environment:** Local Dev (`http://localhost:5173`) & Production (`https://gothai-admin.web.app`)  
**Format:** Where to Go $\rightarrow$ What to Do $\rightarrow$ What Will Happen (Expected Result)  

---

## 📑 Test Suite Navigation Directory

1. [Automated Pre-Flight Terminal Tests](#1-automated-pre-flight-terminal-tests)
2. [Authentication & Session Management](#2-authentication--session-management)
3. [Global Dashboard, Account Settings & Push Notifications](#3-global-dashboard-account-settings--push-notifications)
4. [Hotel Catalog, Rooms & Availability Calendar](#4-hotel-catalog-rooms--availability-calendar)
5. [Hotel Room Bookings Triage & Payments](#5-hotel-room-bookings-triage--payments)
6. [Sightseeing Tours & Daily Capacity](#6-sightseeing-tours--daily-capacity)
7. [Transport Fleet, Transfers & Car Rentals](#7-transport-fleet-transfers--car-rentals)
8. [Omnichannel Live Customer Support Chat](#8-omnichannel-live-customer-support-chat)
9. [Attractions, Categories & Places Hub](#9-attractions-categories--places-hub)
10. [Website Marketing CMS & Media Management](#10-website-marketing-cms--media-management)
11. [Financial Statistics, Records & PDF Invoices](#11-financial-statistics-records--pdf-invoices)
12. [User Directory, PDPA Erasure & Sub-Admins](#12-user-directory-pdpa-erasure--sub-admins)

---

## 1. Automated Pre-Flight Terminal Tests

Run these two commands in your terminal before starting browser testing:

| Test ID | Where to Run | What to Do | What Will Happen (Expected Result) |
|---|---|---|---|
| **AUTO-01** | Terminal root | Run `node --test scripts/adminAccess.test.mjs scripts/offerBanners.test.mjs scripts/supportCategory.test.mjs` | Passes all 6 unit tests in ~130ms. Validates role permissions, banner URL sanitizer, and chat category logic. |
| **AUTO-02** | Terminal root | Run `npm run build` | Compiles Vite production bundle cleanly with zero syntax or import errors. |

---

## 2. Authentication & Session Management

| Test ID | Where to Go | What to Do | What Will Happen (Expected Result) |
|---|---|---|---|
| **AUTH-01** | `/login` | Enter valid admin email and password $\rightarrow$ Click **Log In** | Successfully signs in and redirects to `/dashboard`. User avatar and email display in the header bar. |
| **AUTH-02** | `/login` | Enter incorrect password $\rightarrow$ Click **Log In** | Red toast alert appears: *"Invalid credentials"*. Screen remains on login with password cleared. |
| **AUTH-03** | `/forgot-password` | Enter registered admin email $\rightarrow$ Click **Reset Password** | Success alert displays. Firebase sends a password reset email to the address. |
| **AUTH-04** | Top Header Bar | Click your profile avatar $\rightarrow$ Click **Change Password** $\rightarrow$ Enter current and new 12+ char password $\rightarrow$ Confirm | Password updates in Firebase Auth. Subsequent logins require the new password. |
| **AUTH-05** | Top Header Bar | Click the red **Log Out** button | Session is cleared, Auth token revoked, and page redirects immediately to `/login`. |
| **AUTH-06** | Browser URL bar | While logged out, paste `http://localhost:5173/dashboard` | Route guard triggers immediately; redirects to `/login` without exposing dashboard data. |

---

## 3. Global Dashboard, Account Settings & Push Notifications

| Test ID | Where to Go | What to Do | What Will Happen (Expected Result) |
|---|---|---|---|
| **DASH-01** | `/dashboard` | Open main dashboard | Displays platform statistics (Total Earnings, Active Bookings, Hotels, Tours) and promotional banner carousel. |
| **DASH-02** | `/dashboard` | Scroll to Recent Bookings table | Shows latest cross-vertical reservations with customer name, vertical badge, and real-time status. |
| **DASH-03** | `/dashboard/today-arrival` | Click **Today Arrivals** in sidebar | Shows travelers arriving today across airport transfers and hotel check-ins with contact phone numbers. |
| **SETT-01** | `/dashboard/settings` | Go to **Account Settings** $\rightarrow$ Update display name or phone number $\rightarrow$ Click **Save** | Admin profile information updates in Firestore and persists across sessions. |
| **NOTIF-01** | `/dashboard/notifications` | Go to **Manage Notifications** $\rightarrow$ Enter Title (max 60 chars), Body (max 240 chars), upload image, crop using interactive slider, set optional expiry date $\rightarrow$ Click **Send Broadcast** | Push notification dispatches to all registered customer mobile devices and records in the sent notifications log. |

---

## 4. Hotel Catalog, Rooms & Availability Calendar

| Test ID | Where to Go | What to Do | What Will Happen (Expected Result) |
|---|---|---|---|
| **HOTEL-01** | `/dashboard/hotels` | Click the **Active / Inactive** toggle switch on any hotel row | Switch updates instantly with a saving state; turns green/gray. Consumer website shows or hides the property immediately. |
| **HOTEL-02** | `/dashboard/hotels/add` | Fill property name, city (*Bangkok*, *Phuket*, etc.), address, Google Map pin, commission percentage, amenities, and upload photos $\rightarrow$ Click **Save Hotel** | New hotel is created with default status `Active` and appears in the hotel directory. |
| **HOTEL-03** | `/dashboard/hotels` | Click the **Bed Icon** (*Manage Rooms*) on a hotel | Navigates to `/dashboard/hotels/:hotelId/rooms`. Shows list of room categories (Deluxe, Suite, etc.) with rack rates and bed options. |
| **HOTEL-04** | `/dashboard/hotels/:hotelId/rooms` | Click **+ Add Room Package** $\rightarrow$ Fill name, base capacity, rack rate, and upload room photos $\rightarrow$ Click **Save** | New room type creates in `hotelPackageDetails` and syncs with `HotelDB/{hotelId}/rooms`. |
| **HOTEL-05** | `/dashboard/hotel-room-availability` | Select a hotel from the dropdown $\rightarrow$ View monthly calendar | Grid displays daily remaining inventory numbers color-coded: 🟢 Green (3+), 🟡 Yellow (1–2), 🔴 Red (0 / Sold Out). |
| **HOTEL-06** | `/dashboard/hotel-room-availability` | Click a specific date cell $\rightarrow$ Select **"Block Out Rooms"** $\rightarrow$ Enter reason (e.g. *"Plumbing repair"*) $\rightarrow$ Click **Confirm** | Date cell turns gray with a padlock icon. Available rooms count becomes `0`. Website checkout blocks this date. |
| **HOTEL-07** | `/dashboard/hotel-room-availability` | Click a holiday date $\rightarrow$ Select **"Add Extra Rooms"** $\rightarrow$ Enter `+5` $\rightarrow$ Confirm | That date's available room count increases by 5 immediately. |
| **HOTEL-08** | `/dashboard/hotel-room-availability` | Look at top action toolbar $\rightarrow$ Click **"Release Orphaned Holds"** | Modal opens detecting expired 10-minute cart holds. Clicking **"Release All Expired Holds"** frees locked rooms back to available stock. |

---

## 5. Hotel Room Bookings Triage & Payments

| Test ID | Where to Go | What to Do | What Will Happen (Expected Result) |
|---|---|---|---|
| **RBOOK-01** | `/dashboard/room-bookings` | Review queue tabs | Queue organized by: **Pending Requests**, **Confirmed Bookings**, **Canceled Bookings**. |
| **RBOOK-02** | `/dashboard/room-bookings` | Locate a reservation with blue badge $\rightarrow$ Click **Shield Icon** (*Verify Payment*) | Modal displays customer's uploaded Thai PromptPay QR bank transfer slip. Clicking **"Confirm Verified"** updates badge to 🟢 **Paid**. |
| **RBOOK-03** | `/dashboard/room-bookings` | On a verified pending booking, click the green **Accept Booking** (checkmark icon) | Atomic transaction runs: locks room inventory dates, transitions status to **Confirmed**, and transmits a digital voucher to the customer. |
| **RBOOK-04** | `/dashboard/room-bookings` | Click the red **Cancel / Reject** button $\rightarrow$ Select cancellation reason $\rightarrow$ Confirm | Booking moves to **Canceled** tab. The locked dates **automatically return to available room inventory pool (+1)**. |
| **RBOOK-05** | `/dashboard/room-bookings` | In the top right corner, click the **Calendar View** icon | Interface switches from table to interactive Gantt timeline displaying room occupancy by room number. |
| **RBOOK-06** | `/dashboard/room-bookings` | Select multiple checkboxes on the table $\rightarrow$ Click **Export Selected to Excel** | Generates and downloads an `.xlsx` spreadsheet of selected reservations. |

---

## 6. Sightseeing Tours & Daily Capacity

| Test ID | Where to Go | What to Do | What Will Happen (Expected Result) |
|---|---|---|---|
| **TOUR-01** | `/dashboard/travel-services` | Click **Active / Inactive** toggle on any tour package | Package visibility toggles immediately. Inactive packages disappear from the public website tour catalog. |
| **TOUR-02** | `/dashboard/travel-services/add` | Fill Title, Destination city, Duration, Highlights, Inclusions, Adult & Child rack rate, and upload photos $\rightarrow$ Click **Save** | New tour package publishes live to customer channels. |
| **TOUR-03** | `/dashboard/travel-services` | Click the **Settings (Gear Icon)** in the toolbar | `SightseeingSettingsModal` opens. Changing **Global Daily Capacity Limit** (default `20`) enforces maximum concurrent bookings per day. |
| **TOUR-04** | `/dashboard/travel-bookings` | Check arriving dates on new bookings | • **Tomorrow or Day 2**: Labeled `REQUEST` flow (payment locked until staff confirmation).<br>• **Day 3+**: Labeled `INSTANT` flow (Stripe 35-min hold checkout). |
| **TOUR-05** | `/dashboard/travel-bookings` | On a `REQUEST` booking, click **View Details** $\rightarrow$ Click **Confirm & Open Payment** | Status transitions to `AWAITING_PAYMENT`, `isBookingConfirmed: true`. Traveler gets an alert in their app to proceed with payment. |
| **TOUR-06** | `/dashboard/travel-bookings` | In the booking details drawer, enter **Provider Name** (*"Phuket Marine Co"*) and **Provider Phone** $\rightarrow$ Click **Confirm & Assign Operator** | Local operator details bind to the booking and appear on the customer's PDF voucher. |
| **TOUR-07** | `/dashboard/travel-bookings` | Click **Thai QR / Onsite** tab $\rightarrow$ For cash-on-pickup tours, click **Mark Payment Collected** | Updates financial records to mark cash collected by tour guide. |

---

## 7. Transport Fleet, Transfers & Car Rentals

| Test ID | Where to Go | What to Do | What Will Happen (Expected Result) |
|---|---|---|---|
| **TRANS-01** | `/dashboard/vans` | In **Taxi & Van Management**, click the **Vehicles** tab $\rightarrow$ Click **+ Add New Vehicle** $\rightarrow$ Enter Model (*Toyota Commuter VIP*), License Plate, Capacity (`9`), and Province $\rightarrow$ Save | Vehicle adds to active fleet registry. |
| **TRANS-02** | `/dashboard/vans` | Click the **Drivers** tab $\rightarrow$ Click **+ Add Driver** $\rightarrow$ Enter Name, Phone, Commercial Driver License No., and upload license photo $\rightarrow$ Save | Driver adds to certified dispatch roster. |
| **TRANS-03** | `/dashboard/van-bookings` | Click a new transfer booking $\rightarrow$ Click **Assign Resource** $\rightarrow$ Select van and driver $\rightarrow$ Click **Confirm Dispatch** | Driver gets the trip manifest; customer receives notification with driver name, phone, and vehicle plate number. |
| **TRANS-04** | `/dashboard/car-bookings` | Click a new taxi sedan booking $\rightarrow$ Click **Assign Driver** $\rightarrow$ Select driver $\rightarrow$ Confirm | Assigns vehicle and notifies traveler of sedan pickup details. |
| **TRANS-05** | `/dashboard/self-drive-bookings` | Locate a car rental booking $\rightarrow$ Click **View Details** | Dialog displays uploaded customer **Passport** and **International Driving Permit (IDP)** for verification. |
| **TRANS-06** | `/dashboard/self-drive-bookings` | At airport car handover, click **Record Deposit** $\rightarrow$ Enter `THB 5,000` | Status moves to **In Progress (Vehicle Handed Over)**. |
| **TRANS-07** | `/dashboard/self-drive-bookings` | Upon car return, inspect vehicle $\rightarrow$ Click **Refund Deposit** | Deposit refund is logged, and booking status transitions to **Completed**. |

---

## 8. Omnichannel Live Customer Support Chat

| Test ID | Where to Go | What to Do | What Will Happen (Expected Result) |
|---|---|---|---|
| **CHAT-01** | `/dashboard/customer-chat` | Click **Customer Chat** in sidebar | Left inbox loads conversation threads with badge counter for unread messages. |
| **CHAT-02** | `/dashboard/customer-chat` | Click a customer conversation | Header displays customer name and **active topic chip** (e.g., **"Chatting in Visa"** or **"Chatting in Hotel"**). |
| **CHAT-03** | `/dashboard/customer-chat` | Type a reply $\rightarrow$ Press `Enter` or click the Send icon | Message appears immediately with a sent checkmark and syncs in real-time to customer's mobile app. |
| **CHAT-04** | `/dashboard/customer-chat` | Click the **Paperclip Icon** $\rightarrow$ Attach an image or PDF voucher $\rightarrow$ Send | Image previews directly inside the chat bubble with a one-click download/view link. |
| **CHAT-05** | `/dashboard/customer-chat` | Check conversation history for a customer who switched topics | Centered chip in the timeline displays: *Switched from Visa to Work Permit*. History is immutable. |

---

## 9. Attractions, Categories & Places Hub

| Test ID | Where to Go | What to Do | What Will Happen (Expected Result) |
|---|---|---|---|
| **ATTR-01** | `/dashboard/attractions` | Filter by city dropdown (e.g. *Phuket*, *Bangkok*) or click category pills (e.g. *Temples*, *Nightlife*) | Cards dynamically filter to display places matching the selected category and city. |
| **ATTR-02** | `/dashboard/attractions` | Click the **Manage Categories** button $\rightarrow$ In the modal, click **+ Add Category**, enter Category Name (e.g. *"Waterparks & Theme Parks"*), choose icon, and save | New category pill is created in the horizontal tab bar, ready to hold multiple attractions. |
| **ATTR-03** | `/dashboard/attractions` | Click **+ Add Attraction** $\rightarrow$ Select Category from dropdown, enter Attraction Name (e.g. *"Siam Amazing Park"*), select City, enter Address/Operating Hours/Fees, upload photos $\rightarrow$ Click **Save Attraction** | Saves the attraction under that category. You can add multiple places into the same category, and they all display under that category tab on both the admin grid and consumer website. |
| **ATTR-04** | `/dashboard/attractions` | On an attraction card, click the **Edit** (pencil) icon to update details, or click the **Delete** (trash) icon to remove | Updates save immediately or the place is removed from the catalog. |

---

## 10. Website Marketing CMS & Media Management

| Test ID | Where to Go | What to Do | What Will Happen (Expected Result) |
|---|---|---|---|
| **CMS-01** | `/dashboard/website-config/offers` | Click **+ Add New Banner** $\rightarrow$ Upload banner graphic, enter title, set optional destination link $\rightarrow$ Click **Save Banner** | Banner displays in active offers list and renders on homepage promotional popup slider. |
| **CMS-02** | `/dashboard/website-config/offers` | Toggle **Active / Inactive** switch on a banner | Inactive banner is instantly hidden from customer website slider without deleting it. |
| **CMS-03** | `/dashboard/website-config/site-statistics` | Update counter numbers (e.g., *Happy Travelers: 15,000+*, *Hotels: 120+*) $\rightarrow$ Click **Save Site Statistics** | Homepage "About Us" social proof counters update immediately. |
| **CMS-04** | `/dashboard/website-config/media` | Select **Hero Banners** tab $\rightarrow$ Click **Upload Image** on a designated media slot $\rightarrow$ Crop $\rightarrow$ Save | Replaces homepage hero background visual asset. |
| **CMS-05** | `/dashboard/website-config/blogs` | Click **+ Add New Blog** $\rightarrow$ Type title, author, write article in rich-text editor, upload cover photo $\rightarrow$ Set status **Published** $\rightarrow$ Save | Blog article publishes to `https://thaiseva.com/blogs`. |
| **CMS-06** | `/dashboard/website-config/faqs` | Click **+ Add New FAQ** $\rightarrow$ Enter question, answer, category (Hotels/Tours/Visa) $\rightarrow$ Save | Question displays in the relevant category on the public FAQ accordion. |
| **CMS-07** | `/dashboard/website-config/testimonials` | Locate customer review $\rightarrow$ Click toggle to **Show on Homepage** | Review surfaces on the customer website homepage testimonial carousel. |
| **CMS-08** | `/dashboard/website-config/contact-us` | Locate inquiry row $\rightarrow$ Click **View** $\rightarrow$ Click **Mark Resolved** | Message badge transitions from Unread to Resolved. |
| **CMS-09** | `/dashboard/website-config/contact-us` | Click **Export to CSV** | Browser downloads a `.csv` file containing all submitted contact inquiries. |
| **CMS-10** | `/dashboard/website-config/contact-us` | Click the red trash icon on an inquiry row | Confirmation popup appears. Confirming permanently deletes that inquiry. |

---

## 11. Financial Statistics, Records & PDF Invoices

| Test ID | Where to Go | What to Do | What Will Happen (Expected Result) |
|---|---|---|---|
| **FIN-01** | `/dashboard/admin-statistics` | Toggle between **Daily** and **Monthly** $\rightarrow$ Select date range | Charts render revenue breakdown across Hotels, Tours, Transfers, and Car Rentals. |
| **FIN-02** | `/dashboard/admin-statistics` | Click **Export to Excel** button in the header | Downloads formatted `.xlsx` spreadsheet of platform earnings and booking revenue. |
| **FIN-03** | `/dashboard/bookings-record` | In **Records**, search by Customer Name or Booking ID $\rightarrow$ Review columns | Complete customer financial audit log opens showing paid satang amounts, payment method, and timestamps. |
| **FIN-04** | `/dashboard/bookings-record` | Locate a booking row $\rightarrow$ Click **Preview Invoice** (eye icon) | In-app dialog opens rendering the generated PDF invoice preview directly inside an iframe. |
| **FIN-05** | `/dashboard/bookings-record` | Locate a booking row $\rightarrow$ Click **Download Invoice** (download icon) | Client-side engine compiles and downloads a branded PDF voucher/invoice with official invoice sequence ID. |
| **FIN-06** | `/dashboard/bookings-record` | Click **Export to Excel** button on Records | Downloads cross-vertical booking records spreadsheet for accountant reconciliation. |

---

## 12. User Directory, PDPA Erasure & Sub-Admins

| Test ID | Where to Go | What to Do | What Will Happen (Expected Result) |
|---|---|---|---|
| **USER-01** | `/dashboard/user-data` | In **Users Data**, view registered customer accounts $\rightarrow$ Click **Export to CSV** | Generates and downloads a `.csv` export of registered customer profiles. |
| **PDPA-01** | `/dashboard/deletion-requests` | View the **Pending Requests** tab | Displays user account erasure requests with a 30-day statutory countdown timer. |
| **PDPA-02** | `/dashboard/deletion-requests` | Click **Review Details** on an eligible request $\rightarrow$ Click **Process Erasure** | Anonymizes user PII from Firestore Auth while preserving mandatory financial tax invoices under Thai law. |
| **ADMIN-01** | `/dashboard/sub-admins` *(Head Admin)* | Click **+ Add Administrator** $\rightarrow$ Enter name, email, assign role (*Admin* or *Sub-Admin*) $\rightarrow$ Click **Create** | Sends invitation email and registers staff account with restricted role claims. |
| **ADMIN-02** | `/dashboard/sub-admins` | Click **Revoke Access** on a sub-admin account | Account status changes to suspended; immediate sign-in block takes effect. |

---

## 🎯 Verification Sign-Off Summary

When performing a manual QA pass, ensure:
1. [ ] **Terminal unit tests** pass with 0 failures (`node --test scripts/...`).
2. [ ] **Vite build** completes without syntax errors (`npm run build`).
3. [ ] **Hotel & Tour bookings** confirm properly and increment/decrement availability inventory.
4. [ ] **Live chat** loads message threads, current category header, and file attachments without refresh.
5. [ ] **Export & PDF buttons** (CSV / Excel / PDF Invoice) preview and download clean files.
6. [ ] **Log out** terminates session and blocks protected routes.
