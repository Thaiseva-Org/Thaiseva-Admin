const {test} = require('node:test');
const assert = require('node:assert/strict');
const flow = require('../sightseeingFlow');
const now = new Date('2026-10-11T12:00:00Z');
const doc = (id, data) => ({id, data: () => data});

test('tomorrow/day 2 require preparation; day 3 and later are eligible', () => {
    assert.equal(flow.dateDecision('2026-10-11', now).valid, false);
    for (const date of ['2026-10-12', '2026-10-13']) {
        const result = flow.availability(date, {globalDailyLimit: 20}, [], now);
        assert.equal(result.bookingFlow, 'REQUEST');
        assert.equal(result.reasonCode, 'PREPARATION_REQUIRED');
        assert.match(result.message, /Payment is collected only after confirmation/);
    }
    assert.equal(flow.availability('2026-10-14', {}, [], now).canInstantBook, true);
    assert.equal(flow.availability('2026-11-01', {}, [], now).canInstantBook, true);
});

test('calendar uses Thailand midnight and validates leap/month boundaries', () => {
    assert.equal(flow.thaiDate(new Date('2026-10-11T17:00:00Z')), '2026-10-12');
    assert.equal(flow.dateDecision('2026-11-02', new Date('2026-10-30T12:00:00Z')).daysAhead, 3);
    assert.equal(flow.dateDecision('2026-02-30', now).valid, false);
    assert.equal(flow.dateDecision('bad', now).valid, false);
});

test('full/zero daily limits route requests and pending requests do not consume slots', () => {
    const date = '2026-10-14';
    const docs = [doc('paid', {arrivalDate: date, isPaymentDone: true}), doc('request', {arrivalDate: date, bookingFlow: 'REQUEST', status: 'Pending'}), doc('cancelled', {arrivalDate: date, status: 'Accepted', bookingStatus: 'CANCELLED'})];
    const full = flow.availability(date, {globalDailyLimit: 1}, docs, now);
    assert.equal(full.dailyCount, 1);
    assert.equal(full.canInstantBook, false);
    assert.equal(full.reasonCode, 'DAILY_LIMIT_REACHED');
    assert.equal(flow.availability(date, {globalDailyLimit: 0}, [], now).canInstantBook, false);
});

test('live checkout holds consume capacity; expired holds release it', () => {
    const data = {arrivalDate: '2026-10-14', bookingFlow: 'INSTANT', paymentMethod: 'STRIPE', isBookingConfirmed: true};
    assert.equal(flow.countsTowardDailyLimit({...data, instantReservationExpiresAt: {toDate: () => new Date(now.getTime() + 1000)}}, data.arrivalDate, now), true);
    assert.equal(flow.countsTowardDailyLimit({...data, instantReservationExpiresAt: {toDate: () => new Date(now.getTime() - 1000)}}, data.arrivalDate, now), false);
});

test('payment cannot open before acceptance or after cancel/checkout expiry', () => {
    assert.equal(flow.approvedForPayment({bookingFlow: 'REQUEST', status: 'Pending', isBookingConfirmed: false}, now), false);
    assert.equal(flow.approvedForPayment({bookingFlow: 'REQUEST', status: 'Accepted', bookingStatus: 'AWAITING_PAYMENT', isBookingConfirmed: true}, now), true);
    assert.equal(flow.approvedForPayment({status: 'Accepted', bookingStatus: 'CANCELLED', isBookingConfirmed: true}, now), false);
    assert.equal(flow.approvedForPayment({bookingFlow: 'INSTANT', status: 'Accepted', instantReservationExpiresAt: {toDate: () => new Date(now.getTime() - 1000)}}, now), false);
});
