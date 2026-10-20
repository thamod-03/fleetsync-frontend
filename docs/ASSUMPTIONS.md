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
