const {test}=require('node:test');
const assert=require('node:assert/strict');
const {identityMediaPath,canReadIdentityMedia}=require('../lib/identityMedia');

test('identity previews accept only canonical identity documents and same-project legacy links',()=>{
  const path='users/customer/passports/passport.jpg';
  assert.equal(identityMediaPath(path),path);
  assert.equal(identityMediaPath('https://firebasestorage.googleapis.com/v0/b/gothai-ffea1.firebasestorage.app/o/'+encodeURIComponent(path)+'?alt=media&token=old'),path);
  for(const value of ['users/customer/passports/..','users/customer/avatars/photo.jpg','users/customer/passports/../other.jpg','food_orders/customer/photo.jpg','https://evil.test/file','https://firebasestorage.googleapis.com/v0/b/foreign/o/'+encodeURIComponent(path)])assert.equal(identityMediaPath(value),null);
});

test('identity access excludes food staff, other customers and email shortcuts',()=>{
  const path='users/customer/licences/licence.jpg';
  assert.equal(canReadIdentityMedia('customer',{},'Customer',path),true);
  assert.equal(canReadIdentityMedia('staff',{},'Admin',path),true);
  assert.equal(canReadIdentityMedia('staff',{admin:true},'',path),true);
  for(const claims of [{},{foodRole:'masterAdmin'},{email:'admin@gmail.com'},{admin:'true'}])assert.equal(canReadIdentityMedia('stranger',claims,'Customer',path),false);
});
