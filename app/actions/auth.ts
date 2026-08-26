"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getBaseUrl() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

// Most Supabase auth error messages ("Invalid login credentials", "Password
// should be at least 6 characters") already read fine to an end user as-is.
// Rate-limit errors are the exception -- they surface as internal-sounding
// text ("email rate limit exceeded") with no indication of what to actually
// do, so that's the one case worth translating rather than passing through.
function friendlyAuthErrorMessage(message: string): string {
  if (message.toLowerCase().includes("rate limit")) {
    return "Too many attempts right now. Please wait a few minutes and try again.";
  }
  return message;
}

export type AuthFormState = {
  error: string | null;
  message?: string | null;
};

export async function signUp(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createSupabaseServerClient();
  const fullNameValue = String(formData.get("fullName") ?? "").trim();
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    options: { data: { full_name: fullNameValue || undefined } },
  });

  if (error) {
    return { error: friendlyAuthErrorMessage(error.message) };
  }

  // With email confirmation enabled (this project's default), signUp()
  // succeeds and creates the user + profile row, but returns no session
  // until the user clicks the confirmation link — redirecting to /dashboard
  // here would just bounce straight back to /sign-in via requireUserOrRedirect.
  if (!data.session) {
    return {
      error: null,
      message: "Account created. Check your email to confirm it, then sign in.",
    };
  }

  redirect("/dashboard");
}

export async function signIn(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (error) {
    return { error: friendlyAuthErrorMessage(error.message) };
  }

  redirect("/dashboard");
}

export async function requestPasswordReset(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createSupabaseServerClient();
  const email = String(formData.get("email") ?? "").trim();
  const baseUrl = await getBaseUrl();

  // Always return the same message regardless of whether the email matches
  // an account -- resetPasswordForEmail's own error (if any) isn't surfaced
  // to the caller, so this page can't be used to enumerate registered
  // emails.
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${baseUrl}/reset-password` });

  return {
    error: null,
    message: "If an account exists for that email, we've sent a link to reset your password.",
  };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
