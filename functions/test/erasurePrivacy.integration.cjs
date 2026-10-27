const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw new Error('Emulators required');
const db = admin.firestore(), auth = admin.auth(), bucket = admin.storage().bucket();
const {deleteAuthAccountKeepData, processDeletionRequest} = require('../lib/accountDeletion');
const {tokenDocId, registerCustomerDevice} = require('../lib/customerPush');
// The installed Storage emulator keeps Firebase bearer tokens in a separate array;
// its GCS metadata PATCH incorrectly leaves them behind when a key is set to null.
// Adapt that emulator transport to the documented GCS null-removal contract.
// The production function still must issue the real null patch for this to run.
// https://docs.cloud.google.com/storage/docs/viewing-editing-metadata
let restoreMetadata;
before(() => {
  const prototype = Object.getPrototypeOf(bucket.file('synthetic-metadata-adapter'));
  const original = prototype.setMetadata;
  prototype.setMetadata = async function(patch, ...options) {
    const oldTokens = patch?.metadata?.firebaseStorageDownloadTokens === null
      ? String((await this.getMetadata())[0].metadata?.firebaseStorageDownloadTokens || '').split(',').filter(Boolean) : [];
    const result = await original.call(this, patch, ...options);
    for (const token of oldTokens) {
      const url = `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${encodeURIComponent(this.bucket.name)}/o/${encodeURIComponent(this.name)}?delete_token=${encodeURIComponent(token)}`;
      const response = await fetch(url, {method: 'POST', headers: {Authorization: 'Bearer owner'}});
      assert.equal(response.status, 200, 'Storage emulator token adapter');
    }
    return result;
  };
  restoreMetadata = () => {prototype.setMetadata = original;};
});
after(() => restoreMetadata?.());

async function customer(uid) {
  await auth.createUser({uid, email: `${uid}@example.invalid`, password: 'synthetic-password-123'});
  await db.doc(`users/${uid}`).set({role: 'Customer'});
}
async function tokenFor(uid) {
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: `${uid}@example.invalid`, password: 'synthetic-password-123', returnSecureToken: true}),
  });
  assert.equal(response.status, 200);
  return (await response.json()).idToken;
}
const firestoreUrl = path => `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/demo-thaiseva-otp/databases/(default)/documents/${path}`;
const storageUrl = path => `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/demo-thaiseva-otp.appspot.com/o/${encodeURIComponent(path)}?alt=media`;

test('customer personal records paginate past 100 and remove nested data without affecting other customers', async () => {
  const uid = 'pdpa-large-customer'; await customer(uid);
  const batch = db.batch();
  for (let index = 0; index < 107; index++) batch.set(db.doc(`reviews/pdpa-review-${String(index).padStart(3, '0')}`), {userId: uid, text: 'synthetic'});
  await batch.commit();
  for (const path of ['feedbackandratings/pdpa-own', 'messages/pdpa-own', 'ContactMessages/pdpa-own']) await db.doc(path).set({userId: uid, senderId: uid});
  await db.doc('reviews/pdpa-review-001/replies/child').set({fixture: true});
  await db.doc('reviews/pdpa-other').set({uid: 'other-customer', text: 'keep'});
  await bucket.file('users/other-customer/keep.txt').save('keep');
  await deleteAuthAccountKeepData(uid, 'test-admin');
  assert.equal((await db.collection('reviews').where('userId', '==', uid).get()).size, 0);
  assert.equal((await db.doc('reviews/pdpa-review-001/replies/child').get()).exists, false);
  for (const path of ['feedbackandratings/pdpa-own', 'messages/pdpa-own', 'ContactMessages/pdpa-own']) assert.equal((await db.doc(path).get()).exists, false);
  assert.equal((await db.doc('reviews/pdpa-other').get()).exists, true);
  assert.equal((await bucket.file('users/other-customer/keep.txt').exists())[0], true);
  const job = (await db.doc(`privacyErasureJobs/${uid}`).get()).data();
  assert.equal(job.cleanupVersion, 2); assert.ok(job.verifiedAt); assert.equal(job.operationalRecordsErased, true);
});

test('nested holds, ambiguous ownership and held files stay visible instead of being silently erased', async () => {
  const uid = 'pdpa-nested-hold'; await customer(uid);
  await db.doc(`cart/${uid}/items/held`).set({legalHold: true});
  await db.doc('reviews/pdpa-nested-hold').set({uid});
  await db.doc('reviews/pdpa-nested-hold/evidence/held').set({audit: {retentionHold: true}});
  await db.doc('reviews/pdpa-conflict').set({uid, userId: 'different-customer'});
  await bucket.file(`uploads/${uid}/held-evidence.pdf`).save('synthetic evidence');
  await bucket.file(`profile_pics/${uid}.jpg`).save('synthetic image');
  await deleteAuthAccountKeepData(uid, 'test-admin');
  for (const path of [`cart/${uid}/items/held`, 'reviews/pdpa-nested-hold/evidence/held', 'reviews/pdpa-conflict']) assert.equal((await db.doc(path).get()).exists, true);
  assert.equal((await bucket.file(`uploads/${uid}/held-evidence.pdf`).exists())[0], true);
  assert.equal((await bucket.file(`profile_pics/${uid}.jpg`).exists())[0], true);
  const job = (await db.doc(`privacyErasureJobs/${uid}`).get()).data();
  assert.equal(job.operationalRecordsErased, false); assert.equal(job.uploadsErased, false);
  const records = (await db.collection(`privacyErasureJobs/${uid}/records`).get()).docs.map(record => record.data());
  assert.ok(records.some(record => record.reason === 'CONFLICTING_IDENTITY'));
  assert.ok(records.some(record => record.reason === 'RETENTION_HOLD'));
});

test('retained business records and partner copies get individual review cases without copying their personal data', async () => {
  const uid = 'pdpa-business-inventory'; await customer(uid);
  await db.doc('orders/pdpa-retained-order').set({Receiver: {id: uid, name: 'PRIVATE_NAME'}, invoiceNumber: 'PRIVATE_INVOICE', status: 'Completed'});
  await db.doc('partnerOrderViews/pdpa-retained-order').set({name: 'PRIVATE_NAME'});
  await db.doc('hotelBookingData/pdpa-retained-booking').set({authUid: uid, guestEmail: 'PRIVATE_EMAIL', legalHold: true});
  await deleteAuthAccountKeepData(uid, 'test-admin');
  const records = (await db.collection(`privacyErasureJobs/${uid}/records`).get()).docs.map(record => record.data());
  for (const path of ['orders/pdpa-retained-order', 'partnerOrderViews/pdpa-retained-order', 'hotelBookingData/pdpa-retained-booking']) assert.ok(records.some(record => record.recordPath === path));
  assert.doesNotMatch(JSON.stringify(records), /PRIVATE_/);
  assert.ok(records.every(record => record.reviewDueAt && record.owner === 'Admin'));
});

test('a still-valid pre-deletion token cannot recreate profiles, carts, reviews or uploads, or read held customer files', async () => {
  const uid = 'pdpa-old-token'; await customer(uid);
  const token = await tokenFor(uid);
  const headers = {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'};
  const path = `users/${uid}/proof.pdf`;
  await bucket.file(path).save('synthetic', {metadata: {contentType: 'application/pdf', metadata: {firebaseStorageDownloadTokens: 'synthetic-bearer-token'}}});
  const avatar = `profile_pics/${uid}.jpg`;
  await bucket.file(avatar).save('synthetic avatar', {metadata: {contentType: 'image/jpeg'}});
  assert.equal((await fetch(storageUrl(avatar))).status, 200);
  assert.equal((await fetch(`${storageUrl(path)}&token=synthetic-bearer-token`)).status, 200);
  assert.equal((await fetch(storageUrl(path), {headers})).status, 200, 'Production Storage rules allow the active owner');
  await db.doc('orders/pdpa-old-token-held').set({userId: uid, legalHold: true});
  await deleteAuthAccountKeepData(uid, 'test-admin');
  assert.equal((await bucket.file(path).exists())[0], true, 'Held evidence remains');
  assert.equal((await fetch(`${storageUrl(path)}&token=synthetic-bearer-token`)).status, 403, 'Old bearer URL revoked');
  assert.equal((await fetch(storageUrl(avatar))).status, 403, 'Preserved avatar becomes private');
  for (const path of [`users/${uid}`, `cart/${uid}`, `reviews/pdpa-recreate`]) {
    const response = await fetch(firestoreUrl(path), {method: 'PATCH', headers, body: JSON.stringify({fields: {uid: {stringValue: uid}, role: {stringValue: 'Customer'}}})});
    assert.equal(response.status, 403, path);
  }
  assert.equal((await fetch(storageUrl(path), {headers})).status, 403, 'Old token cannot read held evidence');
  const upload = `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/demo-thaiseva-otp.appspot.com/o?uploadType=media&name=${encodeURIComponent(`uploads/${uid}/late.txt`)}`;
  assert.equal((await fetch(upload, {method: 'POST', headers: {...headers, 'Content-Type': 'application/octet-stream', 'X-Goog-Upload-Protocol': 'raw'}, body: 'synthetic late upload'})).status, 403);
  await assert.rejects(registerCustomerDevice.run({auth: {uid, token: {}}, data: {token: 't'.repeat(40)}}), error => error.code === 'permission-denied');
  assert.equal((await db.doc(`customerDeviceTokens/${tokenDocId('t'.repeat(40))}`).get()).exists, false);
});

test('notification topic failure keeps tokens for retry and never reports successful file cleanup', async () => {
  const uid = 'pdpa-token-retry'; await customer(uid);
  const ref = db.doc(`DeletionRequests/${uid}`); await ref.set({uid, status: 'Pending'});
  const token = 'p'.repeat(40); const tokenRef = db.doc(`customerDeviceTokens/${tokenDocId(token)}`);
  await tokenRef.set({uid, token});
  const messaging = admin.messaging(), original = messaging.unsubscribeFromTopic;
  let calls = 0;
  messaging.unsubscribeFromTopic = async (tokens, topic) => {
    assert.deepEqual(tokens, [token]); assert.equal(topic, 'customers'); calls++;
    return calls === 1 ? {errors: [{error: {code: 'messaging/server-unavailable'}}]} : {errors: []};
  };
  try {
    await assert.rejects(processDeletionRequest(ref.id, 'test-admin'), /Notification topic removal/);
    assert.equal((await tokenRef.get()).exists, true);
    assert.equal((await db.doc(`privacyErasureJobs/${uid}`).get()).data().status, 'RETRY_REQUIRED');
    await processDeletionRequest(ref.id, 'test-admin');
    assert.equal((await tokenRef.get()).exists, false);
    assert.equal((await db.doc(`privacyErasureJobs/${uid}`).get()).data().uploadsErased, true);
  } finally {messaging.unsubscribeFromTopic = original;}
});

test('request clients cannot store credentials, fake processing success or complete erasure', async () => {
  const uid = 'pdpa-request-rules'; await customer(uid);
  const token = await tokenFor(uid), headers = {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'};
  for (const extra of [{confirmPassword: {stringValue: 'secret'}}, {currentPassword: {stringValue: 'secret'}}, {loginDeletedAt: {timestampValue: new Date().toISOString()}}, {status: {stringValue: 'Completed'}}]) {
    const fields = {uid: {stringValue: uid}, email: {stringValue: `${uid}@example.invalid`}, status: {stringValue: 'Pending'}, ...extra};
    const response = await fetch(firestoreUrl('DeletionRequests/pdpa-unsafe-request'), {method: 'PATCH', headers, body: JSON.stringify({fields})});
    assert.equal(response.status, 403);
  }
});


test('a registration overlapping account erasure removes its late broadcast subscription and token', async () => {
  const uid = 'pdpa-late-push'; await customer(uid);
  const messaging = admin.messaging();
  const subscribe = messaging.subscribeToTopic, unsubscribe = messaging.unsubscribeFromTopic;
  let unsubscribed = false;
  messaging.subscribeToTopic = async () => {
    await db.doc(`privacyAccountRestrictions/${uid}`).set({status: 'ERASURE_STARTED'});
    return {errors: []};
  };
  messaging.unsubscribeFromTopic = async () => {unsubscribed = true; return {errors: []};};
  const token = 'z'.repeat(40);
  try {
    await assert.rejects(registerCustomerDevice.run({auth: {uid, token: {}}, data: {token}}), error => error.code === 'permission-denied');
    assert.equal(unsubscribed, true);
    assert.equal((await db.doc(`customerDeviceTokens/${tokenDocId(token)}`).get()).exists, false);
  } finally {
    messaging.subscribeToTopic = subscribe; messaging.unsubscribeFromTopic = unsubscribe;
  }
});

test('future retention deadlines and accounting records under a profile survive recursive cleanup and are recorded', async () => {
  const uid = 'pdpa-nested-accounting'; await customer(uid);
  await db.doc(`users/${uid}/documents/accounting`).set({invoiceNumber: 'synthetic-invoice'});
  await db.doc(`cart/${uid}/items/retained`).set({retentionUntil: admin.firestore.Timestamp.fromMillis(Date.now() + 86400000)});
  await deleteAuthAccountKeepData(uid, 'test-admin');
  assert.equal((await db.doc(`users/${uid}/documents/accounting`).get()).exists, true);
  assert.equal((await db.doc(`cart/${uid}/items/retained`).get()).exists, true);
  const job = (await db.doc(`privacyErasureJobs/${uid}`).get()).data();
  assert.equal(job.profileErased, false); assert.equal(job.operationalRecordsErased, false);
  const records = (await db.collection(`privacyErasureJobs/${uid}/records`).get()).docs.map(record => record.data());
  assert.ok(records.some(record => record.reason === 'ACCOUNTING_RETENTION_MAPPING_REQUIRED'));
  assert.ok(records.some(record => record.reason === 'RETENTION_DEADLINE_REVIEW'));
});


test('legacy private support attachments are removed with their customer conversation', async () => {
  const uid = 'erase-private-support'; await customer(uid);
  const paths = [`private-chat/chats/${uid}_CustomerSupport/staff/file.pdf`, `private-chat/foodCustomerSupportChats/${uid}/${uid}/image.jpg`];
  for (const path of paths) await bucket.file(path).save('synthetic');
  const other = 'private-chat/chats/another_CustomerSupport/staff/file.pdf';
  await bucket.file(other).save('keep');
  await deleteAuthAccountKeepData(uid, 'test-admin');
  for (const path of paths) assert.equal((await bucket.file(path).exists())[0], false);
  assert.equal((await bucket.file(other).exists())[0], true);
});

test('an identity upload which overlaps account erasure removes its late file and returns an error', async () => {
  const uid = 'erase-late-identity'; await customer(uid);
  const prototype = Object.getPrototypeOf(bucket.file('synthetic-upload-hook'));
  const original = prototype.save;
  let uploaded;
  prototype.save = async function(...args) {
    const result = await original.apply(this, args);
    if (this.name.startsWith(`users/${uid}/`)) {
      uploaded = this.name;
      await db.doc(`privacyAccountRestrictions/${uid}`).set({status: 'ERASURE_STARTED'});
    }
    return result;
  };
  try {
    const {uploadIdentityDocument} = require('../lib/identityMedia');
    const contentBase64 = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]).toString('base64');
    await assert.rejects(uploadIdentityDocument.run({auth: {uid, token: {auth_time: Math.ceil(Date.now()/1000)}}, data: {kind: 'passport', contentType: 'image/png', contentBase64}}), error => error.code === 'permission-denied');
    assert.ok(uploaded);
    assert.equal((await bucket.file(uploaded).exists())[0], false);
  } finally {prototype.save = original;}
});
