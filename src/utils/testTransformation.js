
import { transformHotelData } from './hotelTransformation.js';

// Mock existing data matching structure seen in AddHotelForm.jsx
const mockCurrentData = {
    uid: "test-hotel-uuid-12345",
    status: "Verified",
    hotelInformation: {
        hotelName: "Grand Thaiseva Hotel",
        country: "Thailand",
        address: "123 Bangkok Street, Thailand",
        description: "A lovely place to stay.",
        logoURL: "https://example.com/logo.png",
        phoneNumber: "+66 1234 5678",
        rating: 4.5,
        amenities: ["wifi", "pool", "spa"],
        roomTypes: [
            { id: 1, name: "Deluxe Ocean View", price: 3500, guests: 2, amenities: ['wifi', 'ac'] },
            { id: 2, name: "Standard Room", price: 1500, guests: 2, amenities: ['wifi'] }
        ]
    }
};

console.log("-------------- Input Data --------------");
console.log(JSON.stringify(mockCurrentData, null, 2));

const result = transformHotelData(mockCurrentData);

console.log("\n\n-------------- Transformed Data (Gold Standard) --------------");
console.log(JSON.stringify(result, null, 2));

// specific validation
const hotelCheck = result.hotel.hotelName === "Grand Thaiseva Hotel" ? "PASS" : "FAIL";
const roomCheck = result.rooms.length === 2 ? "PASS" : "FAIL";
const priceCheck = result.hotel.startingPrice === 1500 ? "PASS" : "FAIL";

console.log(`\n\n-------------- Verification Results --------------`);
console.log(`Hotel Name Map: ${hotelCheck}`);
console.log(`Room Count Map: ${roomCheck}`);
console.log(`Starting Price Calculation: ${priceCheck}`);
