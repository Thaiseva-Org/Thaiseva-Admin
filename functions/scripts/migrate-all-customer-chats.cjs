/* Controlled bulk wrapper: private backups + all-thread preflight before apply. */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const admin = require("firebase-admin");
const { fingerprint } = require("../lib/customerChatCore");
const args = process.argv.slice(2);
const option = (key) => args[args.indexOf(key) + 1];
if (!args.includes("--project") || !args.includes("--backup-dir"))
  throw new Error("--project and an external --backup-dir are required.");
const projectId = option("--project");
const backupDir = path.resolve(option("--backup-dir"));
const repo = path.resolve(__dirname, "../..");
if (backupDir === repo || backupDir.startsWith(repo + path.sep))
  throw new Error("Backups must be outside the repository.");
const apply = args.includes("--apply");
const { db } = require("./chatMigrationConnection.cjs").connect({
  projectId,
  bucketName:
    process.env.CHAT_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
  firebaseToolsRoot: args.includes("--firebase-tools-root")
    ? option("--firebase-tools-root")
    : undefined,
});
async function main() {
  fs.mkdirSync(backupDir, { recursive: true });
  const documents = (await db.collection("chats").get()).docs.filter((doc) =>
    doc.id.endsWith("_CustomerSupport"),
  );
  const sourceHash = fingerprint(
    documents.map((doc) => [doc.id, doc.data().messages]),
  );
  const manifestPath = path.join(backupDir, "preflight.json");
  if (apply) {
    if (!fs.existsSync(manifestPath))
      throw new Error("Run the bulk dry-run first.");
    const previous = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (
      previous.projectId !== projectId ||
      previous.sourceHash !== sourceHash ||
      previous.failed !== 0
    )
      throw new Error(
        "Preflight is missing, failed or stale. Rerun the dry-run before apply.",
      );
  } else {
    // Export all originals before any production writes are possible.
    for (const document of documents)
      fs.writeFileSync(
        path.join(backupDir, `${document.id}.source.json`),
        JSON.stringify(
          { path: document.ref.path, data: document.data() },
          null,
          2,
        ),
        { mode: 0o600 },
      );
    const directory = await db.doc("chatRooms/CustomerSupport").get();
    fs.writeFileSync(
      path.join(backupDir, "customer-support-directory.source.json"),
      JSON.stringify(directory.data() || {}, null, 2),
      { mode: 0o600 },
    );
  }
  const summary = {
    projectId,
    mode: apply ? "apply" : "dry-run",
    sourceHash,
    threads: documents.length,
    messages: 0,
    attachments: 0,
    completed: 0,
    failed: 0,
    failures: [],
  };
  for (const document of documents) {
    const uid = document.id.slice(0, -"_CustomerSupport".length);
    const options = [
      path.join(__dirname, "migrate-customer-chat.cjs"),
      "--project",
      projectId,
      "--uid",
      uid,
      "--backup-dir",
      backupDir,
    ];
    for (const flag of ["--firebase-tools-root", "--source-bucket-alias"])
      if (args.includes(flag)) options.push(flag, option(flag));
    if (args.includes("--reviewed-legacy-files"))
      options.push("--reviewed-legacy-files");
    if (apply) options.push("--apply");
    const result = spawnSync(process.execPath, options, {
      env: process.env,
      encoding: "utf8",
      timeout: 180000,
      maxBuffer: 4 * 1024 * 1024,
    });
    fs.writeFileSync(
      path.join(backupDir, `${uid}.${summary.mode}.log`),
      `${result.stdout || ""}\n${result.stderr || ""}`,
      { mode: 0o600 },
    );
    const match = result.stdout?.match(/\{[\s\S]*?\n\}/);
    if (match) {
      const counts = JSON.parse(match[0]);
      summary.messages += counts.sourceCount;
      summary.attachments += counts.attachments;
    }
    if (result.status === 0) summary.completed++;
    else {
      summary.failed++;
      summary.failures.push({
        source: document.ref.path,
        exitCode: result.status,
      });
    }
    if ((summary.completed + summary.failed) % 5 === 0)
      console.log(
        JSON.stringify({
          mode: summary.mode,
          processed: summary.completed + summary.failed,
          total: documents.length,
          failed: summary.failed,
        }),
      );
  }
  fs.writeFileSync(
    apply ? path.join(backupDir, "applied.json") : manifestPath,
    JSON.stringify(summary, null, 2),
    { mode: 0o600 },
  );
  // Public output contains counts only, never customer IDs, messages, URLs or tokens.
  console.log(
    JSON.stringify({
      mode: summary.mode,
      threads: summary.threads,
      messages: summary.messages,
      attachments: summary.attachments,
      completed: summary.completed,
      failed: summary.failed,
    }),
  );
  if (summary.failed) process.exitCode = 1;
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => admin.app().delete());
