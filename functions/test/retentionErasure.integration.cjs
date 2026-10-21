const {test,before,after}=require('node:test');const assert=require('node:assert/strict');const admin=require('firebase-admin');
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST||!process.env.FIREBASE_STORAGE_EMULATOR_HOST)throw Error('All emulators required; production forbidden');
const projectId='demo-thaiseva-otp';const app=admin.initializeApp({projectId,storageBucket:projectId+'.appspot.com'});const db=admin.firestore();const bucket=admin.storage().bucket();const {deleteAuthAccountKeepData}=require('../lib/accountDeletion');const {maintainRetention}=require('../lib/retentionMaintenance');const ts=year=>admin.firestore.Timestamp.fromDate(new Date(`${year}-01-01T00:00:00Z`));
before(async()=>{await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`,{method:'DELETE'});await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${projectId}/accounts`,{method:'DELETE'});});
test('current erasure removes login, profiles, nested operational data and scoped files; retains legal records and queues review',async()=>{const uid='retention-test-customer';await admin.auth().createUser({uid,email:'retention-fixture@example.invalid'});for(const p of [`users/${uid}`,`Users/${uid}`,`cart/${uid}`,`cart/${uid}/items/item`,`foodCustomerSupportChats/${uid}`,`foodCustomerSupportChats/${uid}/messages/m`,`chats/${uid}_CustomerSupport`,`chats/${uid}_CustomerSupport/messages/m`,`userDevices/${uid}`,`notifications/users/${uid}/notice`])await db.doc(p).set({fixture:true});await db.doc('chatRooms/CustomerSupport').set({fixture:{userInfo:{uid}},other:{userInfo:{uid:'other-customer'}}});await db.doc('hotelBookingData/retained').set({userId:uid,bookingStatus:'completed',createdAt:ts(2026),completedAt:ts(2026)});await bucket.file(`users/${uid}/photo.txt`).save('synthetic file');await bucket.file(`chatMedia/${uid}/media.txt`).save('synthetic file');await bucket.file('users/other-customer/keep.txt').save('other fixture');await deleteAuthAccountKeepData(uid,'test-admin');await assert.rejects(admin.auth().getUser(uid),e=>e.code==='auth/user-not-found');for(const p of [`users/${uid}`,`Users/${uid}`,`cart/${uid}`,`cart/${uid}/items/item`,`chats/${uid}_CustomerSupport/messages/m`,`foodCustomerSupportChats/${uid}/messages/m`,`userDevices/${uid}`,`notifications/users/${uid}/notice`])assert.equal((await db.doc(p).get()).exists,false,p);assert.equal((await bucket.file(`users/${uid}/photo.txt`).exists())[0],false);assert.equal((await bucket.file(`chatMedia/${uid}/media.txt`).exists())[0],false);assert.equal((await bucket.file('users/other-customer/keep.txt').exists())[0],true);const dir=(await db.doc('chatRooms/CustomerSupport').get()).data();assert.equal(dir.fixture,undefined);assert.ok(dir.other);assert.equal((await db.doc('hotelBookingData/retained').get()).exists,true);const job=(await db.doc(`privacyErasureJobs/${uid}`).get()).data();assert.equal(job.status,'PENDING_RECORD_REVIEW');assert.equal(job.profileErased,true);assert.ok(job.remainingReview.includes('bookings'));});
test('scheduler processes eligible customer requests but preserves cancelled, held and staff requests',async()=>{for(const [uid,status,extra]of [['due-customer','Pending',{}],['cancelled-customer','Cancelled',{}],['held-customer','Pending',{legalHold:true}],['staff-customer','Pending',{}]]){await admin.auth().createUser({uid});await db.doc(`users/${uid}`).set({role:uid==='staff-customer'?'Admin':'Customer'});await db.doc(`DeletionRequests/${uid}`).set({uid,status,createdAt:ts(2020),...extra});}const result=await maintainRetention(false);assert.equal(result.failures,0);await assert.rejects(admin.auth().getUser('due-customer'),e=>e.code==='auth/user-not-found');assert.equal((await db.doc('DeletionRequests/due-customer').get()).data().status,'Erasure Pending');for(const uid of ['cancelled-customer','held-customer','staff-customer'])assert.ok(await admin.auth().getUser(uid));});
test('dry run leaves expired contacts untouched; actual cleanup removes dated expiry and preserves holds/undated records',async()=>{await db.doc('ContactMessages/expired').set({createdAt:ts(2020)});await db.doc('ContactMessages/held').set({createdAt:ts(2020),legalHold:true});await db.doc('ContactMessages/no-date').set({fixture:true});await maintainRetention(true);assert.equal((await db.doc('ContactMessages/expired').get()).exists,true);const result=await maintainRetention(false);assert.equal(result.failures,0);assert.equal((await db.doc('ContactMessages/expired').get()).exists,false);assert.equal((await db.doc('ContactMessages/held').get()).exists,true);assert.equal((await db.doc('ContactMessages/no-date').get()).exists,true);assert.equal((await db.doc('privacyRetentionReviews/ContactMessages_no-date').get()).exists,true);});
test('legacy chat dates and T2T nested messages expire; parent and child holds survive',async()=>{
  await db.doc('chats/legacy-date').set({messages:[{date:ts(2020),text:'old'},{date:ts(2020),legalHold:true,text:'held'},{date:'ambiguous',text:'undated'}]});
  await db.doc('T2TWorldChatRoom/legacy').set({fixture:true});
  await db.doc('T2TWorldChatRoom/legacy/messages/old').set({date:ts(2020)});
  await db.doc('T2TWorldChatRoom/legacy/messages/held').set({date:ts(2020),legalHold:true});
  await db.doc('foodCustomerChats/legacy').set({messages:[{date:'2020-01-01T00:00:00Z'},{date:'2099-01-01T00:00:00Z'}]});
  await db.doc('foodCustomerChats/held').set({legalHold:true,messages:[{date:'2020-01-01T00:00:00Z'}]});
  await maintainRetention(true);
  assert.equal((await db.doc('T2TWorldChatRoom/legacy/messages/old').get()).exists,true);
  const result=await maintainRetention(false);assert.equal(result.failures,0);
  assert.equal((await db.doc('chats/legacy-date').get()).data().messages.length,2);
  assert.equal((await db.doc('T2TWorldChatRoom/legacy/messages/old').get()).exists,false);
  assert.equal((await db.doc('T2TWorldChatRoom/legacy/messages/held').get()).exists,true);
  assert.equal((await db.doc('foodCustomerChats/legacy').get()).data().messages.length,1);
  assert.equal((await db.doc('foodCustomerChats/held').get()).data().messages.length,1);
});
test('erasure removes exact current storage paths without touching another customer',async()=>{
  const uid='current-path-customer';await admin.auth().createUser({uid});await db.doc(`users/${uid}`).set({role:'Customer'});
  const paths=[`uploads/${uid}/proof.pdf`,`food_orders/${uid}/order/photo.jpg`,`profile_pics/${uid}.jpg`];
  for(const path of paths)await bucket.file(path).save('synthetic');
  await bucket.file('profile_pics/current-path-customer-other.jpg').save('other');
  await deleteAuthAccountKeepData(uid,'test-admin');
  for(const path of paths)assert.equal((await bucket.file(path).exists())[0],false,path);
  assert.equal((await bucket.file('profile_pics/current-path-customer-other.jpg').exists())[0],true);
});
test('erasure preserves held order/support attachments and records pending review',async()=>{
  const uid='held-attachment-customer';await admin.auth().createUser({uid});await db.doc(`users/${uid}`).set({role:'Customer'});
  await db.doc('orders/held-attachment-order').set({Receiver:{id:uid},disputeOpen:true});
  await db.doc(`chats/${uid}_CustomerSupport`).set({fixture:true});
  await db.doc(`chats/${uid}_CustomerSupport/messages/held`).set({retentionHold:true});
  await bucket.file(`food_orders/${uid}/proof.jpg`).save('synthetic');
  await deleteAuthAccountKeepData(uid,'test-admin');
  assert.equal((await bucket.file(`food_orders/${uid}/proof.jpg`).exists())[0],true);
  assert.equal((await db.doc(`chats/${uid}_CustomerSupport/messages/held`).get()).exists,true);
  const job=(await db.doc(`privacyErasureJobs/${uid}`).get()).data();assert.equal(job.uploadsErased,false);assert.equal(job.attachmentHold,true);
});
test('legacy credential fields are removed even from completed requests; preview leaves records unchanged',async()=>{
  const ref=db.doc('DeletionRequests/completed-legacy');await ref.set({status:'Completed',password:'synthetic-password',confirmPassword:'synthetic-password',reason:'synthetic reason'});
  await maintainRetention(true);assert.ok((await ref.get()).data().password);
  await maintainRetention(false);const data=(await ref.get()).data();assert.equal(data.password,undefined);assert.equal(data.confirmPassword,undefined);assert.equal(data.reason,'synthetic reason');assert.equal(data.status,'Completed');
  assert.equal((await db.doc('privacyRetentionReviews/DeletionRequests_completed-legacy').get()).data().reason,'LEGACY_REQUEST_IDENTITY_REVIEW');
});
test('private photo API rejects unrelated accounts, revoked assignments and foreign references',async()=>{
  const {getFoodOrderPhoto}=require('../lib/orderMedia');
  for(const uid of ['photo-customer','photo-restaurant','photo-rider','photo-stranger'])await admin.auth().createUser({uid});
  const path='food_orders/photo-customer/photo-order/location.jpg';
  const photo={Receiver:{id:'photo-customer',locationPhotos:[path]},Restaurant:{ownerId:'photo-restaurant'},assignedRiderId:'photo-rider'};
  await db.doc('orders/photo-order').set(photo);await bucket.file(path).save('synthetic photo',{metadata:{contentType:'image/jpeg'}});
  const call=(uid,requestedPath=path)=>getFoodOrderPhoto.run({auth:{uid,token:{auth_time:Math.ceil(Date.now()/1000)}},data:{orderId:'photo-order',path:requestedPath}});
  for(const uid of ['photo-customer','photo-restaurant','photo-rider'])assert.ok((await call(uid)).contentBase64);
  await assert.rejects(call('photo-stranger'),e=>e.code==='permission-denied');
  await db.doc('orders/photo-order').update({assignedRiderId:'different-rider'});
  await assert.rejects(call('photo-rider'),e=>e.code==='permission-denied');
  const foreign='food_orders/another-customer/private.jpg';await db.doc('orders/photo-order').update({'Receiver.locationPhotos':[foreign]});
  await assert.rejects(call('photo-customer',foreign),e=>e.code==='permission-denied');
});
test('terminal order retention removes the derived partner copy in the same cleanup',async()=>{
  await db.doc('orders/expired-source').set({status:'Completed',createdAt:ts(2010),completedAt:ts(2010)});
  await db.doc('partnerOrderViews/expired-source').set({Amount:100});
  await maintainRetention(false);
  assert.equal((await db.doc('orders/expired-source').get()).exists,false);assert.equal((await db.doc('partnerOrderViews/expired-source').get()).exists,false);
});
test('travel booking holds preserve identity files while account cleanup stays explicitly incomplete',async()=>{
  const uid='held-travel-customer';await admin.auth().createUser({uid});
  await db.doc(`users/${uid}`).set({role:'Customer'});
  await db.doc('self_driving_bookings/identity-hold').set({authUid:uid,retentionHold:true});
  const file=bucket.file(`users/${uid}/passports/passport.jpg`);await file.save('synthetic',{metadata:{contentType:'image/jpeg'}});
  await deleteAuthAccountKeepData(uid,'test-admin');
  assert.equal((await file.exists())[0],true);
  const job=(await db.doc(`privacyErasureJobs/${uid}`).get()).data();
  assert.equal(job.uploadsErased,false);assert.equal(job.bookingAttachmentReview,true);assert.equal(job.status,'PENDING_RECORD_REVIEW');
});

test('identity previews enforce ownership, current privilege, suspension, revocation and safe content',async()=>{
  const {getIdentityDocument}=require('../lib/identityMedia');
  for(const uid of ['id-owner','id-other','id-admin'])await admin.auth().createUser({uid});
  await db.doc('users/id-admin').set({role:'Admin'});
  const path='users/id-owner/passports/passport.jpg';await bucket.file(path).save('synthetic image',{metadata:{contentType:'image/jpeg',metadata:{firebaseStorageDownloadTokens:'unchanged-fixture'}}});
  const call=(uid,value=path,authTime=Math.ceil(Date.now()/1000))=>getIdentityDocument.run({auth:{uid,token:{auth_time:authTime}},data:{path:value}});
  assert.ok((await call('id-owner')).contentBase64);assert.ok((await call('id-admin')).contentBase64);
  await assert.rejects(call('id-other'),e=>e.code==='permission-denied');
  await db.doc('users/id-owner').set({isSuspended:true});await assert.rejects(call('id-owner'),e=>e.code==='permission-denied');
  await db.doc('users/id-owner').set({isSuspended:false});await admin.auth().revokeRefreshTokens('id-owner');await assert.rejects(call('id-owner',path,1),e=>e.code==='permission-denied');
  const bad='users/id-owner/licences/unsafe.html';await bucket.file(bad).save('<html>',{metadata:{contentType:'text/html'}});
  await assert.rejects(call('id-owner',bad),e=>e.code==='failed-precondition');
  const [meta]=await bucket.file(path).getMetadata();assert.equal(meta.metadata.firebaseStorageDownloadTokens,'unchanged-fixture');
});

test('driver previews require current owner or admin and a server-bound driver file',async()=>{
  const {getDriverDocument}=require('../lib/driverMedia');
  for(const uid of ['driver-owner','driver-other','driver-admin','driver-food'])await admin.auth().createUser({uid,customClaims:uid==='driver-food'?{foodRole:'masterAdmin'}:{}});
  await db.doc('users/driver-admin').set({role:'Admin'});
  const path='123456789-file';
  await bucket.file(path).save('synthetic licence',{metadata:{contentType:'image/jpeg',metadata:{privateDriverDocument:'true',privateDriverOwner:'driver-owner'}}});
  await db.doc('drivers/driver-owner').set({driverInformation:{license:path}});
  const call=(uid,driverId='driver-owner',authTime=Math.ceil(Date.now()/1000))=>getDriverDocument.run({auth:uid?{uid,token:{auth_time:authTime}}:undefined,data:{driverId,path:'ignored-attacker-input'}});
  assert.ok((await call('driver-owner')).contentBase64);
  assert.ok((await call('driver-admin')).contentBase64);
  for(const uid of ['driver-other','driver-food'])await assert.rejects(call(uid),e=>e.code==='permission-denied');
  await assert.rejects(call(null),e=>e.code==='unauthenticated');
  await db.doc('users/driver-admin').set({role:'Customer'});
  await assert.rejects(call('driver-admin'),e=>e.code==='permission-denied');
  await db.doc('users/driver-owner').set({isSuspended:true});
  await assert.rejects(call('driver-owner'),e=>e.code==='permission-denied');
  await db.doc('users/driver-owner').set({isSuspended:false});
  await admin.auth().revokeRefreshTokens('driver-owner');
  await assert.rejects(call('driver-owner','driver-owner',1),e=>e.code==='permission-denied');
  await db.doc('drivers/driver-other').set({driverInformation:{license:path}});
  await assert.rejects(call('driver-other','driver-other'),e=>e.code==='permission-denied');
  await bucket.file(path).setMetadata({contentType:'text/html'});
  await assert.rejects(call('driver-owner'),e=>e.code==='failed-precondition');
});

test('driver upload stores protected owner-bound bytes without a download token',async()=>{
  const {uploadDriverDocument}=require('../lib/driverMedia');
  const call=(uid,contentType='image/png',contentBase64=Buffer.from([137,80,78,71,13,10,26,10,1]).toString('base64'))=>uploadDriverDocument.run({auth:uid?{uid,token:{auth_time:Math.ceil(Date.now()/1000)}}:undefined,data:{contentType,contentBase64}});
  await assert.rejects(call(null),e=>e.code==='unauthenticated');
  await assert.rejects(call('driver-other','image/png',Buffer.from('<html>').toString('base64')),e=>e.code==='invalid-argument');
  const {path}=await call('driver-other');
  assert.ok(path.startsWith('users/driver-other/licences/'));
  const [metadata]=await bucket.file(path).getMetadata();
  assert.equal(metadata.metadata.privateDriverOwner,'driver-other');
  assert.equal(metadata.metadata.privateDriverDocument,'true');
  assert.ok(!metadata.metadata.firebaseStorageDownloadTokens);
});

test('retained previews require current Admin privilege and an operator-bound file',async()=>{
  const {getRetainedPrivateFile}=require('../lib/retainedMedia');
  const fileId='a'.repeat(64),path='T2T_world/legacy-id.jpg';
  await admin.auth().createUser({uid:'retained-admin'});await db.doc('users/retained-admin').set({role:'Admin'});
  await bucket.file(path).save('synthetic identity',{metadata:{contentType:'image/jpeg',metadata:{privateRetainedDocument:'true',privateRetainedId:fileId}}});
  await db.doc(`retainedPrivateFiles/${fileId}`).set({status:'PROTECTED',storagePath:path});
  const call=uid=>getRetainedPrivateFile.run({auth:uid?{uid,token:{auth_time:Math.ceil(Date.now()/1000)}}:undefined,data:{fileId,path:'attacker-ignored'}});
  assert.ok((await call('retained-admin')).contentBase64);
  await assert.rejects(call(null),e=>e.code==='unauthenticated');
  await assert.rejects(call('driver-other'),e=>e.code==='permission-denied');
  await db.doc('users/retained-admin').set({role:'Admin',isSuspended:true});
  await assert.rejects(call('retained-admin'),e=>e.code==='permission-denied');
  await db.doc('users/retained-admin').set({role:'Customer'});
  await assert.rejects(call('retained-admin'),e=>e.code==='permission-denied');
  await db.doc('users/retained-admin').set({role:'Admin'});
  await bucket.file(path).setMetadata({metadata:{privateRetainedId:'b'.repeat(64)}});
  await assert.rejects(call('retained-admin'),e=>e.code==='permission-denied');
});

test('new hotel outcomes record server dates and ignore stale events or duplicate retries',async()=>{
  const {recordLifecycleTransition}=require('../lib/privacyLifecycle');
  const ref=db.doc('hotelBookingData/lifecycle-fixture');
  await ref.set({status:'Completed'});const commit=ts(2026);
  await recordLifecycleTransition(ref,{status:'Pending'},{status:'Completed'},commit);
  assert.equal((await ref.get()).data().completedAt.toMillis(),commit.toMillis());
  await recordLifecycleTransition(ref,{status:'Pending'},{status:'Completed'},ts(2020));
  assert.equal((await ref.get()).data().completedAt.toMillis(),commit.toMillis());
  await ref.update({status:'Pending'});
  await recordLifecycleTransition(ref,{status:'Pending'},{status:'Completed'},ts(2027));
  assert.equal((await ref.get()).data().completedAt.toMillis(),commit.toMillis());
});

after(async()=>{await app.delete();});
