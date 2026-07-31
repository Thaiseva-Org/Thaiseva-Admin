import { doc, getDoc, updateDoc } from "firebase/firestore";
import {
    carBookingsCollection,
    roomBookingCollection,
    selfDriveBookingCollection,
    travelBookingCollection,
    vanBookingsCollection,
} from "../firebase/firebase.config";
import { generateInvoiceIds, INVOICE_TYPES } from "../utils/invoiceGenerator";

export const ensureInvoiceIdForBooking = async (category, id, currentData) => {
    if (currentData.customerInvoiceId && currentData.partnerInvoiceId) {
        return currentData;
    }

    // Otherwise, generate and update
    let col;
    let serviceType;

    if (category === "Taxi Bookings") {
        col = carBookingsCollection;
        serviceType = INVOICE_TYPES.TAXI;
    } else if (category === "Selfdrive Bookings") {
        col = selfDriveBookingCollection;
        serviceType = INVOICE_TYPES.SAFE_DRIVE;
    } else if (category === "Room Bookings") {
        col = roomBookingCollection;
        serviceType = INVOICE_TYPES.ROOM;
    } else if (category === "Van Bookings") {
        // Handle Mobile Vans vs Manual Vans
        if (currentData.source === 'mobile') {
            col = carBookingsCollection;
        } else {
            col = vanBookingsCollection;
        }
        serviceType = INVOICE_TYPES.VAN;
    } else {
        col = travelBookingCollection;
        serviceType = INVOICE_TYPES.SIGHTSEEING;
    }

    try {
        const { customerId, partnerId } = await generateInvoiceIds(serviceType);

        // Update Firestore
        const OrderRef = doc(col, id);
        await updateDoc(OrderRef, {
            customerInvoiceId: customerId,
            partnerInvoiceId: partnerId,
            invoiceId: partnerId
        });

        // Return updated data object
        return {
            ...currentData,
            customerInvoiceId: customerId,
            partnerInvoiceId: partnerId,
            invoiceId: partnerId
        };
    } catch (error) {
        console.error("Error ensuring invoice ID:", error);
        return currentData;
    }
};
