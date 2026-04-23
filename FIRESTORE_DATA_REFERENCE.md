# Firestore Data Reference

This file is the single source of reference for Firestore data used by the admin portal codebase.

It is based on the actual collection names and document shapes used in this repository, not an idealized schema. In several places the app supports both newer and legacy field names, so this document calls that out explicitly.

## Notes

- Firestore collection names below are taken from [src/firebase/firebase.config.js](/d:/projects/Thaiseva-Admin-Portal-Web-App/src/firebase/firebase.config.js:23).
- Some collections have hybrid or legacy formats because the app reads older data as well as newer admin-created data.
- `id` is often the Firestore document id, even when it is not stored as a field inside the document.
- Timestamps in this codebase are mixed:
  - Firestore `Timestamp`
  - JS `Date`
  - ISO strings
  - date-only strings for a few booking fields

## 1. Core User Collections

### `users`
Purpose: auth-linked profile records for admins, partners, sub-admins, and some app users.

Common partner/admin shape used by onboarding flows:

```json
{
  "uid": "string",
  "email": "string",
  "displayName": "string",
  "photoURL": "string",
  "role": "Admin | Partner | Sub Admin",
  "status": "Pending | Verified",
  "serviceCategory": "string",
  "phoneNo": "string",
  "phoneNumber": "string",
  "isVerified": "boolean",
  "createdAt": "Timestamp | Date"
}
```

Legacy/app-user fields also expected by admin user listing:

```json
{
  "firstName": "string",
  "lastName": "string",
  "profilePic": "string",
  "userLocation1": "string",
  "isAppUser": "boolean"
}
```

Important:

- This collection is not a single strict schema.
- `phoneNo` and `phoneNumber` are both used in different places.
- `displayName` is the main identity field for staff/partners, while `firstName` is used by the app-user table.

### `partners`
Purpose: general local/service partners created through partner onboarding.

Typical shape:

```json
{
  "uid": "string",
  "fullName": "string",
  "email": "string",
  "address": "string",
  "phoneNumber": "string",
  "photoURL": "string",
  "serviceCategory": "string | string[]",
  "serviceDetails": "string | string[]",
  "serviceArea": "string",
  "status": "Pending | Verified",
  "paymentInformation": {
    "bankName": "string",
    "accountNumber": "string",
    "bankAddress": "string"
  },
  "createdAt": "Timestamp"
}
```

### `general_partners`
Purpose: partner management and package assignments.

Common fields used in code:

```json
{
  "personalInformation": {
    "fullName": "string"
  },
  "serviceCategory": "string | string[]",
  "commissions": {
    "Sightseeing Packages": {
      "type": "Percentage | Fixed",
      "rate": "number | string"
    }
  }
}
```

Subcollection:

#### `general_partners/{partnerId}/assignedPackages`

```json
{
  "packageId": "string",
  "packageName": "string",
  "createdAt": "Timestamp"
}
```

### `drivers`
Purpose: driver partner profiles.

Typical shape:

```json
{
  "uid": "string",
  "fullName": "string",
  "email": "string",
  "phoneNumber": "string",
  "photoURL": "string",
  "license": "string",
  "address": "string",
  "location": {
    "lat": "number",
    "lng": "number"
  },
  "serviceCategory": "Driving",
  "status": "Pending | Verified",
  "paymentInformation": {
    "bankName": "string",
    "accountNumber": "string",
    "bankAddress": "string"
  }
}
```

### `restaurants`
Purpose: restaurant partner profiles.

Typical shape:

```json
{
  "uid": "string",
  "email": "string",
  "restaurantName": "string",
  "phoneNumber": "string",
  "address": "string",
  "logoURL": "string",
  "license": "string",
  "coupon": "string",
  "keywords": "string | string[]",
  "location": {
    "lat": "number",
    "lng": "number"
  },
  "status": "Pending | Verified",
  "serviceCategory": "Restaurant",
  "paymentInformation": {
    "bankName": "string",
    "accountNumber": "string",
    "bankAddress": "string"
  }
}
```

### `agents`
Purpose: reserved for agent/admin support records.

Used in config, but not strongly defined in this repo.

## 2. Hotel Data

### `HotelDB`
Purpose: hotel partner records and hotel catalog data.

This collection supports multiple shapes. The current admin UI mainly writes a nested `hotel` object.

Current admin-created shape:

```json
{
  "hotel": {
    "hotelId": "string",
    "hotelUid": "string",
    "hotelName": "string",
    "country": "string",
    "currency": "THB",
    "startingPrice": "number",
    "discount": "number",
    "totalRooms": "number",
    "address": "string",
    "description": "string",
    "policies": "string",
    "images": {
      "logo": "string",
      "gallery": ["string"]
    },
    "petsAllowed": "boolean",
    "nearbyAttractions": ["string"],
    "features": ["string"],
    "phoneNumber": "string",
    "email": "string",
    "rating": "number",
    "numberOfReviews": "number",
    "status": "Verified",
    "updatedAt": "string | Timestamp",
    "location": {
      "lat": "number",
      "lng": "number"
    }
  }
}
```

Legacy hotel onboarding shape still appears in repo:

```json
{
  "accountInfo": {
    "email": "string",
    "password": "string"
  },
  "status": "Pending",
  "verified": "boolean",
  "serviceCategory": "Hotel",
  "hotelInformation": {
    "hotelName": "string",
    "address": "string",
    "phoneNumber": "string",
    "location": {
      "lat": "number",
      "lng": "number"
    },
    "logoURL": "string",
    "license": "string",
    "country": "string"
  },
  "timestamp": "Timestamp",
  "paymentInformation": {
    "bankName": "string",
    "accountNumber": "string",
    "bankAddress": "string"
  }
}
```

Also supported by readers:

- top-level `hotelName`
- top-level `address`
- top-level `totalRooms`
- nested `hotelInformation`
- nested `hotelDetails`

Subcollection:

### `HotelDB/{hotelId}/rooms`
Purpose: room types attached to a hotel.

Current admin-created shape:

```json
{
  "id": "string | number",
  "roomName": "string",
  "packageName": "string",
  "maxGuests": "number",
  "numberOfBeds": "number",
  "bedType": "string",
  "bedDetails": [
    {
      "type": "string",
      "count": "number"
    }
  ],
  "photos": ["string"],
  "amenities": ["string"],
  "description": "string",
  "policies": {
    "checkIn": "string",
    "checkOut": "string",
    "extraBed": "string",
    "extraBedPrice": "number",
    "paymentInfo": "string",
    "refundable": "boolean",
    "notes": "string"
  },
  "foodInfo": {
    "breakfastIncluded": "boolean",
    "breakfastType": "string"
  },
  "pricing": {
    "basePrice": "number",
    "discountPercent": "number",
    "pricePerNightAfterDiscount": "number",
    "pricingBasedOnGuests": [
      {
        "guests": "number",
        "pricePerNight": "number"
      }
    ],
    "priceForStay": {
      "nights": "number",
      "totalAmount": "number"
    }
  }
}
```

Notes:

- Readers often accept `name` or `roomName`.
- Older room-related code also uses `packageName`.

### `hotelPackages`
Purpose: older room package records.

### `hotelPackageDetails`
Purpose: detailed room package records.

Used by hotel room manager pages. Shape overlaps with room/package concepts and is not fully normalized in this repo.

## 3. Sightseeing / Travel Data

### `sightseeingPackages`
Purpose: summary collection for sightseeing packages.

Current admin-created summary shape:

```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "price": "number",
  "discount": "number",
  "location": "string",
  "period": "number",
  "packageType": "string",
  "maxBookingsPerWeek": "number",
  "minPersons": "number",
  "maxPersons": "number",
  "coverPhoto": "string",
  "timestamp": "Date | Timestamp",
  "images": ["string"],
  "hasAuthorizedPartners": "boolean"
}
```

### `sightseeingPackagesDetails`
Purpose: detailed sightseeing package records used by admin travel pages.

Current admin-created detail shape:

```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "price": "number",
  "discount": "number",
  "location": "string",
  "period": "number",
  "packageId": "string",
  "packageName": "string",
  "about": "string",
  "startingPrice": "number",
  "packageType": "string",
  "currency": "THB",
  "duration": {
    "days": "number",
    "nights": "number"
  },
  "coverPhoto": "string",
  "thumbnailImage": "string",
  "images": ["string"],
  "packageImages": ["string"],
  "pictures": ["string"],
  "highlights": ["string"],
  "amenities": ["string"],
  "included": ["string"],
  "excluded": ["string"],
  "itinerary": [
    {
      "day": "number",
      "title": "string",
      "timeline": [
        {
          "time": "string",
          "activity": "string"
        }
      ]
    }
  ],
  "hotelsIncluded": [
    {
      "hotelId": "string",
      "hotelName": "string",
      "nights": "number",
      "roomType": "string",
      "location": "string",
      "isManual": "boolean"
    }
  ],
  "hotels": [
    {
      "hotelId": "string",
      "hotelName": "string",
      "nights": "number",
      "roomType": "string"
    }
  ],
  "sights": [
    {
      "sightId": "string",
      "title": "string",
      "description": "string",
      "images": ["string"],
      "location": {
        "latitude": "number",
        "longitude": "number"
      }
    }
  ],
  "places": ["string"],
  "specialRates": {
    "seasonalPricing": {
      "enabled": "boolean",
      "note": "string"
    },
    "earlyBirdDiscount": {
      "enabled": "boolean",
      "discountPercent": "number",
      "description": "string"
    }
  },
  "pricingStructure": {
    "pricePerAdult": "number",
    "pricePerChild": "number",
    "extraAdultPrice": "number",
    "minPersons": "number",
    "maxPersons": "number"
  },
  "transportType": "string",
  "pickupDropDetails": {
    "pickupFromHotel": "boolean",
    "dropToAirport": "boolean",
    "availablePickupTimes": ["string"],
    "availableDropTimes": ["string"]
  },
  "maxBookingsPerWeek": "number",
  "rating": {
    "average": "number",
    "totalReviews": "number"
  },
  "authorizedPartners": [
    {
      "partnerId": "string",
      "partnerName": "string",
      "commissionType": "Percentage | Fixed",
      "commissionRate": "number | string",
      "maxBookingsPerWeek": "number | string",
      "assignedAt": "string"
    }
  ],
  "createdAt": "string",
  "updatedAt": "string"
}
```

### `travelRequirements`
Purpose: travel-related service requests for admin handling.

Common fields vary, but these records are used as requirements/work requests rather than completed bookings.

### `travelBookingDetails`
Purpose: sightseeing booking orders.

The admin app reads this collection as a hybrid of old and new shapes.

Common fields seen in readers and updaters:

```json
{
  "fullName": "string",
  "guestEmail": "string",
  "guestPhone": "string",
  "email": "string",
  "phone": "string",
  "guestDetails": {
    "name": "string",
    "email": "string",
    "phoneNumber": "string"
  },
  "title": "string",
  "packageName": "string",
  "packageId": "string",
  "userId": "string",
  "uId": "string",
  "arrivalDate": "string | Timestamp",
  "pickUpTime": "string | Timestamp",
  "orderedAt": "Timestamp",
  "createdAt": "Timestamp",
  "timestamp": "Timestamp",
  "price": "number",
  "totalAmount": "number",
  "currency": "string",
  "status": "Pending | Accepted | Canceled | In Progress | Confirmed",
  "isBookingConfirmed": "boolean",
  "paymentMethod": "string",
  "isPaymentDone": "boolean",
  "paymentConfirmation": "object | string | null",
  "paymentVerificationStatus": "string",
  "paymentVerificationNote": "string",
  "stripeSessionId": "string | null",
  "stripePaymentIntentId": "string | null",
  "paidAt": "string | null",
  "Provider": {
    "name": "string",
    "phone": "string"
  },
  "adminReview": "string"
}
```

## 4. Booking Collections

### `hotelBookingData`
Purpose: hotel room booking orders.

Common fields used by the admin app:

```json
{
  "bookingId": "string",
  "fullName": "string",
  "guestEmail": "string",
  "guestPhone": "string",
  "email": "string",
  "phone": "string",
  "guestDetails": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "phoneNumber": "string",
    "adults": "number",
    "children": "number"
  },
  "hotelUid": "string",
  "hotelId": "string",
  "hotelName": "string",
  "hotel": {
    "hotelName": "string"
  },
  "roomName": "string",
  "rooms": "number",
  "noOfRooms": "number",
  "adults": "number",
  "children": "number",
  "nights": "number",
  "nationality": "string",
  "checkInDate": "string | Timestamp",
  "checkOutDate": "string | Timestamp",
  "checkIn": "string | Timestamp",
  "checkOut": "string | Timestamp",
  "createdAt": "Timestamp",
  "orderedAt": "Timestamp",
  "amountTHB": "number",
  "amount": "number",
  "amountINR": "number",
  "currency": "string",
  "paymentMethod": "string",
  "isPaymentDone": "boolean",
  "paymentConfirmation": "object | string",
  "paymentVerificationStatus": "string",
  "paymentVerificationNote": "string",
  "stripeSessionId": "string | null",
  "stripePaymentIntentId": "string | null",
  "paidAt": "string | null",
  "status": "Pending | Accepted | Canceled",
  "bookingStatus": "PENDING | ACCEPTED | CANCELED | CONFIRMED",
  "isBookingConfirmed": "boolean",
  "userId": "string",
  "managerPhone": "string",
  "roomNumbers": ["string"],
  "source": "string"
}
```

Notes:

- Admin pages normalize status from both `status` and `bookingStatus`.
- Readers support both `checkInDate/checkOutDate` and `checkIn/checkOut`.

### `car_bookings`
Purpose: taxi/car booking orders.

Common fields used in admin lists:

```json
{
  "orderedAt": "Timestamp",
  "timestamp": "Timestamp",
  "status": "string",
  "transportType": "string",
  "amount": "number",
  "AmountOffered": "number"
}
```

### `self_driving_bookings`
Purpose: self-drive booking orders.

Common fields used in admin lists:

```json
{
  "orderedAt": "Timestamp",
  "time": "Timestamp | string",
  "status": "string",
  "amount": "number"
}
```

### `vanBookings`
Purpose: manually added van booking orders.

Common fields:

```json
{
  "bookingDate": "string",
  "createdAt": "string",
  "status": "Pending | Accepted | Confirmed | Done",
  "amount": "number"
}
```

## 5. Website Content Collections

### `ServiceDB`
Purpose: home/service cards.

```json
{
  "title": "string",
  "subtitle": "string",
  "description": "string",
  "icon": "string",
  "color": "string",
  "link": "string",
  "image": "string",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### `BlogDB`
Purpose: website blogs/articles.

```json
{
  "slug": "string",
  "title": "string",
  "excerpt": "string",
  "content": "string",
  "image": "string",
  "category": "string",
  "author": "string",
  "status": "Draft | Published",
  "metaTitle": "string",
  "metaDescription": "string",
  "metaKeywords": "string",
  "readTime": "string",
  "publishedDate": "Timestamp | null",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

Notes:

- The current admin UI does not manage `canonicalUrl`, `ogTitle`, `ogDescription`, or `ogImage`.

### `FaqDB`
Purpose: website FAQ entries.

```json
{
  "question": "string",
  "answer": "string",
  "category": "string",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### `TestimonialDB`
Purpose: testimonials/reviews shown on the website.

```json
{
  "user": "string",
  "role": "string",
  "rating": "number",
  "text": "string",
  "image": "string",
  "displayOrder": "number",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### `OfferDB`
Purpose: website promotional offers.

```json
{
  "title": "string",
  "description": "string",
  "image": "string",
  "type": "string",
  "active": "boolean",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### `ContentDB`
Purpose: page content blocks and banners.

Known document ids used by admin UI:

- `home_hero`

Common shape for `home_hero`:

```json
{
  "title": "string",
  "subtitle": "string",
  "description": "string",
  "buttonText": "string",
  "buttonLink": "string",
  "image": "string",
  "stats": {
    "users": "number",
    "partners": "number",
    "bookings": "number"
  }
}
```

### `ContusDB`
Purpose: contact-us messages from the website.

```json
{
  "fullName": "string",
  "email": "string",
  "mobileNumber": "string",
  "subject": "string",
  "message": "string",
  "status": "New | Archived",
  "createdAt": "Timestamp"
}
```

Important:

- The code uses `ContusDB`, not `ContactMessages`.

## 6. Local Service / Requirement Collections

### `allRequirements`
Purpose: local assistance or service requirements.

Shape varies by service request type. Admin pages expect at least:

```json
{
  "status": "string",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### `localServices`
Purpose: local service categories / partner services.

### `shops`
Purpose: shopping mall/shop entries.

### `clubs`
Purpose: club entries.

These collections are used by admin CRUD pages and contain mostly business listing data.

## 7. Messaging / Notifications

### `notifications`
Purpose: notification records.

Common shape:

```json
{
  "title": "string",
  "message": "string",
  "createdAt": "Timestamp"
}
```

Nested user notifications are also used:

### `notifications/users/{userId}`

```json
{
  "title": "string",
  "message": "string",
  "isRead": "boolean",
  "date": "Timestamp"
}
```

### `chatRooms`
Purpose: support room metadata.

Known document ids:

- `CustomerSupport`
- `HotelSupport`
- `DriversSupport`

### `chats`
Purpose: message arrays for support and chat sessions.

Common shape:

```json
{
  "messages": [
    {
      "message": "string",
      "senderId": "string",
      "date": "Timestamp"
    }
  ]
}
```

## 8. Operations / Finance / Admin Collections

### `partner_invoices`
Purpose: stored invoice records.

### `statistics`
Purpose: summary statistics.

### `hotel_statistics`
Purpose: hotel-specific stats/earnings.

### `coupons`
Purpose: coupon definitions.

### `manage_partners`
Purpose: partner management workflows.

### `vanCompanies`
Purpose: van company records.

### `carDetails`
Purpose: car inventory/details.

### `foodMenu`
Purpose: restaurant menu data.

## 9. Settings Collection

### `settings`
Purpose: general website configuration docs.

Known document ids used by this repo:

- `Service_Categories`
- `logo`
- `todayBestOffer`
- `HotelBanners`
- `whats_new`
- `Hotel`
- `Food`
- `homeBanners`
- `Local_Assistance`
- `NewOffers`
- `NotificationOffers`
- `SightseeingBanners`
- `Travel`
- `SpecialOffers`
- `Confidential`

Example shape varies by document, but usually:

```json
{
  "title": "string",
  "subtitle": "string",
  "description": "string",
  "image": "string | string[]",
  "updatedAt": "Timestamp"
}
```

## 10. Summary of Important Migrations / Hybrids

These are the main places where the repo currently supports more than one schema:

### Hotels

- new admin format: nested `hotel`
- older onboarding format: nested `hotelInformation`
- some readers also accept top-level `hotelName`, `address`, `totalRooms`

### Hotel rooms

- current fields: `roomName`, `photos`, `maxGuests`, `pricing.basePrice`
- older readers may still look for `name` or `packageName`

### Sightseeing packages

- summary collection: `sightseeingPackages`
- full collection: `sightseeingPackagesDetails`
- details schema mixes fields like `title/price/period` and `packageName/about/startingPrice`

### Users

- partner/admin records use `displayName`, `photoURL`, `phoneNo/phoneNumber`
- app-user reporting expects `firstName`, `profilePic`, `userLocation1`, `isAppUser`

### Bookings

- room bookings use both `status` and `bookingStatus`
- sightseeing bookings may use `orderedAt`, `createdAt`, or `timestamp`
- hotel bookings may use `checkInDate` or `checkIn`

## 11. Collection Inventory from Firebase Config

Full collection list currently exported by the app:

- `partners`
- `agents`
- `users`
- `drivers`
- `shops`
- `clubs`
- `allRequirements`
- `localServices`
- `restaurants`
- `HotelDB`
- `travelRequirements`
- `sightseeingPackages`
- `sightseeingPackagesDetails`
- `hotelPackages`
- `hotelPackageDetails`
- `hotelBookingData`
- `foodMenu`
- `travelBookingDetails`
- `self_driving_bookings`
- `settings`
- `chatRooms`
- `chats`
- `hotel_statistics`
- `statistics`
- `carDetails`
- `car_bookings`
- `partner_invoices`
- `notifications`
- `coupons`
- `manage_partners`
- `general_partners`
- `vanCompanies`
- `vanBookings`
- `ContentDB`
- `BlogDB`
- `OfferDB`
- `ServiceDB`
- `TestimonialDB`
- `FaqDB`

## 12. Recommended Rule for Future Work

When adding new documents or updating forms, prefer these patterns:

- Use Firestore `serverTimestamp()` for `createdAt` and `updatedAt`
- Keep document ids as the source of truth for `id`
- Avoid mixing `phoneNo` and `phoneNumber` in new code
- Avoid creating more top-level hotel shapes; prefer the nested `hotel` model already used by admin hotel creation
- Avoid creating more sightseeing variants; prefer the current `sightseeingPackages` + `sightseeingPackagesDetails` pairing
