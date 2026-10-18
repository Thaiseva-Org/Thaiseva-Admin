/* Repairs imported inbox metadata only; never deletes messages or originals. */
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const option = (key) => (args.includes(key) ? args[args.indexOf(key) + 1] : undefined);
const projectId = option("--project");
const backupDir = option("--backup-dir");
if (!projectId || !backupDir) throw new Error("--project and --backup-dir required");
const resolved = path.resolve(backupDir);
const repo = path.resolve(__dirname, "../..");
if (resolved === repo || resolved.startsWith(repo + path.sep))
  throw new Error("Backups must be outside Git");
const {db} = require("./chatMigrationConnection.cjs").connect({
  projectId,
  bucketName: `${projectId}.firebasestorage.app`,
  firebaseToolsRoot: option("--firebase-tools-root"),
});
async function main() {
  fs.mkdirSync(resolved, {recursive: true});
  const directory = (await db.doc("chatRooms/CustomerSupport").get()).data() || {};
  const threads = await db.collection("customerSupportV2").get();
  let candidates = 0,
    updated = 0,
    named = 0;
  for (const thread of threads.docs) {
    const data = thread.data();
    if (data.lastMessage !== "Previous conversation imported") continue;
    candidates++;
    const latest = await db
      .collection("customerSupportMessagesV2")
      .where("customerId", "==", thread.id)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    const message = latest.docs[0]?.data();
    const preview =
      !message || message.deleted
        ? ""
        : String(message.text || message.attachment?.name || message.booking?.title || "").slice(
            0,
            160,
          );
    const profile = (await db.doc(`users/${thread.id}`).get()).data() || {};
    const info = directory[`${thread.id}_CustomerSupport`]?.userInfo || {};
    const customerName = String(
      profile.displayName ||
        profile.fullName ||
        profile.name ||
        info.displayName ||
        info.name ||
        data.customerName ||
        "Customer",
    );
    if (!args.includes("--apply")) continue;
    fs.writeFileSync(
      path.join(resolved, `${thread.id}.preview.json`),
      JSON.stringify(data, null, 2),
      {flag: "wx"},
    );
    await db.runTransaction(async (tx) => {
      const current = await tx.get(thread.ref);
      if (
        current.data()?.lastMessage !== "Previous conversation imported" ||
        !current.updateTime.isEqual(thread.updateTime)
      )
        return;
      tx.update(thread.ref, {lastMessage: preview, customerName});
      updated++;
      if (customerName !== "Customer") named++;
    });
  }
  const remaining = await db
    .collection("customerSupportV2")
    .where("lastMessage", "==", "Previous conversation imported")
    .count()
    .get();
  console.log(
    JSON.stringify({
      mode: args.includes("--apply") ? "apply" : "dry-run",
      candidates,
      updated,
      named,
      remaining: remaining.data().count,
    }),
  );
}
main().catch(() => {
  console.error("Preview repair failed; private backup retained.");
  process.exitCode = 1;
});
