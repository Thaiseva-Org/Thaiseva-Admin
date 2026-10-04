# WhatsApp Notification Integration Plan

> [!NOTE]
> **Consolidated Specification:** This WhatsApp notification and chat architecture has been unified into the authoritative **[Third-Party Integrations Guide (Section 5: WhatsApp Communications)](file:///d:/projects/Thaiseva-Admin-Portal-Web-App/docs/03-api/THIRD_PARTY_INTEGRATIONS.md)**.

## Overview
This document outlines the technical plan to send automated WhatsApp notifications to **2 specific admin numbers** whenever a new notification is created in the Admin Dashboard.

## Architecture
We will use an **Event-Driven Architecture** using Firebase Cloud Functions. This ensures security (hidden API keys) and reliability (background processing).

| Component | Responsibility |
| :--- | :--- |
| **Admin Frontend** | Creates a document in Firestore `notifications` collection. |
| **Firestore** | Stores the notification data. |
| **Cloud Function** | Listens for `onCreate` events in `notifications/{id}`. |
| **Twilio / Meta API** | Delivers the WhatsApp message. |

---

## Prerequisites
1.  **Firebase Blaze Plan**: Required for Cloud Functions to make external API calls.
2.  **WhatsApp Provider Account**:
    *   **Twilio** (Recommended for ease of use): Account + WhatsApp Sender Number.
    *   **Meta Business**: Facebook Developer Account + Business Manager verification.
3.  **Approved Template**: WhatsApp requires pre-approved templates for initiating conversations.
    *   *Example:* `New Alert: {{1}}. Check dashboard for details.`

---

## Implementation Steps

### 1. Setup Environment
Define your target phone numbers and API keys in Firebase environment variables.
```bash
firebase functions:config:set whatsapp.admin1="+1234567890" whatsapp.admin2="+0987654321" whatsapp.sid="AC_YOUR_SID" whatsapp.token="YOUR_AUTH_TOKEN"
```

### 2. Backend Logic (Cloud Function)
Create a new function in `functions/index.js`. This function will run automatically when a new notification is saved.

**Logic Flow:**
1.  Trigger: `functions.firestore.document('notifications/{docId}').onCreate`
2.  Retrieve `docId`, `title`, and `message` from the snapshot.
3.  Iterate through the 2 admin numbers.
4.  Send the message using the Twilio SDK (or HTTP request).

### 3. Example Code Structure
*(Note: This goes in your `functions` directory, not the React app)*

```javascript
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const twilio = require("twilio");

// Initialize using environment variables
const client = twilio(functions.config().whatsapp.sid, functions.config().whatsapp.token);
const ADMIN_NUMBERS = [
    functions.config().whatsapp.admin1,
    functions.config().whatsapp.admin2
];

exports.sendWhatsAppToAdmins = functions.firestore
  .document("notifications/{docId}")
  .onCreate((snapshot, context) => {
    const data = snapshot.data();
    const title = data.title || "New Notification";
    const body = data.desc || "";

    // WhatsApp Template Message
    // IMPORTANT: Body must match your approved Twilio/WhatsApp template exactly
    const messageBody = `New Alert: ${title}. ${body}`;

    const sendPromises = ADMIN_NUMBERS.map((number) => {
      return client.messages.create({
        from: "whatsapp:+14155238886", // Your Twilio Sender Number
        to: `whatsapp:${number}`,
        body: messageBody,
      });
    });

    return Promise.all(sendPromises)
      .then(() => console.log("WhatsApp sent to admins"))
      .catch((err) => console.error("Error sending WhatsApp:", err));
  });
```

---

## Cost & Limitations
*   **Cost**: Uses Firebase Cloud Functions invocation quotas + WhatsApp Provider fees (approx $0.005 - $0.05 per message depending on region).
*   **Template Approval**: You cannot send custom/free-form text as the *first* message. You MUST use a pre-approved template structure.
*   **24-Hour Window**: If the admin replies, you can send free-form text for 24 hours.

## Next Steps
1.  Sign up for **Twilio** or **Meta Developers**.
2.  Upgrade Firebase project to **Blaze Plan**.
3.  Deploy the function using `firebase deploy --only functions`.
