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
const { messageMillis, held } = require("../lib/retentionPolicy");
const args = process.argv.slice(2);
const option = (key) => args[args.indexOf(key) + 1];
if (!args.includes("--project") || !args.includes("--uid"))
  throw new Error(
    "Usage: node scripts/migrate-customer-chat.cjs --project PROJECT --uid CUSTOMER [--apply --backup-dir DIRECTORY]",
  );
const projectId = option("--project");
const uid = id(option("--uid"));
const apply = args.includes("--apply");
const reviewedLegacyFiles = args.includes("--reviewed-legacy-files");
if (apply && !args.includes("--backup-dir"))
  throw new Error(
    "--apply requires --backup-dir; the backup contains private messages. Keep it outside the repository.",
  );
const { db, bucket } = require("./chatMigrationConnection.cjs").connect({
  projectId,
  bucketName:
    process.env.CHAT_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
  firebaseToolsRoot: args.includes("--firebase-tools-root")
    ? option("--firebase-tools-root")
    : undefined,
});
function mediaPath(value, message) {
  if (typeof value !== "string" || !value) return null;
  let candidate = value;
  if (/^https?:/.test(candidate)) {
    const url = new URL(candidate);
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (
      url.hostname !== "firebasestorage.googleapis.com" ||
      !match ||
      (decodeURIComponent(match[1]) !== bucket.name &&
        !(
          reviewedLegacyFiles &&
          args.includes("--source-bucket-alias") &&
          decodeURIComponent(match[1]) === option("--source-bucket-alias")
        ))
    )
      throw new Error(
        "Untrusted legacy attachment URL; review before migrating.",
      );
    candidate = decodeURIComponent(match[2]);
  }
  if (
    candidate.includes("..") ||
    !(
      candidate.startsWith(`chat/${uid}/`) ||
      candidate.startsWith(`chats/${uid}/`) ||
      candidate.startsWith(`chatMedia/${uid}/`) ||
      candidate.startsWith(`private-chat/chats/${uid}_CustomerSupport/`) ||
      (reviewedLegacyFiles &&
        (candidate.startsWith("uploads/") ||
          /^file-[A-Za-z0-9_-]+$/.test(candidate) ||
          (message.senderId === "_CustomerSupport" &&
            /^chat\/[A-Za-z0-9_-]+\//.test(candidate))))
    )
  )
    throw new Error(
      "Attachment is not scoped to this customer; review before migrating.",
    );
  return candidate;
}
function validateImport(bytes, contentType, totalSize) {
  const type = String(contentType || "")
    .split(";")[0]
    .toLowerCase();
  if (!reviewedLegacyFiles)
    return validatedFile(bytes.toString("base64"), type);
  if (!bytes.length || totalSize > 512 * 1024 * 1024)
    throw new Error(
      "Historical attachment exceeds the reviewed 512 MiB migration limit.",
    );
  if (type === "text/plain")
    return { contentType: type, category: "documents" };
  if (
    type === "application/zip" &&
    ["504b0304", "504b0506", "504b0708"].includes(
      bytes.subarray(0, 4).toString("hex"),
    )
  )
    return { contentType: type, category: "documents" };
  return validatedFile(
    bytes
      .subarray(0, Math.min(bytes.length, 8 * 1024 * 1024))
      .toString("base64"),
    type,
  );
}
async function main() {
  const source = await db.doc(`chats/${uid}_CustomerSupport`).get();
  if (!source.exists) throw new Error("Legacy conversation not found.");
  const raw = source.data();
  if (!Array.isArray(raw.messages))
    throw new Error("Unsupported legacy chat format.");
  const sourceHash = fingerprint(raw.messages);
  const profile = (await db.doc(`users/${uid}`).get()).data() || {};
  const directory =
    (await db.doc("chatRooms/CustomerSupport").get()).data() || {};
  const room = directory[source.id] || {};
  const existingRecords = await db
    .collection("customerSupportMessagesV2")
    .where("legacySource", "==", source.ref.path)
    .get();
  const existingIds = new Set(existingRecords.docs.map((record) => record.id));
  const plan = [];
  const identifiers = new Set();
  // Validate every record before writes. Unknown timestamps/media fail instead of silently losing history.
  for (let index = 0; index < raw.messages.length; index++) {
    const message = raw.messages[index];
    const createdAt = messageMillis(message);
    if (!createdAt)
      throw new Error(
        `Message ${index} has no valid timestamp; migration stopped.`,
      );
    const identifier = fingerprint([
      "legacy",
      uid,
      message.id || message.messageId || index,
    ]);
    if (identifiers.has(identifier))
      throw new Error(
        `Duplicate legacy message ID at index ${index}; review before migrating.`,
      );
    identifiers.add(identifier);
    if (existingIds.has(identifier)) continue;
    const media = [
      message.filePath,
      message.img,
      message.file,
      message.audio,
      message.video,
      message.fileUrl,
      message.imageUrl,
      message.audioUrl,
      message.videoUrl,
    ].filter((value) => typeof value === "string" && value);
    const paths = [...new Set(media.map((value) => mediaPath(value, message)))];
    if (paths.length > 1)
      throw new Error(
        `Message ${index} references multiple different attachments; review before migrating.`,
      );
    const sourcePath = paths[0] || null;
    let attachment = null;
    let bytes = null;
    let sourceFile = null;
    let sourceMetadata = null;
    if (sourcePath) {
      const file = bucket.file(sourcePath);
      const [metadata] = await file.getMetadata();
      if (Number(metadata.size) > (reviewedLegacyFiles ? 512 : 8) * 1024 * 1024)
        throw new Error(
          `Message ${index} attachment exceeds the migration size limit.`,
        );
      [bytes] = await file.download(
        reviewedLegacyFiles
          ? {
              start: 0,
              end: Math.min(Number(metadata.size) - 1, 65535),
              validation: false,
            }
          : {},
      );
      const checked = validateImport(
        bytes,
        metadata.contentType,
        Number(metadata.size),
      );
      if (reviewedLegacyFiles) {
        sourceFile = bucket.file(sourcePath, {
          generation: metadata.generation,
        });
        sourceMetadata = metadata;
      }
      attachment = {
        id: identifier,
        name: String(
          message.fileName || message.name || "Previous attachment",
        ).slice(0, 180),
        size: Number(metadata.size),
        contentType: checked.contentType,
        category: checked.category,
        legacy: true,
      };
    }
    const messageText = String(message.text || "");
    const links = extractLinks(messageText);
    const senderRole = message.senderId === uid ? "customer" : "admin";
    plan.push({
      identifier,
      bytes,
      sourceFile,
      sourceMetadata,
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
        legacyType: message.type || null,
        legacyMessageId: message.id || message.messageId || null,
        retentionHold: held(message),
        searchTerms: searchTerms(
          [messageText, attachment?.name || "", ...links].join(" "),
        ),
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
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `${uid}-${Date.now()}.json`);
  fs.writeFileSync(
    backupFile,
    JSON.stringify({ sourcePath: source.ref.path, data: raw }, null, 2),
    {
      flag: "wx",
      mode: 0o600,
    },
  );
  if (fingerprint((await source.ref.get()).data()?.messages) !== sourceHash)
    throw new Error(
      "Source changed during preflight; retry without deleting anything.",
    );
  for (const item of plan) {
    const ref = db.doc(`customerSupportMessagesV2/${item.identifier}`);
    const storagePath = `customer-support-v2/${uid}/${item.identifier}`;
    if (item.bytes) {
      const contentHash = item.sourceMetadata
        ? fingerprint([
            item.sourceFile.name,
            item.sourceMetadata.generation,
            item.sourceMetadata.md5Hash,
            item.sourceMetadata.crc32c,
            item.sourceMetadata.size,
          ])
        : fingerprint(item.bytes.toString("base64"));
      try {
        if (item.sourceFile) {
          await item.sourceFile.copy(bucket.file(storagePath), {
            cacheControl: "private, no-store",
            contentType: item.attachment.contentType,
            metadata: {
              migrationContentHash: contentHash,
              firebaseStorageDownloadTokens: null,
            },
            preconditionOpts: { ifGenerationMatch: 0 },
          });
        } else
          await bucket.file(storagePath).save(item.bytes, {
            resumable: false,
            contentType: item.attachment.contentType,
            preconditionOpts: { ifGenerationMatch: 0 },
            metadata: {
              cacheControl: "private, no-store",
              metadata: { migrationContentHash: contentHash },
            },
          });
      } catch (error) {
        if (Number(error.code) !== 412) throw error;
        const [previous] = await bucket.file(storagePath).getMetadata();
        if (previous.metadata?.migrationContentHash !== contentHash)
          throw new Error(
            "Existing migration attachment does not match; review required.",
          );
      }
      const [copiedMetadata] = await bucket.file(storagePath).getMetadata();
      if (
        Number(copiedMetadata.size) !== item.attachment.size ||
        copiedMetadata.metadata?.firebaseStorageDownloadTokens ||
        (item.sourceMetadata?.crc32c &&
          copiedMetadata.crc32c !== item.sourceMetadata.crc32c)
      )
        throw new Error(
          "Attachment copy verification failed; source retained.",
        );
    }
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
    await db.doc(`customerSupportV2/${uid}`).create({
      customerId: uid,
      customerName:
        profile.displayName || room.userInfo?.displayName || "Customer",
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt:
        latest.docs[0]?.data().createdAt || admin.firestore.Timestamp.now(),
      lastMessage: "Previous conversation imported",
      status: "open",
      adminUnread:
        room.isRead === false
          ? Math.max(
              1,
              raw.messages.filter(
                (message) =>
                  message.senderId === uid && message.isRead === false,
              ).length,
            )
          : 0,
      customerUnread: 0,
      retentionHold: held(raw),
    });
  else if (held(raw)) await existing.ref.update({ retentionHold: true });
  const result = await db
    .collection("customerSupportMessagesV2")
    .where("legacySource", "==", source.ref.path)
    .count()
    .get();
  if (result.data().count !== raw.messages.length)
    throw new Error(
      "Reconciliation failed. Source is unchanged; inspect duplicate legacy message IDs before cutover.",
    );
  if (fingerprint((await source.ref.get()).data()?.messages) !== sourceHash)
    throw new Error(
      "Source changed during migration; copied records retained. Rerun to reconcile new arrivals.",
    );
  console.log(
    `Reconciled ${result.data().count} messages. Source retained. Backup: ${backupFile}`,
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => admin.app().delete());
