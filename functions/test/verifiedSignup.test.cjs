const test = require('node:test');
const assert = require('node:assert/strict');
const { createVerifiedSignupHandler } = require('../lib/verifiedSignup');
const { digest: hash } = require('../lib/otp/core');

function fixture(overrides = {}) {
    const email = 'customer@example.com';
    const token = 'a'.repeat(43);
    const key = 'test-only-key-at-least-32-characters-long';
    const record = { emailHash: hash(key, 'signup-email', email), expiresAt: 2000, consumedBy: null, ...overrides };
    const accounts = new Map();
    let creates = 0;
    const db = {
        collection(name) {
            assert.equal(name, 'emailOtpVerificationProofs');
            return { doc(id) { assert.equal(id, hash(key, 'signup-proof', token)); return {}; } };
        },
        async runTransaction(fn) {
            return fn({ get: async () => ({ exists: true, data: () => record }), update: (_, change) => Object.assign(record, change) });
        },
    };
    const auth = {
        async createUser(account) {
            creates++;
            if (accounts.has(account.email)) throw { code: 'auth/email-already-exists' };
            accounts.set(account.email, account);
        },
        async getUserByEmail(address) { return accounts.get(address); },
    };
    const handler = createVerifiedSignupHandler({ db, auth, getHashKey: () => key, now: () => 1000 });
    return { handler, record, accounts, creates: () => creates, request: { data: { email, password: 'secret123', verificationToken: token } } };
}

test('claims proof before creating a verified account; retries use the same UID', async () => {
    const f = fixture();
    assert.deepEqual(await f.handler(f.request), { created: true });
    const account = f.accounts.get(f.request.data.email);
    assert.equal(account.emailVerified, true);
    assert.equal(account.uid, f.record.consumedBy);
    await f.handler(f.request);
    assert.equal(f.accounts.size, 1);
});

test('rejects expired, mismatched and already consumed proofs before account creation', async () => {
    for (const overrides of [{ expiresAt: 1000 }, { emailHash: 'wrong' }, { consumedBy: 'another-operation' }, { consumedBy: undefined }]) {
        const f = fixture(overrides);
        await assert.rejects(f.handler(f.request), { code: 'unauthenticated' });
        assert.equal(f.creates(), 0);
    }
});

test('rejects missing proof and invalid password', async () => {
    for (const data of [{ verificationToken: undefined }, { password: 'short' }]) {
        const f = fixture();
        await assert.rejects(f.handler({ data: { ...f.request.data, ...data } }), { code: 'invalid-argument' });
        assert.equal(f.creates(), 0);
    }
});

test('does not claim an existing account belonging to another signup', async () => {
    const f = fixture();
    f.accounts.set(f.request.data.email, { uid: 'existing-user', emailVerified: true });
    await assert.rejects(f.handler(f.request), { code: 'already-exists' });
    assert.equal(f.accounts.get(f.request.data.email).uid, 'existing-user');
});
