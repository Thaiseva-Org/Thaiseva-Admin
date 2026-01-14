import { doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase/firebase.config";

export const INVOICE_TYPES = {
    SIGHTSEEING: "Sightseeing",
    ROOM: "Room",
    TAXI: "Taxi",
    SAFE_DRIVE: "Safe Drive",
    VAN: "Van",
};

const PREFIX_MAP = {
    [INVOICE_TYPES.SIGHTSEEING]: "SB",
    [INVOICE_TYPES.ROOM]: "RB",
    [INVOICE_TYPES.TAXI]: "TB",
    [INVOICE_TYPES.SAFE_DRIVE]: "SDB",
    [INVOICE_TYPES.VAN]: "VB",
};

/**
 * Generates invoice IDs for Customer and Partner based on the service type.
 * Uses a daily counter stored in Firestore at `counters/invoice_{YYMMDD}`.
 * The count is global for the day across all services (based on interpretation "invoice ids for one invocie...").
 * 
 * @param {string} serviceType - One of 'Sightseeing', 'Room', 'Taxi', 'Safe Drive'
 * @returns {Promise<{customerId: string, partnerId: string, invoiceIdBase: string}>}
 */
export const generateInvoiceIds = async (serviceType) => {
    const prefix = PREFIX_MAP[serviceType];
    if (!prefix) {
        throw new Error(`Invalid service type: ${serviceType}. Must be one of ${Object.keys(PREFIX_MAP).join(", ")}`);
    }

    const today = new Date();
    const yy = String(today.getFullYear()).slice(-2);
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    // Reference to the daily counter document specific to the service type
    const dateString = `${yy}${mm}${dd}`; // YYMMDD
    const counterRef = doc(db, "counters", `invoices_${prefix}_${dateString}`);

    try {
        const result = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            let newCount = 1;
            if (counterDoc.exists()) {
                const data = counterDoc.data();
                const currentCount = data.count || 0;
                newCount = currentCount + 1;
            }

            // Update the counter
            transaction.set(counterRef, { count: newCount, date: dateString, type: prefix }, { merge: true });

            return newCount;
        });

        // Format: [PREFIX][YYMMDD]-[TYPE][COUNT]
        // Example: SB251227-C1, SB251227-P1
        // Example: TB251227-C1 (Separate counter)
        const baseId = `${prefix}${dateString}`;
        const customerId = `${baseId}-C${result}`;
        const partnerId = `${baseId}-P${result}`;

        return {
            customerId,
            partnerId,
            invoiceIdBase: `${baseId}-${result}`, // internal tracking if needed
            count: result
        };

    } catch (error) {
        console.error("Error generating invoice IDs:", error);
        throw error;
    }
};
