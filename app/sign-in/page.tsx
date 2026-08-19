import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <section className="w-full">
        <h1 className="mb-2 text-3xl font-semibold text-slate-900">Welcome back</h1>
        <p className="mb-6 text-slate-600">Sign in to continue with GitFit.</p>
        <SignInForm />
      </section>
    </main>
  );
}
