/* Per-customer migration. Dry-run by default; never deletes or modifies the source. */
const admin = require("firebase-admin");
const fs = require("node:fs");
const path = require("node:path");
const {
  fingerprint,
  searchTerms,
  extractLinks,
  validatedFile,
  id,
} = require("../lib/customerChatCore");
const {messageMillis, held} = require("../lib/retentionPolicy");
const args = process.argv.slice(2);
const option = (key) => args[args.indexOf(key) + 1];
if (!args.includes("--project") || !args.includes("--uid"))
  throw new Error(
    "Usage: node scripts/migrate-customer-chat.cjs --project PROJECT --uid CUSTOMER [--apply --backup-dir DIRECTORY]",
  );
const projectId = option("--project");
const uid = id(option("--uid"));
const apply = args.includes("--apply");
if (apply && !args.includes("--backup-dir"))
  throw new Error(
    "--apply requires --backup-dir; the backup contains private messages. Keep it outside the repository.",
  );
admin.initializeApp({
  projectId,
  storageBucket: process.env.CHAT_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
});
const db = admin.firestore();
const bucket = admin.storage().bucket();
function mediaPath(value) {
  if (typeof value !== "string" || !value) return null;
  let candidate = value;
  if (/^https?:/.test(candidate)) {
    const url = new URL(candidate);
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (
      url.hostname !== "firebasestorage.googleapis.com" ||
      !match ||
      decodeURIComponent(match[1]) !== bucket.name
    )
      throw new Error("Untrusted legacy attachment URL; review before migrating.");
    candidate = decodeURIComponent(match[2]);
  }
  if (
    candidate.includes("..") ||
    !(
      candidate.startsWith(`chat/${uid}/`) ||
      candidate.startsWith(`chats/${uid}/`) ||
      candidate.startsWith(`chatMedia/${uid}/`) ||
      candidate.startsWith(`private-chat/chats/${uid}_CustomerSupport/`)
    )
  )
    throw new Error("Attachment is not scoped to this customer; review before migrating.");
  return candidate;
}
async function main() {
  const source = await db.doc(`chats/${uid}_CustomerSupport`).get();
  if (!source.exists) throw new Error("Legacy conversation not found.");
  const raw = source.data();
  if (!Array.isArray(raw.messages)) throw new Error("Unsupported legacy chat format.");
  const profile = (await db.doc(`users/${uid}`).get()).data() || {};
  const plan = [];
  const identifiers = new Set();
  // Validate every record before writes. Unknown timestamps/media fail instead of silently losing history.
  for (let index = 0; index < raw.messages.length; index++) {
    const message = raw.messages[index];
    const createdAt = messageMillis(message);
    if (!createdAt) throw new Error(`Message ${index} has no valid timestamp; migration stopped.`);
    const identifier = fingerprint(["legacy", uid, message.id || index]);
    if (identifiers.has(identifier))
      throw new Error(`Duplicate legacy message ID at index ${index}; review before migrating.`);
    identifiers.add(identifier);
    if ((await db.doc(`customerSupportMessagesV2/${identifier}`).get()).exists) continue;
    const media =
      message.img ||
      message.file ||
      message.audio ||
      message.video ||
      message.fileUrl ||
      message.audioUrl;
    const sourcePath = mediaPath(media);
    let attachment = null;
    let bytes = null;
    if (sourcePath) {
      const file = bucket.file(sourcePath);
      const [metadata] = await file.getMetadata();
      if (Number(metadata.size) > 8 * 1024 * 1024)
        throw new Error(`Message ${index} attachment exceeds 8 MiB; review before migrating.`);
      [bytes] = await file.download();
      const checked = validatedFile(bytes.toString("base64"), metadata.contentType);
      attachment = {
        id: identifier,
        name: String(message.fileName || message.name || "Previous attachment").slice(0, 180),
        size: bytes.length,
        contentType: checked.contentType,
        category: checked.category,
      };
    }
    const messageText = String(message.text || "").slice(0, 4000);
    const links = extractLinks(messageText);
    const senderRole = message.senderId === uid ? "customer" : "admin";
    plan.push({
      identifier,
      bytes,
      attachment,
      data: {
        customerId: uid,
        senderId: message.senderId || "legacy-admin",
        senderRole,
        text: messageText,
        booking: null,
        replyTo: null,
        attachment,
        links,
        categories: [
          ...(attachment ? [attachment.category] : []),
          ...(links.length ? ["links"] : []),
        ],
        createdAt: admin.firestore.Timestamp.fromMillis(createdAt),
        deleted: false,
        editedAt: null,
        legacyIndex: index,
        legacySource: source.ref.path,
        retentionHold: held(message),
        searchTerms: searchTerms([messageText, attachment?.name || "", ...links].join(" ")),
      },
    });
  }
  console.log(
    JSON.stringify(
      {
        projectId,
        customerId: uid,
        sourceCount: raw.messages.length,
        toCreate: plan.length,
        attachments: plan.filter((x) => x.attachment).length,
        mode: apply ? "apply" : "dry-run",
      },
      null,
      2,
    ),
  );
  if (!apply) return;
  const backupDir = path.resolve(option("--backup-dir"));
  fs.mkdirSync(backupDir, {recursive: true});
  const backupFile = path.join(backupDir, `${uid}-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({sourcePath: source.ref.path, data: raw}, null, 2), {
    flag: "wx",
    mode: 0o600,
  });
  for (const item of plan) {
    const ref = db.doc(`customerSupportMessagesV2/${item.identifier}`);
    const storagePath = `customer-support-v2/${uid}/${item.identifier}`;
    if (item.bytes)
      await bucket
        .file(storagePath)
        .save(item.bytes, {
          resumable: false,
          contentType: item.attachment.contentType,
          metadata: {cacheControl: "private, no-store"},
        });
    await db.runTransaction(async (tx) => {
      if ((await tx.get(ref)).exists) return;
      tx.create(ref, item.data);
      if (item.attachment)
        tx.set(db.doc(`customerSupportAttachmentsV2/${item.identifier}`), {
          ...item.attachment,
          customerId: uid,
          uploaderId: item.data.senderId,
          storagePath,
          messageId: item.identifier,
          createdAt: item.data.createdAt,
        });
    });
  }
  const latest = await db
    .collection("customerSupportMessagesV2")
    .where("customerId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  const existing = await db.doc(`customerSupportV2/${uid}`).get();
  if (!existing.exists)
    await db
      .doc(`customerSupportV2/${uid}`)
      .create({
        customerId: uid,
        customerName: profile.displayName || "Customer",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: latest.docs[0]?.data().createdAt || admin.firestore.Timestamp.now(),
        lastMessage: "Previous conversation imported",
        status: "open",
        adminUnread: 0,
        customerUnread: 0,
        retentionHold: held(raw),
      });
  else if (held(raw)) await existing.ref.update({retentionHold: true});
  const result = await db
    .collection("customerSupportMessagesV2")
    .where("legacySource", "==", source.ref.path)
    .count()
    .get();
  if (result.data().count !== raw.messages.length)
    throw new Error(
      "Reconciliation failed. Source is unchanged; inspect duplicate legacy message IDs before cutover.",
    );
  console.log(`Reconciled ${result.data().count} messages. Source retained. Backup: ${backupFile}`);
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => admin.app().delete());
