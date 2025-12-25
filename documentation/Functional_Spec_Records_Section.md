# Functional Specification Report: Record Section

## 1. Executive Summary

The **Record Section** (specifically "Today Bookings") serves as the central financial and operational dashboard for the platform. It allows administrators to monitor, reconcile, and manage confirmed daily bookings across four distinct business verticals: Room Bookings, Sightseeing Packages, Taxi Services, and Self-drive Rentals.

The module provides a unified view of accepted orders, enabling financial transparency through instant commission calculations, payment status tracking, and automated invoice generation for both end-users and service partners.

**Primary User:**
*   **Administrator & Sub-Administrator** (Authenticated roles with elevated privileges).

---

## 2. Data Ingestion & Sources

### Input Methods
*   **Database Query (Primary):** Data is fetched directly from the backend database based on user-selected criteria.
*   **Admin UI Logic:**
    *   **Date Range Pickers:** Start Date and End Date inputs to define the query window.
    *   **Category Context:** Toggle chips to switch between "Room", "Sightseeing", "Taxi", and "Selfdrive" datasets.
    *   **Pagination Controls:** Interface to request subsequent batches of records.

### Database & API Endpoints
*   **Database:** Google Cloud Firestore (NoSQL).
*   **Collections:** The system aggregates data from four distinct Firestore collections:
    *   `carBookingsCollection` (Taxi Bookings)
    *   `selfDriveBookingCollection` (Self-drive Rentals)
    *   `roomBookingCollection` (Hotel/Room Bookings)
    *   `travelBookingCollection` (Sightseeing/Travel Packages)

### Required Parameters
All data fetch operations require the following parameters:
*   `category`: Defines the target collection.
*   `startDate` & `endDate`: Defines the temporal range for the query.
*   `status`: Hardcoded filter (always fetches records where `status == "Accepted"`).
*   `page` & `rowsPerPage`: Used for cursor-based pagination.

---

## 3. Logic & Processing

### Step-by-Step Flow
1.  **Initialization:** The admin selects a date range and a booking category.
2.  **Query Construction:** The system constructs a Firestore compound query:
    *   Selects the collection matching the category.
    *   Filters for `status == "Accepted"`.
    *   Filters for records where the timestamp falls within the selected start (00:00:00) and end (23:59:59) dates.
    *   Sorts results by timestamp in descending order.
3.  **Data Retrieval:** The application fetches a paginated batch of documents (e.g., 10 records).
4.  **Normalization (Transformation):** Raw JSON documents differ by collection (e.g., `Driver.name` for Taxis vs. `hotelName` for Rooms). A normalization function (`setupDataProperly`) maps these disparate fields into a single unified schema (`createData`), ensuring the table can display any type of booking uniformly.
5.  **Calculation:**
    *   **Partner Amount:** `UserAmount - (UserAmount * Commission%)`
    *   **Commission Amount:** `(UserAmount * Commission%)`
6.  **Rendering:** The normalized data is rendered in a responsive data table.

### Validation Rules
*   **Date Requirement:** The system alerts "Please select both start and end!!" if retrieval is attempted without a valid date range.
*   **Chronology Check:** The End Date input is constrained (`min` attribute) to prevent selecting a date earlier than the Start Date.
*   **Confirmation:** A browser confirm dialog ("Are you sure to clear this entry?") guards the payment clearance action.

### Transformations
*   **Field Mapping:**
    *   *Taxi:* Maps `AmountOffered` → `userAmount`.
    *   *Room:* Maps `amount` → `userAmount`.
    *   *Sightseeing:* Maps `price` → `userAmount`.
*   **Data Formatting:** Timestamps are converted to human-readable locale strings (e.g., "Dec 19, 2024, 10:30 PM").
*   **Sanitization:** Fallback values (e.g., `"-"` or `"0"`) are applied if optional fields like provider names or contact numbers are missing.

---

## 4. Capabilities & Functionality

### Core Actions (CRUD)
*   **READ:** View detailed lists of daily bookings including Provider Name, Guest Contact, Booking Time, and Financial Breakdown.
*   **UPDATE:**
    *   **Mark as Cleared:** Admins can toggle a "Payment Cleared" status flag (`isPaymentClear: true`) for individual records.
*   *(Note: Create and Delete actions are not exposed in this specific view; this module is read/update focused).*

### Advanced Features
*   **Dynamic Filtering:**
    *   Filter by Service Category (e.g., show only Taxis).
    *   Filter by Date Range.
*   **Exporting:**
    *   **CSV Export:** Generates a comprehensive `.csv` file containing booking data across **all categories** for the selected date range. This involves batch fetching and flattening disparate datasets into a single spreadsheet.
    *   **PDF Invoices:** On-demand generation and download of:
        *   **User Invoice:** Receipt for the customer.
        *   **Partner Invoice:** Statement for the service provider.
*   **Pagination:** Server-side pagination handles large datasets efficiently.

### Edge Cases
*   **Empty Data:** If no records match the criteria, a graphical "No [Category] Found" state is displayed.
*   **Loading States:** Skeleton loaders (`LoadingContent`) are displayed during data fetch to prevent layout shift.
*   **Network Failure:** Errors are logged to the console (graceful UI error handling involves the loading state persisting or empty states).

---

## 5. Technical Architecture Diagram Description

**Text-Based Flow Diagram:**

`[Admin Browser Client]` -> `[React Component (TodayBookings.jsx)]` -> `[Service Layer (DailyRecords.js)]` -> `[Firebase SDK]` -> `[Google Cloud Firestore]`

1.  **Frontend Component:** Maintains state (`matchedRequirements`, `page`, `category`) and renders the UI.
2.  **Service Layer:** Contains the logic to select the correct collection reference and build the Firestore Query (`query()`, `where()`, `orderBy()`).
3.  **Database:** Executes the query against indexes.
4.  **Return Path:** Data flows back to the component where it is:
    *   **Normalized:** Converted to a standard format.
    *   **Stored:** Placed in React state variables (e.g., `matchedRequirements`).
    *   **Displayed:** Rendered into the Material UI Table.
