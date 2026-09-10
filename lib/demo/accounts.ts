// Demo-mode configuration. This fork prefills the sign-in page and exposes
// one-click "sign in as <role>" buttons so a demo viewer can reach every
// surface of the app without knowing credentials.
//
// Enabled by NEXT_PUBLIC_DEMO_MODE=true. The account emails/passwords can be
// overridden per-environment via the DEMO_* env vars below; the fallbacks are
// the seeded accounts on the shared Supabase project (all password "Welcome!").
//
// Nothing here is secret — the whole point of demo mode is publicly known
// credentials — but the passwords are still kept server-side (no NEXT_PUBLIC_
// prefix) so they are only ever used inside the sign-in Server Action, never
// shipped in the client bundle.

// "dev" is not a real Supabase role. The dev quick-login authenticates as the
// admin account (so RLS grants full data access) and additionally sets a
// short-lived cookie that lib/auth/session.ts reads to flip on an all-access
// bypass: every role gate passes, every page renders, every Fitbot shortcut is
// available. See DEV_COOKIE below and requireRole* in lib/auth/session.ts.
export type DemoRole = "admin" | "staff" | "client" | "dev";

export type DemoAccount = {
  role: DemoRole;
  label: string;
  blurb: string;
  email: string;
  password: string;
};

// Cookie that marks a session as the all-access dev view. Cleared by every
// non-dev sign-in and by sign-out.
export const DEV_COOKIE = "gitfit_demo_dev";

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

const DEFAULTS: Record<DemoRole, { label: string; blurb: string; email: string }> = {
  admin: {
    label: "Admin",
    blurb: "Studio-wide dashboard, retention, time-off approvals",
    email: "wil.sheppard@pursuit.org",
  },
  staff: {
    label: "Staff",
    blurb: "Trainer / manager console, schedule, member lookup",
    email: "sofia.martinez@gitfit.demo",
  },
  client: {
    label: "Member",
    blurb: "Personal dashboard, class booking, Fitbot",
    email: "casimir.hilpert@gitfit.demo",
  },
  dev: {
    label: "Dev",
    blurb: "All-access: every page and every feature, all role gates off",
    // Runs on a *different* admin account than the Admin button so the two
    // logins are visibly distinct. Any admin-role account works — RLS is
    // unrestricted for it and the dev bypass is layered on in
    // lib/auth/session.ts.
    email: "riarusso@pursuit.org",
  },
};

const DEFAULT_PASSWORD = "Welcome!";

function accountFor(role: DemoRole): DemoAccount {
  const upper = role.toUpperCase();
  return {
    role,
    label: DEFAULTS[role].label,
    blurb: DEFAULTS[role].blurb,
    email: process.env[`DEMO_${upper}_EMAIL`] ?? DEFAULTS[role].email,
    password: process.env[`DEMO_${upper}_PASSWORD`] ?? process.env.DEMO_PASSWORD ?? DEFAULT_PASSWORD,
  };
}

export function getDemoAccount(role: DemoRole): DemoAccount {
  return accountFor(role);
}

export function getDemoAccounts(): DemoAccount[] {
  return (["dev", "admin", "staff", "client"] as const).map(accountFor);
}
