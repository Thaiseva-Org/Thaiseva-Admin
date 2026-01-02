import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

let db: admin.firestore.Firestore;

export const autoAcceptSightseeingBookings = onDocumentCreated("travelBookingDetails/{bookingId}", async (event) => {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  if (!db) {
    db = admin.firestore();
  }

  const snapshot = event.data;
  if (!snapshot) {
    return;
  }

  const bookingData = snapshot.data();
  const bookingId = event.params.bookingId;

  logger.info(`New Booking Triggered: ${bookingId}`, bookingData);

  const packageId = bookingData.packageId || bookingData.dataid;
  if (!packageId) {
    logger.warn(`Booking ${bookingId} skipped: No packageId found. Data:`, bookingData);
    return;
  }

  // Determine if it's a partner booking
  const partnerId = bookingData.partnerId || bookingData.providerId || bookingData.agentId || null;
  logger.info(`Processing Booking ${bookingId}: Package ${packageId}, Partner: ${partnerId}`);

  try {
    // 1. Fetch the Package Details to get limits
    const packageDocRef = db.collection("sightseeingPackagesDetails").doc(packageId);
    const packageDocSnapshot = await packageDocRef.get();

    if (!packageDocSnapshot.exists) {
      logger.error(`Package ${packageId} not found for booking ${bookingId}.`);
      return;
    }

    const packageData = packageDocSnapshot.data();

    // FETCH GLOBAL SETTINGS
    const settingsDoc = await db.collection("settings").doc("sightseeingConfig").get();
    const globalLimit = settingsDoc.exists ? (parseInt(settingsDoc.data()?.globalWeeklyLimit) || 200) : 200;

    let limit = globalLimit;

    // Logic for Partner vs Own
    if (partnerId && packageData?.authorizedPartners && Array.isArray(packageData.authorizedPartners)) {
      // Find specific partner limit
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const authorizedPartner = packageData.authorizedPartners.find((p: any) => p.partnerId === partnerId || p.id === partnerId);
      if (authorizedPartner && authorizedPartner.maxBookingsPerWeek) {
        limit = parseInt(authorizedPartner.maxBookingsPerWeek);
        logger.info(`Using Partner Limit for ${partnerId}: ${limit}`);
      } else {
        logger.info(`Partner ${partnerId} has no specific limit, using Global Limit: ${limit}`);
      }
    } else {
      logger.info(`Own Booking, using Global Limit: ${limit}`);
    }

    // 2. Count existing bookings for this week
    const bookingDateRaw = bookingData.orderedAt || bookingData.createdAt;
    const bookingDate = bookingDateRaw ? bookingDateRaw.toDate() : new Date();
    const startOfWeek = new Date(bookingDate);
    const day = startOfWeek.getDay() || 7; // Get current day number, converting Sun (0) to 7
    if (day !== 1) startOfWeek.setHours(-24 * (day - 1));
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // SIMPLIFIED QUERY TO AVOID MISSING INDEX ERRORS
    // We fetch all bookings for this package and filter date/status in memory.
    let query = db.collection("travelBookingDetails")
      .where("packageId", "==", packageId);

    // Execute query
    const bookingsSnapshot = await query.get();

    let count = 0;
    const validStatuses = ["Accepted", "Confirmed", "Done"];

    if (partnerId) {
      // For partner, strictly count their bookings
      count = bookingsSnapshot.docs.filter(doc => {
        const d = doc.data();
        const pid = d.partnerId || d.providerId || d.agentId;
        const status = d.status;
        const rawDate = d.orderedAt || d.createdAt;
        const oDate = rawDate ? rawDate.toDate() : null;

        const works = pid === partnerId &&
          validStatuses.includes(status) &&
          oDate && oDate >= startOfWeek && oDate <= endOfWeek;
        return works;
      }).length;
    } else {
      // For own, count bookings NOT from partners
      count = bookingsSnapshot.docs.filter(doc => {
        const d = doc.data();
        const pid = d.partnerId || d.providerId || d.agentId;
        const status = d.status;
        const rawDate = d.orderedAt || d.createdAt;
        const oDate = rawDate ? rawDate.toDate() : null;

        const works = !pid &&
          validStatuses.includes(status) &&
          oDate && oDate >= startOfWeek && oDate <= endOfWeek;
        return works;
      }).length;
    }

    logger.info(`Current confirmed count for this week: ${count}. Limit: ${limit}`);

    // 3. Logic: Check Limit
    if (count < limit) {
      logger.info(`Limit passed (${count} < ${limit}). Auto-accepting booking ${bookingId}.`);
      // Auto Accept
      await snapshot.ref.update({
        status: "Accepted",
        isBookingConfirmed: true,
        autoAccepted: true,
        acceptedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      logger.info(`Booking ${bookingId} successfully updated to Accepted.`);
    } else {
      logger.info(`Limit reached (${count} >= ${limit}). Leaving booking ${bookingId} as Pending.`);
      // Ensure consistency if needed, but usually imply Pending if created as such
      if (bookingData.status !== "Pending" && bookingData.status !== "Review In Progress") {
        await snapshot.ref.update({
          status: "Pending"
        });
      }
    }

  } catch (error) {
    logger.error("Error in autoAcceptSightseeingBookings:", error);
  }
});
