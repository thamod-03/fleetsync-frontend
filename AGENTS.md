# AGENTS.md — FleetSync Frontend Demonstration

## 1. Mission

Build and refine the **FleetSync / Fleet Management System** frontend as a runnable, coherent **React + TypeScript demonstration** based on the team's approved Figma screens and finalized system diagrams. Optimize for a reliable, convincing demonstration with connected workflows—not for a production backend.

**Current implementation scope:**
- Authentication: login, recovery/reset, customer registration, staff application.
- Fleet Administrator web interface.
- Customer web interface.
- Operational Coordinator web interface.

**Not in this development phase:** Driver mobile app, Mechanic mobile app, Fleet Owner interface, production authentication, backend APIs, server/database deployment, real payments, real emails, real push notifications, and multi-user real-time synchronization. Driver and mechanic records may still appear in mock data and trip assignments.

## 2. Sources of truth and conflicting requirements

1. **Functional scope, roles, and data relationships:** the team's finalized Use Case, EER, and Class diagrams, plus approved project requirements when provided in the repository or task context.
2. **Visual design:** the matching Figma frame or exported screenshot for each requested screen.
3. **Technical implementation:** this repository's existing code, package versions, shared types, and established architecture.

Do not invent undocumented business rules. When a diagram, Figma screen, and code disagree:
- Preserve the approved visual design where practical.
- Do **not** silently change business rules or shared data contracts.
- Record the discrepancy and temporary demo assumption in `docs/ASSUMPTIONS.md` (create if needed).
- Ask for a decision if a conflict blocks a correct or safe implementation. Otherwise use a clearly identified temporary demo behavior.

Known decisions and unresolved items:
- **Create Trip requires a vehicle, a driver, and a mechanic.** Validate all three before committing the assignment.
- The standard trip lifecycle is `Draft -> Assigned -> In Progress -> Completed`, with a `Cancelled` state; do not invent additional transitions.
- **Trip cancellation eligibility is unresolved across the diagrams/designs:** some material allows cancellation from `In Progress`, while the Figma screen says `Draft`/`Assigned` only. Do not silently choose or broaden a rule. Document the temporary choice and keep UI/mock validation consistent until the team confirms it.
- Require actual return date and final odometer before completing a trip; do not display a trip as legitimately completed while required completion data is missing.
- Vehicle/driver/mechanic release rules after cancellation and the exact reassignment policy need confirmation. Label any interim handling as demo behavior.
- A customer account represents a **person** linked to a **customer company**; do not conflate the two. Preserve mutually exclusive user-role specialization where represented in the approved EER.

## 3. Figma is STRICTLY READ-ONLY

Figma is a reference for **reading** design information only:
- Allowed: inspect frames, screenshots, spacing, typography, colors, component properties, design assets, and read-only metadata through Figma MCP; use exported PNG/SVG references provided by the team.
- **Never** create, edit, delete, move, rename, reorder, or publish Figma frames, pages, components, variables, styles, comments, or other Figma content.
- **Never** write implementation changes back to Figma, use Figma editing MCP tools, or use browser/computer-use automation to modify Figma.
- Do not request expanded Figma write permissions. If access is unavailable, request an exported screenshot or a frame-specific read link.
- Make all requested interface changes in local React/TypeScript code **only**; report discrepancies instead of editing the design.

The Figma MCP read-tool allowlist should also be enforced in the user's Codex `config.toml`. **These instructions are not a replacement for permissions:** computer-use/browser tools may operate independently of MCP, so the no-edit rule applies to them too.

## 4. Technology and dependencies

- React, TypeScript, Vite.
- Tailwind CSS **v4** using `@tailwindcss/vite` and `@import "tailwindcss"`.
- shadcn/ui with **Base UI + Nova** as the starting component system; customize to match Figma instead of imposing Nova defaults.
- React Router for web navigation; Zustand or the repository's established shared-state approach for mock state.
- Lucide React icons; React Hook Form + Zod + the **already compatible installed** `@hookform/resolvers` version for forms.
- Recharts for charts and TanStack Table where genuinely needed.

Inspect `package.json`, installed versions, and existing configuration **before** changing dependencies. Do not recreate the Vite project, switch UI libraries, install a second router/state framework, downgrade Zod, or upgrade major versions without explicit approval. Never use `npm install --force` or `--legacy-peer-deps` as a default way to bypass conflicts. Prefer the current working dependency tree.

Keep TypeScript strict. Avoid `any`, suppressed errors, giant components, inline duplicate mock datasets, and extra packages for simple tasks.

## 5. Project architecture

Prefer and reuse existing folders; if not established, organize as:

```text
src/
  app/                 # app providers and setup (if needed)
  components/
    layout/            # shared shells, sidebar, topbar, page headings
    ui/                # shadcn wrappers and reusable primitives
  features/
    auth/
    admin/
    customer/
    coordinator/
  routes/              # route definitions and demo role guards
  data/                # typed seed data, mock repositories/services
  store/               # shared Zustand store if used
  types/               # shared domain types
  lib/                 # shared utilities
  hooks/
docs/
  ASSUMPTIONS.md
```

Reuse a single `AppShell`, `Sidebar`, `Topbar`, navigation definitions, statuses, tables, dialogs, form fields, loading states, and feedback components. Group routes by role and keep the sidebar focused on primary navigation; use contextual tabs, actions, and dialogs for secondary tasks.

Suggested route groupings (adapt to an existing router rather than duplicating it):
- Public: `/login`, `/forgot-password`, `/reset-password`, `/register/customer`, `/apply/staff`.
- Admin: `/admin/*` — dashboard, users, applications, change approvals, vehicles, service types, audit, mail.
- Customer: `/customer/*` — dashboard, orders/new, orders/details, quotations, payments, chat.
- Coordinator: `/coordinator/*` — dashboard, submitted orders/review, trips/create/details, availability, reports, chat, mail.
- Common: access-denied, not-found, account/profile as required by Figma.

## 6. Mock data and demo behavior

Use **one canonical, typed mock data source** and shared mock service functions. Do not keep conflicting copies of an order/trip/user inside individual screens.

Include realistic but **fictional** and consistent related records for the necessary domain concepts: users/roles, customer companies, staff applications, vehicles, drivers, mechanics, transport orders, quotations, trips/assignments, payments/invoices, maintenance records, chat, notifications, and audit events. Align fields and relationships with the supplied finalized diagrams. Use stable IDs; keep list pages, details, dashboards, and counts consistent.

- Expose Promise-based services so the mocks can eventually be replaced by API calls. Small simulated delays are acceptable; provide loading and failure states.
- Persist changes to browser `localStorage` (or the repository's established persistence mechanism) and include a **Reset Demo Data** action.
- Provide clearly labeled demo accounts/persona switching for Admin, Customer, and Coordinator. Demo authentication and frontend route guards are **not security controls**.
- A customer-created order must appear in Coordinator's submitted orders; a Coordinator-created quotation must appear to the customer; accepted quote/payment status must update across roles.
- A newly created trip must reference one available vehicle, driver, and mechanic. Recheck availability at commit time; prevent duplicate assignment within the mock repository; update affected list/detail/availability screens together.
- Notifications, email, chat delivery, file exports, and payments are **simulations**. Never suggest an actual payment was charged or a real email/push message was sent. Clearly label demo-mode actions.
- No real passwords, payment cards, identity documents, private personal data, live API credentials, or secrets in mock data or committed files.
- Local browser storage does not synchronize across machines. Demo handoffs should occur by switching roles in the **same browser profile**, or by resetting/reseeding data.

## 7. Workflow priorities

Implement the main cross-role demonstration before polishing every secondary screen:

1. Log in as a demo Customer; create a transport order (route, cargo, review/submit).
2. Log in as Coordinator; review that order and prepare/save a fare quotation.
3. Return as Customer; accept/decline the quotation and simulate a payment response where applicable.
4. Return as Coordinator; create a trip with **vehicle + driver + mechanic**, validate availability, and show its status and simulated notices.
5. Use the Admin interface to inspect related users, staff applications, vehicles, and audit information.
6. Demonstrate trip viewing/management, reports, and chat/mail simulation.

Screen coverage expected for the four modules:
- **Authentication:** login and error, forgot/reset password, customer registration, staff application.
- **Admin:** dashboard, users and profiles, role/status management, applications and approval, vehicle/reference data, audit history, mail.
- **Customer:** dashboard, multi-step new order, orders/details, quotation decision, simulated payment and history, chat.
- **Coordinator:** dashboard, submitted orders/review, trip creation/confirmation, trips/details/cancellation/availability, reports, chat/mail.

Match the requested Figma frame faithfully. Treat dialogs, wizard steps, error states, and success states as states within a page when appropriate—not automatically as separate URLs.

## 8. UI fidelity, responsiveness, and accessibility

Before coding a screen, inspect its **specific Figma frame** with read-only tools. If inaccessible, ask for a PNG/SVG reference instead of guessing. Reproduce actual UI components—**never place a full screenshot as the page UI**.

- Use Figma design tokens, colors, font sizes, spacing, widths, icons, and density where visible.
- Favor a clean 1440px desktop layout matching the supplied web frames, plus usable tablet and mobile-web fallbacks. Driver and mechanic are separate mobile apps and should not be developed here.
- At smaller widths, adapt sidebar/navigation and cards; allow wide tables to scroll inside their region, not the whole document.
- Use semantic HTML, accessible labels, keyboard-operable menus/dialogs, visible focus indicators, sensible contrast, and validated form feedback.
- All buttons, menus, form actions, tabs, modal controls, pagination, and links must do something meaningful or be visibly disabled. Do not leave unexplained placeholder clicks.
- Show loading, empty, validation, success, and error states where relevant.
- Sample dates, names, totals, statuses, and currencies must be internally consistent; avoid hardcoded misleading “live” indicators.

## 9. Team boundaries and safe editing

One integration lead owns **shared** routing, theme/tokens, global layouts, shared components, domain types, mock services/store, and package configuration. Other contributors primarily own their feature module under `src/features/auth`, `admin`, `customer`, or `coordinator`.

- Check `git status`, existing routes/components, and related files before editing.
- Keep each change focused on the requested Figma screen/workflow.
- Do not overwrite another teammate's changes, remove unrelated code, or reformat the whole repository.
- If shared interfaces need a change, explain the needed contract and coordinate with the integration lead rather than silently breaking other feature modules.
- Do not run destructive git commands, push branches, deploy, alter external accounts, or delete files without explicit instruction.
- Do not install dependencies or introduce major architectural changes unless necessary and justified.

## 10. Required Codex workflow for every task

1. Read this `AGENTS.md`, inspect the relevant code, and identify the exact frame/screenshot for the task.
2. State a brief implementation plan and the files expected to change.
3. Implement the smallest complete and functional feature using shared components and mock services.
4. Review edge cases, empty/error states, role guard behavior, and responsive layout.
5. Run available verification commands (typically `npm run build` and `npm run lint`; run existing tests if present). Fix errors caused by the change. Do not claim a command passed unless it was executed successfully.
6. Summarize changed files, functional behavior, assumptions, unresolved issues, and how the user can test it manually.

**Definition of done:** The requested screen closely follows Figma; routes and interactions work; cross-role records remain consistent; responsive fallback is usable; no blocking console/TypeScript errors; build passes; and all deviations are disclosed.

## 11. Explicit guardrails

- **Do not edit Figma.** All design changes happen in code.
- **Do not implement a real backend or external integrations** for this demonstration without explicit approval.
- **Do not invent or silently change business rules.** Maintain `docs/ASSUMPTIONS.md` for unresolved decisions.
- **Do not claim simulations are real transactions or deliveries.**
- **Do not implement Driver/Mechanic mobile apps or Fleet Owner features** as part of this four-module sprint.
- **Do not use `--force` / `--legacy-peer-deps` to hide npm conflicts.**
- **Do not sacrifice a runnable build** for visual polish.
