const test = require('node:test');
const assert = require('node:assert/strict');
const { isListingActive } = require('../lib/utils/listingStatus');

test('visibility respects root/nested booleans and supports legacy statuses', () => {
  for (const record of [{}, {status: 'Verified'}, {status: 'Approved'}]) assert.equal(isListingActive(record), true);
  for (const record of [{isActive: false}, {hotel: {isActive: false}}, {status: 'Inactive'}, {hotel: {status: 'Inactive'}}]) assert.equal(isListingActive(record), false);
  assert.equal(isListingActive({isActive: true, hotel: {isActive: false}}), true);
});
