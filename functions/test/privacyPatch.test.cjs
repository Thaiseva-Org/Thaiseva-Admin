const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {publicPartnerView,publicConditionsView}=require('../lib/publicPrivacyViews');
test('public partner projection drops all personal documents and contacts',()=>{
  assert.deepEqual(publicPartnerView({'Registered Business':'Cafe',City:'Bangkok',Country:'Thailand','ID link':'private','Alternative Phone':'secret',Email:'private','First Name':'private',bankAccount:'private',arbitrary:{secret:true}}),{'Registered Business':'Cafe',City:'Bangkok',Country:'Thailand'});
});
test('public rental projection rejects submissions and mixed records',()=>{
  assert.deepEqual(publicConditionsView({conditions:['Public condition']}),{conditions:['Public condition']});
  for(const data of [{conditions:'public',personalInfo:{name:'private'}},{conditions:[{passport:'private'}]},{licence:'private'},{conditions:null}])assert.equal(publicConditionsView(data),null);
});
function adminHarness(profile,claims,account={}) {
 const module={exports:{}};
 class HttpsError extends Error {constructor(code,message){super(message);this.code=code;}}
 const requireMock=name=>name==='firebase-functions/v2/https'?{HttpsError,onCall:(_options,handler)=>handler}:{firestore:()=>({doc:()=>({get:async()=>({data:()=>profile})})}),auth:()=>({getUser:async()=>({disabled:false,tokensValidAfterTime:'1970-01-01',customClaims:claims,...account})})};
 vm.runInNewContext(fs.readFileSync(require.resolve('../lib/privilegedAccounts'),'utf8'),{module,exports:module.exports,require:requireMock,Date,Buffer});
 return module.exports;
}
test('Admin export refuses a stale admin token after current claim removal',async()=>{
 await assert.rejects(()=>adminHarness({role:'Customer'},{}).requireSuperAdmin('former-admin',{admin:true,auth_time:Date.now()/1000}),{code:'permission-denied'});
});
test('current Admin access works while revoked/disabled/suspended accounts fail',async()=>{
 for(const [profile,claims] of [[{role:'Admin'},{}],[{role:'Customer'},{admin:true}]])await adminHarness(profile,claims).requireSuperAdmin('staff',{auth_time:Date.now()/1000});
 for(const [profile,account] of [[{role:'Admin'},{disabled:true}],[{role:'Admin',isSuspended:true},{}],[{role:'Admin'},{tokensValidAfterTime:new Date(Date.now()+10000).toISOString()}]])await assert.rejects(()=>adminHarness(profile,{},account).requireSuperAdmin('staff',{auth_time:Date.now()/1000}),{code:'permission-denied'});
});

function retainedHarness(record, metadata = {}) {
 const module={exports:{}};let downloads=0;
 class HttpsError extends Error {constructor(code,message){super(message);this.code=code;}}
 const id='a'.repeat(64);
 const requireMock=name=>name==='firebase-functions/v2/https'?{HttpsError,onCall:(_options,handler)=>handler}:name==='./retentionPolicy'?require('../lib/retentionPolicy'):name==='./accountRestrictions'?{assertAccountNotErasing:async()=>{}}:{
  firestore:()=>({doc:path=>({get:async()=>({data:()=>path.startsWith('users/')?{role:'Admin'}:record})})}),
  auth:()=>({getUser:async()=>({disabled:false,tokensValidAfterTime:'1970-01-01',customClaims:{admin:true}})}),
  storage:()=>({bucket:()=>({file:()=>({exists:async()=>[true],getMetadata:async()=>[{contentType:'image/png',size:'3',metadata:{privateRetainedId:id,privateRetainedDocument:'true'},...metadata}],download:async()=>{downloads++;return [Buffer.from('png')];}})})})
 };
 vm.runInNewContext(fs.readFileSync(require.resolve('../lib/retainedMedia'),'utf8'),{module,exports:module.exports,require:requireMock,Date,Buffer});
 return {open:()=>module.exports.getRetainedPrivateFile({auth:{uid:'staff',token:{auth_time:Date.now()/1000}},data:{fileId:id}}),downloads:()=>downloads};
}
test('retained previews stop at expiry before asynchronous object deletion',async()=>{
 for(const expiresAt of [{seconds:1},'invalid']) {
  const h=retainedHarness({status:'PROTECTED',storagePath:'registered',expiresAt});
  await assert.rejects(h.open,{code:'failed-precondition'});assert.equal(h.downloads(),0);
 }
});
test('retained previews preserve current grants and native-hold evidence review',async()=>{
 for(const [expiresAt,metadata] of [[undefined,{}],[{seconds:Date.now()/1000+3600},{}],[{seconds:1},{temporaryHold:true}],[{seconds:1},{eventBasedHold:true}]]){
  const h=retainedHarness({status:'PROTECTED',storagePath:'registered',expiresAt},metadata);
  assert.equal((await h.open()).contentType,'image/png');assert.equal(h.downloads(),1);
 }
 const malformed=retainedHarness({status:'PROTECTED',storagePath:'registered',expiresAt:'invalid'},{temporaryHold:true});
 await assert.rejects(malformed.open,{code:'failed-precondition'});
});
