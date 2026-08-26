"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { IconSpinner } from "@/app/components/icons";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "invalid" | "success";

export function ResetPasswordForm() {
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The reset link lands here with either a URL hash (#access_token=...&type=recovery)
  // or a ?code= param, which the browser client's detectSessionInUrl processes
  // automatically -- there's nothing to do but wait for the resulting
  // PASSWORD_RECOVERY event (or an existing session, if it resolved before this
  // listener attached). An explicit error param, or nothing arriving within a
  // few seconds, means the link was invalid or already used/expired.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    async function checkForExistingSession() {
      const params = new URLSearchParams(
        window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.search
      );
      if (params.get("error") || params.get("error_description")) {
        if (!cancelled) setStatus("invalid");
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled) setStatus((current) => (current === "checking" && session ? "ready" : current));
    }
    void checkForExistingSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStatus("ready");
    });

    const timeout = window.setTimeout(() => {
      setStatus((current) => (current === "checking" ? "invalid" : current));
    }, 5000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setIsSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setStatus("success");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update your password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === "checking") {
    return <p className="field-hint">Checking your reset link...</p>;
  }

  if (status === "invalid") {
    return (
      <div className="auth-form">
        <p aria-live="polite" className="field-error">
          This reset link is invalid or has expired.
        </p>
        <p className="auth-form-footer">
          <Link className="auth-link" href="/forgot-password">
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="auth-form">
        <p aria-live="polite" className="form-success">
          Your password has been updated.
        </p>
        <p className="auth-form-footer">
          <Link className="auth-link" href="/sign-in">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="field">
        <label className="field-label" htmlFor="password">
          New password
        </label>
        <input
          autoComplete="new-password"
          className="field-input"
          id="password"
          minLength={6}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="confirm-password">
          Confirm new password
        </label>
        <input
          autoComplete="new-password"
          className="field-input"
          id="confirm-password"
          minLength={6}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          type="password"
          value={confirmPassword}
        />
      </div>
      {error ? (
        <p aria-live="polite" className="field-error">
          {error}
        </p>
      ) : null}
      <button className="btn btn-primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? (
          <>
            <IconSpinner className="btn-spinner" /> Updating...
          </>
        ) : (
          "Update password"
        )}
      </button>
    </form>
  );
}
