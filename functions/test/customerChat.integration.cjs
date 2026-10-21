const {test, before, after} = require("node:test");
const assert = require("node:assert/strict");
if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  !process.env.FIREBASE_STORAGE_EMULATOR_HOST
)
  throw new Error("All three emulators are required; production is forbidden.");
const admin = require("firebase-admin");
admin.initializeApp({
  projectId: "demo-thaiseva-chat",
  storageBucket: "demo-thaiseva-chat.appspot.com",
});
const {customerChat, cleanupCustomerChatAttachments} = require("../lib/customerChat");
const db = admin.firestore();
const call = (uid, action, body = {}) =>
  customerChat.run({
    auth: {uid, token: {auth_time: Math.ceil(Date.now() / 1000)}},
    data: {action, ...body},
  });
before(async () => {
  for (const uid of ["alice", "bob", "admin", "food-admin", "suspended"]) {
    await admin.auth().createUser({uid});
    await db.doc(`users/${uid}`).set({
      displayName: uid,
      role: uid === "admin" ? "Admin" : "Customer",
      isSuspended: uid === "suspended",
    });
  }
  await admin.auth().setCustomUserClaims("food-admin", {foodMasterAdmin: true});
  await db
    .doc("hotelBookingData/alice-hotel")
    .set({authUid: "alice", hotelName: "Bangkok Hotel", checkInDate: "2026-10-20"});
  await db.doc("hotelBookingData/bob-hotel").set({authUid: "bob", hotelName: "Other Hotel"});
  await db.doc("hotelBookingData/conflicting").set({authUid: "bob", userId: "alice"});
  await call("alice", "open");
  await call("bob", "open");
});
after(async () => {
  await admin.app().delete();
});

test("category changes retain history, deduplicate retries and preserve customer boundaries", async () => {
  const uid="category-customer";
  await admin.auth().createUser({uid});await db.doc(`users/${uid}`).set({role:"Customer"});
  await call(uid,"open");
  const first=await call(uid,"category",{category:"Visa",requestId:"category-visa"});
  assert.equal(first.message.type,"heading");assert.equal(first.conversation.currentCategory,"Visa");
  assert.equal((await call(uid,"category",{category:"Visa",requestId:"category-visa"})).message.id,first.message.id);
  assert.equal((await call(uid,"category",{category:"Visa",requestId:"category-same"})).message,null);
  const second=await call(uid,"send",{type:"heading",text:"Work Permit",requestId:"category-work"});
  assert.equal(second.conversation.currentCategory,"Work Permit");
  await call(uid,"category",{category:"Visa",requestId:"category-visa"});
  assert.equal((await db.doc(`customerSupportV2/${uid}`).get()).data().currentCategory,"Work Permit");
  assert.equal((await db.collection("customerSupportMessagesV2").where("customerId","==",uid).get()).size,2);
  await assert.rejects(call("bob","category",{customerId:uid,category:"Hotel",requestId:"category-foreign"}),e=>e.code==="permission-denied");
  await assert.rejects(call(uid,"category",{category:"Hotel",requestId:"category-visa"}),e=>e.code==="already-exists");
  await assert.rejects(call(uid,"edit",{messageId:first.message.id,text:"Other"}),e=>e.code==="failed-precondition");
  await assert.rejects(call(uid,"delete",{messageId:second.message.id}),e=>e.code==="failed-precondition");
  await db.doc(`customerSupportV2/${uid}`).update({retentionHold:true});
  await assert.rejects(call(uid,"category",{category:"Hotel",requestId:"category-held"}),e=>e.code==="failed-precondition");
});

test("open restores the latest historical category without overwriting a newer category",async()=>{
  const uid="category-legacy";await admin.auth().createUser({uid});
  await db.doc(`chats/${uid}_CustomerSupport`).set({messages:[{type:"heading",text:"Visa"},{type:"text",text:"Normal message"},{type:"heading",text:"Work Permit"}]});
  assert.equal((await call(uid,"open")).conversation.currentCategory,"Work Permit");
  await call(uid,"category",{category:"General",requestId:"legacy-change"});
  assert.equal((await call(uid,"open")).conversation.currentCategory,"General");
});

test("legacy mobile category changes appear in the new history once and retain their dates",async()=>{
  const uid="category-mobile";await admin.auth().createUser({uid});
  const source=db.doc(`chats/${uid}_CustomerSupport`),date=admin.firestore.Timestamp.now();
  const first={id:"mobile-visa",senderId:uid,type:"heading",text:"Visa",date,legalHold:true};
  await source.set({messages:[first]});await call(uid,"open");
  assert.equal((await call(uid,"messages")).items.filter(m=>m.legacyType==="heading").length,1);
  const second={id:"mobile-work",senderId:uid,type:"heading",text:"Work Permit",date:admin.firestore.Timestamp.now()};
  await source.update({messages:[first,second]});
  const result=await call(uid,"messages");assert.equal(result.items.filter(m=>m.legacyType==="heading").length,2);
  assert.equal(result.items.find(m=>m.text==="Work Permit").createdAt,second.date.toMillis());
  assert.equal(result.items.find(m=>m.text==="Visa").retentionHold,true);
  assert.equal((await db.doc(`customerSupportV2/${uid}`).get()).data().currentCategory,"Work Permit");
  assert.equal((await call(uid,"messages")).items.length,2);
  assert.equal((await source.get()).data().messages.length,2);
  await source.update({retentionHold:true,messages:[first,second,{id:"mobile-held",senderId:uid,type:"heading",text:"Hotel",date:admin.firestore.Timestamp.now()}]});
  assert.equal((await call(uid,"messages")).items.length,2);
  assert.equal((await db.doc(`customerSupportV2/${uid}`).get()).data().currentCategory,"Work Permit");
});

test("anonymous, suspended and unrelated accounts cannot access chat or admin inbox", async () => {
  await assert.rejects(
    customerChat.run({data: {action: "open"}}),
    (e) => e.code === "unauthenticated",
  );
  await assert.rejects(call("suspended", "open"), (e) => e.code === "permission-denied");
  await assert.rejects(
    call("bob", "messages", {customerId: "alice"}),
    (e) => e.code === "permission-denied",
  );
  await assert.rejects(call("food-admin", "inbox"), (e) => e.code === "permission-denied");
  await assert.rejects(call("alice", "inbox"), (e) => e.code === "permission-denied");
  await assert.rejects(
    call("alice", "search", {allCustomers: true, query: "hello"}),
    (e) => e.code === "permission-denied",
  );
});
test("booking picker and send enforce authoritative customer ownership", async () => {
  const list = await call("alice", "bookings", {service: "hotel"});
  assert.deepEqual(
    list.items.map((x) => x.id),
    ["alice-hotel"],
  );
  await assert.rejects(
    call("alice", "send", {
      requestId: "foreign-booking",
      booking: {service: "hotel", id: "bob-hotel"},
    }),
    (e) => e.code === "permission-denied",
  );
  await assert.rejects(
    call("alice", "send", {
      requestId: "conflicting",
      booking: {service: "hotel", id: "conflicting"},
    }),
    (e) => e.code === "permission-denied",
  );
});

test("booking popup returns allowlisted admin details without expanding customer cards", async () => {
  await db.doc("hotelBookingData/alice-hotel").update({
    roomName: "Deluxe",
    name: "Guest",
    amountTHB: 2400,
    internalSecret: "private",
  });
  const reference = {service: "hotel", id: "alice-hotel"};
  const result = await call("admin", "booking", {customerId: "alice", booking: reference});
  assert.equal(result.booking.details.roomName, "Deluxe");
  assert.equal(result.booking.details.amountTHB, 2400);
  assert.equal(result.booking.details.internalSecret, undefined);
  assert.equal((await call("alice", "booking", {booking: reference})).booking.details, undefined);
  assert.equal((await call("alice", "bookings", {service: "hotel"})).items[0].details, undefined);
  await assert.rejects(
    call("admin", "booking", {customerId: "bob", booking: reference}),
    (e) => e.code === "permission-denied",
  );
  await assert.rejects(
    call("bob", "booking", {customerId: "alice", booking: reference}),
    (e) => e.code === "permission-denied",
  );
});
test("concurrent retries create one message and one unread increment; reused key rejects changed content", async () => {
  const payload = {
    requestId: "same-request",
    text: "Hello Bangkok booking",
    booking: {service: "hotel", id: "alice-hotel"},
  };
  const [one, two] = await Promise.all([
    call("alice", "send", payload),
    call("alice", "send", payload),
  ]);
  assert.equal(one.message.id, two.message.id);
  assert.equal((await db.doc("customerSupportV2/alice").get()).data().adminUnread, 1);
  assert.equal(one.message.senderId, "alice");
  assert.equal(one.message.booking.title, "Bangkok Hotel");
  await assert.rejects(
    call("alice", "send", {...payload, text: "changed"}),
    (e) => e.code === "already-exists",
  );
});
test("pagination, search, shared links and global admin search respect conversation scope", async () => {
  await call("bob", "send", {
    requestId: "bob-secret",
    text: "Private uniqueSecret https://example.com/secret",
  });
  for (let n = 0; n < 4; n++)
    await call("alice", "send", {
      requestId: `page-${n}`,
      text: `Invoice file${n}.pdf https://thaiseva.com/${n}`,
    });
  const first = await call("alice", "messages", {limit: 2});
  const second = await call("alice", "messages", {limit: 2, cursor: first.nextCursor});
  assert.equal(first.items.length, 2);
  assert.equal(second.items.length, 2);
  assert.equal(new Set([...first.items, ...second.items].map((x) => x.id)).size, 4);
  assert.equal((await call("alice", "search", {query: "uniqueSecret"})).items.length, 0);
  assert.equal(
    (
      await call("admin", "search", {
        customerId: "alice",
        query: "uniqueSecret",
        allCustomers: true,
      })
    ).items.length,
    1,
  );
  assert.equal((await call("alice", "shared", {category: "links"})).items.length, 4);
});
test("attachments cannot be stolen, reused or downloaded after deletion; cleanup removes bytes", async () => {
  const encoded = Buffer.from("%PDF-1.7\nfixture").toString("base64");
  const upload = await call("alice", "upload", {
    name: "invoice.pdf",
    contentType: "application/pdf",
    contentBase64: encoded,
  });
  const attachmentId = upload.attachment.id;
  await assert.rejects(
    call("bob", "send", {requestId: "steal", attachmentId}),
    (e) => e.code === "permission-denied",
  );
  await assert.rejects(
    call("alice", "download", {attachmentId}),
    (e) => e.code === "permission-denied",
  );
  const sent = await call("alice", "send", {requestId: "file", attachmentId, text: "Document"});
  assert.equal((await call("alice", "download", {attachmentId})).contentBase64, encoded);
  await assert.rejects(
    call("bob", "download", {attachmentId}),
    (e) => e.code === "permission-denied",
  );
  await assert.rejects(
    call("alice", "send", {requestId: "reuse", attachmentId}),
    (e) => e.code === "permission-denied",
  );
  assert.equal((await call("alice", "shared", {category: "documents"})).items.length, 1);
  await call("admin", "delete", {customerId: "alice", messageId: sent.message.id});
  await assert.rejects(
    call("alice", "download", {attachmentId}),
    (e) => e.code === "permission-denied",
  );
  assert.equal((await call("alice", "shared", {category: "documents"})).items.length, 0);
  await cleanupCustomerChatAttachments.run({});
  assert.equal((await db.doc(`customerSupportAttachmentsV2/${attachmentId}`).get()).exists, false);
});
test("edits update search, foreign mutation fails, read receipts and status are protected", async () => {
  const sent = await call("alice", "send", {requestId: "edit", text: "Originalword"});
  await assert.rejects(
    call("bob", "delete", {messageId: sent.message.id}),
    (e) => e.code === "permission-denied",
  );
  await call("alice", "edit", {messageId: sent.message.id, text: "Replacementword"});
  assert.equal((await call("alice", "search", {query: "Originalword"})).items.length, 0);
  assert.equal((await call("alice", "search", {query: "Replacementword"})).items.length, 1);
  await assert.rejects(
    call("alice", "status", {status: "resolved"}),
    (e) => e.code === "permission-denied",
  );
  await call("admin", "status", {customerId: "alice", status: "resolved"});
  assert.equal((await db.doc("customerSupportV2/alice").get()).data().status, "resolved");
  await call("admin", "read", {customerId: "alice", through: sent.message.createdAt});
  assert.equal((await db.doc("customerSupportV2/alice").get()).data().adminUnread, 0);
  await call("alice", "send", {requestId: "reopen", text: "Another question"});
  assert.equal((await db.doc("customerSupportV2/alice").get()).data().status, "open");
});
test("distributed limits stop excess uploads", async () => {
  await db
    .doc("customerSupportRateLimits/alice_upload")
    .set({count: 10, until: Date.now() + 60000});
  await assert.rejects(
    call("alice", "upload", {
      contentType: "application/pdf",
      name: "x.pdf",
      contentBase64: Buffer.from("%PDF-1.7").toString("base64"),
    }),
    (e) => e.code === "resource-exhausted",
  );
});

test("retention holds block mutation and preserve expired evidence; unheld old messages and abandoned files are removed", async () => {
  const old = admin.firestore.Timestamp.fromDate(new Date("2020-01-01T00:00:00Z"));
  await db
    .doc("customerSupportMessagesV2/expired")
    .set({customerId: "bob", createdAt: old, deleted: false, text: "expired"});
  await db.doc("customerSupportMessagesV2/held").set({
    customerId: "bob",
    senderId: "bob",
    createdAt: old,
    deleted: false,
    text: "evidence",
    retentionHold: true,
  });
  await assert.rejects(
    call("admin", "delete", {customerId: "bob", messageId: "held"}),
    (e) => e.code === "failed-precondition",
  );
  const storagePath = "customer-support-v2/bob/abandoned";
  await admin.storage().bucket().file(storagePath).save("abandoned");
  await db
    .doc("customerSupportAttachmentsV2/abandoned")
    .set({customerId: "bob", storagePath, expiresAt: old, messageId: null});
  await cleanupCustomerChatAttachments.run({});
  assert.equal((await db.doc("customerSupportMessagesV2/expired").get()).exists, false);
  assert.equal((await db.doc("customerSupportMessagesV2/held").get()).exists, true);
  assert.equal((await admin.storage().bucket().file(storagePath).exists())[0], false);
});

test("revoked sessions and disabled accounts are denied even with a supplied auth context", async () => {
  await assert.rejects(
    customerChat.run({auth: {uid: "alice", token: {auth_time: 0}}, data: {action: "open"}}),
    (e) => e.code === "permission-denied",
  );
  await admin.auth().updateUser("suspended", {disabled: true});
  await assert.rejects(call("suspended", "messages"), (e) => e.code === "permission-denied");
});

test("default-deny rules prevent direct client database access and private storage downloads", async () => {
  const {initializeApp, deleteApp} = require("../../node_modules/firebase/app");
  const {
    getAuth,
    connectAuthEmulator,
    signInWithCustomToken,
  } = require("../../node_modules/firebase/auth");
  const {
    getFirestore,
    connectFirestoreEmulator,
    doc,
    getDoc,
    setDoc,
    terminate,
  } = require("../../node_modules/firebase/firestore");
  const app = initializeApp({projectId: "demo-thaiseva-chat", apiKey: "demo-key"}, "direct-client");
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
    disableWarnings: true,
  });
  await signInWithCustomToken(auth, await admin.auth().createCustomToken("alice"));
  const clientDb = getFirestore(app);
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
  connectFirestoreEmulator(clientDb, host, Number(port));
  try {
    await assert.rejects(
      getDoc(doc(clientDb, "customerSupportV2/alice")),
      (e) => e.code === "permission-denied",
    );
    await assert.rejects(
      setDoc(doc(clientDb, "customerSupportV2/alice"), {customerId: "bob"}),
      (e) => e.code === "permission-denied",
    );
    const storagePath = "customer-support-v2/alice/direct-probe";
    await admin.storage().bucket().file(storagePath).save("private");
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(
      `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/demo-thaiseva-chat.appspot.com/o/${encodeURIComponent(storagePath)}?alt=media`,
      {headers: {Authorization: `Bearer ${token}`}},
    );
    assert.equal(response.status, 403);
  } finally {
    await terminate(clientDb);
    await deleteApp(app);
  }
});

test("large historical downloads require an expiring UID-bound Storage grant", async () => {
  const {initializeApp, deleteApp} = require("../../node_modules/firebase/app");
  const {
    getAuth,
    connectAuthEmulator,
    signInWithCustomToken,
  } = require("../../node_modules/firebase/auth");
  const {
    getStorage,
    connectStorageEmulator,
    ref,
    getBytes,
  } = require("../../node_modules/firebase/storage");
  const storagePath = "customer-support-v2/alice/historical-zip";
  await admin.storage().bucket().file(storagePath).save("PK\x03\x04fixture");
  await db.doc("customerSupportMessagesV2/historical-large").set({
    customerId: "alice",
    senderId: "alice",
    deleted: false,
    attachment: {id: "historical-zip"},
  });
  await db.doc("customerSupportAttachmentsV2/historical-zip").set({
    customerId: "alice",
    legacy: true,
    messageId: "historical-large",
    storagePath,
    size: 143243058,
    name: "archive.zip",
    contentType: "application/zip",
  });
  const app = initializeApp(
    {
      projectId: "demo-thaiseva-chat",
      apiKey: "demo-key",
      storageBucket: "demo-thaiseva-chat.appspot.com",
    },
    "legacy-download",
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
    disableWarnings: true,
  });
  const storage = getStorage(app);
  const [host, port] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(":");
  connectStorageEmulator(storage, host, Number(port));
  const file = ref(storage, storagePath);
  try {
    await signInWithCustomToken(auth, await admin.auth().createCustomToken("alice"));
    await assert.rejects(getBytes(file), (e) => e.code === "storage/unauthorized");
    await assert.rejects(
      call("bob", "download", {attachmentId: "historical-zip"}),
      (e) => e.code === "permission-denied",
    );
    const result = await call("alice", "download", {attachmentId: "historical-zip"});
    assert.equal(result.downloadTransport, "firebase-authenticated");
    assert.equal(result.storagePath, storagePath);
    assert.equal(result.downloadUrl, undefined);
    assert.ok(result.expiresAt > Date.now() + 59000);
    assert.ok((await getBytes(file)).byteLength);
    await signInWithCustomToken(auth, await admin.auth().createCustomToken("bob"));
    await assert.rejects(getBytes(file), (e) => e.code === "storage/unauthorized");
    await signInWithCustomToken(auth, await admin.auth().createCustomToken("alice"));
    await db
      .doc("customerSupportAttachmentsV2/historical-zip")
      .update({"downloadGrants.alice": admin.firestore.Timestamp.fromMillis(Date.now() - 1)});
    await assert.rejects(getBytes(file), (e) => e.code === "storage/unauthorized");
    await call("alice", "download", {attachmentId: "historical-zip"});
    await call("alice", "delete", {messageId: "historical-large"});
    await assert.rejects(getBytes(file), (e) => e.code === "storage/unauthorized");
  } finally {
    await deleteApp(app);
  }
});

test("migration dry-run is read-only and apply preserves messages, private attachments and rerun idempotency", async () => {
  const {spawnSync} = require("node:child_process");
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const uid = "migration-customer";
  const storagePath = `private-chat/chats/${uid}_CustomerSupport/${uid}/12345678-1234-1234-1234-123456789abc`;
  await admin
    .storage()
    .bucket()
    .file(storagePath)
    .save("%PDF-1.7\nfixture", {contentType: "application/pdf"});
  const source = db.doc(`chats/${uid}_CustomerSupport`);
  await source.set({
    messages: [
      {id: "one", text: "Previous message", senderId: uid, date: admin.firestore.Timestamp.now()},
      {
        id: "two",
        senderId: uid,
        text: "",
        fileUrl: storagePath,
        fileName: "original.pdf",
        date: admin.firestore.Timestamp.now(),
      },
      {
        messageId: "three",
        senderId: uid,
        text: "long historical text ".repeat(300),
        date: admin.firestore.Timestamp.now(),
      },
      {
        id: "four",
        senderId: uid,
        text: "Historical image field",
        imageUrl: storagePath,
        date: admin.firestore.Timestamp.now(),
      },
    ],
  });
  const env = {...process.env, CHAT_STORAGE_BUCKET: "demo-thaiseva-chat.appspot.com"};
  const command = [
    "scripts/migrate-customer-chat.cjs",
    "--project",
    "demo-thaiseva-chat",
    "--uid",
    uid,
  ];
  const run = (extra = []) =>
    spawnSync(process.execPath, [...command, ...extra], {env, encoding: "utf8", timeout: 60000});
  const preview = run();
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal((await db.doc(`customerSupportV2/${uid}`).get()).exists, false);
  const backup = fs.mkdtempSync(path.join(os.tmpdir(), "thaiseva-chat-migration-"));
  const applied = run(["--apply", "--backup-dir", backup]);
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(
    (await db.collection("customerSupportMessagesV2").where("customerId", "==", uid).get()).size,
    4,
  );
  const migrated = await db
    .collection("customerSupportMessagesV2")
    .where("customerId", "==", uid)
    .get();
  assert.equal(
    migrated.docs.find((doc) => doc.data().legacyMessageId === "three").data().text,
    "long historical text ".repeat(300),
  );
  assert.ok(migrated.docs.find((doc) => doc.data().legacyMessageId === "four").data().attachment);
  assert.equal((await source.get()).data().messages.length, 4);
  assert.equal(fs.readdirSync(backup).length, 1);
  const repeat = run(["--apply", "--backup-dir", backup]);
  assert.equal(repeat.status, 0, repeat.stderr);
  assert.equal(
    (await db.collection("customerSupportMessagesV2").where("customerId", "==", uid).get()).size,
    4,
  );
});

test("reviewed legacy migration copies large archives and strips permanent download tokens", async () => {
  const {spawnSync} = require("node:child_process");
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const uid = "migration-reviewed";
  const sourcePath = `uploads/${uid}/historical.zip`;
  const bytes = Buffer.alloc(8 * 1024 * 1024 + 1);
  bytes.write("PK\x03\x04");
  const file = admin.storage().bucket().file(sourcePath);
  await file.save(bytes, {
    contentType: "application/zip",
    metadata: {metadata: {firebaseStorageDownloadTokens: "old-fixture-token"}},
  });
  const [before] = await file.getMetadata();
  await db.doc(`chats/${uid}_CustomerSupport`).set({
    messages: [
      {
        messageId: "archive",
        senderId: uid,
        text: "Historical archive",
        date: admin.firestore.Timestamp.now(),
        fileUrl: `https://firebasestorage.googleapis.com/v0/b/old-chat-fixture.appspot.com/o/${encodeURIComponent(sourcePath)}?alt=media&token=old-fixture-token`,
        fileName: "historical.zip",
      },
    ],
  });
  const backup = fs.mkdtempSync(path.join(os.tmpdir(), "thaiseva-reviewed-migration-"));
  const command = [
    "scripts/migrate-customer-chat.cjs",
    "--project",
    "demo-thaiseva-chat",
    "--uid",
    uid,
    "--apply",
    "--backup-dir",
    backup,
    "--reviewed-legacy-files",
    "--source-bucket-alias",
    "old-chat-fixture.appspot.com",
  ];
  const result = spawnSync(process.execPath, command, {
    env: {...process.env, CHAT_STORAGE_BUCKET: "demo-thaiseva-chat.appspot.com"},
    encoding: "utf8",
    timeout: 60000,
  });
  assert.equal(result.status, 0, result.stderr);
  const migrated = (
    await db.collection("customerSupportMessagesV2").where("customerId", "==", uid).get()
  ).docs[0].data();
  assert.equal(migrated.attachment.size, bytes.length);
  assert.equal(migrated.attachment.legacy, true);
  const attachment = (
    await db.doc(`customerSupportAttachmentsV2/${migrated.attachment.id}`).get()
  ).data();
  const [copied] = await admin.storage().bucket().file(attachment.storagePath).getMetadata();
  assert.equal(copied.metadata?.firebaseStorageDownloadTokens || null, null);
  assert.equal(copied.crc32c, before.crc32c);
  assert.equal((await file.getMetadata())[0].generation, before.generation);
});

test("account erasure includes V2 records and private bytes, while held support evidence is preserved", async () => {
  const {deleteAuthAccountKeepData} = require("../lib/accountDeletion");
  for (const uid of ["erase-new-chat", "hold-new-chat"]) {
    await admin.auth().createUser({uid});
    await db.doc(`users/${uid}`).set({role: "Customer"});
    await db
      .doc(`customerSupportV2/${uid}`)
      .set({customerId: uid, retentionHold: uid === "hold-new-chat"});
    await db.doc(`customerSupportMessagesV2/${uid}`).set({customerId: uid, text: "private"});
    await db.doc(`customerSupportAttachmentsV2/${uid}`).set({customerId: uid});
    await admin.storage().bucket().file(`customer-support-v2/${uid}/file`).save("private");
    await deleteAuthAccountKeepData(uid, "test-admin");
    const preserved = uid === "hold-new-chat";
    assert.equal((await db.doc(`customerSupportV2/${uid}`).get()).exists, preserved);
    assert.equal((await db.doc(`customerSupportMessagesV2/${uid}`).get()).exists, preserved);
    assert.equal((await db.doc(`customerSupportAttachmentsV2/${uid}`).get()).exists, preserved);
    assert.equal(
      (await admin.storage().bucket().file(`customer-support-v2/${uid}/file`).exists())[0],
      preserved,
    );
  }
});
