/* Operator-only migration connection. Credentials remain in memory, never in backups/logs. */
const admin = require("firebase-admin");
const path = require("node:path");

function connect({ projectId, bucketName, firebaseToolsRoot }) {
  if (!firebaseToolsRoot) {
    admin.initializeApp({ projectId, storageBucket: bucketName });
    return { db: admin.firestore(), bucket: admin.storage().bucket() };
  }
  const cliRoot = path.resolve(firebaseToolsRoot);
  const cliAuth = require(path.join(cliRoot, "lib/auth"));
  const cliApi = require(path.join(cliRoot, "lib/api"));
  const account = cliAuth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token)
    throw new Error("Firebase CLI login is required.");
  const credentials = {
    type: "authorized_user",
    client_id: cliApi.clientId(),
    client_secret: cliApi.clientSecret(),
    refresh_token: account.tokens.refresh_token,
  };
  const credential = admin.credential.applicationDefault();
  credential.getAccessToken = async () => {
    const token = await cliAuth.getAccessToken(
      account.tokens.refresh_token,
      [],
    );
    return { access_token: token.access_token, expires_in: 3600 };
  };
  admin.initializeApp({ projectId, storageBucket: bucketName, credential });
  const db = admin.firestore();
  db.settings({ credentials });
  const { Storage } = require("@google-cloud/storage");
  return {
    db,
    bucket: new Storage({ projectId, credentials }).bucket(bucketName),
  };
}

module.exports = { connect };
