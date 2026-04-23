# Sightseeing Booking Data Display Fix

## Problem Summary
Sightseeing bookings were not displaying data correctly when created. The issue was in the **board view** of the `TravelBookings.jsx` component.

## Root Cause
The board view was trying to access fields that **don't exist** in the actual booking data structure:

### Incorrect Field Names (Before Fix):
- `row.tripName` ❌
- `row.customerName` ❌
- `row.totalPrice` ❌
- `row.orderId` ❌

### Correct Field Names (After Fix):
- `row.title` or `row.packageName` ✅
- `row.guestDetails?.name` or `row.fullName` ✅
- `row.price` or `row.totalAmount` ✅
- `row.id` ✅

## Changes Made

### 1. **Pending Column** (Lines 566-604)
Fixed field mappings:
- **Package Name**: `row.tripName` → `row.title || row.packageName || "N/A"`
- **Guest Name**: `row.customerName` → `row.guestDetails?.name?.replace("not_present", "").trim() || row.fullName || "N/A"`
- **Price**: `row.totalPrice` → `(row.price || row.totalAmount || 0).toLocaleString()`
- **Booking ID**: `row.orderId` → `row.id`

### 2. **Done Column** (Lines 616-632)
Applied same field mapping fixes for accepted/confirmed bookings.

### 3. **Rejected Column** (Lines 643-659)
Applied same field mapping fixes for rejected/canceled bookings.

## Data Structure Reference

### New Sightseeing Booking Object Structure (Current):
```javascript
{
  id: "BBqlc1b0Xm5BmQGkyale",      // Document ID
  packageName: "Romantic Paris & Historic London",  // Package name
  fullName: "hshsj",               // Guest name
  phone: "+915946646464",          // Guest phone with country code
  countryCode: "+91",              // Country code
  email: "jdjs@fkf.com",          // Guest email
  totalAmount: 7276,               // Total booking price
  adults: 2,                       // Number of adults
  children: 1,                     // Number of children
  extraAdults: 0,                  // Extra adults count
  arrivalDate: "2026-01-08T00:00:00.000",  // Arrival date (string)
  createdAt: Timestamp,            // Booking creation timestamp
  status: "Accepted",              // Booking status
  isBookingConfirmed: true,        // Confirmation flag
  airportPickup: false,            // Airport pickup flag
  packageId: "32aa4042-e887-4efb-be9e-8ffdea471133",  // Package ID
  userId: "1ABBuL7BPgPPY6vbQ9wW2mDRvxQ2"  // User ID
}
```

### Old Sightseeing Booking Object Structure (Legacy):
```javascript
{
  id: "doc_id",                    // Document ID
  title: "Package Title",          // Package name (primary)
  packageName: "Package Name",     // Package name (fallback)
  guestDetails: {
    name: "Guest Name",
    phoneNumber: "0123456789",
    email: "guest@example.com"
  },
  price: 5000,                     // Price (primary)
  totalAmount: 5000,               // Price (fallback)
  orderedAt: Timestamp,            // Booking timestamp
  timestamp: Timestamp,            // Fallback timestamp
  status: "Not Reviewed",          // Booking status
  noOfPassengers: 4,               // Number of guests
  pickUpTime: Timestamp,           // Pickup date/time
  arrivalDate: "2024-01-01",       // Fallback date
  Provider: {
    name: "Provider Name",
    phone: "0987654321"
  }
}
```

### Field Mapping (Handles Both Structures):
- **Package Name**: `title` OR `packageName`
- **Guest Name**: `guestDetails?.name` OR `fullName`
- **Guest Phone**: `guestDetails?.phoneNumber` OR `phone`
- **Guest Email**: `guestDetails?.email` OR `email`
- **Price**: `price` OR `totalAmount`
- **Timestamp**: `orderedAt` OR `createdAt` OR `timestamp`
- **Guest Count**: `noOfPassengers` OR `adults + children`
- **Pickup Date**: `pickUpTime` OR `arrivalDate`

## Testing Recommendations

1. **Create a new sightseeing booking** and verify it appears in the "Pending" column
2. **Check all three columns** (Pending, Done, Rejected) display data correctly
3. **Verify the following fields display**:
   - Package/Trip name
   - Guest name
   - Booking date/time
   - Price (formatted with ฿ symbol)
4. **Test action buttons**:
   - "Reject" button should work
   - "Process" button should open booking details modal

## Additional Notes

- The **list view** (table view) was already working correctly because it uses the `rows()` function which properly maps the fields
- The **board view** was the only view with incorrect field mappings
- All three status columns (Pending, Done, Rejected) have been fixed
- The fix handles both old and new data structures with fallback values

## Files Modified
- `src/pages/dashboard/adminDashboard/clientOrders/travelBookings/TravelBookings.jsx`
