const {test} = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  throw new Error('All emulators required; production forbidden');
}
const {processDeletionRequest, autoProcessDeletionRequest} = require('../lib/accountDeletion');
const db = admin.firestore();
const bucket = admin.storage().bucket();
const auth = admin.auth();
const now = () => admin.firestore.Timestamp.now();
async function fixture(uid, source = 'WEB', extra = {}, profile = {role: 'Customer'}, claims = {}) {
  await auth.createUser({uid, email: `${uid}@example.invalid`});
  if (Object.keys(claims).length) await auth.setCustomUserClaims(uid, claims);
  await db.doc(`users/${uid}`).set(profile);
  const ref = db.doc(`DeletionRequests/request-${uid}`);
  await ref.set({uid, email: `${uid}@example.invalid`, source, status: 'Pending', createdAt: now(), ...extra});
  return ref;
}
const run = async ref => autoProcessDeletionRequest.run({data: await ref.get(), params: {requestId: ref.id}});

test('new web and mobile requests immediately clean login, profile, nested records and uploads, with retained-record review', async () => {
  for (const source of ['WEB', 'MOBILE']) {
    const uid = `auto-${source.toLowerCase()}`;
    const ref = await fixture(uid, source);
    await db.doc(`cart/${uid}/items/one`).set({fixture: true});
    await db.doc(`bookings/${uid}`).set({userId: uid, status: 'Pending'});
    await bucket.file(`users/${uid}/photo.jpg`).save('synthetic');
    await run(ref);
    await assert.rejects(auth.getUser(uid), error => error.code === 'auth/user-not-found');
    assert.equal((await db.doc(`users/${uid}`).get()).exists, false);
    assert.equal((await db.doc(`cart/${uid}/items/one`).get()).exists, false);
    assert.equal((await bucket.file(`users/${uid}/photo.jpg`).exists())[0], false);
    assert.equal((await db.doc(`bookings/${uid}`).get()).exists, true);
    const request = (await ref.get()).data();
    assert.equal(request.status, 'Erasure Pending');
    assert.equal(request.processedBy, 'automaticDeletion');
    assert.ok(request.loginDeletedAt);
    const job = (await db.doc(`privacyErasureJobs/${uid}`).get()).data();
    assert.equal(job.status, 'PENDING_RECORD_REVIEW');
    assert.equal(job.processingLeaseUntil, undefined);
    await run(ref); // Event delivery is at least once.
    assert.equal((await db.collection('auditLogs').where('targetUid', '==', uid).get()).size, 1);
  }
});

test('automatic deletion preserves cancelled, held, privileged and legacy partner accounts', async () => {
  const cases = [
    ['cancelled', {status: 'Cancelled'}, {}, {}, {}],
    ['request-hold', {legalHold: true}, {}, {}, {}],
    ['profile-hold', {}, {retentionHold: true}, {}, {}],
    ['legacy-hold', {}, {}, {disputeOpen: true}, {}],
    ['admin', {}, {role: 'Admin'}, {}, {}],
    ['legacy-partner', {}, {}, {role: 'Partner'}, {}],
    ['driver', {}, {role: 'driver'}, {}, {}],
    ['claim-staff', {}, {}, {}, {foodRole: 'rider'}],
    ['claim-admin', {}, {}, {}, {admin: true}],
  ];
  for (const [suffix, extra, profile, legacy, claims] of cases) {
    const uid = `auto-protected-${suffix}`;
    const ref = await fixture(uid, 'MOBILE', extra, profile, claims);
    await db.doc(`Users/${uid}`).set(legacy);
    await run(ref);
    assert.ok(await auth.getUser(uid), suffix);
    assert.equal((await ref.get()).data().status, extra.status || 'Pending', suffix);
    if (suffix !== 'cancelled') assert.equal((await db.doc(`privacyRetentionReviews/DeletionRequests_${ref.id}`).get()).data().status, 'PENDING');
  }
});

test('stale create events re-read cancellation rather than deleting the customer', async () => {
  const ref = await fixture('auto-late-event');
  const snapshot = await ref.get();
  await ref.update({status: 'Cancelled'});
  await autoProcessDeletionRequest.run({data: snapshot, params: {requestId: ref.id}});
  assert.ok(await auth.getUser('auto-late-event'));
});

test('simultaneous duplicate requests share a UID lease and do not repeat cleanup', async () => {
  const uid = 'auto-concurrent';
  const first = await fixture(uid);
  const second = db.doc(`DeletionRequests/duplicate-${uid}`);
  await second.set((await first.get()).data());
  const results = await Promise.all([processDeletionRequest(first.id, 'test'), processDeletionRequest(second.id, 'test')]);
  assert.equal(results.filter(result => result === 'processed').length, 1);
  for (const ref of [first, second]) await run(ref);
  assert.equal((await db.collection('auditLogs').where('targetUid', '==', uid).get()).size, 1);
  for (const ref of [first, second]) assert.ok((await ref.get()).data().loginDeletedAt);
});

test('transient failure records retry state and a repeated event completes cleanup', async () => {
  const uid = 'auto-retry';
  const ref = await fixture(uid);
  const original = auth.deleteUser;
  auth.deleteUser = async () => { throw new Error('synthetic temporary service failure'); };
  try { await assert.rejects(run(ref), /synthetic temporary/); }
  finally { auth.deleteUser = original; }
  let job = (await db.doc(`privacyErasureJobs/${uid}`).get()).data();
  assert.equal(job.status, 'RETRY_REQUIRED');
  assert.equal(job.processingLeaseUntil, undefined);
  assert.equal((await db.doc(`privacyRetentionFailures/${ref.id}`).get()).exists, true);
  assert.ok((await ref.get()).data().processingError);
  await run(ref);
  job = (await db.doc(`privacyErasureJobs/${uid}`).get()).data();
  assert.equal(job.status, 'PENDING_RECORD_REVIEW');
  assert.equal((await ref.get()).data().processingError, undefined);
  assert.equal((await db.doc(`privacyRetentionFailures/${ref.id}`).get()).exists, false);
});

test('expired leases recover partial cleanup even when the Auth login is already gone', async () => {
  const uid = 'auto-expired-lease';
  const ref = await fixture(uid, 'MOBILE', {status: 'Erasure Pending'});
  await auth.deleteUser(uid);
  await db.doc(`privacyErasureJobs/${uid}`).set({status: 'PROCESSING', processingLeaseUntil: admin.firestore.Timestamp.fromMillis(1)});
  await bucket.file(`uploads/${uid}/file.pdf`).save('synthetic');
  await run(ref);
  assert.equal((await bucket.file(`uploads/${uid}/file.pdf`).exists())[0], false);
  assert.ok((await ref.get()).data().loginDeletedAt);
});

test('active leases reject duplicate trigger work and missing identities go to review', async () => {
  const uid = 'auto-active-lease';
  const ref = await fixture(uid);
  await db.doc(`privacyErasureJobs/${uid}`).set({processingLeaseUntil: admin.firestore.Timestamp.fromMillis(Date.now() + 600000)});
  await assert.rejects(run(ref), /already running/);
  assert.ok(await auth.getUser(uid));
  const invalid = db.doc('DeletionRequests/auto-invalid-identity');
  await invalid.set({uid: 'bad/path', status: 'Pending'});
  await run(invalid);
  assert.equal((await db.doc(`privacyRetentionReviews/DeletionRequests_${invalid.id}`).get()).data().reason, 'LEGACY_REQUEST_IDENTITY_REVIEW');
});

test('scheduled recovery processes fresh requests without a 30-day wait; preview leaves them untouched', async () => {
  const uid = 'auto-scheduler-today';
  const ref = await fixture(uid);
  const {maintainRetention} = require('../lib/retentionMaintenance');
  await maintainRetention(true);
  assert.ok(await auth.getUser(uid));
  assert.equal((await ref.get()).data().status, 'Pending');
  assert.equal((await db.doc(`privacyErasureJobs/${uid}`).get()).exists, false);
  await maintainRetention(false);
  await assert.rejects(auth.getUser(uid), error => error.code === 'auth/user-not-found');
  assert.ok((await ref.get()).data().loginDeletedAt);
});


test('request rules bind creation to the signed-in customer and protect in-flight deletion records', async () => {
  const uid = 'auto-rules-customer';
  const email = `${uid}@example.invalid`;
  await auth.createUser({uid, email, password: 'synthetic-password-123'});
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email, password: 'synthetic-password-123', returnSecureToken: true}),
  });
  assert.equal(response.status, 200);
  const {idToken} = await response.json();
  const base = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/demo-thaiseva-otp/databases/(default)/documents/DeletionRequests`;
  const headers = {Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json'};
  const create = (id, targetUid) => fetch(`${base}/${id}`, {method: 'PATCH', headers, body: JSON.stringify({fields: {
    uid: {stringValue: targetUid}, email: {stringValue: email}, status: {stringValue: 'Pending'},
  }})});
  assert.equal((await create('auto-rules-own-request', uid)).status, 200);
  assert.equal((await create('auto-rules-foreign-request', 'another-customer')).status, 403);
  await db.doc(`users/${uid}`).set({role: 'Admin'});
  const ref = db.doc('DeletionRequests/auto-rules-own-request');
  for (const status of ['Pending', 'Erasure Pending']) {
    await ref.update({status});
    assert.equal((await fetch(`${base}/${ref.id}`, {method: 'DELETE', headers})).status, 403, status);
  }
  await ref.update({status: 'Cancelled'});
  assert.equal((await fetch(`${base}/${ref.id}`, {method: 'DELETE', headers})).status, 200);
});


test('retry repairs request finalization after profile cleanup without repeating destructive work', async () => {
  const uid = 'auto-finalize-retry';
  const ref = await fixture(uid, 'WEB', {status: 'Erasure Pending', processingError: 'synthetic interrupted finalization'});
  await auth.deleteUser(uid);
  await db.doc(`users/${uid}`).delete();
  await db.doc(`privacyErasureJobs/${uid}`).set({profileErased: true, cleanupVersion: 2, cleanupFinished: true, updatedAt: now(), status: 'RETRY_REQUIRED'});
  await db.doc(`privacyRetentionFailures/${ref.id}`).set({status: 'RETRY_REQUIRED'});
  await run(ref);
  assert.ok((await ref.get()).data().loginDeletedAt);
  assert.equal((await ref.get()).data().processingError, undefined);
  assert.equal((await db.doc(`privacyErasureJobs/${uid}`).get()).data().status, 'PENDING_RECORD_REVIEW');
  assert.equal((await db.doc(`privacyRetentionFailures/${ref.id}`).get()).exists, false);
  assert.equal((await db.collection('auditLogs').where('targetUid', '==', uid).get()).size, 0);
});
