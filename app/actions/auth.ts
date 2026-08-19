"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error: string | null;
  message?: string | null;
};

export async function signUp(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (error) {
    return { error: error.message };
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
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
