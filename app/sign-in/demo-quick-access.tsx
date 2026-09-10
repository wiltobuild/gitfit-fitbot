"use client";

import { useFormStatus } from "react-dom";

import { signInAsDemo } from "@/app/actions/auth";
import { IconSpinner } from "@/app/components/icons";
import type { DemoRole } from "@/lib/demo/accounts";

type DemoPersona = {
  role: DemoRole;
  label: string;
  blurb: string;
  email: string;
};

function DemoButton({ persona }: { persona: DemoPersona }) {
  const { pending } = useFormStatus();
  return (
    <button className="demo-quick-btn" disabled={pending} type="submit">
      <span className="demo-quick-btn-main">
        {pending ? <IconSpinner className="btn-spinner" /> : null}
        Sign in as {persona.label}
      </span>
      <span className="demo-quick-btn-blurb">{persona.blurb}</span>
      <span className="demo-quick-btn-email">{persona.email}</span>
    </button>
  );
}

export function DemoQuickAccess({ personas }: { personas: DemoPersona[] }) {
  return (
    <div className="demo-quick-access">
      <p className="demo-quick-access-label">
        <span /> Demo access &mdash; jump straight into any role
      </p>
      <div className="demo-quick-access-grid">
        {personas.map((persona) => (
          <form action={signInAsDemo.bind(null, persona.role)} key={persona.role}>
            <DemoButton persona={persona} />
          </form>
        ))}
      </div>
    </div>
  );
}
