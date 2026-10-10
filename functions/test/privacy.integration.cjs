const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const admin=require('firebase-admin');
const {initializeApp}=require('../../node_modules/firebase/app');
const {getAuth,connectAuthEmulator,signInWithCustomToken}=require('../../node_modules/firebase/auth');
const {getFirestore,connectFirestoreEmulator,doc,getDoc,setDoc}=require('../../node_modules/firebase/firestore');
if(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw Error('Emulators required; never use production');
const projectId='demo-thaiseva-otp';
admin.initializeApp({projectId});
async function client(uid,role){
 await admin.auth().createUser({uid});
 if(role) await admin.firestore().doc(`users/${uid}`).set({role});
 const app=initializeApp({projectId,apiKey:'demo-key',authDomain:'localhost'},uid);
 const auth=getAuth(app);connectAuthEmulator(auth,`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`,{disableWarnings:true});
 const db=getFirestore(app);const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');connectFirestoreEmulator(db,host,Number(port));
 await signInWithCustomToken(auth,await admin.auth().createCustomToken(uid));return {auth,db};
}
let alice,bob,staff,legacy;
before(async()=>{
 await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`,{method:'DELETE'});
 await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${projectId}/accounts`,{method:'DELETE'});
 alice=await client('privacy-alice');bob=await client('privacy-bob');staff=await client('privacy-admin','Admin');legacy=await client('privacy-legacy','Sub Admin');
 await admin.firestore().doc('chatRooms/CustomerSupport').set({directory:'private'});
 await admin.firestore().doc('chats/privacy-alice_CustomerSupport').set({userId:'privacy-alice',messages:[]});
 await admin.firestore().doc('hotelBookingData/private-booking').set({userId:'privacy-alice',fullName:'private'});
 await admin.firestore().doc('settings/Confidential').set({appSign:'private'});
});
test('customer directory is staff-only; private conversation stays owner-scoped',async()=>{
 await assert.rejects(getDoc(doc(alice.db,'chatRooms/CustomerSupport')));
 await assert.rejects(setDoc(doc(alice.db,'chatRooms/CustomerSupport'),{directory:'tamper'}));
 assert.equal((await getDoc(doc(staff.db,'chatRooms/CustomerSupport'))).exists(),true);
 assert.equal((await getDoc(doc(alice.db,'chats/privacy-alice_CustomerSupport'))).exists(),true);
 await assert.rejects(getDoc(doc(bob.db,'chats/privacy-alice_CustomerSupport')));
});
test('support IDs cannot be bypassed with forged participant fields; staff can use nested messages',async()=>{
 await assert.rejects(setDoc(doc(bob.db,'chats/victim_CustomerSupport'),{userId:'privacy-bob',participants:['privacy-bob'],messages:[]}));
 await admin.firestore().doc('chats/other_CustomerSupport').set({participants:['privacy-bob'],messages:[]});
 await assert.rejects(getDoc(doc(bob.db,'chats/other_CustomerSupport')));
 await assert.rejects(setDoc(doc(alice.db,'chats/privacy-alice_CustomerSupport'),{userId:'privacy-alice',messages:[{senderId:'_CustomerSupport',text:'forged staff reply'}]}));
 await setDoc(doc(alice.db,'chats/privacy-alice_CustomerSupport'),{userId:'privacy-alice',messages:[{senderId:'privacy-alice',text:'legitimate'}]});
 await setDoc(doc(alice.db,'chats/privacy-alice_CustomerSupport/messages/customer'),{senderId:'privacy-alice',text:'help'});
 await assert.rejects(getDoc(doc(bob.db,'chats/privacy-alice_CustomerSupport/messages/customer')));
 assert.equal((await getDoc(doc(staff.db,'chats/privacy-alice_CustomerSupport/messages/customer'))).exists(),true);
 await setDoc(doc(staff.db,'chats/privacy-alice_CustomerSupport/messages/staff'),{senderId:'_CustomerSupport',text:'staff reply'});
 assert.equal((await getDoc(doc(alice.db,'chats/privacy-alice_CustomerSupport/messages/staff'))).exists(),true);
 await assert.rejects(setDoc(doc(alice.db,'chats/privacy-alice_CustomerSupport/messages/forged'),{senderId:'_CustomerSupport',text:'forged'}));
});
test('only Admin gets staff access; suspended accounts lose access',async()=>{
 await assert.rejects(getDoc(doc(legacy.db,'hotelBookingData/private-booking')));
 assert.equal((await getDoc(doc(staff.db,'hotelBookingData/private-booking'))).exists(),true);
 await admin.firestore().doc('users/privacy-admin').update({isSuspended:true});
 await assert.rejects(getDoc(doc(staff.db,'hotelBookingData/private-booking')));
 await admin.firestore().doc('users/privacy-admin').update({isSuspended:false});
});
test('browser cannot retrieve or write calling service secrets',async()=>{
 await assert.rejects(getDoc(doc(staff.db,'settings/Confidential')));
 await assert.rejects(setDoc(doc(staff.db,'settings/Confidential'),{appSign:'replacement'}));
});
test('backend rejects disabled accounts and cross-customer identity',async()=>{
 const {requireAuth,assertUserMatch}=require('../lib/payments/corsAuth');
 const token=await alice.auth.currentUser.getIdToken();
 const identity=await requireAuth({headers:{authorization:`Bearer ${token}`}});
 assert.equal(identity.uid,'privacy-alice');
 assert.throws(()=>assertUserMatch(identity,'privacy-bob'));
 await admin.auth().updateUser('privacy-alice',{disabled:true});
 await assert.rejects(requireAuth({headers:{authorization:`Bearer ${token}`}}));
});

test('retention deletes expired contacts and nested chat messages, preserves holds and queues undated records',async()=>{
 const db=admin.firestore();
 await db.doc('ContactMessages/expired').set({createdAt:admin.firestore.Timestamp.fromDate(new Date('2020-01-01')),message:'old'});
 await db.doc('ContactMessages/held').set({createdAt:admin.firestore.Timestamp.fromDate(new Date('2020-01-01')),legalHold:true});
 await db.doc('ContactMessages/undated').set({message:'legacy'});
 await db.doc('chats/privacy-alice_CustomerSupport/messages/old').set({createdAt:admin.firestore.Timestamp.fromDate(new Date('2020-01-01')),text:'old'});
 await db.doc('chats/privacy-alice_CustomerSupport/messages/fresh').set({createdAt:admin.firestore.Timestamp.now(),text:'fresh'});
 const {maintainRetention}=require('../lib/retentionMaintenance');
 await maintainRetention(true);
 assert.equal((await db.doc('ContactMessages/expired').get()).exists,true);
 await maintainRetention(false);
 assert.equal((await db.doc('ContactMessages/expired').get()).exists,false);
 assert.equal((await db.doc('ContactMessages/held').get()).exists,true);
 assert.equal((await db.doc('ContactMessages/undated').get()).exists,true);
 assert.equal((await db.doc('privacyRetentionReviews/ContactMessages_undated').get()).exists,true);
 assert.equal((await db.doc('chats/privacy-alice_CustomerSupport/messages/old').get()).exists,false);
 assert.equal((await db.doc('chats/privacy-alice_CustomerSupport/messages/fresh').get()).exists,true);
});

after(async()=>{
 const {terminate}=require('../../node_modules/firebase/firestore');
 const {deleteApp,getApps}=require('../../node_modules/firebase/app');
 await Promise.all([alice,bob,staff,legacy].filter(Boolean).map(c=>terminate(c.db)));
 await Promise.all(getApps().map(app=>deleteApp(app)));
 await admin.app().delete();
});
