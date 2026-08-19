"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signUp, type AuthFormState } from "@/app/actions/auth";
import { IconSpinner } from "@/app/components/icons";

const initialAuthFormState: AuthFormState = { error: null };

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(
    signUp,
    initialAuthFormState
  );

  return (
    <form action={formAction} className="auth-form">
      <div className="field">
        <label className="field-label" htmlFor="fullName">
          Full name
        </label>
        <input
          autoComplete="name"
          className="field-input"
          id="fullName"
          name="fullName"
          type="text"
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input
          autoComplete="email"
          className="field-input"
          id="email"
          name="email"
          required
          type="email"
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input
          autoComplete="new-password"
          className="field-input"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>
      {state.error ? (
        <p aria-live="polite" className="field-error">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p aria-live="polite" className="form-success">
          {state.message}
        </p>
      ) : null}
      <button className="btn btn-primary" disabled={isPending} type="submit">
        {isPending ? (
          <>
            <IconSpinner className="btn-spinner" /> Creating account...
          </>
        ) : (
          "Create account"
        )}
      </button>
      <p className="auth-form-footer">
        Already have an account?{" "}
        <Link className="auth-link" href="/sign-in">
          Sign in
        </Link>
      </p>
    </form>
  );
}
