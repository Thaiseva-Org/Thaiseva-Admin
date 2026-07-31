import * as logger from "firebase-functions/logger";

const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export async function sendTelegramNotification(message: string, retries = 3) {
  // Read inside the function so Firebase v2 .env auto-loading works.
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    logger.error(
      "[Telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing. " +
        "Ensure functions/.env contains these variables.",
    );
    return false;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  const attemptSend = async (attempt: number): Promise<boolean> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorRaw = await response.text();
        let errorData: unknown;
        try {
          errorData = JSON.parse(errorRaw);
        } catch {
          errorData = errorRaw;
        }

        logger.error(
          "[Telegram] Failed to send notification " +
            `(attempt ${attempt}/${retries})`,
          {
            status: response.status,
            error: errorData,
          },
        );

        if (response.status === 429 || response.status >= 500) {
          // Retry on rate limit or server error
          throw new Error(`Telegram API returned ${response.status}`);
        }

        // Don't retry on 4xx client errors (e.g., bad token, invalid chat ID)
        return false;
      }

      logger.info("[Telegram] Notification sent successfully");
      return true;
    } catch (error) {
      clearTimeout(timeout);
      logger.error(
        `[Telegram] Error executing fetch (attempt ${attempt}/${retries})`,
        error,
      );
      throw error;
    }
  };

  for (let i = 1; i <= retries; i++) {
    try {
      const success = await attemptSend(i);
      if (success) return true;
      if (!success && i === 1) return false; // Fail fast on 4xx
    } catch (error) {
      if (i === retries) {
        logger.error(
          `[Telegram] Exhausted all ${retries} retries for message.`,
        );
        return false;
      }
      const backoffDelay = Math.pow(2, i - 1) * 1000;
      logger.info(`[Telegram] Retrying in ${backoffDelay}ms...`);
      await sleep(backoffDelay);
    }
  }
  return false;
}
