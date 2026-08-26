"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signIn, type AuthFormState } from "@/app/actions/auth";
import { IconSpinner } from "@/app/components/icons";

const initialAuthFormState: AuthFormState = { error: null };

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(
    signIn,
    initialAuthFormState
  );

  return (
    <form action={formAction} className="auth-form">
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
          autoComplete="current-password"
          className="field-input"
          id="password"
          name="password"
          required
          type="password"
        />
        <Link className="field-hint-link" href="/forgot-password">
          Forgot password?
        </Link>
      </div>
      {state.error ? (
        <p aria-live="polite" className="field-error">
          {state.error}
        </p>
      ) : null}
      <button className="btn btn-primary" disabled={isPending} type="submit">
        {isPending ? (
          <>
            <IconSpinner className="btn-spinner" /> Signing in...
          </>
        ) : (
          "Sign in"
        )}
      </button>
      <p className="auth-form-footer">
        Need an account?{" "}
        <Link className="auth-link" href="/sign-up">
          Sign up
        </Link>
      </p>
    </form>
  );
}
