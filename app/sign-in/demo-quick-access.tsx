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

function DemoButton({ persona, variant }: { persona: DemoPersona; variant: "role" | "dev" }) {
  const { pending } = useFormStatus();
  return (
    <button
      className={variant === "dev" ? "demo-quick-btn demo-quick-btn-dev" : "demo-quick-btn"}
      disabled={pending}
      type="submit"
    >
      <span className="demo-quick-btn-main">
        {pending ? <IconSpinner className="btn-spinner" /> : null}
        {variant === "dev" ? "Sign in as Dev — all-access" : `Sign in as ${persona.label}`}
      </span>
      <span className="demo-quick-btn-blurb">{persona.blurb}</span>
      <span className="demo-quick-btn-email">{persona.email}</span>
    </button>
  );
}

function PersonaForm({ persona, variant }: { persona: DemoPersona; variant: "role" | "dev" }) {
  return (
    <form action={signInAsDemo.bind(null, persona.role)}>
      <DemoButton persona={persona} variant={variant} />
    </form>
  );
}

export function DemoQuickAccess({ personas }: { personas: DemoPersona[] }) {
  const dev = personas.find((persona) => persona.role === "dev");
  const roles = personas.filter((persona) => persona.role !== "dev");

  return (
    <div className="demo-quick-access">
      <p className="demo-quick-access-label">
        <span /> Demo access &mdash; jump straight into any role
      </p>

      {dev ? (
        <div className="demo-quick-dev-block">
          <PersonaForm persona={dev} variant="dev" />
          <p className="demo-quick-dev-note">
            The <strong>Dev</strong> login opens <strong>every page and every feature for every
            role</strong> at once &mdash; all role gates off. Use the role logins below to see the
            app exactly as that user would.
          </p>
        </div>
      ) : null}

      <div className="demo-quick-access-grid">
        {roles.map((persona) => (
          <PersonaForm key={persona.role} persona={persona} variant="role" />
        ))}
      </div>
    </div>
  );
}
