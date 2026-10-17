const test = require('node:test');
const assert = require('node:assert/strict');
const {
    createRegisterHandler, createUnregisterHandler, pushToCustomer, pushBroadcast,
    buildPushMessage, tokenDocId, CUSTOMER_TOPIC, DEVICE_TOKENS_COLLECTION,
} = require('../lib/customerPush');

const TOKEN_A = 'a'.repeat(40);
const TOKEN_B = 'b'.repeat(40);

// In-memory customerDeviceTokens with just the calls customerPush makes.
function fakeDb() {
    const docs = new Map();
    const snapshot = (id) => {
        const data = docs.get(id);
        return { id, exists: Boolean(data), data: () => data, get: (key) => data?.[key], ref: ref(id) };
    };
    const ref = (id) => ({
        id,
        set: async (data) => { docs.set(id, { ...data, updatedAt: { toMillis: () => data.millis ?? Date.now() } }); },
        delete: async () => { docs.delete(id); },
    });
    const collection = (name) => {
        assert.equal(name, DEVICE_TOKENS_COLLECTION);
        return {
            doc: ref,
            where: (field, op, value) => ({
                get: async () => {
                    const matches = [...docs.keys()].filter((id) => docs.get(id)[field] === value).map(snapshot);
                    return { size: matches.length, docs: matches };
                },
            }),
        };
    };
    return {
        docs,
        collection,
        batch: () => {
            const ops = [];
            return { delete: (r) => ops.push(r), commit: async () => { for (const r of ops) await r.delete(); } };
        },
        runTransaction: async (fn) => fn({ get: async (r) => snapshot(r.id), delete: (r) => docs.delete(r.id) }),
    };
}

function fakeMessaging(failures = {}) {
    const calls = { multicast: [], send: [], subscribed: [], unsubscribed: [] };
    return {
        calls,
        sendEachForMulticast: async (message) => {
            calls.multicast.push(message);
            const responses = message.tokens.map((t) => failures[t] ? { success: false, error: { code: failures[t] } } : { success: true });
            return { successCount: responses.filter((r) => r.success).length, responses };
        },
        send: async (message) => { calls.send.push(message); return 'id'; },
        subscribeToTopic: async (tokens, topic) => { calls.subscribed.push([tokens, topic]); },
        unsubscribeFromTopic: async (tokens, topic) => { calls.unsubscribed.push([tokens, topic]); },
    };
}

const request = (uid, data) => ({ auth: uid ? { uid } : undefined, data });

test('register stores the token under its hash and joins the broadcast topic', async () => {
    const db = fakeDb();
    const messaging = fakeMessaging();
    const register = createRegisterHandler(() => ({ db, messaging }));
    assert.deepEqual(await register(request('u1', { token: TOKEN_A, platform: 'IOS' })), { registered: true });
    const saved = db.docs.get(tokenDocId(TOKEN_A));
    assert.equal(saved.uid, 'u1');
    assert.equal(saved.platform, 'ios');
    assert.deepEqual(messaging.calls.subscribed, [[[TOKEN_A], CUSTOMER_TOPIC]]);
});

test('signing in with another account on the same phone moves the token', async () => {
    const db = fakeDb();
    const register = createRegisterHandler(() => ({ db, messaging: fakeMessaging() }));
    await register(request('u1', { token: TOKEN_A }));
    await register(request('u2', { token: TOKEN_A }));
    assert.equal(db.docs.size, 1);
    assert.equal(db.docs.get(tokenDocId(TOKEN_A)).uid, 'u2');
});

test('register and unregister reject signed-out callers and bad tokens', async () => {
    const deps = () => ({ db: fakeDb(), messaging: fakeMessaging() });
    for (const handler of [createRegisterHandler(deps), createUnregisterHandler(deps)]) {
        await assert.rejects(handler(request(null, { token: TOKEN_A })), { code: 'unauthenticated' });
        for (const token of [undefined, 'short', 'x'.repeat(30) + ' space']) {
            await assert.rejects(handler(request('u1', { token })), { code: 'invalid-argument' });
        }
    }
});

test('unregister only removes the caller\'s own token', async () => {
    const db = fakeDb();
    const messaging = fakeMessaging();
    const deps = () => ({ db, messaging });
    await createRegisterHandler(deps)(request('u1', { token: TOKEN_A }));
    await createUnregisterHandler(deps)(request('u2', { token: TOKEN_A }));
    assert.equal(db.docs.size, 1);
    assert.deepEqual(messaging.calls.unsubscribed, []);
    await createUnregisterHandler(deps)(request('u1', { token: TOKEN_A }));
    assert.equal(db.docs.size, 0);
    assert.deepEqual(messaging.calls.unsubscribed, [[[TOKEN_A], CUSTOMER_TOPIC]]);
});

test('inbox push goes to every device of the user and drops dead tokens', async () => {
    const db = fakeDb();
    const register = createRegisterHandler(() => ({ db, messaging: fakeMessaging() }));
    await register(request('u1', { token: TOKEN_A }));
    await register(request('u1', { token: TOKEN_B }));
    await register(request('u2', { token: 'c'.repeat(40) }));
    const messaging = fakeMessaging({ [TOKEN_B]: 'messaging/registration-token-not-registered' });
    const note = { title: 'Hotel booking accepted', desc: 'Pay ฿1,200', type: 'hotel-booking', bookingId: 'b1', bookingCollection: 'hotelBookingData' };
    assert.deepEqual(await pushToCustomer('u1', 'n1', note, { db, messaging }), { sent: 1, removed: 1 });
    const [sent] = messaging.calls.multicast;
    assert.deepEqual(sent.tokens.sort(), [TOKEN_A, TOKEN_B]);
    assert.deepEqual(sent.notification, { title: 'Hotel booking accepted', body: 'Pay ฿1,200' });
    assert.deepEqual(sent.data, { notificationId: 'n1', type: 'hotel-booking', bookingId: 'b1', bookingCollection: 'hotelBookingData' });
    assert.equal(sent.android.notification.channelId, 'high_importance_channel');
    assert.equal(db.docs.has(tokenDocId(TOKEN_B)), false);
    assert.equal(db.docs.has(tokenDocId(TOKEN_A)), true);
});

test('inbox push without devices sends nothing', async () => {
    const messaging = fakeMessaging();
    assert.deepEqual(await pushToCustomer('u1', 'n1', { title: 't' }, { db: fakeDb(), messaging }), { sent: 0 });
    assert.equal(messaging.calls.multicast.length, 0);
});

test('message reads message/desc fallbacks, keeps data as strings and only https images', () => {
    const food = buildPushMessage('n2', { title: 'Order Confirmed', message: 'Hey!', imageUrl: 'http://x/y.png' });
    assert.equal(food.notification.body, 'Hey!');
    assert.equal(food.notification.imageUrl, undefined);
    assert.ok(Object.values(food.data).every((v) => typeof v === 'string'));
    const promo = buildPushMessage('n3', { title: 'Sale', desc: 'Now', imageUrl: 'https://x/y.png' });
    assert.equal(promo.notification.imageUrl, 'https://x/y.png');
});

test('broadcast goes to the topic; inbox parent documents are ignored', async () => {
    const messaging = fakeMessaging();
    assert.deepEqual(await pushBroadcast('promo1', { title: 'Songkran deals', desc: '20% off' }, { messaging }), { sent: true });
    assert.equal(messaging.calls.send[0].topic, CUSTOMER_TOPIC);
    assert.equal(messaging.calls.send[0].data.type, 'broadcast');
    for (const id of ['users', 'restaurants', 'admin', 'foodRiders']) {
        assert.deepEqual(await pushBroadcast(id, { title: 'x' }, { messaging }), { sent: false });
    }
    assert.equal(messaging.calls.send.length, 1);
});
