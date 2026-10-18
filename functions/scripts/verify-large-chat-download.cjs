/* Explicit production smoke check. Creates and removes only random synthetic fixtures. */
const admin = require("firebase-admin");
const fs = require("node:fs");
const path = require("node:path");
const {randomUUID, randomBytes} = require("node:crypto");
const args = process.argv.slice(2);
const option = (key) => args[args.indexOf(key) + 1];
if (!args.includes("--run-synthetic-check") || !args.includes("--project"))
  throw new Error("Explicit --run-synthetic-check and --project are required.");
const projectId = option("--project");
const {db, bucket} = require("./chatMigrationConnection.cjs").connect({
  projectId,
  bucketName: process.env.CHAT_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
  firebaseToolsRoot: args.includes("--firebase-tools-root")
    ? option("--firebase-tools-root")
    : undefined,
});
let apiKey = process.env.VITE_apiKey;
for (const filename of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  const filenamePath = path.resolve(__dirname, "../..", filename);
  if (!fs.existsSync(filenamePath)) continue;
  const match = fs.readFileSync(filenamePath, "utf8").match(/^VITE_apiKey\s*=\s*(.+)$/m);
  if (match) apiKey = match[1].trim().replace(/^['"]|['"]$/g, "");
}
const createdUsers = [];
const createdRecords = [];
const files = [];
async function signIn(uid) {
  const email = `${uid}@example.invalid`;
  const password = randomBytes(24).toString("base64url");
  await admin.auth().createUser({uid, email, password, emailVerified: true});
  createdUsers.push(uid);
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: {"Content-Type": "application/json", Referer: "https://gothai-admin.web.app/"},
      body: JSON.stringify({email, password, returnSecureToken: true}),
    },
  );
  const data = await response.json();
  if (!response.ok || !data.idToken) throw new Error("Synthetic sign-in failed.");
  return data.idToken;
}
async function api(token, action, data) {
  const response = await fetch(`https://asia-east2-${projectId}.cloudfunctions.net/customerChat`, {
    method: "POST",
    headers: {"Content-Type": "application/json", Authorization: `Bearer ${token}`},
    body: JSON.stringify({data: {...data, action}}),
  });
  const payload = await response.json();
  return {status: response.status, result: payload.result, error: payload.error?.status};
}
async function main() {
  if (!apiKey) throw new Error("Firebase web API configuration is required.");
  const uid = `chat-check-${randomUUID()}`;
  const otherUid = `chat-check-${randomUUID()}`;
  const token = await signIn(uid);
  const otherToken = await signIn(otherUid);
  const messageId = `chat-check-${randomUUID()}`;
  const attachmentId = randomUUID();
  const storagePath = `customer-support-v2/${uid}/${attachmentId}`;
  const recordValues = [
    [`users/${uid}`, {role: "Customer", migrationVerification: true}],
    [
      `customerSupportV2/${uid}`,
      {
        customerId: uid,
        customerName: "Migration verification",
        status: "open",
        updatedAt: admin.firestore.Timestamp.fromMillis(1),
      },
    ],
    [
      `customerSupportMessagesV2/${messageId}`,
      {customerId: uid, senderId: uid, deleted: false, attachment: {id: attachmentId}},
    ],
    [
      `customerSupportAttachmentsV2/${attachmentId}`,
      {
        customerId: uid,
        legacy: true,
        storagePath,
        messageId,
        name: "verification.zip",
        size: 9 * 1024 * 1024,
        contentType: "application/zip",
      },
    ],
  ];
  for (const [recordPath, data] of recordValues) {
    await db.doc(recordPath).create(data);
    createdRecords.push(recordPath);
  }
  await bucket
    .file(storagePath)
    .save(Buffer.from("PK\x03\x04fixture"), {
      resumable: false,
      contentType: "application/zip",
      metadata: {cacheControl: "private, no-store"},
      preconditionOpts: {ifGenerationMatch: 0},
    });
  files.push(storagePath);
  const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media`;
  const read = (tokenValue) =>
    fetch(fileUrl, {
      headers: {Authorization: `Firebase ${tokenValue}`, Origin: "https://gothai-admin.web.app"},
    });
  if ((await read(token)).status !== 403)
    throw new Error("Storage access was not denied before grant.");
  const authorized = await api(token, "download", {attachmentId});
  if (
    authorized.status !== 200 ||
    authorized.result?.downloadTransport !== "firebase-authenticated"
  )
    throw new Error("Authenticated download descriptor unavailable.");
  const downloaded = await read(token);
  if (downloaded.status !== 200 || (await downloaded.text()) !== "PK\x03\x04fixture")
    throw new Error("Authorized Storage download failed.");
  if ((await read(otherToken)).status !== 403) throw new Error("Another account reused the grant.");
  const cors = downloaded.headers.get("access-control-allow-origin");
  if (cors !== "*" && cors !== "https://gothai-admin.web.app")
    throw new Error("Browser download CORS response unavailable.");
  await db
    .doc(`customerSupportAttachmentsV2/${attachmentId}`)
    .update({[`downloadGrants.${uid}`]: admin.firestore.Timestamp.fromMillis(Date.now() - 1)});
  if ((await read(token)).status !== 403) throw new Error("Expired grant remained usable.");
  await api(token, "download", {attachmentId});
  if ((await api(token, "delete", {messageId})).status !== 200)
    throw new Error("Synthetic message deletion failed.");
  if ((await read(token)).status !== 403)
    throw new Error("Deleted attachment remained accessible.");
  console.log(
    JSON.stringify({
      authorizedDownload: true,
      otherAccountDenied: true,
      grantExpiryEnforced: true,
      deletionRevokesAccess: true,
      browserCorsVerified: true,
    }),
  );
}
main()
  .catch((error) => {
    console.error(error.code || error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const filename of files) await bucket.file(filename).delete({ignoreNotFound: true});
    for (const recordPath of createdRecords) await db.doc(recordPath).delete();
    for (const uid of createdUsers) {
      for (const kind of ["request", "upload"])
        await db.doc(`customerSupportRateLimits/${uid}_${kind}`).delete();
      await admin.auth().deleteUser(uid);
    }
    await admin.app().delete();
  });
