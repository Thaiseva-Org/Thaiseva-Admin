const {test} = require('node:test');
const assert = require('node:assert/strict');
const {bookingAction, expiredMessages, millis} = require('../lib/retentionPolicy');
const now = new Date('2026-10-09T00:00:00Z');
test('five-year deletion needs terminal status and both lifecycle dates', () => {
  const record = {status:'Completed',createdAt:'2020-01-01T00:00:00Z',completedAt:'2020-02-01T00:00:00Z'};
  assert.equal(bookingAction(record,now),'DELETE');
  assert.equal(bookingAction({...record,completedAt:undefined},now),'REVIEW');
  assert.equal(bookingAction({...record,status:'Pending'},now),'KEEP');
  assert.equal(bookingAction({...record,legalHold:true},now),'KEEP');
  assert.equal(bookingAction({...record,chargebackOpen:true},now),'KEEP');
});
test('trip locations expire at 90 days while transaction record remains', () => {
  assert.equal(bookingAction({status:'Completed',createdAt:'2026-01-01T00:00:00Z',completedAt:'2026-06-01T00:00:00Z'},now),'LOCATION');
  assert.equal(bookingAction({status:'Completed',createdAt:'2026-01-01T00:00:00Z',completedAt:'2026-10-01T00:00:00Z'},now),'KEEP');
});
test('chat cleanup preserves fresh and undated messages', () => {
  const messages=[{createdAt:'2023-10-09T00:00:00Z'},{createdAt:'2026-10-08T00:00:00Z'},{text:'legacy'}];
  assert.deepEqual(expiredMessages(messages,now),messages.slice(1));
});
test('ambiguous dates cannot trigger erasure', () => {
  for(const value of [null,0,123,'01/02/2020','not a date']) assert.equal(millis(value),null);
});
