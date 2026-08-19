import { signOut } from "@/app/actions/auth";
import { requireUserOrRedirect } from "@/lib/auth/session";

export default async function DashboardPage() {
  const { user, role } = await requireUserOrRedirect();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-12">
      <section className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-3 text-3xl font-semibold text-slate-900">Your dashboard</h1>
        <p className="mb-6 text-slate-700">Signed in as {user.email} ({role})</p>
        <form action={signOut}>
          <button className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white" type="submit">
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
