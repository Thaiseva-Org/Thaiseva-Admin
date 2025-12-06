/**
 * @typedef {Object} TargetRoomPricing
 * @property {number} basePrice
 * @property {number} discountPercent
 * @property {boolean} taxIncluded
 * @property {number} pricePerNightAfterDiscount
 * @property {Array<{guests: number, pricePerNight: number}>} pricingBasedOnGuests
 * @property {{nights: number, totalAmount: number}} priceForStay
 */

/**
 * @typedef {Object} TargetRoom
 * @property {string} roomName
 * @property {string} packageName
 * @property {number} maxGuests
 * @property {number} numberOfBeds
 * @property {string} bedType
 * @property {Array<string>} photos
 * @property {Array<string>} amenities
 * @property {string} description
 * @property {{checkIn: string, checkOut: string, extraBed: string, paymentInfo: string, refundable: boolean}} policies
 * @property {{breakfastIncluded: boolean, breakfastType: string}} foodInfo
 * @property {TargetRoomPricing} pricing
 */

/**
 * @typedef {Object} TargetHotelImages
 * @property {string} logo
 * @property {Array<string>} gallery
 */

/**
 * @typedef {Object} TargetHotel
 * @property {Object} hotel
 * @property {string} hotel.hotelId - UUID
 * @property {string} hotel.hotelUid - String
 * @property {string} hotel.hotelName - String
 * @property {string} hotel.country - String
 * @property {string} hotel.currency - String
 * @property {number} hotel.startingPrice - Number
 * @property {number} hotel.discount - Number
 * @property {string} hotel.address - String
 * @property {string} hotel.description - String
 * @property {TargetHotelImages} hotel.images
 * @property {boolean} hotel.petsAllowed
 * @property {Array<string>} hotel.nearbyAttractions
 * @property {Array<string>} hotel.features
 * @property {string} hotel.phoneNumber - String
 * @property {number} hotel.rating - Number
 * @property {number} hotel.numberOfReviews - Number
 * @property {string} hotel.status - String
 * @property {string} hotel.updatedAt - ISO Date String
 * @property {Array<TargetRoom>} rooms
 */

/**
 * Transforms existing hotel data into the Gold Standard TargetHotel format.
 * @param {Object} currentData - The existing hotel data object (from Firebase/AddHotelForm context).
 * @returns {TargetHotel} The transformed data adhering to the gold standard.
 */
export const transformHotelData = (currentData) => {
    // Info might be nested under hotelInformation or at top level depending on source (AddHotelForm lines 345 vs 368)
    // We'll assume a structure similar to what's saved in `usersCollection` or passed to `HotelProfile`
    const hotelInfo = currentData.hotelInformation || currentData;

    // --- Hotel Transformation ---
    const transformHotel = () => {
        return {
            hotelId: currentData.uid || "N/A", // Map uid to hotelId
            hotelUid: currentData.uid || "N/A", // Map uid to hotelUid as well
            hotelName: hotelInfo.hotelName || "",
            country: hotelInfo.country || "",
            currency: "THB", // Defaulting to THB based on "Thaiseva" context, could be dynamic
            startingPrice: 0, // Needs calculation based on rooms, defaulting to 0
            discount: 0, // Needs calculation or default
            address: hotelInfo.address || "",
            description: hotelInfo.description || "",
            images: {
                logo: hotelInfo.logoURL || "",
                gallery: hotelInfo.gallery || [] // Assuming gallery might exist or default empty
            },
            petsAllowed: false, // Default, not found in current source
            nearbyAttractions: [], // Default, not found
            features: hotelInfo.amenities || [], // Map amenities to features
            phoneNumber: hotelInfo.phoneNumber || "",
            rating: Number(hotelInfo.rating) || 0,
            numberOfReviews: 0, // Default
            status: "Verified",
            updatedAt: new Date().toISOString()
        };
    };

    // --- Room Transformation ---
    const transformRooms = () => {
        const roomsList = hotelInfo.roomTypes || [];

        return roomsList.map(room => {
            // Calculate discounted price if applicable
            const basePrice = Number(room.price) || 0;
            const discountPercent = 0; // Current room types in Form don't seem to have explicit discount field in initial roomTypes state, but HotelRoomsManager has.
            // Assuming addHotelForm roomTypes structure: { id, name, price, guests, rooms: [], amenities: [] }
            const priceAfterDiscount = basePrice * (1 - discountPercent / 100);

            return {
                roomName: room.name || "",
                packageName: room.name || "", // Reusing name for package
                maxGuests: Number(room.guests) || 2,
                numberOfBeds: 1, // Default
                bedType: "King", // Default
                photos: [], // Default, not in basic roomType object
                amenities: room.amenities || [],
                description: "", // Default
                policies: {
                    checkIn: "14:00", // Standard default
                    checkOut: "12:00", // Standard default
                    extraBed: "Available", // Default strategy
                    paymentInfo: "Prepaid", // Default
                    refundable: true // Default
                },
                foodInfo: {
                    breakfastIncluded: false,
                    breakfastType: "None"
                },
                pricing: {
                    basePrice: basePrice,
                    discountPercent: discountPercent,
                    taxIncluded: true,
                    pricePerNightAfterDiscount: priceAfterDiscount,
                    pricingBasedOnGuests: [], // Complex logic, leaving empty for basic transformation
                    priceForStay: {
                        nights: 1, // Default to 1 night view
                        totalAmount: priceAfterDiscount
                    }
                }
            };
        });
    };

    const targetHotel = transformHotel();
    const rooms = transformRooms();

    // Update starting price based on cheapest room if available
    if (rooms.length > 0) {
        const prices = rooms.map(r => r.pricing.pricePerNightAfterDiscount);
        targetHotel.startingPrice = Math.min(...prices);
    }

    return {
        hotel: targetHotel,
        rooms: rooms
    };
};
