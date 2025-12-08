/**
 * @typedef {Object} SightseeingDuration
 * @property {number} days
 * @property {number} nights
 */

/**
 * @typedef {Object} SightseeingRating
 * @property {number} average
 * @property {number} totalReviews
 */

/**
 * @typedef {Object} SightseeingTimelineItem
 * @property {string} time
 * @property {string} activity
 */

/**
 * @typedef {Object} SightseeingItineraryDay
 * @property {number} day
 * @property {string} title
 * @property {Array<SightseeingTimelineItem>} timeline
 */

/**
 * @typedef {Object} SightseeingHotel
 * @property {string} hotelId
 * @property {string} hotelName
 * @property {number} nights
 * @property {string} roomType
 * @property {string} location
 * @property {Array<string>} images
 * @property {Array<string>} amenities
 */

/**
 * @typedef {Object} SightseeingLocation
 * @property {number} latitude
 * @property {number} longitude
 */

/**
 * @typedef {Object} SightseeingSight
 * @property {string} sightId
 * @property {string} title
 * @property {string} description
 * @property {Array<string>} images
 * @property {SightseeingLocation} location
 */

/**
 * @typedef {Object} SightseeingPricingStructure
 * @property {number} pricePerAdult
 * @property {number} pricePerChild
 * @property {number} extraAdultPrice
 */

/**
 * @typedef {Object} SeasonalPricing
 * @property {boolean} enabled
 * @property {string} note
 */

/**
 * @typedef {Object} EarlyBirdDiscount
 * @property {boolean} enabled
 * @property {number} discountPercent
 * @property {string} description
 */

/**
 * @typedef {Object} SightseeingSpecialRates
 * @property {SeasonalPricing} seasonalPricing
 * @property {EarlyBirdDiscount} earlyBirdDiscount
 */

/**
 * @typedef {Object} PickupDropDetails
 * @property {boolean} pickupFromHotel
 * @property {boolean} dropToAirport
 * @property {Array<string>} availablePickupTimes
 * @property {Array<string>} availableDropTimes
 */

/**
 * @typedef {Object} SightseeingPackage
 * @property {string} packageId
 * @property {string} packageName
 * @property {string} location
 * @property {SightseeingDuration} duration
 * @property {string} thumbnailImage
 * @property {Array<string>} packageImages
 * @property {number} startingPrice
 * @property {string} currency
 * @property {SightseeingRating} rating
 * @property {string} about
 * @property {Array<string>} highlights
 * @property {Array<string>} included
 * @property {Array<string>} excluded
 * @property {Array<SightseeingItineraryDay>} itinerary
 * @property {Array<SightseeingHotel>} hotelsIncluded
 * @property {Array<SightseeingSight>} sights
 * @property {SightseeingPricingStructure} pricingStructure
 * @property {SightseeingSpecialRates} specialRates
 * @property {string} transportType
 * @property {PickupDropDetails} pickupDropDetails
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Function to initialize a default empty sightseeing package structure
 * @returns {SightseeingPackage}
 */
export const getEmptySightseeingPackage = () => {
    return {
        packageId: "",
        packageName: "",
        location: "",
        duration: {
            days: 1,
            nights: 0
        },
        thumbnailImage: "",
        packageImages: [],
        startingPrice: 0,
        currency: "THB",
        rating: {
            average: 0,
            totalReviews: 0
        },
        about: "",
        highlights: [],
        included: [],
        excluded: [],
        itinerary: [],
        hotelsIncluded: [],
        sights: [],
        pricingStructure: {
            pricePerAdult: 0,
            pricePerChild: 0,
            extraAdultPrice: 0
        },
        specialRates: {
            seasonalPricing: {
                enabled: false,
                note: ""
            },
            earlyBirdDiscount: {
                enabled: false,
                discountPercent: 0,
                description: ""
            }
        },
        transportType: "",
        pickupDropDetails: {
            pickupFromHotel: false,
            dropToAirport: false,
            availablePickupTimes: [],
            availableDropTimes: []
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
};
