# NailFlow

Booking and management platform for nail studios. Clients book online and pay a
deposit; the salon manages services, staff, appointments and its own branding
from an admin panel.

One deployment serves one salon, addressed by its own domain. The API resolves
which salon a request belongs to from the host it arrived on.

---

## Repository layout

```
apps/
  api/          Express + PostgreSQL REST API
    src/
      config/     Validated environment configuration
      db/         Connection pool and schema bootstrap
      middleware/ Tenant resolution, auth, validation, error handling
      routes/     One module per resource
      services/   Business logic: availability, bookings, payments
      jobs/       Scheduled cleanup
  web/          Next.js App Router frontend (booking flow + admin panel)
    src/
      app/        Routes
      components/ Booking wizard, admin widgets, UI primitives
      lib/        API client, domain helpers, design tokens
packages/
  shared/       Types and pure logic used by both apps
Docs/           Product and integration specifications
```

`packages/shared` holds the API contract. Both apps compile against it, so a
change to a payload shape becomes a type error rather than a runtime surprise.

---

## Getting started

Requires Node 20+ and a PostgreSQL database.

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Fill in both files (see [Configuration](#configuration)), then:

```bash
npm run dev
```

The API listens on `http://localhost:3001` and the web app on
`http://localhost:3000`.

On first boot the API creates its tables. Open `http://localhost:3000/signup` to
create the owner account — the first sign-up claims the salon on that domain and
becomes its first staff member.

### Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the API and the web app together |
| `npm run build` | Builds `shared`, then the API, then the web app |
| `npm run typecheck` | Typechecks every workspace |
| `npm run lint` | Lints every workspace |

---

## Configuration

Every value lives in `.env`; nothing is hardcoded. `apps/api/.env.example` and
`apps/web/.env.example` document each one.

The essentials:

**API** — `DATABASE_URL`, `CORS_ORIGINS` (the web app's origin; wildcards are
rejected), and Firebase Admin credentials via either `FIREBASE_SERVICE_ACCOUNT`
(the JSON on one line) or `GOOGLE_APPLICATION_CREDENTIALS` (a file path).

**Web** — `NEXT_PUBLIC_API_URL` and the `NEXT_PUBLIC_FIREBASE_*` values. These
are read at build time, so a Docker build needs them as build arguments.

Optional integrations turn themselves off when unset: leave `MP_ACCESS_TOKEN`
empty to run without online payments, `N8N_WEBHOOK_URL` empty to run without
WhatsApp automation.

### Business rules worth knowing

| Setting | Default | Effect |
| --- | --- | --- |
| `BOOKING_MIN_ADVANCE_DAYS` | `7` | Earliest a client may book (spec §4) |
| `BOOKING_SLOT_INTERVAL_MINUTES` | `30` | Spacing of the offered start times |
| `BOOKING_SLOT_HOLD_MINUTES` | `10` | How long a chosen slot stays reserved during checkout |
| `REFERENCE_IMAGE_RETENTION_DAYS` | `14` | When client reference photos are purged (spec §10) |
| `ALLOW_TEST_BOOKINGS` | off in production | Enables `POST /api/bookings/test`, which confirms without payment |

---

## How it fits together

**Tenant resolution.** Every `/api` route below the tenant middleware is scoped
to the salon that owns the request's host. Callers cannot select a salon by id
or query parameter.

**Authorisation.** A verified Firebase token proves *who* someone is;
`requireTenantAccess` then checks they own — or are active staff at — the salon
the request resolved to. Both checks are required for anything that reads client
data or writes salon data.

**Money.** The browser sends which services were chosen; the API reads their
price and duration from its own rows and computes the total. Appointments store
the price charged at the time, so changing a service's price later never rewrites
past revenue.

**Payments.** A booking that requires a deposit is created as `pending_payment`
and only the Mercado Pago webhook — signature-verified, then re-read from the
Mercado Pago API — may promote it to `confirmed`.

**Images.** CDN keys stay on the server. Uploads go through `/proxy/upload` in
the web app; reads go through `/api/img/:slug/*` in the API, which validates the
path and never exposes the key to the browser.

**Theming.** A salon picks a palette in *Perfil → Apariencia*. Palettes set
semantic CSS variables (`--surface`, `--brand-primary`, `--text-muted`), so the
booking flow and the admin panel re-theme together.

---

## Deployment

Both apps ship as Docker images (`apps/api/Dockerfile`, `apps/web/Dockerfile`)
and are deployed with Dokploy. Each exposes a health check the platform can poll:
`GET /health` on the API, `GET /` on the web app.

The web image needs the `NEXT_PUBLIC_*` values as build arguments, because
Next.js inlines them into the client bundle at build time.

---

## Specifications

- [`Docs/nailflow_technical_specification.md`](Docs/nailflow_technical_specification.md) — system spec
- [`Docs/cdn_integration_guide.md`](Docs/cdn_integration_guide.md) — image storage
- [`Docs/prompt_fidelizacion_ui.md`](Docs/prompt_fidelizacion_ui.md) — loyalty programme
