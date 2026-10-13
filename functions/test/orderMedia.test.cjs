const {test}=require('node:test');
const assert=require('node:assert/strict');
const {orderMediaPath,canReadOrderMedia}=require('../lib/orderMedia');
test('photo paths accept same-bucket legacy links but reject foreign buckets, traversal and private documents',()=>{
  const path='food_orders/customer/order/photo.jpg';
  assert.equal(orderMediaPath(path),path);
  assert.equal(orderMediaPath('https://firebasestorage.googleapis.com/v0/b/gothai-ffea1.firebasestorage.app/o/'+encodeURIComponent(path)+'?alt=media&token=synthetic'),path);
  for(const path of ['food_orders/customer/../other.jpg','users/customer/id.pdf','https://evil.test/photo.jpg','https://firebasestorage.googleapis.com/v0/b/foreign/o/food_orders%2Fcustomer%2Fphoto.jpg'])assert.equal(orderMediaPath(path),null);
});
test('photo authorization follows customer, restaurant and assigned rider rather than arbitrary sign-in',()=>{
  const order={Receiver:{id:'customer'},Restaurant:{ownerId:'restaurant'},assignedRiderId:'rider'};
  for(const uid of ['customer','restaurant','rider'])assert.equal(canReadOrderMedia(uid,{},'',order),true);
  assert.equal(canReadOrderMedia('stranger',{},'Customer',order),false);
  assert.equal(canReadOrderMedia('old-rider',{},'rider',order),false);
  assert.equal(canReadOrderMedia('staff',{admin:true},'',order),true);
  assert.equal(canReadOrderMedia('foodstaff',{foodRole:'masterAdmin'},'',order),true);
});
