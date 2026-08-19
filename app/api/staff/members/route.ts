import { UnauthorizedError, requireRoleOrThrow } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MemberRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
};

export async function POST(request: Request) {
  try {
    await requireRoleOrThrow("staff");
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json(
        { error: error.reason === "unauthenticated" ? "Unauthorized" : "Forbidden" },
        { status: error.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    throw error;
  }

  const body = await request.json().catch(() => ({}));
  const searchTerm = typeof body.search_term === "string" ? body.search_term.trim() : "";

  if (!searchTerm) return Response.json({ members: [] });

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("search_members", { search_term: searchTerm });

    if (error) throw error;

    const members: MemberRow[] = (data ?? []).map((member: MemberRow) => ({
      id: member.id,
      email: member.email,
      full_name: member.full_name,
      role: member.role,
      created_at: member.created_at,
    }));

    return Response.json({ members });
  } catch (error) {
    console.error("Unable to search members", error);
    return Response.json({ error: "We couldn't look up members right now." }, { status: 500 });
  }
}
