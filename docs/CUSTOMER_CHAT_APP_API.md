# Thaiseva customer chat: app integration

Updated: 19 October 2026. Customer ↔ one Thaiseva admin. No partner or food-portal integration.

## What is implemented

- Admin inbox at `/dashboard/customer-chat`.
- Callable API named `customerChat`, region `asia-east2`, using the same Firebase project as the admin portal.
- Server-controlled messages, replies, edits/deletion, read receipts, open/resolved status, paginated history.
- Private attachments (8 MiB maximum), shared media/documents/links and word-prefix search.
- A `/` booking picker: hotel, sightseeing, car (including van/taxi/bike bookings stored in `car_bookings`), and self-drive.
- A per-customer, dry-run-first legacy migration script. Existing chat is retained during cutover.

The mobile application source is not part of this repository. This document and `examples/customer_chat_service.dart` provide its integration contract. No mobile UI is included; app developers can connect their existing screens to this API.

## Authentication and API transport

The app must sign in with Firebase Authentication. Prefer the Firebase Functions client SDK: it attaches the Firebase ID token and handles the callable request/response envelope. Never send service-account keys, admin claims, sender IDs, timestamps, or storage paths from the app. The server derives identity and checks active accounts, revoked sessions, conversation scope, and booking ownership.

JavaScript:

```js
import { getFunctions, httpsCallable } from 'firebase/functions';
const call = httpsCallable(getFunctions(firebaseApp, 'asia-east2'), 'customerChat');
const chat = async (action, payload = {}) =>
  (await call({ ...payload, action })).data;

const { conversation } = await chat('open');
const { items, nextCursor } = await chat('messages', { limit: 30 });
```

Flutter:

```dart
final functions = FirebaseFunctions.instanceFor(region: 'asia-east2');
final endpoint = functions.httpsCallable('customerChat');
final result = await endpoint.call({'action': 'open'});
final conversation = result.data['conversation'];
```

Without the SDK, use the callable HTTP protocol:

```http
POST https://asia-east2-PROJECT_ID.cloudfunctions.net/customerChat
Authorization: Bearer FIREBASE_ID_TOKEN
Content-Type: application/json

{"data":{"action":"messages","limit":30}}
```

Success is wrapped as `{"result": {...}}`; callable errors use `{"error":{"status":"PERMISSION_DENIED","message":"..."}}`. These are not plain REST endpoints. Use the deployed function URL if its configuration provides a different URL.

Official references: [Callable functions](https://firebase.google.com/docs/functions/callable), [callable HTTP protocol](https://firebase.google.com/docs/functions/callable-reference).

## Action reference

Customers omit `customerId`; it is derived from authentication. Supplying a different customer ID is rejected. Admin calls include the target `customerId`. Only the protected general Admin role/admin claim can access the admin actions; food roles and sub-admin roles do not grant chat access.

All timestamps in responses are Unix milliseconds. `items` are newest first for messages and search. `nextCursor: null` means the end. Cursors must be reused with the same action, scope and filters.

| Action | Input beyond `action` | Response / behavior |
|---|---|---|
| `open` | none (admin supplies `customerId`) | `{conversation}`; creates the customer's one conversation if missing; includes unread counts and `customerReadAt`/`adminReadAt` when set |
| `messages` | `limit` 1–50, optional `cursor`, `from`, `to` | `{items,nextCursor}`; active message history |
| `send` | unique `requestId`, optional `text`, `booking`, `attachmentId`, `replyTo` | `{message}`; at least text, booking or attachment required; reopens a resolved conversation |
| `edit` | `messageId`, `text` | `{success:true}`; only the original sender can edit; held records cannot be edited |
| `delete` | `messageId` | `{success:true}`; customer may delete own messages, admin may delete either side; held records preserved |
| `read` | `through` = timestamp of newest displayed message | `{success:true}`; advances the current user's read receipt; preserves unread arrivals newer than `through` |
| `bookings` | `service`, optional `cursor` | `{items,nextCursor}`; 30 candidates/page, own bookings only |
| `booking` | `booking:{service,id}` | `{booking}`; fresh, verified reference details. General admins also receive an allowlisted `booking.details` object for the order-view popup; customer responses stay minimal. |
| `upload` | `name`, `contentType`, `contentBase64` | `{attachment:{id,name,contentType,size,category}}` |
| `download` | `attachmentId` | `{contentBase64,contentType,name}` normally; large imported files return an authenticated Storage descriptor (below); only linked active attachments are available |
| `shared` | `category`: `media`, `documents` or `links`; optional `limit`, `cursor`, `from`, `to` | `{items,nextCursor}`; each item is its original message |
| `search` | `query`; optional `limit`, `cursor`, `from`, `to`, `senderRole`, `contentType` | `{items,nextCursor}`; current customer's history |
| `inbox` | admin only; optional `limit`, `cursor` | `{items,nextCursor}`; newest updated conversations first |
| `status` | admin only; `customerId`, `status`: `open` or `resolved` | `{success:true}` |

Admin may use `search` with `allCustomers:true`. Customers cannot use this flag. `from` and `to` are inclusive Unix millisecond filters.

Search matches normalized **word prefixes**, 2–48 characters per query word. It is not fuzzy, arbitrary substring, OCR or semantic search. Up to 1,200 indexed prefixes are kept per message. Thai combining marks are preserved; unspaced Thai text is indexed as a contiguous token, not linguistically segmented words. Multiword, sender-role and MIME filters are applied within each fetched candidate page, so an empty page can still have a `nextCursor`. Continue until the cursor is null. Booking lists can similarly return an empty filtered page when a conflicting legacy ownership record is excluded.

## App integration lifecycle

### Chat topic categories (restored 19 October 2026)

Categories such as Visa or Work Permit describe what the customer is chatting about. They do not change access, routing or retention. They are separate from the `shared` attachment filters (`media`, `documents`, `links`).

After opening the conversation, record a category selection through the callable:

```js
const result = await chat('category', {
  category: 'Visa',
  requestId: crypto.randomUUID(),
});
```

Keep the same request ID and payload for retries. `setCategory` is an alias; `send` with `type: 'heading'` and `text: 'Visa'` is also accepted. Admin calls include the target `customerId`. Category names must be nonempty, at most 80 characters, and contain no control characters. `open` also accepts an optional `category` and `requestId`.

The response is `{changed,message,conversation}`. A transition appends a server-authored `type: 'heading'` message with `category`, `text` and `createdAt`, and updates `conversation.currentCategory` and `categoryUpdatedAt`. Selecting the current category adds no marker (`changed: false`, `message: null`). An identical retry returns its existing marker without resetting a newer category; reusing that ID for another category returns `already-exists`. Held conversations reject category changes. Category history cannot be edited or deleted through message actions.

Render both new `type: 'heading'` and migrated `legacyType: 'heading'` records as centered **Chatting in {category}** entries, using `category` or fallback `text`. Ordinary text mentioning a category stays a normal message. Use `conversation.currentCategory` for the latest header even when viewing older pages; the Admin inbox displays it beneath the customer name.

Compatibility: `open` backfills a missing current category from the customer's original headings. Normal `messages` polling imports missing legacy category headings using stable migration IDs and their original dates. Source records remain unchanged, source/conversation holds block the sync, and individual marker holds are preserved. This is limited to category headings; ordinary messages and files are not synchronized between stores. See [restoration and validation](05-security/CHAT_CATEGORY_RESTORATION_2026-10-19.md).

1. On entering Support, call `open`, then `messages`. Render messages in ascending time order.
2. While this screen is visible, refresh the latest page every five seconds, with only one request in flight. Pause while backgrounded, offline, signed out, or viewing older history. Resume with a fresh latest page; do not start overlapping timers. This version uses polling, not Firestore subscriptions or push notifications.
3. After displaying the latest page, call `read` with its highest `createdAt`. Refresh `open` periodically to obtain the admin read timestamp. Show **Read** for customer messages with `createdAt <= conversation.adminReadAt`, otherwise **Sent**.
4. On upward scroll, call `messages` using `nextCursor`. Prepend older results and preserve scroll position. Deduplicate by message ID. Do not mark unseen incoming messages as read.
5. On send, create a UUID **once**. Persist that request ID and its exact payload for retries. Reuse them after timeouts, reconnects and app restarts. A changed payload requires a new ID. Display a pending bubble until confirmation; reconcile by the server message ID. Do not clear the composer on failure.
6. The app has no admin routing or agent selector. The header is always **Thaiseva Support**.
7. Menu options open Media, Documents, Links and Search. Keep pagination and scroll state separate for each view. Search results and shared items retain the original message ID for navigation. If the source message is outside loaded history, load older pages until found; a dedicated jump endpoint is not included.
8. Booking cards call `booking` when tapped. If a booking has been removed or is inaccessible, show “Booking details unavailable” without exposing other customers' data.

## `/` booking selection

The app's existing chat can invoke the booking-list API from its `/` action. This integration does not create a new conversation.

Call `bookings` for each selected service and paginate to access the complete list. The backend never scans another customer's bookings. The list query includes legacy `authUid`, `userId`, `uId`, and `uid` fields; `authUid`, then `userId`, is authoritative if present.

When the customer selects a booking, show a removable chip/card above the composer. Do not send it until Send is tapped:

```json
{
  "action": "send",
  "requestId": "9cc4f7c6-0ad1-4d9e-85e0-2401feef82a4",
  "text": "Can I change my check-in time?",
  "booking": {"service": "hotel", "id": "ACTUAL_FIRESTORE_BOOKING_DOCUMENT_ID"}
}
```

Use the returned booking document `id`, not an invented `TS` number. Display `reference` when available. The server rebuilds the card from the owned booking; client-supplied titles/status/dates are ignored.

## Attachments

1. Pick one file. Check the 8 MiB limit before base64 encoding.
2. Call `upload` with the actual MIME type and base64 content (no `data:...` prefix).
3. Retain the returned attachment ID. Call `send` with it and the stable request ID. Text and a booking can be included in the same message.
4. Use `download` to display or save the attachment. Convert decoded bytes to an app-private temporary file or an in-memory preview. Do not persist a public URL.
5. Delete private temporary files when no longer needed or on sign-out. Never render HTML/SVG as attachments. Prefer platform PDF/document viewers.

Allowed: JPEG, PNG, GIF, WebP, PDF, WebM audio/video, Ogg audio, MP3, MP4 audio/video. Office files, SVG and AVIF are deliberately not accepted by this new endpoint. The server checks size and file signatures. Signature checks are **not** malware scanning.

One attachment is supported per message. Unsent uploads expire after 24 hours; reuse the successful upload ID during send retries. Downloads are reauthorized each time; deleting a message blocks new downloads immediately. Cleanup removes pending files hourly, up to 200 candidates/run. Already downloaded bytes cannot be revoked.

Historical imports may include larger files, ZIP archives or plain-text documents. These exceptions do not change the 8 MiB limit or supported formats for new uploads. For a historical attachment larger than 8 MiB, `download` returns `{downloadTransport:"firebase-authenticated",bucket,storagePath,expiresAt,name,contentType,size}`. Use the signed-in user's Firebase Storage SDK with that bucket/path, for example native `writeToFile` or web `getBlob`. A server-issued UID-bound grant expires after one minute; another account cannot reuse it, and deletion blocks access immediately. Call `download` again if the grant expires before the download starts. Do not use `getDownloadURL`, expose a bearer URL or add download tokens. Native clients should stream large archives to a private local file rather than loading them into memory.

This version uses base64 request/response transport. There are no resumable uploads, byte-level progress, generated thumbnails, video streaming or malware-scanner integration. Show an indeterminate “Uploading…” state. Those production enhancements need a storage-upload pipeline rather than pretending the callable supports them.

## Errors and limits

| Callable error | App behavior |
|---|---|
| `unauthenticated` | Prompt sign-in; refresh authentication before a retry |
| `permission-denied` | Stop retrying; explain access is unavailable |
| `invalid-argument` | Show validation message and let the user correct input |
| `already-exists` | Request ID was reused with different content; recover the existing pending send or create a new send intentionally |
| `resource-exhausted` | Wait at least one minute before retrying |
| `failed-precondition` | Open the conversation first, or explain that a retention hold blocks the requested change |
| Network/timeout | Keep pending state; retry the identical send with its original request ID |

Limits: text 4,000 characters; filename 180; search query 100; up to 10 extracted HTTP(S) links/message; 180 API requests/user/minute, with a separate 10-upload/minute bucket. Uploaded MIME and bytes must agree. Link cards currently show the URL/domain; the backend does not fetch external preview pages.

## Release checklist

Production project: `gothai-ffea1`. The release record is in `CHAT_RELEASE_2026-10-19.md`. For subsequent releases, functions, indexes and the admin build must be released before a mobile build uses the new endpoint. Direct client Firestore access and Storage writes remain denied. Only large historical downloads use authenticated Storage reads with an API-issued, UID-bound one-minute grant. Verify the actual deployed shared rules before cutover.

1. Run `npm run test:customer-chat` and `npm run test:customer-chat:integration` from `functions`; run `npm run build` from the repository root.
2. Review the new indexes in `firestore.indexes.json` alongside the canonical shared-security indexes. The project uses shared Firebase resources: merge additions into the canonical deployment configuration before release. Wait for indexes to finish building. Do not remove unrelated live indexes.
3. Deploy only the new `customerChat` and `cleanupCustomerChatAttachments` functions, and deploy the updated account-deletion function (`deleteUserFunction`) so the new storage and records are included in erasure. Deploy the admin hosting build after testing against staging.
4. Confirm the real storage bucket name for migration; set `CHAT_STORAGE_BUCKET` if different from the default. Verify each supported service against real staging booking schemas.
5. Freeze legacy customer sends for each customer's cutover. From `functions`, preview migration:

   ```powershell
   node scripts/migrate-customer-chat.cjs --project STAGING_PROJECT --uid CUSTOMER_UID
   ```

   After reviewing counts and any unsupported attachment/timestamp errors:

   ```powershell
   node scripts/migrate-customer-chat.cjs --project STAGING_PROJECT --uid CUSTOMER_UID --apply --backup-dir D:\private-chat-backups
   ```

   The script writes a private backup before applying, uses deterministic message IDs, and reconciles source/target counts. It never deletes or modifies the original conversation. Unknown attachments, external URLs, oversized files and missing dates stop migration for review. The script supports legacy message arrays; legacy nested message collections require a separate migration adapter. Do not run against production as an unattended bulk command.
6. Test the mobile integration, then enable the new app chat. Keep the previous admin chat link during migration. Do not promise two-way sync: old and new stores are independent. Retire legacy writes only after supported clients have migrated.
7. Rollback: point the app/admin back to the previous flow. Preserve messages written to V2 and reconcile them before rollback; they are not automatically copied into the old array. Keep backups private and apply an agreed backup retention policy.

Chat cleanup follows the existing two-year message retention policy and preserves legal/retention/dispute holds. Account erasure now includes the V2 conversation, messages, attachment metadata, rate-limit records and private storage prefix, unless a hold requires review.

Bulk migration is available in `functions/scripts/migrate-all-customer-chats.cjs`. It exports originals to an external private backup directory and requires a successful dry-run with an unchanged source manifest before `--apply`. `--reviewed-legacy-files` is an operator-only compatibility mode: it accepts inspected historical upload paths and ZIP/text documents up to 512 MiB, validates headers, performs server-side copies, verifies size/checksum, strips permanent download tokens and preserves full message text. An explicitly reviewed `--source-bucket-alias` resolves old Firebase bucket URLs to already-copied objects in the current bucket. It never fetches arbitrary remote URLs, rewrites legacy messages, deletes original files, or broadens new-upload permissions. `--firebase-tools-root` can use an existing operator CLI login with credentials held only in memory.

## Remaining production enhancements

Instant push/realtime subscriptions, resumable upload/streaming, server-generated thumbnails, restricted remote link previews, malware scanning, dedicated jump-to-message, and fuzzy/linguistically segmented search are not implemented in this version. The API and UI must be staging-tested with the actual mobile app before production rollout.
