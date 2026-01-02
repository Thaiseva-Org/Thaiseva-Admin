# Thaiseva Automation Logic Report

## Overview
This document outlines the automated booking acceptance logic currently deployed for **Sightseeing Packages** in the Thaiseva system.

**Note:** Currently, **only Sightseeing Bookings** have automated acceptance logic deployed. Hotel bookings follow standard manual processing or app-side logic unless specified otherwise.

---

## Sightseeing Bookings Automation

### 1. Trigger Mechanism
- **Event**: A new booking is created in the `travelBookingDetails` collection in the database.
- **Action**: The system immediately triggers the `autoAcceptSightseeingBookingsV2` Cloud Function.

### 2. Logic Flow

A booking is processed through the following steps to decide if it should be **Accepted** immediately or left as **Pending**.

#### **Step A: Identify Booking Limits**
The system first determines the allowed "Weekly Limit" for the specific package involved in the booking.

*   **Global Limit (Default)**: The system fetches the *Global Weekly Booking Limit* configured by the admin (e.g., 200). This applies to all packages by default.
*   **Partner Specific Limit**:
    *   If the booking comes from a specific Partner (has a `partnerId`).
    *   And that Partner is strictly "Authorized" in the package settings with a specific *Custom Weekly Limit*.
    *   Then, the system uses that **Custom Limit** instead of the Global Limit.
    *   *Otherwise, it defaults to the Global Limit.*

#### **Step B: Count Current Bookings**
The system counts how many "Confirmed" bookings already exist for this package for the **current week** (Monday to Sunday).

*   **For Direct Bookings (Own)**: It counts all confirmed bookings that are *not* assigned to any partner.
*   **For Partner Bookings**: It counts only confirmed bookings assigned to that specific partner.

#### **Step C: Decision**
*   **If (Current Count < Limit)**:
    *   ✅ **Auto-Accept**: The booking status is updated to `Accepted`.
    *   `isBookingConfirmed` is set to `true`.
    *   `autoAccepted` flag is set to `true`.
    *   The booking appears in the "Done / Accepted" tab immediately.
    
*   **If (Current Count >= Limit)**:
    *   ⚠️ **Pending**: The booking status remains `Pending` (or `Review In Progress`).
    *   The admin must manually review and accept/reject this booking.

---

## Hotel Bookings Automation

### 1. Status & Infrastructure
*   **Infrastructure**: The system now supports defining "Total Rooms" (Inventory) for each room type in the Admin Dashboard.
*   **Automation Logic**: (Ready to be deployed) The system is designed to automatically check availability based on date ranges.

### 2. Logic Flow (Proposed/Upcoming)

A booking will be processed through the following steps:

#### **Step A: Identify Room & Dates**
The system identifies the specific `roomId` being booked and the requested date range (Start Date to End Date).

#### **Step B: Check Availability**
*   **Fetch Inventory**: It retrieves the `totalRooms` count set by the admin for that specific room type.
*   **Count Overlaps**: It counts how many existing "Confirmed" bookings overlap with the requested date range.

#### **Step C: Decision**
*   **If (Current Overlapping Bookings < Total Inventory)**:
    *   ✅ **Auto-Accept**: The booking is immediately marked as `Accepted` / Confirmed.
    
*   **If (Current Overlapping Bookings >= Total Inventory)**:
    *   ⚠️ **Pending / Full**: The booking is marked as `Pending` for manual review, or flagged that the room is fully booked for those dates.

---

## Summary Table

| Feature | Sightseeing Automation | Hotel Automation |
| :--- | :--- | :--- |
| **Auto-Accept** | ✅ Active (Weekly Limit) | ⏳ Ready (Date-Range Availability) |
| **Limit Config** | Global Setting (Admin Dashboard) | Per-Room Inventory (`totalRooms`) |
| **Process** | Count bookings per week | Count overlapping bookings per date range |
| **Overflow Action**| Remains "Pending" | Remains "Pending" (or "Sold Out") |

*Generated on: January 2, 2026*
