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

export type DemoRole = "admin" | "staff" | "client";

export type DemoAccount = {
  role: DemoRole;
  label: string;
  blurb: string;
  email: string;
  password: string;
};

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
  return (["admin", "staff", "client"] as const).map(accountFor);
}
