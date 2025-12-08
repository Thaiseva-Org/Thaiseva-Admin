export const sightseeingDummyData = [
    {
        "packageId": "PKG_001",
        "packageName": "Bangkok & Phuket Explorer",
        "location": "Thailand",

        "duration": {
            "days": 5,
            "nights": 4
        },

        "thumbnailImage": "https://image.com/p1.jpg",
        "packageImages": [
            "https://image.com/p1.jpg",
            "https://image.com/p2.jpg",
            "https://image.com/p3.jpg"
        ],

        "startingPrice": 81500,
        "currency": "THB",

        "rating": {
            "average": 4.8,
            "totalReviews": 322
        },

        "about": "Embark on a captivating journey through Thailand’s most iconic cities...",

        "highlights": [
            "Explore the Grand Palace and Wat Arun.",
            "Visit floating markets.",
            "Relax at Patong & Karon beaches.",
            "Phi Phi Islands speedboat tour."
        ],

        "included": [
            "4 nights accommodation in 4-star hotels",
            "Daily breakfast",
            "Airport transfers",
            "Local sightseeing tours"
        ],

        "excluded": [
            "Travel insurance",
            "Tips",
            "Lunch & Dinner",
            "Personal expenses"
        ],

        "itinerary": [
            {
                "day": 1,
                "title": "Arrival & Leisure",
                "timeline": [
                    { "time": "09:00 AM", "activity": "Arrival in Bangkok" },
                    { "time": "10:30 AM", "activity": "Hotel transfer" },
                    { "time": "12:00 PM", "activity": "Hotel check-in" }
                ]
            },
            {
                "day": 2,
                "title": "City Temple Tour",
                "timeline": [
                    { "time": "09:30 AM", "activity": "Visit Grand Palace" },
                    { "time": "12:30 PM", "activity": "Lunch break" },
                    { "time": "02:00 PM", "activity": "Visit Wat Arun" }
                ]
            }
        ],

        "hotelsIncluded": [
            {
                "hotelId": "HTL_101",
                "hotelName": "Centara Grand at CentralWorld",
                "nights": 2,
                "roomType": "Deluxe Room",
                "location": "Bangkok, Thailand",
                "images": ["https://hotel.com/h1.jpg", "https://hotel.com/h2.jpg"],
                "amenities": ["Pool", "Gym", "WiFi"]
            },
            {
                "hotelId": "HTL_102",
                "hotelName": "Phuket Marriott Resort",
                "nights": 2,
                "roomType": "Superior Lagoon Pool View",
                "location": "Phuket, Thailand",
                "images": ["https://hotel.com/p1.jpg", "https://hotel.com/p2.jpg"],
                "amenities": ["Pool", "Beachfront", "Breakfast"]
            }
        ],

        "sights": [
            {
                "sightId": "S001",
                "title": "Big Buddha",
                "description": "A giant Buddha statue overlooking Phuket.",
                "images": ["https://sight.com/b1.jpg"],
                "location": { "latitude": 7.8278, "longitude": 98.3125 }
            },
            {
                "sightId": "S002",
                "title": "Phuket Old Town",
                "description": "Colorful Sino-Portuguese buildings.",
                "images": ["https://sight.com/pt1.jpg"],
                "location": { "latitude": 7.884, "longitude": 98.386 }
            }
        ],

        "pricingStructure": {
            "pricePerAdult": 81500,
            "pricePerChild": 45000,
            "extraAdultPrice": 72500
        },

        "specialRates": {
            "seasonalPricing": {
                "enabled": true,
                "note": "Prices differ during peak season."
            },
            "earlyBirdDiscount": {
                "enabled": true,
                "discountPercent": 10,
                "description": "10% OFF for bookings 30+ days in advance."
            }
        },

        "transportType": "AC Mini Bus / Private Car",

        "pickupDropDetails": {
            "pickupFromHotel": true,
            "dropToAirport": true,
            "availablePickupTimes": ["08:00", "12:00", "17:00"],
            "availableDropTimes": ["10:00", "14:00", "19:00"]
        },

        "createdAt": "2025-01-01T10:00:00Z",
        "updatedAt": "2025-01-02T10:00:00Z"
    },
    {
        "packageId": "PKG_002",
        "packageName": "Romantic Paris & Historic London",
        "location": "France & UK",
        "duration": {
            "days": 7,
            "nights": 6
        },
        "thumbnailImage": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=500&q=60",
        "packageImages": [
            "https://images.unsplash.com/photo-1502602898657-3e91760cbb34",
            "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad",
            "https://images.unsplash.com/photo-1529655683826-aba9b3e77383"
        ],
        "startingPrice": 2500,
        "currency": "EUR",
        "rating": {
            "average": 4.9,
            "totalReviews": 510
        },
        "about": "Experience the charm of two of Europe's most famous capitals. From the Eiffel Tower to Big Ben, enjoy a week of history and culture.",
        "highlights": [
            "Eiffel Tower Summit Access",
            "Seine River Cruise",
            "London Eye Experience",
            "British Museum Tour"
        ],
        "included": [
            "Eurostar Train tickets",
            "Daily Breakfast",
            "Museum Passes",
            "City Tax"
        ],
        "excluded": [
            "Visa Fees",
            "Lunch & Dinner",
            "Shopping expenses"
        ],
        "itinerary": [
            {
                "day": 1,
                "title": "Bienvenue à Paris",
                "timeline": [
                    { "time": "10:00 AM", "activity": "Arrival at CDG Airport" },
                    { "time": "02:00 PM", "activity": "Check-in at Hotel" },
                    { "time": "07:00 PM", "activity": "Seine River Dinner Cruise" }
                ]
            },
            {
                "day": 4,
                "title": "The London Connection",
                "timeline": [
                    { "time": "09:00 AM", "activity": "Train to London" },
                    { "time": "01:00 PM", "activity": "Check-in at London Hotel" }
                ]
            }
        ],
        "hotelsIncluded": [
            {
                "hotelId": "HTL_201",
                "hotelName": "Pullman Paris Tour Eiffel",
                "nights": 3,
                "roomType": "Superior King",
                "location": "Paris, France",
                "images": ["https://hotel.com/paris1.jpg"],
                "amenities": ["Gym", "Bar", "Concierge"]
            },
            {
                "hotelId": "HTL_202",
                "hotelName": "The Savoy",
                "nights": 3,
                "roomType": "Luxury Room",
                "location": "London, UK",
                "images": ["https://hotel.com/london1.jpg"],
                "amenities": ["Pool", "Spa", "Fine Dining"]
            }
        ],
        "sights": [
            {
                "sightId": "S003",
                "title": "The Louvre",
                "description": "Home of the Mona Lisa.",
                "images": ["https://sight.com/louvre.jpg"],
                "location": { "latitude": 48.8606, "longitude": 2.3376 }
            }
        ],
        "pricingStructure": {
            "pricePerAdult": 2500,
            "pricePerChild": 1800,
            "extraAdultPrice": 2300
        },
        "specialRates": {
            "seasonalPricing": {
                "enabled": true,
                "note": "Higher rates in summer (June-Aug)."
            },
            "earlyBirdDiscount": {
                "enabled": false,
                "discountPercent": 0,
                "description": ""
            }
        },
        "transportType": "Private Sedan & High Speed Train",
        "pickupDropDetails": {
            "pickupFromHotel": true,
            "dropToAirport": true,
            "availablePickupTimes": ["08:00", "14:00"],
            "availableDropTimes": ["10:00", "16:00"]
        },
        "createdAt": "2025-02-10T10:00:00Z",
        "updatedAt": "2025-02-12T10:00:00Z"
    },
    {
        "packageId": "PKG_003",
        "packageName": "Manali & Leh Ladakh Adventure",
        "location": "India",
        "duration": {
            "days": 9,
            "nights": 8
        },
        "thumbnailImage": "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=500&q=60",
        "packageImages": [
            "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23",
            "https://images.unsplash.com/photo-1581793434119-98f0af09b6a2"
        ],
        "startingPrice": 35000,
        "currency": "INR",
        "rating": {
            "average": 4.7,
            "totalReviews": 128
        },
        "about": "A thrill-seeker's dream. Ride through the highest motorable roads, visit ancient monasteries, and camp under the stars.",
        "highlights": [
            "Rohtang Pass Snow Point",
            "Pangong Lake Camping",
            "Nubra Valley Camel Ride",
            "Magnetic Hill"
        ],
        "included": [
            "Royal Enfield Bike Rental",
            "Fuel",
            "Camping Gear",
            "Dinner & Breakfast"
        ],
        "excluded": [
            "Flights",
            "Personal Medikit",
            "Bike Security Deposit"
        ],
        "itinerary": [
            {
                "day": 1,
                "title": "Arrival in Manali",
                "timeline": [
                    { "time": "08:00 AM", "activity": "Bus arrival" },
                    { "time": "06:00 PM", "activity": "Bike test ride & briefing" }
                ]
            },
            {
                "day": 5,
                "title": "Leh Arrival",
                "timeline": [
                    { "time": "04:00 PM", "activity": "Reach Leh City" },
                    { "time": "07:00 PM", "activity": "Market stroll" }
                ]
            }
        ],
        "hotelsIncluded": [
            {
                "hotelId": "HTL_301",
                "hotelName": "Sterling Manali",
                "nights": 2,
                "roomType": "Classic Room",
                "location": "Manali, India",
                "images": ["https://hotel.com/manali.jpg"],
                "amenities": ["Heater", "Restaurant", "Parking"]
            },
            {
                "hotelId": "HTL_302",
                "hotelName": "Pangong Sarai Camps",
                "nights": 1,
                "roomType": "Swiss Tent",
                "location": "Pangong Tso, India",
                "images": ["https://hotel.com/camp.jpg"],
                "amenities": ["Bonfire", "Hot Water", "Meals"]
            }
        ],
        "sights": [
            {
                "sightId": "S005",
                "title": "Pangong Lake",
                "description": "The world's highest saltwater lake.",
                "images": ["https://sight.com/pangong.jpg"],
                "location": { "latitude": 33.7595, "longitude": 78.6674 }
            }
        ],
        "pricingStructure": {
            "pricePerAdult": 35000,
            "pricePerChild": 20000,
            "extraAdultPrice": 32000
        },
        "specialRates": {
            "seasonalPricing": {
                "enabled": true,
                "note": "Roads closed in Winter."
            },
            "earlyBirdDiscount": {
                "enabled": true,
                "discountPercent": 15,
                "description": "Book 2 months ahead for 15% off."
            }
        },
        "transportType": "Motorbike / 4x4 SUV",
        "pickupDropDetails": {
            "pickupFromHotel": false,
            "dropToAirport": false,
            "availablePickupTimes": [],
            "availableDropTimes": []
        },
        "createdAt": "2025-03-01T09:00:00Z",
        "updatedAt": "2025-03-05T09:00:00Z"
    },
    {
        "packageId": "PKG_004",
        "packageName": "Luxury Maldives Water Villa",
        "location": "Maldives",
        "duration": {
            "days": 4,
            "nights": 3
        },
        "thumbnailImage": "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=500&q=60",
        "packageImages": [
            "https://images.unsplash.com/photo-1514282401047-d79a71a590e8",
            "https://images.unsplash.com/photo-1573843981267-be1999ff37cd"
        ],
        "startingPrice": 2200,
        "currency": "USD",
        "rating": {
            "average": 5.0,
            "totalReviews": 85
        },
        "about": "Unwind in your private overwater bungalow. Crystal clear waters, vibrant coral reefs, and world-class spa treatments await.",
        "highlights": [
            "Overwater Bungalow Stay",
            "Sunset Dolphin Cruise",
            "Undersea Restaurant Dining",
            "Snorkeling Safari"
        ],
        "included": [
            "Seaplane Transfers",
            "All Inclusive Meal Plan",
            "Snorkeling Gear",
            "Honeymoon Cake"
        ],
        "excluded": [
            "Scuba Diving Course",
            "Professional Photography",
            "Souvenirs"
        ],
        "itinerary": [
            {
                "day": 1,
                "title": "Welcome to Paradise",
                "timeline": [
                    { "time": "11:00 AM", "activity": "Seaplane flight" },
                    { "time": "01:00 PM", "activity": "Villa Check-in" }
                ]
            },
            {
                "day": 2,
                "title": "Ocean Life",
                "timeline": [
                    { "time": "10:00 AM", "activity": "Guided Snorkeling" },
                    { "time": "05:00 PM", "activity": "Sunset Cruise" }
                ]
            }
        ],
        "hotelsIncluded": [
            {
                "hotelId": "HTL_401",
                "hotelName": "Anantara Veli Maldives Resort",
                "nights": 3,
                "roomType": "Over Water Bungalow",
                "location": "South Male Atoll",
                "images": ["https://hotel.com/maldives.jpg"],
                "amenities": ["Infinity Pool", "Spa", "Private Deck"]
            }
        ],
        "sights": [],
        "pricingStructure": {
            "pricePerAdult": 2200,
            "pricePerChild": 0,
            "extraAdultPrice": 2200
        },
        "specialRates": {
            "seasonalPricing": {
                "enabled": false,
                "note": ""
            },
            "earlyBirdDiscount": {
                "enabled": true,
                "discountPercent": 5,
                "description": "5% OFF for bookings 60+ days in advance."
            }
        },
        "transportType": "Speedboat / Seaplane",
        "pickupDropDetails": {
            "pickupFromHotel": true,
            "dropToAirport": true,
            "availablePickupTimes": ["Anytime"],
            "availableDropTimes": ["Anytime"]
        },
        "createdAt": "2025-01-15T10:00:00Z",
        "updatedAt": "2025-01-20T10:00:00Z"
    },
    {
        "packageId": "PKG_005",
        "packageName": "Essence of Japan: Tokyo & Kyoto",
        "location": "Japan",
        "duration": {
            "days": 6,
            "nights": 5
        },
        "thumbnailImage": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=500&q=60",
        "packageImages": [
            "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e",
            "https://images.unsplash.com/photo-1528360983277-13d9b152cace"
        ],
        "startingPrice": 250000,
        "currency": "JPY",
        "rating": {
            "average": 4.6,
            "totalReviews": 210
        },
        "about": "A perfect blend of neon-lit skyscrapers and tranquil temples. Experience the Shinkansen bullet train and authentic sushi.",
        "highlights": [
            "Shibuya Crossing",
            "Fushimi Inari Shrine",
            "Mount Fuji View",
            "Tea Ceremony"
        ],
        "included": [
            "JR Rail Pass (7 Days)",
            "Pocket WiFi",
            "Temple Entry Fees",
            "Breakfast"
        ],
        "excluded": [
            "International Flights",
            "Travel Insurance",
            "Personal Shopping"
        ],
        "itinerary": [
            {
                "day": 1,
                "title": "Tokyo Arrival",
                "timeline": [
                    { "time": "03:00 PM", "activity": "Check-in Shinjuku" },
                    { "time": "06:00 PM", "activity": "Ramen Street Dinner" }
                ]
            },
            {
                "day": 3,
                "title": "Bullet Train to Kyoto",
                "timeline": [
                    { "time": "09:00 AM", "activity": "Shinkansen Ride" },
                    { "time": "02:00 PM", "activity": "Kinkaku-ji (Golden Pavilion)" }
                ]
            }
        ],
        "hotelsIncluded": [
            {
                "hotelId": "HTL_501",
                "hotelName": "Keio Plaza Hotel",
                "nights": 3,
                "roomType": "Plaza Standard",
                "location": "Tokyo, Japan",
                "images": ["https://hotel.com/tokyo.jpg"],
                "amenities": ["Shuttle Bus", "Convenience Store", "Bar"]
            },
            {
                "hotelId": "HTL_502",
                "hotelName": "Hotel Granvia Kyoto",
                "nights": 2,
                "roomType": "Double Room",
                "location": "Kyoto, Japan",
                "images": ["https://hotel.com/kyoto.jpg"],
                "amenities": ["Train Station Access", "Gym", "Pool"]
            }
        ],
        "sights": [
            {
                "sightId": "S007",
                "title": "Senso-ji Temple",
                "description": "Tokyo's oldest temple.",
                "images": ["https://sight.com/sensoji.jpg"],
                "location": { "latitude": 35.7148, "longitude": 139.7967 }
            }
        ],
        "pricingStructure": {
            "pricePerAdult": 250000,
            "pricePerChild": 125000,
            "extraAdultPrice": 220000
        },
        "specialRates": {
            "seasonalPricing": {
                "enabled": true,
                "note": "Cherry Blossom season surcharge applied."
            },
            "earlyBirdDiscount": {
                "enabled": false,
                "discountPercent": 0,
                "description": ""
            }
        },
        "transportType": "Public Transport / Train",
        "pickupDropDetails": {
            "pickupFromHotel": false,
            "dropToAirport": false,
            "availablePickupTimes": [],
            "availableDropTimes": []
        },
        "createdAt": "2025-04-01T10:00:00Z",
        "updatedAt": "2025-04-01T10:00:00Z"
    },
    {
        "packageId": "PKG_006",
        "packageName": "Dubai Skylines & Desert Safari",
        "location": "UAE",
        "duration": {
            "days": 5,
            "nights": 4
        },
        "thumbnailImage": "https://images.unsplash.com/photo-1512453979798-5ea904ac66de?auto=format&fit=crop&w=500&q=60",
        "packageImages": [
            "https://images.unsplash.com/photo-1512453979798-5ea904ac66de",
            "https://images.unsplash.com/photo-1541963463532-d68292c34b19"
        ],
        "startingPrice": 3200,
        "currency": "AED",
        "rating": {
            "average": 4.5,
            "totalReviews": 440
        },
        "about": "Experience the luxury of the Middle East. Visit the world's tallest building, shop at massive malls, and enjoy a thrilling desert safari.",
        "highlights": [
            "Burj Khalifa At The Top",
            "Desert Dune Bashing",
            "Marina Dhow Cruise",
            "Dubai Mall Aquarium"
        ],
        "included": [
            "4-Star Accommodation",
            "Buffet Dinner at Desert Camp",
            "City Tour Guide",
            "Visa Assistance"
        ],
        "excluded": [
            "Tourism Dirham Fee",
            "Lunch",
            "Tips for Driver"
        ],
        "itinerary": [
            {
                "day": 1,
                "title": "Arrival",
                "timeline": [
                    { "time": "08:00 AM", "activity": "Land at DXB" },
                    { "time": "07:00 PM", "activity": "Dhow Cruise Dinner" }
                ]
            },
            {
                "day": 2,
                "title": "Modern Dubai",
                "timeline": [
                    { "time": "10:00 AM", "activity": "Burj Khalifa" },
                    { "time": "03:30 PM", "activity": "Pick up for Desert Safari" }
                ]
            }
        ],
        "hotelsIncluded": [
            {
                "hotelId": "HTL_601",
                "hotelName": "Gevora Hotel",
                "nights": 4,
                "roomType": "Deluxe Room",
                "location": "Sheikh Zayed Road",
                "images": ["https://hotel.com/gevora.jpg"],
                "amenities": ["Rooftop Pool", "Gym", "WiFi"]
            }
        ],
        "sights": [
            {
                "sightId": "S009",
                "title": "Burj Khalifa",
                "description": "Tallest building in the world.",
                "images": ["https://sight.com/burj.jpg"],
                "location": { "latitude": 25.1972, "longitude": 55.2744 }
            }
        ],
        "pricingStructure": {
            "pricePerAdult": 3200,
            "pricePerChild": 2500,
            "extraAdultPrice": 3000
        },
        "specialRates": {
            "seasonalPricing": {
                "enabled": true,
                "note": "Prices drop in summer (July-Aug)."
            },
            "earlyBirdDiscount": {
                "enabled": true,
                "discountPercent": 8,
                "description": "8% OFF for bookings 15 days in advance."
            }
        },
        "transportType": "Luxury Coach / Land Cruiser",
        "pickupDropDetails": {
            "pickupFromHotel": true,
            "dropToAirport": true,
            "availablePickupTimes": ["09:00", "15:00"],
            "availableDropTimes": ["12:00", "18:00"]
        },
        "createdAt": "2025-02-20T10:00:00Z",
        "updatedAt": "2025-02-22T10:00:00Z"
    }
];
