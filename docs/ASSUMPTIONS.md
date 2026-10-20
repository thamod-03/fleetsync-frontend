# FleetSync implementation assumptions

## Product intent and current integration status

FleetSync is intended to become the final production application. Mock services and fictional data are temporary implementation mechanisms. They must not alter approved product wording or introduce university-demo banners, canned credentials or fixture controls into normal screens.

Authentication, registration and staff application presentation follow Figma. The backend, email delivery, real password changes, published terms, secure document uploads, server sessions and approval operations are not implemented. Only local development loads the existing mock adapter and localStorage dataset. Production fails closed through an unavailable-service adapter until backend authentication is integrated.

The finalized EER, class and use case diagrams were not supplied in the repository. Shared models remain provisional frontend contracts. Company/contact fields and pending application records are derived from the inspected frames. Existing trip assumptions below remain unchanged; no additional feature screens are implemented.

## Figma inspection: strictly read-only

Reference: https://www.figma.com/design/kVIYQZ1EidykzANXtuGpJx/UI-design

High-fidelity design context and screenshots were inspected again for all six frames in Step 5.1. No Figma content was modified.

| Screen | Node | Local route/state |
| --- | --- | --- |
| Login | 33:438 | /login |
| Login Error | 33:687 | /login after a rejected sign-in |
| Forgot Password | 113:4235 | /forgot-password |
| Set New Password | 113:4333 | /reset-password |
| Customer Registration | 118:3518 | /register and /register/customer |
| Staff Account Application | 118:3655 | /apply/staff |

At 1440px the brand panel occupies 600px. Form widths are 400px for login/recovery/reset and 480px for registration/application. Existing Inter/JetBrains Mono font files, SVG assets, colors, 42px inputs, 40px primary buttons, 42px secondary login buttons, section labels and responsive styles are retained/refined. Global Nova tokens and the dashboard Geist font remain unchanged.

The branding footer disclaimer is removed. Real-time availability and pay-online wording are restored from Figma without claiming that a transaction or delivery has actually occurred. Static sample names, emails, company data, NIC values and application IDs from populated design examples are not hardcoded into presentation components; actual input/context supplies those values.

## Presentation differences that remain intentional

- Recovery uses the exact Figma instruction and button labels. An unconnected adapter returns delivered=false, so the post-action banner states Email delivery unavailable and explicitly says no email was sent. The green Check your email state is reserved for delivered=true from a future integration. No fake 30-minute token expiry is claimed. The 45-second resend cooldown remains functional locally.
- Password reset restores the Figma requirement Not the same as your last password and the other-device sign-out text. No password-history proof is invented in the client: that check remains unconfirmed pending a server response. Local validation covers 8-128 characters, uppercase/lowercase, a number and matching confirmation. The mock compares the fixture password only inside its adapter. Its result updated=false produces Password update unavailable, never a false success or sign-out claim. The reset subtitle uses the recovery email held in memory when available; direct visits do not invent an address.
- The staff frame includes a genuine Administrator-issued invitation banner. StaffApplicationPage accepts reference/expiry context and renders the exact original wording when supplied. The public route has no issued invitation context, so no banner, sample ID or expired sample date is fabricated. Invitation/token authorization and expiry enforcement require a backend.
- Terms of service opens a concise unavailable-content dialog until actual terms are supplied. No new legal terms are invented. The existing checkbox interaction remains required; real consent recording must be integrated before production registration is enabled.
- The normal Login frame says Role-based dashboards for every user while the other frames, including Login Error, say every team member. The shared layout uses the normal Login variant on /login and the other variant on remaining routes; it does not change marketing copy after a rejected login.
- No password-visibility control existed in the inspected frames or current implementation; none was added or removed. Existing password input behavior is retained.
- Mobile frames were not supplied. Existing compact brand/header behavior below 768px and stacked paired fields below 400px remain practical fallbacks, not a claim of separately approved mobile layouts.

## Development-only services and controls

ApplicationServices/ServiceAdapter provide the presentation-facing contract. Components and hooks use the facade/subscriptions, not mock factories, fixture credentials, seed records or localStorage. The existing data/store/persistence implementations remain behind a small development adapter. Startup initializes services before rendering to preserve saved local-session redirects. A future backend adapter can replace the unavailable implementation without changing the forms.

The /__development route contains persona switching, fixture credentials, synthetic attachment downloads, Reset Demo Data and a reset-flow link. It is not linked from Login or the normal account menu. Both the utility route and the entire mock-adapter import require import.meta.env.DEV plus __FLEETSYNC_LOCAL_DEV__. The latter is defined only for the Vite serve command; every build command defines it false, including development mode/NODE_ENV builds. There is no runtime or localStorage opt-in.

Production does not import the development modules, mock auth factory, seed dataset or localStorage store. Its current-user provider always returns null and credential/mutation operations fail with a service-unavailable response. A previously persisted or forged local session cannot enable a role guard in that build. This protects the frontend from shipping the development bypass; it is not a replacement for server authorization.

Local development retains the existing shared fictional accounts, public fixture password FleetSyncDemo1!, five-attempt/15-minute mock lockout, persona switching and logout. Attempt metadata remains in the shared dataset. Expired locks permit a new attempt and Reset Demo Data clears them. These are not production security controls.

## Records, validation and document handling

- Registration preserves separate linked user (Pending), customer-person, company and pending-registration records. Staff applications are independent Pending submissions; they create no users. No approval/activation rule was added. Existing active personas can sign in; pending users cannot. Duplicate account/application emails are rechecked before the synchronous commit.
- Password inputs are validated in memory, then discarded. No plaintext password, password history, reset token, card data or document contents are persisted. Reset does not change credentials in the current mock adapter.
- The NIC field no longer requires a DEMO prefix. With no approved checksum/format rule supplied, validation requires a nonempty identifier with a bounded length. Old DEMO-NIC-* stored submissions remain readable; new standard-format input is accepted. Use synthetic identifiers during development/testing.
- Driver, Mechanic and Operational Coordinator remain the existing role options. Exact office-staff options still require confirmation against the finalized diagrams. NIC document metadata is required for all; Driver additionally requires driving-licence metadata. No mechanic qualification rule is invented.
- Browse and drop retain the Figma upload interface. Native file selection passes only name/type/size to the service. The mock validates PDF/JPG extension and MIME, positive size and a 5 MB maximum; no FileReader, text(), arrayBuffer(), network upload or File/Blob persistence occurs. Only metadata remains in the shared Pending submission, with its existing simulated flag. The current metadata adapter infers driving-licence category from the filename; explicit document categories and content validation require the real upload contract.

## Development persistence limitations

The versioned fleetsync-demo-v1 snapshot remains compatible with older records. Malformed or inconsistent data restores seeds; blocked/full storage falls back to memory with a concise storage notice. Logout and persona switching retain data. Reset restores the original fictional dataset. Keep me signed in retains the simplified local behavior: checked persists the session; unchecked keeps it in the open page only. Cross-tab coordination and cross-machine synchronization are not provided. These mechanisms are loaded only in development.

## Domain and trip rules

- A customer is a person profile referencing one user and one separate customer company. Each user has exactly one role. Driver and mechanic users have resource profiles but cannot sign into this web interface.
- Trip statuses are exactly Draft, Assigned, In Progress, Completed and Cancelled. Completion data is required by the Completed schema: actual return date and nonnegative final odometer. No lifecycle transition service is exposed in this phase.
- The assignment service requires an existing order plus an available vehicle, driver and mechanic. It checks availability after simulated latency and commits all resource reservations, the trip and audit entry synchronously. Its initial state is Assigned. Draft/Assigned/In Progress records reserve resources for the whole demo; date-based scheduling has not been approved.
- Cancellation from In Progress versus Draft/Assigned remains unresolved. Cancellation, release, completion and reassignment services/UI are deliberately deferred. There is no temporary cancellation policy silently encoded here.
- Whether multiple trips per order are allowed, and quote/payment prerequisites for assignment, remain unresolved. The service does not add these restrictions. Only resource double booking is prohibited. Seed data includes a fully assigned trip and a second submitted order; no trip is represented as completed without completion data.


## Production readiness and verification

Server-side authorization, secure password hashing, authenticated APIs/session cookies, password recovery delivery/tokens/history, session revocation, invitation verification, approval policies, published terms/consent, secure document storage and content validation remain required before deployment. Frontend guards, localStorage and mock lockout cannot provide those guarantees. Payment/email/push/chat remain unintegrated; no actual deliveries or charges are performed.

Run npm run build, npm run lint and npm test. Tests cover the existing functional workflows, product-facing form markup, metadata-only file handling, truthful recovery/reset outcomes, pending registration, roles and redirects, and production artifact/module exclusion under both production and development NODE_ENV. A fail-closed adapter test confirms fixture credentials cannot establish a production session.

The current browser inventory is empty, so rendered browser/screenshot comparison, native file-picker interaction and keyboard/mobile checks remain manual. Source layout/copy was compared against all six Figma screenshots. Existing Vite __dirname and large-bundle warnings remain non-blocking. No dependency installation, Git commit or deployment is part of this task.
## Coordinator Batch 01: inspected designs and implementation

Read-only design context and screenshots were inspected for:

| Frame | Node | Route |
| --- | --- | --- |
| Coordinator — Operational dashboard | 121:3930 | /coordinator |
| Coordinator — Submitted orders | 122:4080 | /coordinator/orders |
| Coordinator — Review order / Fare estimation | 123:4232 | /coordinator/orders/:orderId |

The Coordinator tracker (122:4965) was also inspected. Direct links supplied by the team resolved the earlier frame-discovery limitation. No Figma content was modified. Create Trip, Trip assigned, Trips, Trip Details, Cancel Trip, Availability, Reports, Chat and Mail remain outside this implementation batch despite their newly supplied links.

The existing AppShell, Sidebar and Header are reused with Coordinator-scoped Inter/JetBrains Mono typography, colors, a 248px sidebar and a 64px header. The new order table and two-column review/fare layout follow the inspected frames. Loading, empty, error, field-validation and post-action feedback are functional. No clarification action appears in the inspected review frame, so none is invented. Missing transport details display Not provided without introducing new order-eligibility rules.

### Shared contracts and persistence

ApplicationServices exposes getCoordinatorOverview, getSubmittedOrders, getOrder and saveQuotation through the existing facade/adapters. Components do not import mock factories, seed data or localStorage. Shared changes refresh queries through the service revision subscription. Switching order IDs clears the previous query result while fetching the new record, avoiding display of another order under the new URL.

The existing domain contracts gain optional, frame-derived order details (pickup time, delivery instructions, distance, weight, pallet/handling descriptions and customer note), optional customer joinedAt, and optional quotation breakdown/vehicle type/validity/message/creation time. A Draft quotation status is added for the frame's Save draft action. Order and trip status unions remain unchanged. New quotation totals must match their breakdown. Finalized EER/class diagrams are still needed to confirm these provisional frontend fields.

Existing version-1 snapshots remain readable without a reset: all added fields are optional. Existing seed IDs, users, company/customer relationships, orders, assigned resources and accepted quotation remain intact. The current seed company label drops (Demo); order-002 gains fictional transport details and the existing customer gains a fictional joined date. Older persisted records are not overwritten with new seed details and therefore may display Not provided. Use the isolated development Reset Demo Data control if the enriched fixture is desired.

### Temporary fare and order behavior requiring business confirmation

- Charges are manually entered for Distance charge, Load charge, Loading and unloading, Fragile handling, and Tolls and fees. No tariff, distance rate, weight multiplier, tax, automatic price or minimum fare is invented. Amounts are finite, nonnegative and bounded to LKR 1,000,000,000 per component for input safety. The total rounds to two decimal places; zero remains allowed by the pre-existing nonnegative fare model.
- Vehicle choices come from current vehicle descriptions plus the inspected Heavy truck · up to 9 t option. This is a provisional selection catalogue, not a capacity-eligibility or resource-assignment rule. Choosing a type does not reserve a vehicle, driver or mechanic.
- Both Save draft and Send quotation require a vehicle type, valid charges and a valid expiry value. Drafts may retain an expired validity for later editing; publication requires a future time. Validity is chosen by the Coordinator; no default validity period or automatic expiry transition is invented. Dates use the browser's local timezone and are persisted as UTC ISO timestamps.
- One editable Draft per order is supported. Saving updates that draft's ID; sending changes it to Pending and its order to Quoted. The current screen does not overwrite an issued quotation or an Accepted/Declined order. Revisions, withdrawal, multiple issued quotations and re-quoting after a customer decision are unresolved, so those operations are rejected with a clear response. These are conservative temporary editing limits, not approved final quotation policy.
- Runtime service validation and permission/existence/duplicate checks run after simulated latency, then the quotation, order, notification and audit records commit synchronously. Concurrent publication cannot issue two quotations in the current single-browser store. Multi-user/cross-tab concurrency requires a backend.
- Drafts are visible to Coordinators only. Customer getOrder and dashboard quotation counts omit Draft records; published quotations remain accessible only through their owning customer/order relationship. A separate customerId is not duplicated on the quotation because it is derived from its stable orderId.
- Local QuotationNotificationService prepares an in-app notification for the owning user and reports emailDelivered=false. A notification-preparation error prevents the commit. No external email API is called. The original Figma helper text is retained, while post-publication feedback explicitly states the quotation is saved, email delivery is unavailable and no email was sent. A future delivery adapter must report an actual outcome.
- No separate quotation confirmation frame was supplied. A concise accessible status banner handles save/publication feedback on the existing review page; no new confirmation-page design is fabricated.
- Tabs map Needs quotation to Submitted, Quoted to Quoted, Ready for a trip to a successful payment with no non-cancelled trip, and Closed to Declined orders or orders with Completed trips. All open excludes those Closed records. These are presentation groupings only; they do not change trip-creation eligibility, cancellation/reassignment policy or resource validation. Cancelled-trip/order closure behavior still needs confirmation.
- Payment badges derive Paid from an existing Succeeded payment, Payment failed from Failed, Awaiting payment from Accepted without those outcomes, and otherwise Not due yet. Installments/refunds and multiple quote/payment accounting are undefined. No new payment prerequisite is added to the existing trip service.
- Pickup filter options are dates actually present in canonical orders; payment options reflect the inspected badges. Search covers order IDs, companies, customer names, locations and cargo. Header search routes to order search in this batch; trip/vehicle search remains future work. Tabs, filters and pagination are local presentation state; new future customer orders require no separate dataset.
- Export produces a real local CSV of the current filtered results, with quoted/escaped cells and spreadsheet-formula protection. It calls no backend and does not claim an externally delivered report. Pagination appears only when more than eight filtered rows exist; the provided frame shows the first eight without paging controls.

### Remaining visual/data differences and scope boundaries

The current shared record counts and row values are used instead of Figma's static example names/totals. Greetings use the signed-in user and snapshot time. Waiting duration derives from creation time. Driver-start times, shift schedules, late-start thresholds and trip progress percentages are not fabricated.

Dashboard availability uses existing resource reservations. Vehicle descriptions and available mechanic count replace unavailable class/licence breakdowns. Maintenance/service records are absent from the existing shared model, so no fictional maintenance count or alert is displayed; an approved maintenance contract and fixture records remain necessary. Payment summaries cover all recorded orders because payment timestamps are absent, rather than claiming This week. The report panel has no invented generation timestamp. Reports, trip creation/details, availability and Profile shortcuts remain visibly disabled because their feature screens are outside Batch 01. Order review remains available for issued quotations as a read-only summary; a legacy quotation without a breakdown shows Fare breakdown not recorded.

Lucide icons and the existing local brand asset are reused. No full-screen screenshot UI or external runtime asset URLs are introduced. The validity value is an editable datetime control so it can be supplied without inventing an expiry policy; the populated Figma example displays a static value. Unpopulated forms do not copy example monetary amounts, messages or identities into presentation code. Tablet/mobile stacking and horizontal table scrolling are practical fallbacks; separately approved responsive frames were not supplied.

### Verification and manual checks

Focused tests cover submitted-order retrieval/ownership, canonical relationships, draft isolation, detached snapshots, filtering/CSV safety, fare validation, draft updates, publication, original order/customer links, notifications, invalid/duplicate/concurrent operations, notification failure atomicity, reload/reset and shared resource changes. Route/server-rendering tests inspect table/review/form markup, direct routes and Coordinator guards. Existing Authentication tests and production artifact checks remain in place; production excludes Coordinator mocks as well as auth fixtures/utilities and continues to fail closed.

Manual browser checks remain: compare the three screens at 1440px against Figma; check 768px/375px layouts, keyboard focus and validation announcements; exercise filters, paging with more records, native CSV download, draft save/refresh/publish and notification display. Automated service reload tests verify persistence, but no interactive browser checks are claimed. No dependency installation, backend, Authentication feature change, Git commit or deployment is part of this batch.

## Coordinator Batch 02A: assignment rules and design differences

### Read-only references and scope

Design context and screenshots were inspected for Availability (141:4873), Create Trip (124:4326), and Trip Assigned (130:4437), including the annotation confirming mandatory mechanic assignment. The existing Coordinator shell, colors, typography, tables, badges, loading/error/empty states and responsive conventions are reused. No Figma writes occurred. The three new routes are /coordinator/availability, /coordinator/trips/create and /coordinator/trips/:tripId/assigned. The Trips sidebar item currently opens Create Trip; a full Trips list remains deferred. Existing assignment links open the confirmation rather than a full Trip Details screen. Reports/cancellation/reassignment are unchanged and deferred.

### Current eligibility and reservation policy

- The order source is the same non-Draft submitted/history projection used by Batch 01. An order must exist in that projection and have no Draft/Assigned/In Progress trip. The new active-order duplicate guard is a conservative local submission safeguard, including submissions using different resources. Lifetime order/trip uniqueness and behavior after completion/cancellation remain unresolved; no new release or reassignment operation is introduced.
- Payment and quote prerequisites remain unresolved in the existing diagrams/contracts. The form displays the actual payment badge, but no new paid/accepted-quote gate is invented. The fictional submitted order-002 remains usable for exercising assignment. Its order status is preserved; associated Trip records determine Trip created indicators.
- Vehicle, driver AND mechanic must exist and be selectable. Services reject missing or unknown IDs, unavailable flags, vehicles marked inMaintenance, and every resource referenced by an active trip, even if a stale available flag says true. Staff must have an existing non-Pending user. Resources are rechecked after simulated delay and committed synchronously, preventing conflicting submissions in the same store.
- The existing whole-active-trip reservation policy is retained. It blocks overlapping assignments and conservatively also blocks nonoverlapping windows until a release operation exists. Dates/times on Availability control the displayed day and shaded window, not date-based release. A concise availability footer explains that active assignments reserve resources. No date-aware scheduling/reuse rule is silently added.
- Create Trip requires an explicit start and expected return, with return after start. UI values are local times and persist as UTC ISO timestamps. Orders can prefill known pickup/estimated-return times; missing return times are not guessed. The legacy service input still permits both times absent so older callers remain compatible, but rejects partial or reversed windows. No past-date prohibition, travel-duration estimate or overnight scheduling restriction is invented.
- Vehicle capacity, licence and workshop controls are optional user-selected filters over recorded metadata. No automatic weight/licence matching was supported by the existing approved model, and no eligibility matrix is invented in this batch. The summary displays known cargo/capacity values without claiming a suitability check passed. Capacity/licence/service thresholds, shift schedules and route coverage still require approved rules.

These entries supersede the earlier statement that only resource double booking was prevented: a second active trip for an order is now also rejected. Other unresolved trip lifecycle rules remain unchanged.

### Domain, services and backward compatibility

Optional frame-derived metadata is added for vehicle capacity/home base/next-service distance/maintenance flag, driver licence, mechanic speciality/workshop, order estimatedReturnAt, and trip scheduledStart/scheduledEnd/createdAt/createdBy. The initial lifecycle value remains Assigned. Existing IDs and relationships are preserved; new local trip IDs use a collision-checked TRP sequence for legible identification. Backend-issued globally unique IDs will replace local generation when integrated.

Version-1 browser snapshots remain readable because these additions are optional. Stored windows, when present, must be paired and ordered; creator and notification trip references are validated. Older assignments without a time window remain conservatively reserved and appear without fabricated start/end times. Older resource records without metadata show Not recorded or an unknown maintenance total. Existing seed resources gain fictional metadata, and order-002 gains an expected return time. Saved data is not overwritten; Reset Demo Data is an explicit development utility.

The existing createTrip mock operation moves into a focused trip-service factory; its exported input type remains available from the old module. ApplicationServices now exposes getAvailability, getTripAssignmentContext, createTrip, getAssignedTrip and requeueTripNotification through the same adapter boundary. Order projections are extracted for reuse rather than copied between the order and trip factories. Presentation imports no mock store/localStorage. Dashboard and order counts continue to derive from canonical records and refresh through service subscriptions.

Successful creation writes the trip, vehicle/driver/mechanic reservations, an audit event and two local assignment notices as one state change. Notification preparation failure writes nothing. The TripNotificationService interface complements the existing quotation notification boundary without changing quotation behavior. Confirmation access is scoped to Coordinators, the owning Customer, or the assigned Driver/Mechanic for future modules; no mobile interface or mobile-role web login is introduced.

### Truthful communication and Figma differences

The confirmation frame uses Scheduled, but the approved trip lifecycle uses Assigned; the UI displays Assigned. It also shows sent/opened push states and a two-hour unopened reminder. No delivery, device-open or escalation integration exists, so the implementation shows Queued locally and explicitly states that no push was sent. Resend requeues a local record and reports the same unavailable delivery status. No fake Opened state, sent timestamp or dashboard escalation is fabricated. Actual queue timestamps are shown. A legacy assignment without notices shows Not recorded. The driver-notification preview is a static part of the approved web confirmation frame, not a Driver mobile app implementation.

The frame's View trip button remains disabled because full Trip Details is deferred; Back to orders works. The Submitted Orders action for an existing trip is labelled View assignment and opens this batch's confirmation. Create-trip buttons and Availability navigation are enabled. The new generic create entry includes an order selector and editable time fields because the app must select a real order and cannot invent missing trip times; the populated Figma example already has that context. Before saving, Trip ID says Assigned on creation instead of showing a fabricated reserved ID.

Counts, people, vehicle IDs and table rows come from the existing shared fictional records rather than Figma's sample totals. Driver history/trips-this-week and mechanic open-job fields show Not recorded because complete supporting history/job contracts are absent. Maintenance is a recorded vehicle flag, not a fabricated service-booking database; no service dates/durations are invented. Unknown legacy schedules are rendered as reserved without fake times; timed bars use actual stored windows. Responsive stacking/table scrolling are practical fallbacks because separate small-screen frames were not supplied. Lucide icons and the existing local logo are reused.

### Verification boundaries

Automated tests cover successful three-resource assignment, required/unknown resources, each unavailable resource independently, maintenance exclusion, invalid windows/orders, permission checks, active-overlap checks against stale flags, commit-time availability changes, duplicate/concurrent submission, saved order/resource links, local notices, failure atomicity, refresh persistence, legacy snapshots, reset and confirmation access. Existing Authentication/Batch 01 tests remain active. Route/server-rendering tests inspect all three new screens and confirm later-batch routes remain unimplemented. Production artifact checks exclude trip mocks, local notifications and shared seed projections.

Server/cross-tab transactions, actual push/email delivery, delivery/open receipts, date-aware release, cancellation/reassignment and automatic capacity/licence policy cannot be verified as implemented integrations because they are intentionally absent. Manual browser checks remain for 1440px visual comparison, 768px/375px layouts, date/time controls, keyboard/radio navigation, error announcements, selecting all resources, double-click behavior, confirmation refresh, Availability updates and local requeue feedback. No interactive browser verification is claimed.
