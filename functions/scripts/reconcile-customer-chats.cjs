/* Read-only reconciliation. Public output is counts; private details stay with backups. */
const admin = require("firebase-admin");
const fs = require("node:fs");
const path = require("node:path");
const {fingerprint} = require("../lib/customerChatCore");
const {messageMillis} = require("../lib/retentionPolicy");
const args = process.argv.slice(2);
const option = (key) => args[args.indexOf(key) + 1];
if (!args.includes("--project") || !args.includes("--backup-dir"))
  throw new Error("--project and --backup-dir are required.");
const projectId = option("--project");
const backupDir = path.resolve(option("--backup-dir"));
const {db, bucket} = require("./chatMigrationConnection.cjs").connect({
  projectId,
  bucketName: process.env.CHAT_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
  firebaseToolsRoot: args.includes("--firebase-tools-root")
    ? option("--firebase-tools-root")
    : undefined,
});
function attachmentPaths(message) {
  return [
    ...new Set(
      [
        message.filePath,
        message.img,
        message.file,
        message.audio,
        message.video,
        message.fileUrl,
        message.imageUrl,
        message.audioUrl,
        message.videoUrl,
      ]
        .filter((value) => typeof value === "string" && value)
        .map((value) => {
          if (!value.startsWith("http")) return value;
          const url = new URL(value);
          const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
          if (!match || url.hostname !== "firebasestorage.googleapis.com")
            throw new Error("Unexpected source media reference.");
          return decodeURIComponent(match[2]);
        }),
    ),
  ];
}
async function main() {
  const all = (await db.collection("chats").get()).docs;
  const sources = all.filter((doc) => doc.id.endsWith("_CustomerSupport"));
  const preflight = JSON.parse(fs.readFileSync(path.join(backupDir, "preflight.json"), "utf8"));
  const report = {
    projectId,
    verifiedAt: new Date().toISOString(),
    sourceThreads: sources.length,
    sourceMessages: 0,
    copiedThreads: 0,
    copiedMessages: 0,
    verifiedAttachments: 0,
    messagesEditedAfterImport: 0,
    otherLegacyThreadsExcluded: all.length - sources.length,
    originalConversationsUnchanged:
      fingerprint(sources.map((doc) => [doc.id, doc.data().messages])) === preflight.sourceHash,
    originalFilesPreserved: true,
    privateCopiesContainNoDownloadTokens: true,
    copiesHaveNoPublicAcl: true,
    foodLegacyThreads: 0,
    foodLegacyMessages: 0,
    failures: 0,
    fullyReconciled: false,
  };
  const failures = [];
  const fail = (source, reason) => {
    failures.push({source, reason});
    report.failures++;
  };
  const sourceMetadata = new Map();
  let samplePath;
  for (const source of sources) {
    const uid = source.id.slice(0, -"_CustomerSupport".length);
    const original = source.data().messages || [];
    report.sourceMessages += original.length;
    const thread = await db.doc(`customerSupportV2/${uid}`).get();
    if (thread.exists && thread.data().customerId === uid) report.copiedThreads++;
    else fail(source.ref.path, "Conversation metadata missing or mismatched.");
    const copied = await db
      .collection("customerSupportMessagesV2")
      .where("legacySource", "==", source.ref.path)
      .get();
    report.copiedMessages += copied.size;
    const byId = new Map(copied.docs.map((doc) => [doc.id, doc.data()]));
    if (copied.size !== original.length) fail(source.ref.path, "Message count mismatch.");
    for (let index = 0; index < original.length; index++) {
      const message = original[index];
      const identifier = fingerprint(["legacy", uid, message.id || message.messageId || index]);
      const imported = byId.get(identifier);
      if (!imported || imported.customerId !== uid) {
        fail(source.ref.path, "Message missing or incorrectly scoped.");
        continue;
      }
      if (imported.deleted || imported.editedAt) {
        report.messagesEditedAfterImport++;
        continue;
      }
      if (
        imported.text !== String(message.text || "") ||
        imported.senderId !== (message.senderId || "legacy-admin") ||
        Math.abs(imported.createdAt.toMillis() - messageMillis(message)) > 0.001
      )
        fail(source.ref.path, "Message content/sender/timestamp mismatch.");
      const paths = attachmentPaths(message);
      if (!paths.length) continue;
      if (paths.length !== 1 || imported.attachment?.id !== identifier) {
        fail(source.ref.path, "Attachment reference mismatch.");
        continue;
      }
      const record = (await db.doc(`customerSupportAttachmentsV2/${identifier}`).get()).data();
      if (
        !record ||
        record.customerId !== uid ||
        record.messageId !== identifier ||
        record.storagePath !== `customer-support-v2/${uid}/${identifier}`
      ) {
        fail(source.ref.path, "Attachment metadata missing or incorrectly scoped.");
        continue;
      }
      try {
        if (!sourceMetadata.has(paths[0]))
          sourceMetadata.set(paths[0], (await bucket.file(paths[0]).getMetadata())[0]);
        const before = sourceMetadata.get(paths[0]);
        const [after] = await bucket.file(record.storagePath).getMetadata({projection: "full"});
        if ((after.acl || []).some(entry => ["allUsers", "allAuthenticatedUsers"].includes(entry.entity))) {
          report.copiesHaveNoPublicAcl = false;
          fail(source.ref.path, "Copied attachment has a public object ACL.");
          continue;
        }
        if (
          Number(before.size) !== Number(after.size) ||
          Number(record.size) !== Number(after.size) ||
          (before.crc32c && before.crc32c !== after.crc32c)
        ) {
          fail(source.ref.path, "Attachment size/checksum mismatch.");
          continue;
        }
        if (after.metadata?.firebaseStorageDownloadTokens) {
          report.privateCopiesContainNoDownloadTokens = false;
          fail(source.ref.path, "Permanent bearer token on copied attachment.");
          continue;
        }
        report.verifiedAttachments++;
        samplePath ||= record.storagePath;
      } catch {
        report.originalFilesPreserved = false;
        fail(source.ref.path, "Attachment source/copy metadata could not be verified.");
      }
    }
  }
  const food = await db.collection("foodRestaurantChats").get();
  report.foodLegacyThreads = food.size;
  report.foodLegacyMessages = food.docs.reduce(
    (count, doc) => count + (Array.isArray(doc.data().messages) ? doc.data().messages.length : 0),
    0,
  );
  if (samplePath) {
    const response = await fetch(
      `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(samplePath)}`,
      {method: "HEAD"},
    );
    report.anonymousStorageAccessDenied = [401, 403].includes(response.status);
    if (!report.anonymousStorageAccessDenied)
      fail("storage privacy probe", "Copied object is not confirmed private.");
  }
  report.fullyReconciled =
    report.failures === 0 &&
    report.originalConversationsUnchanged &&
    report.sourceThreads === report.copiedThreads &&
    report.sourceMessages === report.copiedMessages;
  fs.writeFileSync(
    path.join(backupDir, "reconciliation.private.json"),
    JSON.stringify({report, failures}, null, 2),
    {mode: 0o600},
  );
  if (args.includes("--report"))
    fs.writeFileSync(path.resolve(option("--report")), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (!report.fullyReconciled) process.exitCode = 1;
}
main()
  .catch((error) => {
    console.error(error.code || "Reconciliation failed; inspect private backup records.");
    process.exitCode = 1;
  })
  .finally(() => admin.app().delete());
