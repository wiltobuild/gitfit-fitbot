"use client";

import Link from "next/link";
import { useActionState } from "react";

import { requestPasswordReset, type AuthFormState } from "@/app/actions/auth";
import { IconSpinner } from "@/app/components/icons";

const initialAuthFormState: AuthFormState = { error: null };

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordReset,
    initialAuthFormState
  );

  if (state.message) {
    return (
      <div className="auth-form">
        <p aria-live="polite" className="form-success">
          {state.message}
        </p>
        <p className="auth-form-footer">
          <Link className="auth-link" href="/sign-in">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

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
      {state.error ? (
        <p aria-live="polite" className="field-error">
          {state.error}
        </p>
      ) : null}
      <button className="btn btn-primary" disabled={isPending} type="submit">
        {isPending ? (
          <>
            <IconSpinner className="btn-spinner" /> Sending...
          </>
        ) : (
          "Send reset link"
        )}
      </button>
      <p className="auth-form-footer">
        Remember your password?{" "}
        <Link className="auth-link" href="/sign-in">
          Sign in
        </Link>
      </p>
    </form>
  );
}
