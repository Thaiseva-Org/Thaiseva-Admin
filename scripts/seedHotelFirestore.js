const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// 1. Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 2. The JSON Data
const hotelData = {
    "hotel": {
        "hotelId": "3b0c3d54-257c-4b41-b250-993ba9df5b65",
        "hotelUid": "UJvVK0supxMN4gU0YxyhRB8vjND2",
        "hotelName": "Punyapha Pattaya",
        "country": "Thailand",
        "currency": "THB",
        "startingPrice": 950,
        "discount": 5,
        "address": "Near Pattaya Beach, Pattaya, Thailand",
        "description": "Superior room , near Pattaya beach. The property offers comfortable accommodations, on-site dining, a fitness center, and concierge services to ensure a convenient stay.",
        "images": {
            "logo": "https://firebasestorage.googleapis.com/v0/b/thaiseva-85cda.appspot.com/o/1756552426523-coverPhoto?alt=media&token=6020d2aa-3e09-4ce9-a4d4-2108c211bd3e",
            "gallery": [
                "https://firebasestorage.googleapis.com/v0/b/thaiseva-85cda.appspot.com/o/1756552444671-roomPhoto?alt=media&token=4b882d1d-77db-425e-ad7e-01c80411a2b3",
                "https://firebasestorage.googleapis.com/v0/b/thaiseva-85cda.appspot.com/o/1756552454113-roomPhoto?alt=media&token=456920cf-6cbb-4a71-b24f-589dd32972cc",
                "https://example.com/hotel-exterior.jpg"
            ]
        },
        "petsAllowed": false,
        "nearbyAttractions": [
            "Pattaya Beach – 200m",
            "Central Festival Pattaya – 1.2 km",
            "Walking Street Pattaya – 1.5 km",
            "Pattaya Viewpoint – 2.3 km"
        ],
        "features": [
            "Swimming Pool",
            "Dine-in Restaurant",
            "Parking",
            "Spa",
            "Gym",
            "City View"
        ],
        "phoneNumber": "038 797 867",
        "rating": 0,
        "numberOfReviews": 0,
        "status": "Approved",
        "updatedAt": "2025-08-30T16:45:30+05:30"
    },

    "rooms": [
        {
            "roomName": "Superior Room",
            "packageName": "Superior",
            "maxGuests": 2,
            "numberOfBeds": 1,
            "bedType": "Queen Bed",
            "photos": [
                "https://firebasestorage.googleapis.com/v0/b/thaiseva-85cda.appspot.com/o/1756552444671-roomPhoto?alt=media&token=4b882d1d-77db-425e-ad7e-01c80411a2b3",
                "https://firebasestorage.googleapis.com/v0/b/thaiseva-85cda.appspot.com/o/1756552454113-roomPhoto?alt=media&token=456920cf-6cbb-4a71-b24f-589dd32972cc",
                "https://example.com/room-photo-3.jpg",
                "https://example.com/room-photo-4.jpg"
            ],
            "amenities": [
                "Fridge",
                "AC",
                "Indian Restaurant",
                "WiFi",
                "Television",
                "Hot Water"
            ],
            "description": "A comfortable superior room with modern facilities, perfect for couples or solo travellers. Located close to Pattaya Beach.",
            "policies": {
                "checkIn": "14:00",
                "checkOut": "12:00",
                "extraBed": "Extra bed available on request (additional charges apply)",
                "paymentInfo": "Payment must be done in advance",
                "refundable": false
            },
            "foodInfo": {
                "breakfastIncluded": true,
                "breakfastType": "Continental"
            },
            "pricing": {
                "basePrice": 950,
                "discountPercent": 5,
                "taxIncluded": true,
                "pricePerNightAfterDiscount": 902.5,
                "pricingBasedOnGuests": [
                    { "guests": 1, "pricePerNight": 850 },
                    { "guests": 2, "pricePerNight": 950 }
                ],
                "priceForStay": {
                    "nights": 1,
                    "totalAmount": 902.5
                }
            }
        }
    ]
};

// 3. Seeding Function
const seedHotelData = async (data) => {
    const hotelId = data.hotel.hotelId;
    if (!hotelId) {
        console.error("Error: hotelId is missing in the data.");
        return;
    }

    try {
        console.log(`Starting seed for Hotel ID: ${hotelId}...`);

        // A. Set Hotel Document
        // Using .set() with { merge: true } is often safer for updates, but .set() is fine for overwrite as implied.
        const hotelRef = db.collection('hotels').doc(hotelId);
        await hotelRef.set(data.hotel);
        console.log(`✅ Hotel document written successfully: hotels/${hotelId}`);

        // B. Add Rooms to Subcollection
        const rooms = data.rooms || [];
        if (rooms.length > 0) {
            const roomsCollectionRef = hotelRef.collection('rooms');

            // Use Promise.all for parallel writes
            const roomPromises = rooms.map((room, index) => {
                // Using .add() generates a new specific ID for each room doc
                return roomsCollectionRef.add(room).then((docRef) => {
                    console.log(`  - Room added with ID: ${docRef.id} (${room.roomName})`);
                });
            });

            await Promise.all(roomPromises);
            console.log(`✅ ${rooms.length} room(s) added successfully.`);
        } else {
            console.log("ℹ️ No rooms found to add.");
        }

        console.log("🎉 Database seeding completed successfully!");

    } catch (error) {
        console.error("❌ Error seeding database:", error);
    }
};

// 4. Execute
seedHotelData(hotelData);
