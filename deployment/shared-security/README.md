# Shared privacy release configuration

Project: gothai-ffea1. These rules affect Website, Food, Admin and mobile together.

On 15 October 2026 the owner confirmed that the app team completed the mobile changes. `firebase.strict.json` was used to deploy the current `firestore.rules` and `storage.rules` with only `firestore:rules,storage` selected. No indexes or other products were redeployed.

The current policy preserves the previous production suspension, support-chat and privacy-review protections. It removes email-only administrator shortcuts, removes restaurant-only access to full orders, and restricts delivery-photo files to the owner, authorized staff or participants of a linked order. Legacy photo paths use the authorized photo callable. The 10 shared access/integration tests passed before deployment.

Unclassified legacy root objects retain their previous access pending classification, so public catalog references are not broken. Existing private bearer tokens need separate revocation; rules alone do not revoke them. See the current remaining-work document for verified cleanup status.

`firestore.compat.rules` and `storage.deployed.rules` are historical snapshots from before this cutover. Do not use them as the current deployed policy. Six partner-order indexes were previously created additively; existing indexes and TTL configuration were preserved.

See ../../docs/05-security/PDPA_REMAINING.md for remaining work and app effects.
