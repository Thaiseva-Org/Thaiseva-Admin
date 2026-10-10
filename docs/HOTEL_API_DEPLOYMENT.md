# Hotel API deployment

This repository owns the production hotel stock and payment APIs in
`gothai-ffea1`, region `asia-east2`.

`lockHotelStock` creates holds in `hotelLocks`.
`createCheckoutSession` reads those holds through
`src/payments/instantHotelCheckout.ts`. Checkout validation, verification, and
Stripe webhook fulfillment must use the same implementation and inventory model.

The website repository also contains legacy functions with identical export
names, but its checkout looks in `hotelBookingHolds`. Mixing deployments can
therefore return `Room hold was not found` even after a successful room lock.
Different deployed source hashes are a diagnostic clue, not proof of which
implementation is running.

From this repository's `functions` directory, deploy the matching group:

```powershell
npm run deploy:hotel
```

The command builds TypeScript before deploying the stock, hold compatibility,
hotel creation, checkout, verification, and webhook endpoints. Configure the
Stripe credentials and webhook destination for this environment before deploying.
Deploy website assets separately with `firebase deploy --only hosting` from the
website repository after its static build; its payment rewrites use `asia-east2`.

After deployment, begin a fresh booking and verify:

1. A successful room lock returns a hold ID stored in `hotelLocks`.
2. Checkout accepts that ID and returns a Stripe URL without creating a booking.
3. Cancellation releases the hold without creating a booking.
4. A Stripe test payment creates one confirmed hotel booking through verification
   or webhook fulfillment; repeated verification does not duplicate the booking.

Do not copy holds between collections or bypass hold ownership, expiry, or room
count checks. Holds from the legacy model should expire via its cleanup process.
