# FleetSync frontend foundation

React + TypeScript + Vite university demonstration. Authentication, payments and message delivery are simulations. No production backend or security is provided.

## Run and verify

```sh
npm install
npm run dev
npm run build
npm run lint
npm test
```

Use the existing dependency tree and lockfile. Tests require Node 22 with experimental type stripping support or a newer compatible Node version; no test dependencies are installed.

## Source structure

```text
src/
  components/
    layout/        AuthLayout, AppShell, Sidebar, Header, PageContainer, DemoDashboard
    ui/            Base UI Button, button variants, loading/empty/error states
  features/
    auth/          Demo persona login and reserved auth pages
    admin/         Placeholder dashboard
    customer/      Placeholder dashboard
    coordinator/   Placeholder dashboard
  routes/          Route definitions, role guards, navigation, system pages
  types/           Zod schemas and inferred shared domain types
  data/            Canonical fictional seed and Promise-based mock services
  store/           Shared Zustand store
  hooks/           Reactive session and storage notice hooks
  lib/             Validated storage adapter and class-name utility
  App.tsx          Browser router provider
  main.tsx         React root
  index.css        Existing Nova tokens and global base styles
  assets/          Retained, unused starter assets
  App.css          Inactive compatibility file; no starter styles
  ...
docs/ASSUMPTIONS.md
tests/             Foundation behavior and route/render checks
```

## Routes and personas

`/login` provides fictional Administrator, Customer and Operational Coordinator personas, without passwords. `/register`, `/register/customer`, `/forgot-password`, `/reset-password`, and `/apply/staff` are explicit placeholders for future Figma work. `/admin`, `/customer`, and `/coordinator` have guarded dashboards. Unknown addresses show a not-found page; wrong-role access goes to `/unauthorized` (also available as `/access-denied`). Anonymous requests return to login with an internal return destination.

The account dropdown switches personas or logs out. Shared records and the demo session persist in this browser profile under `fleetsync-demo-v1`. Logout preserves records. Reset Demo Data restores the original fictional dataset while retaining the current persona. Unavailable storage produces a notice and falls back to memory. Invalid saved data is replaced by validated seed data.

## Integration contract

- Domain schemas/types live in `src/types/domain.ts`; refine them against the finalized diagrams before feature work.
- Read reactive values using the shared Zustand store and hooks. Send mutations through `mockServices`; never manipulate localStorage from components.
- `createMockServices(store, delayMs)` and `createDemoStore(storage)` allow deterministic isolated checks.
- Services currently expose signIn, logout, resetDemoData, getDashboard, getAvailability, and createTrip. The trip service requires all three available resources and reserves them together after rechecking availability. No trip feature screen is implemented yet.
- Seed/customer dashboard relationships use a person profile linked to a company, not a company as the logged-in user.
- Only implemented pages belong in active sidebar navigation. Add feature routes and items together.
- Keep Figma read-only. Token observations, provisional rules and deferred scope are recorded in docs/ASSUMPTIONS.md.

## Manual browser checklist

1. Open `/admin` while logged out: login appears with a return destination.
2. Choose Administrator: `/admin` opens. Use the account dropdown to switch to Customer and Coordinator; each role lands on its own dashboard.
3. While Customer is active, navigate to `/admin`: access denied appears; return to your dashboard.
4. Refresh: the same persona and saved records return. Log out and log in again: records remain.
5. Click Reset Demo Data: success feedback appears and original counts return. The automated test also verifies reset after an actual service mutation.
6. Visit registration/recovery links and unknown URLs; each has a useful return action.
7. At phone width, toggle navigation and ensure content fits. Use Tab, Enter, Escape and arrow keys to check account-menu access and focus.

## Next stage

Inspect the exact authentication frames through Figma read-only tools, then implement login/recovery/registration forms using the installed React Hook Form, Zod and compatible resolvers. Preserve demo-only behavior and refine shared contracts with the finalized diagrams before expanding the Customer-to-Coordinator order workflow.
