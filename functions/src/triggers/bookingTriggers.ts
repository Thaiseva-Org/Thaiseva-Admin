import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { sendTelegramNotification } from "../utils/telegram";

let db: admin.firestore.Firestore;

export const autoAcceptSightseeingBookings = onDocumentCreated(
  { document: "travelBookingDetails/{bookingId}", region: "asia-east2" },
  async (event) => {
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

    const name = bookingData.customerName || bookingData.name || "Unknown Customer";
    const pkgName = bookingData.packageName || bookingData.selectedPackageName || "Unknown Package";
    const date = bookingData.travelDate || bookingData.date || "Unknown Date";
    const amount = bookingData.totalAmount || bookingData.price || "N/A";

    const message = `<b>🆕 New Sightseeing Booking</b>\n` +
                    `🆔 <code>${bookingId}</code>\n` +
                    `👤 ${name}\n` +
                    `📦 ${pkgName}\n` +
                    `📅 ${date}\n` +
                    `💰 ฿${amount}`;

    await sendTelegramNotification(message);

    logger.info(`New Booking Triggered: ${bookingId}`, bookingData);

    const packageId = bookingData.packageId || bookingData.dataid;
    if (!packageId) {
      logger.warn(`Booking ${bookingId} skipped: No packageId found. Data:`, bookingData);
      return;
    }

    const partnerId = bookingData.partnerId || bookingData.providerId || bookingData.agentId || null;
    logger.info(`Processing Booking ${bookingId}: Package ${packageId}, Partner: ${partnerId}`);

    try {
      const packageDocRef = db.collection("sightseeingPackagesDetails").doc(packageId);
      const packageDocSnapshot = await packageDocRef.get();

      if (!packageDocSnapshot.exists) {
        logger.error(`Package ${packageId} not found for booking ${bookingId}.`);
        return;
      }

      const packageData = packageDocSnapshot.data();

      const settingsDoc = await db.collection("settings").doc("sightseeingConfig").get();
      const globalLimit = settingsDoc.exists ? (parseInt(settingsDoc.data()?.globalWeeklyLimit) || 200) : 200;

      let limit = globalLimit;

      if (partnerId && packageData?.authorizedPartners && Array.isArray(packageData.authorizedPartners)) {
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

      const bookingDateRaw = bookingData.orderedAt || bookingData.createdAt;
      const bookingDate = bookingDateRaw ? bookingDateRaw.toDate() : new Date();
      const startOfWeek = new Date(bookingDate);
      const day = startOfWeek.getDay() || 7;
      if (day !== 1) startOfWeek.setHours(-24 * (day - 1));
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const query = db.collection("travelBookingDetails")
        .where("packageId", "==", packageId);

      const bookingsSnapshot = await query.get();

      let count = 0;
      const validStatuses = ["Accepted", "Confirmed", "Done"];

      if (partnerId) {
        count = bookingsSnapshot.docs.filter(doc => {
          const d = doc.data();
          const pid = d.partnerId || d.providerId || d.agentId;
          const status = d.status;
          const rawDate = d.orderedAt || d.createdAt;
          const oDate = rawDate ? rawDate.toDate() : null;

          return pid === partnerId &&
            validStatuses.includes(status) &&
            oDate && oDate >= startOfWeek && oDate <= endOfWeek;
        }).length;
      } else {
        count = bookingsSnapshot.docs.filter(doc => {
          const d = doc.data();
          const pid = d.partnerId || d.providerId || d.agentId;
          const status = d.status;
          const rawDate = d.orderedAt || d.createdAt;
          const oDate = rawDate ? rawDate.toDate() : null;

          return !pid &&
            validStatuses.includes(status) &&
            oDate && oDate >= startOfWeek && oDate <= endOfWeek;
        }).length;
      }

      logger.info(`Current confirmed count for this week: ${count}. Limit: ${limit}`);

      if (count < limit) {
        logger.info(`Limit passed (${count} < ${limit}). Auto-accepting booking ${bookingId}.`);
        await snapshot.ref.update({
          status: "Accepted",
          isBookingConfirmed: true,
          autoAccepted: true,
          acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.info(`Booking ${bookingId} successfully updated to Accepted.`);
      } else {
        logger.info(`Limit reached (${count} >= ${limit}). Leaving booking ${bookingId} as Pending.`);
        if (bookingData.status !== "Pending" && bookingData.status !== "Review In Progress") {
          await snapshot.ref.update({
            status: "Pending",
          });
        }
      }
    } catch (error) {
      logger.error("Error in autoAcceptSightseeingBookings:", error);
    }
  },
);

export const onSightseeingBookingStatusChange = onDocumentUpdated(
  { document: "travelBookingDetails/{bookingId}", region: "asia-east2" },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const statusBefore = before.status;
    const statusAfter = after.status;

    if (statusBefore === statusAfter) return;

    if (after.autoAccepted && (statusAfter === "Accepted" || statusAfter === "ACCEPTED")) {
      logger.info(`Skipping 'Accepted' notification for ${event.params.bookingId} because it was auto-accepted.`);
      return;
    }

    logger.info(`Sightseeing Booking ${event.params.bookingId} status changed: ${statusBefore} -> ${statusAfter}`);

    const name = after.customerName || after.name || "Unknown Customer";
    const pkgName = after.packageName || after.selectedPackageName || "Unknown Package";

    if (statusAfter === "Accepted" || statusAfter === "ACCEPTED") {
      logger.info("Sending Telegram Notification: Booking Accepted");
      await sendTelegramNotification(
        `<b>✅ Sightseeing Booking Accepted</b>\n` +
        `🆔 <code>${event.params.bookingId}</code>\n` +
        `👤 ${name}\n` +
        `📦 ${pkgName}`
      );
    }

    if (statusAfter === "Canceled" || statusAfter === "CANCELED" || statusAfter === "Cancelled") {
      logger.info("Sending Telegram Notification: Booking Canceled");
      await sendTelegramNotification(
        `<b>❌ Sightseeing Booking Cancelled</b>\n` +
        `🆔 <code>${event.params.bookingId}</code>\n` +
        `👤 ${name}\n` +
        `📦 ${pkgName}`
      );
    }
  },
);
