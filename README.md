# GitFit Suite

**GitFit** is a unified fitness-management platform: one Supabase-backed
application that gives members a home for booking classes and tracking
progress, gives staff a live studio operations console, and ties it all
together with **Fitbot** — a deterministic-first chat assistant that acts as
the suite's native, persistent interface rather than a bolted-on widget.

Live app: **https://gitfit-pursuit6.vercel.app**

---

## The products

GitFit is one Next.js application, but it ships as four distinct
role-aware modules under a shared design system, navigation shell, and
auth/role model.

### 🏠 Dashboard
The member's home base after signing in — a quick-glance view of weekly
class bookings, a nudge toward the target cadence, and shortcut cards into
the rest of the suite (chat with Fitbot, book a class, jump to the staff
console for staff users).

### 💬 Fitbot
The suite's chat assistant, available as a persistent overlay from anywhere
in the app once signed in (not just a standalone page). Fitbot is
**deterministic-first**: everyday requests — schedule questions, booking
lookups, member questions for staff — are answered by real intent-routed
logic against Supabase data, not by handing every message to an LLM. Rich
in-chat cards render structured results (classes, bookings, member records)
instead of plain text where it matters.

### 📅 Book a Class
The member-facing scheduling module — browse upcoming studio classes by
day, see instructor and capacity at a glance, reserve a spot, and cancel an
existing booking. Bookings are real, per-user rows in Supabase, not a demo
fixture.

### 🛡️ Staff Console
A staff-only operations view (gated by the `staff` role):
- **Live register** — today's classes with fill level, instructor, and a
  currently-running/next-up indicator, so staff always know what's
  happening right now on the floor.
- **Member lookup** — search member records and booking/attendance history.
- **Time-off requests** — a staff time-off request workflow.
- **Retention & outreach** — surfaces members worth re-engaging and stages
  outreach messages, with any send action gated behind an explicit staff
  confirmation step — Fitbot never sends anything autonomously.

---

## How it's built

| Layer | Choice |
|---|---|
| Framework | [Next.js](https://nextjs.org) (App Router, TypeScript) |
| Styling | Tailwind CSS + a shared design-token system across all modules |
| Backend / data | [Supabase](https://supabase.com) — Postgres, Auth, and Row Level Security |
| Auth & roles | Supabase Auth with a `profiles.role` column (`client` \| `staff`), enforced by RLS policies and a `protect_profile_role` trigger so only staff (or the service role) can promote a user |
| Hosting | [Vercel](https://vercel.com) |

### Role model

Every authenticated user gets a `client` profile by default. Staff members
have `role = 'staff'`, which unlocks the Staff Console and every
staff-scoped API route and chat intent. Role changes are protected at the
database level — an ordinary client can never promote themselves.

### Data model

Supabase migrations (`supabase/migrations/`) define the suite's schema
end-to-end: profiles & roles, chat messages, studio classes, bookings,
member lookup, time-off requests, and outreach — each with RLS policies
matching the `client`/`staff` boundary above.

---

## Local development

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill in your Supabase project's
URL and keys:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Run the database migrations in `supabase/migrations/` (in order) against
your Supabase project via the SQL Editor, then start the dev server:

```bash
npm run dev
```

Other scripts:

```bash
npm run build   # production build
npm run start   # run a production build locally
npm run lint     # eslint
npm run format   # prettier --write
```

---

## Project structure

```
app/
  page.tsx              # landing page / suite entry point
  dashboard/             # member home base
  chat/                  # Fitbot standalone chat page
  appointments/          # Book a Class
  staff/                 # Staff Console (staff-only)
  api/                   # chat, appointments, staff API routes
  components/            # shared UI (nav, icons, chatbot overlay, cards)
lib/                     # auth/session helpers, Supabase clients
supabase/migrations/     # full schema history, RLS policies, triggers
docs/                    # project profile, per-task briefs/plans/reviews
```

See `docs/agent/project-profile.md` and `docs/agent/decisions.md` for the
suite's architecture history and decisions log.
