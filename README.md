# Thaiseva Admin and partner portal

React/Vite operations portal for travel bookings, hotel/partner workflows, support, invoices and website configuration. Production: https://gothai-admin.web.app.

## Current documentation

- [Technical Data Protection Report](docs/05-security/THAISEVA_TECHNICAL_DATA_PROTECTION.md): plain-language data use, recipients, processing locations, safeguards and evidence for company/regulatory review.
- [Documentation index](docs/README.md): API, setup, operating and testing references.
- [Data policy](docs/05-security/PDPA_DATA_POLICY_2026-10-21.md) and [privacy operating procedures](docs/05-security/PDPA_OPERATING_PROCEDURES.md).
- [Technical verification](docs/05-security/PDPA_TECHNICAL_CLOSEOUT_2026-10-21.md): completed checks and remaining company evidence.

The technical report is not regulatory approval. Historical reports, duplicate guides, generated logs and local exports were removed from this project into an access-restricted archive outside the source repositories. Current source, tests, configuration and essential guides remain.

## Development

```sh
npm ci
npm --prefix functions ci
npm run dev
```

Use the environment example files for configuration. Keep real credentials, customer exports and debug logs out of Git.

## Verification and release

```sh
npm run build
npm --prefix functions test
node --test scripts/adminAccess.test.mjs scripts/offerBanners.test.mjs scripts/supportCategory.test.mjs
```

Follow the [deployment runbook](docs/06-devops/DEPLOYMENT_RUNBOOK.md). Hosting serves `dist`; functions run Node.js 22. Shared Firestore and Storage rules are deployed from the canonical shared-security workspace, not independently from this application. Preserve runtime Secret Manager bindings during backend releases.
