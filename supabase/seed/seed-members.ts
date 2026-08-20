// Real seed script — writes the 300-member dataset to the live Supabase
// project, provisions ~25 real Auth accounts for the account-holding
// subset, and generates correlated bookings/chat/outreach data for them.
//
// Idempotent: upserts members by email, reuses existing Auth accounts by
// email instead of duplicating them, and only inserts bookings/messages
// that don't already exist for a given member.
//
// Run with: npx tsx supabase/seed/seed-members.ts
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
// environment (already present in .env.local).

import { createClient } from "@supabase/supabase-js";
import { generateMembers, DEMO_PASSWORD } from "./member-data";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const STAFF_EMAIL_FOR_OUTREACH = "wil.sheppard@pursuit.org";

async function listAllAuthUsers(): Promise<Map<string, string>> {
  const byEmail = new Map<string, string>();
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email) byEmail.set(user.email.toLowerCase(), user.id);
    }
    if (data.users.length < 1000) break;
    page += 1;
  }
  return byEmail;
}

async function main() {
  const members = generateMembers();
  const counts = members.reduce((acc: Record<string, number>, m) => {
    acc[m.lifecycle_status] = (acc[m.lifecycle_status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Generated ${members.length} members in memory. Lifecycle:`, counts);

  // ---- 1. Upsert members (without auth_user_id yet) ----

  const memberRows = members.map((m) => ({
    email: m.email,
    first_name: m.first_name,
    last_name: m.last_name,
    full_name: m.full_name,
    birthdate: m.birthdate,
    phone: m.phone,
    join_date: m.join_date,
    membership_tier: m.membership_tier,
    membership_status: m.membership_status,
    last_visit_date: m.last_visit_date,
    lifecycle_status: m.lifecycle_status,
    goals: m.goals,
    preferred_class_types: m.preferred_class_types,
    fitness_level: m.fitness_level,
    staff_notes: m.staff_notes || null,
    is_instructor: m.is_instructor,
  }));

  const { error: upsertError } = await supabase.from("members").upsert(memberRows, { onConflict: "email" });
  if (upsertError) throw upsertError;
  console.log(`Upserted ${memberRows.length} members rows.`);

  const { data: allMembers, error: fetchError } = await supabase.from("members").select("id, email, lifecycle_status");
  if (fetchError) throw fetchError;
  const memberIdByEmail = new Map(allMembers!.map((m) => [m.email.toLowerCase(), m.id as string]));

  // ---- 2. Provision real Auth accounts for the account-holding subset ----

  const existingAuthUsers = await listAllAuthUsers();
  const accountHolders = members.filter((m) => m.has_account);
  let created = 0;
  let reused = 0;

  for (const m of accountHolders) {
    const emailKey = m.email.toLowerCase();
    let authUserId = existingAuthUsers.get(emailKey);

    if (!authUserId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: m.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: m.full_name },
      });
      if (error) throw new Error(`Failed to create auth user for ${m.email}: ${error.message}`);
      authUserId = data.user.id;
      existingAuthUsers.set(emailKey, authUserId);
      created += 1;
    } else {
      reused += 1;
    }

    const { error: linkError } = await supabase.from("members").update({ auth_user_id: authUserId }).eq("email", m.email);
    if (linkError) throw linkError;
  }
  console.log(`Auth accounts: ${created} created, ${reused} reused. Total account-holding members: ${accountHolders.length}.`);

  // profiles are created client-role by default via the on_auth_user_created
  // trigger (0001) — none of the 25 demo accounts should be staff.

  // ---- 3. Correlated bookings for the account-holding subset ----

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, capacity, booked_count, class_date")
    .order("class_date", { ascending: true });
  if (classesError) throw classesError;

  const { data: existingBookings, error: bookingsFetchError } = await supabase.from("bookings").select("class_id, user_id");
  if (bookingsFetchError) throw bookingsFetchError;
  const existingBookingKeys = new Set((existingBookings ?? []).map((b) => `${b.class_id}:${b.user_id}`));
  const existingBookingCountByUser = new Map<string, number>();
  for (const b of existingBookings ?? []) {
    existingBookingCountByUser.set(b.user_id, (existingBookingCountByUser.get(b.user_id) ?? 0) + 1);
  }
  const bookedCountByClass = new Map((classes ?? []).map((c) => [c.id, c.booked_count as number]));

  let bookingsInserted = 0;
  for (const m of accountHolders) {
    if (m.is_instructor) continue; // instructors don't book their own studio's classes
    const authUserId = existingAuthUsers.get(m.email.toLowerCase())!;
    // 1-2 classes per account holder, skipping ones already full or already booked.
    // Idempotency: if this member already has any bookings from a prior run, leave them alone
    // entirely rather than topping up to `desired` — re-running must not keep adding bookings.
    if ((existingBookingCountByUser.get(authUserId) ?? 0) > 0) continue;
    const desired = 1 + (m.email.length % 2);
    let attempts = 0;
    let bookedForThisMember = 0;
    while (bookedForThisMember < desired && attempts < 6) {
      attempts += 1;
      const classRow = classes![Math.floor(Math.random() * classes!.length)];
      const key = `${classRow.id}:${authUserId}`;
      const currentBooked = bookedCountByClass.get(classRow.id) ?? 0;
      if (existingBookingKeys.has(key) || currentBooked >= classRow.capacity) continue;

      const { error: insertError } = await supabase.from("bookings").insert({ class_id: classRow.id, user_id: authUserId });
      if (insertError) {
        if (insertError.message.includes("Class is full") || insertError.code === "23505") continue;
        throw insertError;
      }
      existingBookingKeys.add(key);
      bookedCountByClass.set(classRow.id, currentBooked + 1);
      bookingsInserted += 1;
      bookedForThisMember += 1;
    }
  }
  console.log(`Inserted ${bookingsInserted} new bookings.`);

  // ---- 4. A few chat_messages for a handful of account holders ----

  const { data: existingChatUsers, error: chatFetchError } = await supabase.from("chat_messages").select("user_id");
  if (chatFetchError) throw chatFetchError;
  const usersWithChat = new Set((existingChatUsers ?? []).map((c) => c.user_id));

  const chatSampleTurns: Array<{ role: "user" | "assistant"; content: string }> = [
    { role: "user", content: "What classes are on the schedule this week?" },
    { role: "assistant", content: "Here's the matching schedule — take a look and let me know if you'd like to book one." },
  ];

  let chatSeeded = 0;
  for (const m of accountHolders.slice(0, 8)) {
    const authUserId = existingAuthUsers.get(m.email.toLowerCase())!;
    if (usersWithChat.has(authUserId)) continue;
    for (const turn of chatSampleTurns) {
      const { error } = await supabase.from("chat_messages").insert({ user_id: authUserId, role: turn.role, content: turn.content });
      if (error) throw error;
    }
    chatSeeded += 1;
  }
  console.log(`Seeded chat history for ${chatSeeded} members.`);

  // ---- 5. A handful of outreach_messages drafts targeting at_risk/lapsed members ----
  // (target_member_id -> members.id works whether or not the member has an account.)

  const staffAuthUserId = existingAuthUsers.get(STAFF_EMAIL_FOR_OUTREACH.toLowerCase());
  if (!staffAuthUserId) {
    console.warn(`Staff account ${STAFF_EMAIL_FOR_OUTREACH} not found — skipping outreach drafts.`);
  } else {
    const { data: existingOutreach, error: outreachFetchError } = await supabase.from("outreach_messages").select("target_member_id");
    if (outreachFetchError) throw outreachFetchError;
    const alreadyTargeted = new Set((existingOutreach ?? []).map((o) => o.target_member_id));

    const needsOutreach = members.filter((m) => (m.lifecycle_status === "at_risk" || m.lifecycle_status === "lapsed") && !m.is_instructor);
    const candidates = needsOutreach.slice(0, 8);

    let outreachInserted = 0;
    for (const m of candidates) {
      const memberId = memberIdByEmail.get(m.email.toLowerCase());
      if (!memberId || alreadyTargeted.has(memberId)) continue;
      const subject = "We miss you at GitFit!";
      const body = `Hi ${m.full_name}, it's been a while since we've seen you at GitFit — we'd love to have you back. Check the schedule and book a class that feels right for you.`;
      const { error } = await supabase.from("outreach_messages").insert({
        target_member_id: memberId,
        staff_user_id: staffAuthUserId,
        subject,
        body,
        status: "draft",
      });
      if (error) throw error;
      outreachInserted += 1;
    }
    console.log(`Inserted ${outreachInserted} outreach drafts targeting at_risk/lapsed members.`);
  }

  // ---- Summary ----

  const { count: finalCount } = await supabase.from("members").select("id", { count: "exact", head: true });
  console.log(`\nDone. members table now has ${finalCount} rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
