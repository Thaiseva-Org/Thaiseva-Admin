// Package pricing follows the room with the lowest base price.
export const hotelPackagePricing = (rooms = []) => {
    let cheapest = null;
    for (const room of rooms) {
        const price = Number(room.pricing?.basePrice ?? room.price);
        if (!Number.isFinite(price) || price <= 0) continue;
        if (!cheapest || price < cheapest.startingPrice) {
            const rawDiscount = Number(room.pricing?.discountPercent ?? room.discount ?? 0);
            cheapest = {
                startingPrice: price,
                discount: Number.isFinite(rawDiscount) ? Math.min(100, Math.max(0, rawDiscount)) : 0,
            };
        }
    }
    return cheapest || { startingPrice: 0, discount: 0 };
};

export const hotelPackagePricingUpdate = (rooms) => {
    const pricing = hotelPackagePricing(rooms);
    return {
        ...pricing,
        "hotel.startingPrice": pricing.startingPrice,
        "hotel.discount": pricing.discount,
    };
};
