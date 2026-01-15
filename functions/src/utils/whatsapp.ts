import * as logger from "firebase-functions/logger";
import * as dotenv from "dotenv";


// Attempt to load .env from standard locations
// In local emulator/test:
dotenv.config();

// In compiled lib structure:
const PHONE_NUMBER_ID = "899290049941177";
const ADMIN_PHONE_NUMBER = "919284091637";
// Permanent token provided by user
const PERMANENT_TOKEN = "EAAWQVwqWzbwBQbuAFiUmPzZBp8vvLWd7uvw4nA66ZATWPL6jcoF5OpngEkXF43513up6dd9bkXbkStZAtwNZCpHd5A3ZCJZC7ETyJHO8qAV9mOJoCBMZB0LZAIcZBHJZAb493pI64k30bsoMophoMHm1sEZBZCc6DDOQOJX2oIPhinfIFQkqmTkxJB9lLDyTTEu0iYrSuwZDZD";

/**
 * Sends a WhatsApp notification to the admin using the WhatsApp Business API.
 * @param templateName The name of the template to use (default: "hello_world")
 * @param languageCode The language code for the template (default: "en_US")
 */
export async function sendWhatsAppNotification(
    templateName: string = "hello_world",
    languageCode: string = "en_US"
) {
    const accessToken = PERMANENT_TOKEN; // process.env.WHATSAPP_ACCESS_TOKEN;

    // Detailed logging for debugging
    const tokenExists = !!accessToken;
    const tokenPreview = tokenExists ? `...${accessToken!.slice(-5)}` : "MISSING";

    logger.info(`[WhatsApp] Status Check - Token: ${tokenPreview}, PhoneID: ${PHONE_NUMBER_ID}, Target: ${ADMIN_PHONE_NUMBER}`);

    if (!accessToken) {
        logger.error(
            "[WhatsApp] WHATSAPP_ACCESS_TOKEN is missing. Please check functions/.env or Cloud Function Environment Variables."
        );
        return;
    }

    const url = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`;

    const payload = {
        messaging_product: "whatsapp",
        to: ADMIN_PHONE_NUMBER,
        type: "template",
        template: {
            name: templateName,
            language: {
                code: languageCode,
            },
        },
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorRaw = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorRaw);
            } catch {
                errorData = errorRaw;
            }
            logger.error("[WhatsApp] Failed to send notification", { status: response.status, error: errorData });
        } else {
            const data = await response.json();
            logger.info("[WhatsApp] Notification sent successfully", data);
        }
    } catch (error) {
        logger.error("[WhatsApp] Error executing fetch", error);
    }
}
