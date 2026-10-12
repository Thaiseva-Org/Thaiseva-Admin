# Thaiseva Documentation Hub

> Privacy/security status updated 11 October 2026: [current verified status](05-security/DATA_PRIVACY_PDPA.md) supersedes older privacy, role, retention and deployment claims below. One Admin staff role is active; current erasure removes scoped records and queues remaining review, rather than proving complete deletion. Historical gaps remain open, Secret Manager migration is IAM-blocked, and Storage/uploads were not changed. Earlier plans, example rules and compliance assertions are not evidence of live readiness.

Welcome to the central documentation hub for the **Thaiseva Admin Portal, Partner Dashboard & Booking Ecosystem**.

This documentation set provides the authoritative reference for engineers, architects, operations teams, security auditors, and business stakeholders.

---

## 🧭 Documentation Map

```
docs/
├── 01-design-system/
│   └── DESIGN_SYSTEM_AND_THEME.md    # UI tokens, Tailwind color palette, CSS variables & components
├── 02-architecture/
│   ├── SYSTEM_ARCHITECTURE.md        # Technical architecture, C4 design, and serverless triggers
│   └── adr/                          # Architecture Decision Records
├── 03-api/
│   ├── API_SPECIFICATION.md          # Complete REST & Callable Cloud Functions reference
│   ├── PACKAGE_BOOKING_INTEGRATION_GUIDE.md # Comprehensive Sightseeing Package Booking API & Integration Guide
│   └── THIRD_PARTY_INTEGRATIONS.md   # Stripe payments, Google Maps, Zoho ZeptoMail & WhatsApp
├── 04-data/
│   └── DATA_SCHEMA_DICTIONARY.md     # Authoritative Firestore schema & subcollection dictionary
├── 05-security/
│   ├── SECURITY_AND_RBAC.md          # Multi-tenant security model, RBAC matrix & rules audit
│   ├── DATA_PRIVACY_PDPA.md          # Thailand PDPA compliance & account deletion workflows
│   └── INTERNAL_DASHBOARD_REVIEW.md  # Technical review of internal dashboard data handling & access controls
├── 06-devops/
│   └── DEPLOYMENT_RUNBOOK.md         # Local setup, Firebase deploy & production release gates
├── 07-user-guides/
│   └── ADMIN_USER_MANUAL.md          # Step-by-step operations manual for Admins and Partners
├── 08-operations/
│   └── OPERATIONS_RUNBOOK.md         # SRE runbook, stuck hold resolution & incident procedures
└── 09-testing/
    └── TEST_STRATEGY.md              # Test strategy, concurrency tests & QA release gates
```

---

## 📚 Quick Navigation

| Document | Primary Audience | Purpose |
|---|---|---|
| [Design System & Theming](01-design-system/DESIGN_SYSTEM_AND_THEME.md) | Frontend Devs, UI/UX | Color palette, Tailwind design tokens, CSS variables, utility classes, and card styles. |
| [System Architecture](02-architecture/SYSTEM_ARCHITECTURE.md) | Architects, Engineers | High-level and component architecture, data flow, serverless trigger chain. |
| [API Specification](03-api/API_SPECIFICATION.md) | Backend, Mobile, Web Devs | Definitive contract for Cloud Functions (`asia-east2`), stock locks, and checkouts. |
| [Package Booking Integration Guide](03-api/PACKAGE_BOOKING_INTEGRATION_GUIDE.md) | Full Stack, Web & Mobile Devs | Complete end-to-end integration guide for sightseeing tours, dual-flow routing, pricing & Stripe. |
| [Third-Party Integrations](03-api/THIRD_PARTY_INTEGRATIONS.md) | Backend & DevOps | Stripe Webhooks, Google Maps Platform, Zoho ZeptoMail OTP, and WhatsApp integration. |
| [Data Schema Dictionary](04-data/DATA_SCHEMA_DICTIONARY.md) | Full Stack & Data Engineers | Authoritative NoSQL Firestore schema, subcollections, indexes, and legacy mappings. |
| [Security & RBAC](05-security/SECURITY_AND_RBAC.md) | Security Auditors, Leads | Access control matrix, Firestore Security Rules governance, and threat model. |
| [Data Privacy & PDPA](05-security/DATA_PRIVACY_PDPA.md) | Legal, Compliance, Ops | Thailand PDPA (B.E. 2562) compliance, Right to Erasure, and account deletion. |
| [Internal Dashboard Review](05-security/INTERNAL_DASHBOARD_REVIEW.md) | Security, DevOps, Admins | Technical review of staff access, export coverage, session management, and retention controls. |
| [Deployment Runbook](06-devops/DEPLOYMENT_RUNBOOK.md) | DevOps, Release Engineers | Local environment setup, Firebase CLI commands, and deployment checklists. |
| [Admin User Manual](07-user-guides/ADMIN_USER_MANUAL.md) | Operations Staff, Partners | Guide for managing bookings, onboarding partners, chat support, and PDF invoicing. |
| [Operations & SRE Runbook](08-operations/OPERATIONS_RUNBOOK.md) | SRE, Support Leads | Troubleshooting stuck holds, failed Stripe webhooks, and manual overrides. |
| [Test Strategy & QA Plan](09-testing/TEST_STRATEGY.md) | QA Leads, Engineers | Testing pyramid, emulator concurrency tests, webhook replay & release gates. |

---

## 🛠️ Key Technology Stack Summary

- **Frontend:** React 19, Vite 7 (ESM), React Router DOM v7, Material UI v6, Tailwind CSS v3, Chart.js.
- **Backend:** Firebase Cloud Functions v2 (Node.js 22, TypeScript), region `asia-east2`.
- **Database & Storage:** Google Cloud Firestore (NoSQL), Firebase Cloud Storage.
- **Authentication:** Firebase Auth (Email/Password, Custom Claims, Passwordless Email OTP).
- **Payment & Invoicing:** Stripe (Checkout Sessions, Webhooks), `@react-pdf/renderer` & `jsPDF`.
- **Hosting & Infrastructure:** Firebase Hosting (`hotel-booking-admin.web.app`), Firebase Emulators.
