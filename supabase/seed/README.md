# Seed data — how to tell it apart from real activity

There is no `is_seed` column anywhere — synthetic and real rows share the
same tables and schema. The following conventions are the de facto markers.
Treat them as load-bearing: don't reuse these patterns for real data, and
don't build anything that assumes a flag column exists.

- **Members**: every seeded member's email ends in `@gitfit.demo`
  (`EMAIL_DOMAIN` in `member-data.ts`). A real member's email never will —
  it's an obviously-synthetic domain that can't be registered.
- **Auth accounts**: the ~25 seeded members with real Supabase Auth logins
  (`ACCOUNT_HOLDER_COUNT`) all share the password `Welcome!` (`DEMO_PASSWORD`
  in `member-data.ts`), same password already used for the 4 manually
  provisioned staff/admin accounts.
- **Historical classes**: `seed-historical-activity.ts` backfills 8 weeks of
  past classes using the ID namespace `class_hist_<YYYYMMDD>_<slot>` —
  distinct from hand-seeded `class_001`–`class_029` (`seed-classes.ts`'s
  original fixtures) and generated `class_gen_*` rows (`seed-classes.ts`'s
  rolling-window generator). A real class never gets an ID in this range.
- **Bookings against those classes**: inserted through the normal booking
  flow (real INSERT into `bookings`, same triggers, same capacity
  enforcement) with a backdated `created_at` — not fabricated directly into
  an analytics table. A booking row itself carries no marker; its class_id's
  namespace is the tell.

When adding new seed/demo data, extend these same conventions (the
`gitfit.demo` domain, the `class_hist_*`/`class_gen_*` ID namespaces) rather
than inventing a new one, so "is this real" stays answerable without a
schema change.
