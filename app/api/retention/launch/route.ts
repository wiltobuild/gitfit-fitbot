import { UnauthorizedError, requireRoleOrThrow } from "@/lib/auth/session";
import { createBulkOutreachDrafts } from "@/lib/outreach/queries";
import { getMemberForUser, getStudentAuthUserIdsForInstructor } from "@/lib/members/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LaunchMember = { id: string; auth_user_id: string | null };

export async function POST(request: Request) {
  let session;
  try {
    session = await requireRoleOrThrow(["staff", "admin"]);
  } catch (error) {
    if (error instanceof UnauthorizedError)
      return Response.json(
        {
          error:
            error.reason === "unauthenticated" ? "Unauthorized" : "Forbidden"
        },
        { status: error.reason === "unauthenticated" ? 401 : 403 }
      );
    throw error;
  }
  const body = await request.json().catch(() => null);
  const memberIds =
    Array.isArray(body?.memberIds) &&
    body.memberIds.every(
      (memberId: unknown) => typeof memberId === "string" && memberId.trim()
    )
      ? body.memberIds.map((memberId: string) => memberId.trim())
      : [];
  const members: LaunchMember[] = Array.isArray(body?.members)
    ? body.members.filter(
        (member: unknown): member is LaunchMember =>
          !!member &&
          typeof member === "object" &&
          typeof (member as LaunchMember).id === "string" &&
          ((member as LaunchMember).auth_user_id === null ||
            typeof (member as LaunchMember).auth_user_id === "string")
      )
    : [];
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const message = typeof body?.body === "string" ? body.body.trim() : "";
  if (
    !memberIds.length ||
    new Set(memberIds).size !== memberIds.length ||
    !subject ||
    !message
  )
    return Response.json(
      { error: "A member list, subject, and message are required." },
      { status: 400 }
    );
  if (
    members.length !== memberIds.length ||
    new Set(members.map((member) => member.id)).size !== memberIds.length ||
    members.some((member) => !memberIds.includes(member.id))
  )
    return Response.json(
      { error: "The selected member data is invalid." },
      { status: 400 }
    );
  try {
    const supabase = await createSupabaseServerClient();

    // A trainer's audience is scoped to their own students on the /retention
    // page, but this route is the real enforcement point -- a tampered
    // request could otherwise submit any memberIds regardless of what the
    // UI offered. Admin keeps studio-wide reach.
    if (session.role === "staff") {
      const { data: instructorMember, error: memberError } = await getMemberForUser(supabase, session.user.id);
      if (memberError) throw memberError;
      const studentAuthUserIds = instructorMember?.is_instructor
        ? await getStudentAuthUserIdsForInstructor(supabase, instructorMember.id)
        : new Set<string>();
      const hasNonStudent = members.some((member) => !member.auth_user_id || !studentAuthUserIds.has(member.auth_user_id));
      if (hasNonStudent) {
        return Response.json({ error: "You can only send outreach to members who've booked one of your classes." }, { status: 403 });
      }
    }

    const { data, error } = await createBulkOutreachDrafts(supabase, {
      memberIds,
      subject,
      body: message,
      staffUserId: session.user.id
    });
    if (error) throw error;
    const createdMemberIds = new Set(
      (data ?? []).map((draft) => draft.target_member_id)
    );
    const draftsCreated = createdMemberIds.size;
    const reachableCount = members.filter(
      (member) => createdMemberIds.has(member.id) && !!member.auth_user_id
    ).length;
    return Response.json({ draftsCreated, reachableCount });
  } catch (error) {
    console.error("Unable to create retention campaign drafts", error);
    return Response.json(
      { error: "We couldn't create those campaign drafts right now." },
      { status: 500 }
    );
  }
}
