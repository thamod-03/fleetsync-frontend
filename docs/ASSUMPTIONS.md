# FleetSync foundation assumptions

## Scope and sources

This phase establishes shared local frontend infrastructure only. Login is a demo persona selector; registration, recovery, reset and staff application are explicitly labeled placeholders. Role dashboards contain dataset counts and demo controls, not final feature screens. No backend, payment processor, email, push delivery, driver/mechanic mobile UI, or Fleet Owner interface is implemented.

The finalized EER, class and use case diagrams were not supplied in the repository. Models in `src/types/domain.ts` are provisional frontend contracts, not proposed database tables. They use stable string IDs and minimal display/relationship fields. Status sets for orders, quotations and payments, LKR currency, and boolean resource availability are temporary demo representations to refine with those diagrams. Staff applications, invoices and maintenance models are deferred until their approved contracts are available; no corresponding feature is implemented here.

## Figma inspection (read-only, 20 October 2026)

Reference: https://www.figma.com/design/kVIYQZ1EidykzANXtuGpJx/UI-design

Inspected metadata for Page 1 (`0:1`) and the design system (`15:14`), plus design context for foundations (`15:68`) and the Coordinator shell (`30:158`). No Figma content was modified.

- Typography: Inter for interface text; JetBrains Mono for identifiers. Page title 28/36 bold, section title 20/28 semibold, body 14/22, labels 13/20, captions 12/16.
- Neutral canvas #F4F5F7, surface #FFFFFF, border #E3E6EB, text #111827, muted text #6B7280.
- Interaction accent #4F46E5 with #E0E7FF soft background. Status pairs: pending #B45309/#FEF3C7, info #1D4ED8/#DBEAFE, success #15803D/#DCFCE7, danger #B91C1C/#FEE2E2.
- Desktop role variants use a 248px sidebar, a 64px top bar, avatar/name/role, 28px content inset, and rounded bordered cards. Coordinator navigation includes Dashboard, Submitted orders, Trips, Availability, Chat, Mail, Reports and Notifications.

Per this task's neutral foundation scope, existing Nova token values and installed Geist font remain intact. Sidebar/header dimensions and reusable structure follow the inspected shell. Figma typography, colors, logo asset, search and notification controls are deferred to specific screen implementation; nonfunctional search/bell controls and links to unimplemented screens are intentionally absent. Mobile navigation expands inline rather than introducing an unapproved drawer design. This is not a claim of final visual fidelity.

## Domain and trip rules

- A customer is a person profile referencing one user and one separate customer company. Each user has exactly one role. Driver and mechanic users have resource profiles but cannot sign into this web demo.
- Trip statuses are exactly Draft, Assigned, In Progress, Completed and Cancelled. Completion data is required by the Completed schema: actual return date and nonnegative final odometer. No lifecycle transition service is exposed in this phase.
- The assignment service requires an existing order plus an available vehicle, driver and mechanic. It checks availability after simulated latency and commits all resource reservations, the trip and audit entry synchronously. Its initial state is Assigned. Draft/Assigned/In Progress records reserve resources for the whole demo; date-based scheduling has not been approved.
- Cancellation from In Progress versus Draft/Assigned remains unresolved. Cancellation, release, completion and reassignment services/UI are deliberately deferred. There is no temporary cancellation policy silently encoded here.
- Whether multiple trips per order are allowed, and quote/payment prerequisites for assignment, remain unresolved. The service does not add these restrictions. Only resource double booking is prohibited. Seed data includes a fully assigned trip and a second submitted order; no trip is represented as completed without completion data.

## Persistence, services and security

- One versioned snapshot (`fleetsync-demo-v1`) stores the canonical fictional dataset and demo session in this browser profile. Empty storage seeds data. Malformed JSON, unsupported versions, invalid shapes, broken references or conflicting assignments restore the seed and show a notice. Invalid/non-web session IDs clear only the session.
- Blocked/full localStorage falls back to in-memory operation with a visible notice. Reset replaces the fictional dataset and preserves a valid current persona. Logout clears only the session. Switching personas never replaces records.
- Promise-based services return expected failures as typed results. The assignment service is foundation infrastructure with no feature UI yet. Future feature modules should add shared service operations rather than writing storage or copying datasets locally.
- This is single-page/same-profile demo state. Separate browser tabs are not coordinated; no cross-machine or multi-user synchronization is claimed. Refresh reloads the last successfully saved snapshot.
- Frontend route guards and service checks are demo behavior, not security. Data includes no credentials or payment card details. All identities and transactions are fictional. `.example` email addresses are reserved examples. Simulated payments and messages are labeled explicitly.

## Verification and remaining work

Run `npm run build`, `npm run lint`, and `npm test`. Tests use the existing Node 22 type-stripping support (experimental on the installed Node version), injected memory storage, and Vite server rendering. They exercise storage reload/recovery, reset/logout, persona handoff, role redirects, route registration, shared markup, assignment contention and required completion data.

No browser surface is available to the current automation session (browser inventory empty; opening the in-app browser reports unavailable), so interactive browser, mobile viewport and keyboard checks remain manual. See README for the checklist. The existing Vite `__dirname` configuration warning is retained to preserve configuration; production build also reports a >500 kB bundle warning. Neither blocks compilation.
