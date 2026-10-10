const {test}=require('node:test');
const assert=require('node:assert/strict');
const {formatNewHotelTelegramMessage,formatHotelStatusTelegramMessage}=require('../lib/utils/hotelBooking');
const {formatSightseeingTelegramMessage}=require('../lib/utils/sightseeingBooking');
const {assertRecentSignIn,safeExportText}=require('../lib/privilegedAccounts');
const secret={fullName:'PRIVATE_NAME',guestPhone:'PRIVATE_PHONE',guestEmail:'PRIVATE_EMAIL',pickUpLocation:'PRIVATE_ADDRESS',specialRequests:'PRIVATE_HEALTH'};
test('hotel and tour Telegram alerts never disclose personal or itinerary fields',()=>{
 for(const message of [formatNewHotelTelegramMessage(secret,{finalHotelName:'PRIVATE_HOTEL',room:'PRIVATE_ROOM',checkIn:'PRIVATE_DATE'}),formatHotelStatusTelegramMessage('PRIVATE_NAME',secret),formatSightseeingTelegramMessage('PRIVATE_NAME',secret)]) {
  assert.doesNotMatch(message,/PRIVATE_/);assert.match(message,/https:\/\/admin\.thaiseva\.com\/dashboard/);
 }
});
test('sensitive staff actions require fresh authentication',()=>{
 assert.throws(()=>assertRecentSignIn({auth_time:1}));
 assert.throws(()=>assertRecentSignIn({}));
 assert.doesNotThrow(()=>assertRecentSignIn({auth_time:Date.now()/1000}));
});
test('customer export cells cannot execute spreadsheet formulas',()=>{
 for(const text of ['=HYPERLINK("bad")',' +SUM(1,2)','@SUM(1,2)','\tcommand']) assert.equal(safeExportText(text)[0],"'");
 assert.equal(safeExportText('ordinary text'),'ordinary text');
});
