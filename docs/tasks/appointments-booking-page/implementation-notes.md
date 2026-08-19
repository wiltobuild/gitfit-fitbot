# Implementation notes: appointments booking page

## Seed-data verification

The copied seed data contains seven distinct day/date pairs, from Monday
2026-08-17 through Sunday 2026-08-23. The class-count breakdown is:

- Monday: 4
- Tuesday: 3
- Wednesday: 3
- Thursday: 3
- Friday: 2
- Saturday: 3
- Sunday: 2

`classes.json` is loaded with its `bookedCount` values unchanged. Confirmed
`bookings.json` rows for `member_001` are used only to initialise that
member's held-class set; they are never reapplied to the booked counts.

## Deviations

None from the approved implementation scope. The backing store is
intentionally process-local and resets if the server restarts.

## Commands run

- `npm run lint; npm run build` — could not execute because PowerShell blocks
  `npm.ps1` under the current execution policy (exit 1).
- `npm.cmd run lint; npm.cmd run build` — lint completed with exit 0 and one
  existing warning in `postcss.config.mjs` (`import/no-anonymous-default-export`);
  build initially failed with strict TypeScript narrowing errors in the new
  store (exit 1).
- `node_modules/.bin/prettier.cmd --write app/appointments app/api/appointments lib/appointments-store.ts app/page.tsx app/chat/chat-experience.tsx app/globals.css;
  npm.cmd run lint; npm.cmd run build` — exit 0. Lint had the same pre-existing
  PostCSS warning; build completed successfully.
- Started `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000` and attempted
  GET/reserve/cancel requests using `Invoke-RestMethod`. The server could not
  bind in this sandbox: `listen EACCES: permission denied 127.0.0.1:3000`.
  Therefore, the required live HTTP verification could not be performed here.
