import { UnauthorizedError, requireRoleOrThrow } from "@/lib/auth/session";
import { searchMembers, type MemberRow } from "@/lib/members/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try { await requireRoleOrThrow("staff"); } catch (error) {
    if (error instanceof UnauthorizedError) return Response.json({ error: error.reason === "unauthenticated" ? "Unauthorized" : "Forbidden" }, { status: error.reason === "unauthenticated" ? 401 : 403 });
    throw error;
  }
  const body = await request.json().catch(() => ({}));
  const searchTerm = typeof body.search_term === "string" ? body.search_term.trim() : "";
  if (!searchTerm) return Response.json({ members: [] });
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await searchMembers(supabase, searchTerm);
    if (error) throw error;
    const members: MemberRow[] = data;
    return Response.json({ members });
  } catch (error) {
    console.error("Unable to search members", error);
    return Response.json({ error: "We couldn't look up members right now." }, { status: 500 });
  }
}
