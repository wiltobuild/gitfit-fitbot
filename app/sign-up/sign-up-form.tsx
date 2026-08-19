"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signUp, type AuthFormState } from "@/app/actions/auth";

const initialAuthFormState: AuthFormState = { error: null };

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(signUp, initialAuthFormState);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-900" htmlFor="email">
          Email
        </label>
        <input
          autoComplete="email"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
          id="email"
          name="email"
          required
          type="email"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-900" htmlFor="password">
          Password
        </label>
        <input
          autoComplete="new-password"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>
      {state.error ? <p aria-live="polite" className="text-sm text-red-600">{state.error}</p> : null}
      {state.message ? <p aria-live="polite" className="text-sm text-teal-700">{state.message}</p> : null}
      <button className="w-full rounded-md bg-teal-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={isPending} type="submit">
        {isPending ? "Creating account..." : "Create account"}
      </button>
      <p className="text-center text-sm text-slate-600">
        Already have an account? <Link className="font-medium text-teal-700 underline" href="/sign-in">Sign in</Link>
      </p>
    </form>
  );
}
