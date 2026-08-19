import { UnauthorizedError, requireRoleOrThrow } from "@/lib/auth/session";

export async function GET() {
  try {
    const session = await requireRoleOrThrow("staff");

    return Response.json({ ok: true, message: "pong", user: session.user.email });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      // Return 403 for unauthenticated and wrong-role requests so this fixture
      // does not imply that signing in alone would grant access.
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    throw error;
  }
}
