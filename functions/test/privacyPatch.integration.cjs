const {test,before,after}=require('node:test');const assert=require('node:assert/strict');
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST||!process.env.FIREBASE_STORAGE_EMULATOR_HOST)throw Error('All emulators required; production forbidden');
const admin=require('firebase-admin');admin.initializeApp({projectId:'demo-thaiseva-privacy-patch',storageBucket:'demo-thaiseva-privacy-patch.appspot.com'});
const {uploadIdentityDocument,getIdentityDocument}=require('../lib/identityMedia');
const {syncPublicPartnerDirectory,syncPublicSelfDriveConditions}=require('../lib/publicPrivacyViews');
const {requireSuperAdmin}=require('../lib/privilegedAccounts');
const db=admin.firestore();
const auth=uid=>({uid,token:{auth_time:Math.ceil(Date.now()/1000)}});
before(async()=>{for(const uid of ['alice','bob','staff','disabled']){await admin.auth().createUser({uid,disabled:uid==='disabled'});await db.doc('users/'+uid).set({role:uid==='staff'?'Admin':'Customer'});}});
after(async()=>{await admin.app().delete();});
test('identity uploads have no bearer token and previews enforce owner/current Admin access',async()=>{
 const result=await uploadIdentityDocument.run({auth:auth('alice'),data:{kind:'passport',contentType:'application/pdf',contentBase64:Buffer.from('%PDF-synthetic').toString('base64')}});
 const [metadata]=await admin.storage().bucket().file(result.path).getMetadata();assert.equal(metadata.metadata?.firebaseStorageDownloadTokens,undefined);assert.equal(metadata.cacheControl,'private, no-store');
 for(const uid of ['alice','staff'])assert.equal((await getIdentityDocument.run({auth:auth(uid),data:{path:result.path}})).contentType,'application/pdf');
 await assert.rejects(()=>getIdentityDocument.run({auth:auth('bob'),data:{path:result.path}}),{code:'permission-denied'});
 await assert.rejects(()=>getIdentityDocument.run({auth:{...auth('bob'),token:{...auth('bob').token,admin:true}},data:{path:result.path}}),{code:'permission-denied'});
});
test('disabled and anonymous identity uploads and forged file content are rejected',async()=>{
 const data={kind:'licence',contentType:'image/png',contentBase64:Buffer.from('not a PNG').toString('base64')};
 await assert.rejects(()=>uploadIdentityDocument.run({data}),{code:'unauthenticated'});
 await assert.rejects(()=>uploadIdentityDocument.run({auth:auth('disabled'),data}),{code:'permission-denied'});
 await assert.rejects(()=>uploadIdentityDocument.run({auth:auth('alice'),data}),{code:'invalid-argument'});
});
test('public partner synchronization uses current source and removes deleted sources',async()=>{
 const params={category:'Agents',partnerId:'alice'};const target=db.doc('publicPartnerDirectory/Agents/partners/alice');
 await db.doc('T2T_world/Agents/Users/alice').set({'Registered Business':'Public Cafe','ID link':'private',Email:'private'});
 await syncPublicPartnerDirectory.run({params});assert.deepEqual((await target.get()).data(),{'Registered Business':'Public Cafe'});
 await db.doc('T2T_world/Agents/Users/alice').delete();await syncPublicPartnerDirectory.run({params});assert.equal((await target.get()).exists,false);
});
test('rental public projection never publishes submissions or stale conditions',async()=>{
 const params={documentId:'rental'},source=db.doc('self_drive_conditions_and_documents/rental'),target=db.doc('publicSelfDriveConditions/rental');
 await source.set({conditions:['Public terms']});await syncPublicSelfDriveConditions.run({params});assert.deepEqual((await target.get()).data(),{conditions:['Public terms']});
 await source.set({personalInfo:{name:'private'},conditions:['mixed']});await syncPublicSelfDriveConditions.run({params});assert.equal((await target.get()).exists,false);
});
test('real current Auth claim removal defeats a recently signed-in stale Admin token',async()=>{
 await admin.auth().setCustomUserClaims('bob',{admin:true});await requireSuperAdmin('bob',auth('bob').token);
 await admin.auth().setCustomUserClaims('bob',{});
 await assert.rejects(()=>requireSuperAdmin('bob',{admin:true,...auth('bob').token}),{code:'permission-denied'});
});
