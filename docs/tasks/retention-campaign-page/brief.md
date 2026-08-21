# Brief: retention-campaign-page

## Scope (in the user's own words)

"Look in my downloads folder there is a new folder called Retention. Inside
it is a concept for the retention page for our app. It will be a new page.
I want you to try to integrate it as cleanly as you can into the existing
app. Investigate it and the current codebase on github, update our local
files from it, and then draw up a plan to add it as a new page. Make sure
to take out incorrect branding like fitbot and replace it with our gitfit
branding. It should connect to the dataset and work as advertised. write no
code yet. Its also for staff/admin only."

## What was actually delivered

The named folder never appeared; the user later confirmed it was on a
different physical machine than this session has access to. The actual
asset arrived as `fitbot-reconnect-team-export.zip` in this machine's
Downloads folder, extracted to
`C:\Users\Wil\Downloads\fitbot-reconnect-team-export\`. It's a standalone
Vite + React 19 export named "Fitbot Reconnect" — a **bulk retention/
win-back campaign builder**: pick an inactive-member cohort, edit a
campaign (goal, channel, send time), compose a push/email message, toggle
an optional incentive, preview it against a demo member, and "launch" it.
Entirely mock data, zero real API calls, explicitly designed for later
integration (its own README says as much — see investigation.md).

## Explicit requirements from the user

1. Integrate as a new page, as cleanly as possible into the existing
   Next.js app (not run as a separate standalone app).
2. Investigate the mockup AND the current codebase (already up to date
   with `origin/main` as of this task).
3. Draw up a plan — **no implementation yet**.
4. Strip "Fitbot" branding, replace with real GitFit branding (the mockup
   says "Fitbot" in the header brand mark, the "FITBOT INSIGHT" section
   label, the push-notification sender name, and the email sign-off "–
   Your Fitbot").
5. It must connect to the real dataset and "work as advertised" — not
   ship as another disconnected local-state demo.
6. Staff/admin only.

## Preflight state

- Repo: `C:\Users\Wil\Documents\Codex\fitbot`, branch `main`, up to date
  with `origin/main` (includes the teammate's merged appointments-UX PR
  and the new-instructors work).
- Mockup source: `C:\Users\Wil\Downloads\fitbot-reconnect-team-export\`
  (kept outside the repo — nothing has been copied into the codebase yet).

## Acceptance criteria for this GUIDE/COORDINATE pass

- `investigation.md`: full mapping of the mockup's UI/data model against
  GitFit's actual schema and existing retention/outreach code, with every
  gap between "what the mockup pretends to do" and "what the real app can
  actually do today" called out explicitly (channel delivery, cohort
  definition, scheduling, bulk-send).
- `plan.md`: concrete, decision-structured plan for the new page —
  route/placement, data wiring, branding replacement, and an honest
  accounting of what "launch" can actually do against real infrastructure
  — phased for review, nothing implemented.
