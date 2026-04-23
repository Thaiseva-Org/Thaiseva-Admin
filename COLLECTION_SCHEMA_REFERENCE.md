# Firestore Collection Schema Reference

This document provides a detailed reference of the Firestore collections used in the Thaiseva Admin Portal, categorized by their primary role in the application's data flow.

---

## 📥 Inbound Data
Collections used for retrieving website content, service listings, and configuration.

### `HotelDB`
**Purpose:** Stores hotel properties and metadata.
- **Sub-collection:** `rooms` (Detailed room type information)

#### Hotel Schema
```json
{
  "hotelId": "String (UUID)",
  "hotelUid": "String (Partner User UID)",
  "hotelName": "String",
  "country": "String (Default: 'Thailand')",
  "currency": "String (Default: 'THB')",
  "startingPrice": "Number",
  "discount": "Number",
  "totalRooms": "Number",
  "address": "String",
  "description": "String",
  "policies": "String",
  "images": {
    "logo": "String (URL)",
    "gallery": ["String (URL)"]
  },
  "petsAllowed": "Boolean",
  "nearbyAttractions": ["String"],
  "features": ["String (Amenities: pool, gym, wifi, etc.)"],
  "phoneNumber": "String",
  "email": "String",
  "rating": "Number",
  "numberOfReviews": "Number",
  "status": "String ('Verified', 'Pending', etc.)",
  "location": {
    "lat": "Number",
    "lng": "Number"
  },
  "updatedAt": "Timestamp/String (ISO)"
}
```

#### `rooms` (Sub-collection under HotelDB)
```json
{
  "id": "String (Room Type ID)",
  "roomName": "String",
  "maxGuests": "Number",
  "numberOfBeds": "Number",
  "bedType": "String",
  "bedDetails": [
    { "type": "String", "count": "Number" }
  ],
  "photos": ["String (URL)"],
  "amenities": ["String"],
  "description": "String",
  "policies": {
    "checkIn": "String (Time)",
    "checkOut": "String (Time)",
    "extraBed": "String",
    "extraBedPrice": "Number",
    "paymentInfo": "String",
    "refundable": "Boolean"
  },
  "foodInfo": {
    "breakfastIncluded": "Boolean",
    "breakfastType": "String"
  },
  "pricing": {
    "basePrice": "Number",
    "discountPercent": "Number",
    "taxIncluded": "Boolean",
    "pricePerNightAfterDiscount": "Number",
    "priceForStay": {
      "nights": "Number",
      "totalAmount": "Number"
    }
  }
}
```

---

### `sightseeingPackagesDetails`
**Purpose:** Stores detailed information for tour and sightseeing packages.

#### Package Schema
```json
{
  "packageId": "String (UUID)",
  "packageName": "String",
  "about": "String",
  "startingPrice": "Number",
  "currency": "String (Default: 'THB')",
  "discount": "Number",
  "location": "String",
  "duration": {
    "days": "Number",
    "nights": "Number"
  },
  "packageType": "String ('Couple', 'Family', 'Solo', etc.)",
  "maxBookingsPerWeek": "Number",
  "thumbnailImage": "String (URL)",
  "packageImages": ["String (URL)"],
  "highlights": ["String"],
  "included": ["String"],
  "excluded": ["String"],
  "itinerary": [
    {
      "day": "Number",
      "title": "String",
      "timeline": [
        { "time": "String", "activity": "String" }
      ]
    }
  ],
  "hotelsIncluded": [
    {
      "hotelId": "String",
      "hotelName": "String",
      "nights": "Number",
      "roomType": "String"
    }
  ],
  "pricingStructure": {
    "pricePerAdult": "Number",
    "pricePerChild": "Number",
    "extraAdultPrice": "Number",
    "minPersons": "Number",
    "maxPersons": "Number"
  },
  "transportType": "String",
  "pickupDropDetails": {
    "pickupFromHotel": "Boolean",
    "dropToAirport": "Boolean"
  },
  "rating": {
    "average": "Number",
    "totalReviews": "Number"
  },
  "authorizedPartners": [
    {
      "partnerId": "String",
      "partnerName": "String",
      "commissionRate": "Number"
    }
  ],
  "timestamp": "Timestamp"
}
```

---

### `BlogDB`
**Purpose:** Stores blog posts and articles.
```json
{
  "title": "String",
  "slug": "String",
  "excerpt": "String",
  "content": "String (HTML/RichText)",
  "image": "String (URL)",
  "category": "String",
  "author": "String",
  "status": "String ('published', 'draft')",
  "seoTitle": "String",
  "seoDescription": "String",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

---

### Website Config Collections
Used to manage UI components and layout configurations.

#### `ServiceDB` (Services Catalog)
- Fields: `title`, `subtitle`, `description`, `icon`, `color`, `link`, `image`.

#### `OfferDB` (Promotional Banners)
- Fields: `title`, `description`, `image`, `type`, `isActive` (Boolean).

#### `TestimonialDB` (Customer Reviews)
- Fields: `user`, `role`, `rating` (Number), `text`, `image`, `displayOrder`.

#### `FaqDB` (General Support)
- Fields: `question`, `answer`, `category`.

---

## 📤 Outbound Data
Collections used for persisting user interactions, transactions, and system updates.

### `hotelBookingData`
**Purpose:** Stores hotel reservation details and payment status.
```json
{
  "bookingId": "String (UUID)",
  "hotelId": "String",
  "hotelName": "String",
  "userId": "String (User UID)",
  "fullName": "String",
  "phone": "String",
  "email": "String",
  "nationality": "String",
  "adults": "Number",
  "children": "Number",
  "rooms": "Number",
  "roomName": "String",
  "roomNumbers": "String (e.g., '101, 102')",
  "checkIn": "Timestamp/String",
  "checkOut": "Timestamp/String",
  "nights": "Number",
  "amountTHB": "Number",
  "amountINR": "Number",
  "currency": "String",
  "paymentMethod": "String",
  "paymentStatus": "String",
  "status": "String ('Accepted', 'Pending', 'Canceled')",
  "isPaymentDone": "Boolean",
  "orderedAt": "Timestamp",
  "customerInvoiceId": "String"
}
```

---

### `travelBookingDetails`
**Purpose:** Stores sightseeing package bookings.
```json
{
  "orderId": "String (UUID)",
  "userId": "String",
  "packageId": "String",
  "packageName": "String",
  "guestDetails": {
    "name": "String",
    "phoneNumber": "String",
    "email": "String"
  },
  "adults": "Number",
  "children": "Number",
  "totalAmount": "Number",
  "pickUpLocation": "String",
  "pickUpTime": "Timestamp/String",
  "status": "String ('Accepted', 'Pending', 'Canceled', 'In Progress')",
  "isBookingConfirmed": "Boolean",
  "orderedAt": "Timestamp",
  "adminReview": "String (Notes)",
  "Provider": {
    "name": "String",
    "phone": "String"
  },
  "specialRequests": "String"
}
```

---

### `notifications`
**Purpose:** Real-time user notifications.
```json
{
  "title": "String",
  "message": "String",
  "userId": "String (Recipient UID)",
  "type": "String",
  "isRead": "Boolean",
  "timestamp": "Timestamp"
}
```

---

### `users`
**Purpose:** User profiles and administrative status.
```json
{
  "uid": "String",
  "fullName": "String",
  "email": "String",
  "phoneNumber": "String",
  "role": "String ('admin', 'partner', 'user')",
  "status": "String ('Verified', 'Pending')",
  "isVerified": "Boolean",
  "createdAt": "Timestamp",
  "profileImage": "String (URL)"
}
```

---

> [!NOTE]
> All collections use Firestore's `serverTimestamp()` for auditing where applicable. Field names and types are inferred based on the latest admin dashboard components.
