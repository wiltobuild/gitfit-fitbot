import { SignUpForm } from "./sign-up-form";

export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <section className="w-full">
        <h1 className="mb-2 text-3xl font-semibold text-slate-900">Create your GitFit account</h1>
        <p className="mb-6 text-slate-600">Start building a routine that works for you.</p>
        <SignUpForm />
      </section>
    </main>
  );
}
