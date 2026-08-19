import { requireRoleOrRedirect } from "@/lib/auth/session";

export default async function StaffPage() {
  const { user } = await requireRoleOrRedirect("staff");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-12">
      <section className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-3 text-3xl font-semibold text-slate-900">Staff Zone</h1>
        <p className="mb-6 text-slate-700">Signed in as {user.email}</p>
        <p className="text-slate-700">
          This is a Phase 1 verification fixture for role enforcement — real staff features land in a later phase.
        </p>
      </section>
    </main>
  );
}
