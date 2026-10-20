# FleetSync frontend

FleetSync is the frontend of the final Fleet Management System, developed incrementally from the approved Figma screens and system diagrams. React 19, TypeScript, Vite, Tailwind v4, shadcn Base UI/Nova, React Router and Zustand remain the established stack.

The backend is not implemented yet. Local development uses typed mock services and a persistent fictional dataset; these are implementation adapters, not product UI content. Production builds intentionally do not authenticate users until a server-backed adapter is connected.

## Run and verify

```sh
npm install
npm run dev
npm run build
npm run lint
npm test
```

Use the existing dependency tree and lockfile. Tests use Node 22 type stripping (experimental on the installed version), Vite server rendering and artifact inspection. No additional packages are required.

`npm run dev` enables the local mock adapter. `npm run preview` serves the production bundle, which has no mock authentication, fixture credentials or developer utilities and reports unavailable services rather than granting access.

## Authentication routes

- `/login`: credentials, role redirects and Figma error state.
- `/forgot-password`: email validation, recovery request and 45-second resend cooldown.
- `/reset-password`: password-strength and confirmation validation.
- `/register` and `/register/customer`: company/contact registration.
- `/apply/staff`: staff application and document selection.
- `/admin`, `/customer`, `/coordinator`: existing guarded workspace routes.

The standard authentication pages follow the approved Figma copy and contain no university disclaimers, fixture account panels or persona controls. File/drop controls retain the approved appearance. Service outcomes are truthful: unavailable email/reset integrations do not claim to send email or change a password. Terms of service content is not yet connected.

## Development-only utilities

With `npm run dev`, navigate directly to `/__development`. The page contains persona switching, fixture credentials, Reset Demo Data, synthetic attachment downloads, and a link to exercise the local reset flow. These controls are isolated from Login and the account menu.

| Local persona | Email | Fixture password |
| --- | --- | --- |
| Fleet Administrator | alex@fleetsync.example | FleetSyncDemo1! |
| Customer | maya@harbor.example | FleetSyncDemo1! |
| Operational Coordinator | ravi@fleetsync.example | FleetSyncDemo1! |

Use synthetic information and test files only during local development. Do not use real credentials, payment information or identity documents.

The utilities and adapter require both `import.meta.env.DEV` and a compile-time flag defined by Vite only for the serve command. Every build command defines that flag as false, including builds run with development mode or `NODE_ENV=development`. No query parameter, localStorage value or environment-mode name enables them in a built application. Tests inspect production chunks and included module paths to enforce this boundary.

## Service and persistence boundaries

```text
features/auth/          Presentation components and reusable form validation
services/contracts.ts   Typed application service and session adapter contracts
services/application-services.ts
                        Presentation-facing facade and session subscriptions
services/unavailable-adapter.ts
                        Fail-closed production default; replace with backend integration
development/            Isolated local adapter and tools route
data/                   Existing mock factories, seeds and development fixture metadata
store/ and lib/         Existing Zustand store and validated persistence
```

Components call `applicationServices`; they do not import mock factories, fixture credentials or localStorage. Existing hooks subscribe through the active service adapter. Startup initializes the adapter before rendering so saved local sessions retain the existing redirect behavior. Production does not import the seed/store and never trusts a localStorage session.

Development retains `fleetsync-demo-v1` and backward-compatible snapshot loading. Customer registrations create separate linked Pending user/customer/company records. Staff applications remain independent Pending submissions; no automatic approval rule is added. Pending users cannot log in. Admin can read submissions through the existing `mockServices.getPendingApplications()` for future approval UI work. Logout and persona switching retain records; Reset Demo Data restores seed data.

Passwords are validated in memory and never persisted. Local credential login still uses the public fixture password above. Keep me signed in retains the existing simplified local behavior: checked persists the session, unchecked clears it on page reload. This is not a production session mechanism.

Document selection validates file extensions/MIME types and the 5 MB limit. The development adapter receives only filename, type and size, never File/Blob contents. It does not call FileReader, text(), arrayBuffer(), or upload anything. Only attachment metadata is persisted. The temporary adapter identifies driving-licence entries from their filename; use the synthetic downloads on the utility page. A future backend must replace that classification with an explicit verified document contract and secure storage.

## Manual checks

1. With `npm run dev`, open Login: no developer panel or branding disclaimer appears. Check validation, wrong credentials, lockout, valid role redirects and both remember-session choices.
2. Use `/__development` to switch personas. Confirm Customer cannot access `/admin`, and sign-out preserves the dataset.
3. Request recovery: the integration-unavailable response must say no email was sent. Resend counts down. Use the utility page's reset link, check strength/matching, then verify no password change is claimed.
4. Register synthetic company/contact details. The pending record survives refresh; duplicate emails are rejected and pending accounts cannot log in. Passwords are absent from saved records.
5. Select Driver, browse/drop synthetic NIC and driving-licence files, remove entries, test size/type errors, then submit. Change roles and verify conditional document validation and pending persistence. The public application route has no invented invitation ID or expiry; an actual invitation context renders the original Figma banner.
6. Compare 1440px desktop composition to Figma; check 768px/375px layouts, focus, keyboard operation and error announcements. This tool session has no browser surface, so interactive visual checks remain manual.
7. Build and preview. `/__development` must resolve to not-found; fixture credentials and forged localStorage sessions must not grant access. Authentication must report service unavailability until backend integration is supplied.

## Before production deployment

The artifact builds successfully but is not a deployed authentication system. Implement a server-backed adapter with server-side authentication/authorization, secure password hashing and session management, recovery-token generation/delivery/expiry, password history and session revocation, approval workflows, published terms/consent, and secure document storage/validation. Replace localStorage business persistence with authenticated APIs. Frontend role guards and mock lockout are not security controls.

Unresolved business policies and Figma differences are recorded in `docs/ASSUMPTIONS.md`. No external services, backend, Git commit, push or deployment are added by this task.
## Coordinator Batch 01

Implemented routes:

- `/coordinator`: Operational dashboard.
- `/coordinator/orders`: Submitted orders, tabs, search, pickup/payment filters, pagination and CSV export.
- `/coordinator/orders/:orderId`: Order review and fare estimation, draft persistence, publication and action feedback.

The read-only Figma references are `121:3930`, `122:4080` and `123:4232`. Review and fare estimation share a frame; no separate quotation confirmation frame was supplied. Related dashboard shortcuts and sidebar navigation now open these routes. Other Coordinator screens remain outside Batch 01.

`ApplicationServices` exposes typed order/overview queries and `saveQuotation`. The development adapter stores a quotation breakdown, vehicle type, validity and optional message in the canonical Zustand/localStorage dataset. Saving a draft keeps the order Submitted and hides the draft from Customer queries. Publishing changes the order to Quoted, persists a Pending quotation and adds a local customer notification and audit event. The notification adapter reports emailDelivered=false; the action response explicitly says no email was sent. Future Customer screens can read published quotations through ownership-scoped `getOrder`.

For a local check, choose Operational Coordinator at `/__development`, open Submitted orders, and prepare a quote for `order-002`. Select a vehicle type, enter charges and a future validity time, then Save draft. Refresh and reopen the order; the draft should remain. Send quotation and verify the order moves to Quoted and the displayed confirmation does not claim email delivery. Existing Authentication and production fail-closed behavior are unchanged.

`npm test` covers retrieval/ownership, filtering, fare validation, draft/publication persistence, duplicate/concurrent operations, notifications, reload/reset, role guards and server-rendered page markup. Rendered 1440px comparison, keyboard/mobile operation and native CSV download remain manual checks. See `docs/ASSUMPTIONS.md` for provisional business rules, legacy-data behavior, unavailable maintenance data and remaining visual differences.

## Coordinator Batch 02A — Trip Assignment

New routes follow these read-only Figma frames:

| Screen | Node | Route |
| --- | --- | --- |
| Availability | 141:4873 | /coordinator/availability |
| Create trip | 124:4326 | /coordinator/trips/create?orderId=order-002 |
| Trip assigned | 130:4437 | /coordinator/trips/:tripId/assigned |

Availability shows the shared vehicle schedule, resource counts, capacity/status filters and staff cards. Create trip selects a shared order and requires vehicle, driver and mechanic, with a start/return window and assignment summary. Saving rechecks resources and active-order assignments after latency, then commits the Assigned trip, all three reservations, audit entry and local staff notifications together. Confirmation supports refresh and requeuing local notices. Existing assignment links reopen this confirmation, not a new Trip Details feature.

The existing conservative reservation rule remains: an active trip reserves its resources until a future approved release operation. Time controls shade the schedule but do not release active reservations for a different date. Payment prerequisites, lifetime order/trip uniqueness, capacity/licence eligibility and date-aware reuse still require confirmation. No new payment or automatic licence/capacity gate is imposed. Full Trips, Trip Details, cancellation and reports are not implemented.

Local check: select Coordinator at `/__development`, open Create trip, choose `order-002`, confirm its window, select the available vehicle/driver/mechanic, then Assign & create trip. Refresh the confirmation and open Availability to see the reservations. Reset Demo Data restores the original availability. For an older persisted dataset, enter missing trip times or reset explicitly to load enriched optional fixture metadata.

Assignment notices are queued locally; no actual push notification or email is delivered. Production remains fail-closed and excludes the local trip services and fixture utilities. Tests cover assignment validation, conflicts, duplicates/concurrency, relationships, persistence/reset, query access, truthful notification status, routes and rendered forms, alongside Authentication and quotation regression tests. Browser visual and keyboard/mobile checks remain manual.
