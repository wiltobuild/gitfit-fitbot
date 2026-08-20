// One-off seed script for the Boxing, Pilates, and Strength instructors.
//
// Idempotent: reuses Auth accounts by email, upserts members and classes by
// their unique keys, and keeps an existing profile full name unless it is null.
//
// Run with: npx tsx supabase/seed/seed-new-instructors.ts
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.

import { createClient } from "@supabase/supabase-js";
import { DEMO_PASSWORD } from "./member-data";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type InstructorSeed = {
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  specialty: string;
  goals: string;
};

const instructors: InstructorSeed[] = [
  { email: "diego.reyes@gitfit.demo", first_name: "Diego", last_name: "Reyes", full_name: "Diego Reyes", specialty: "Boxing", goals: "Coach confident, powerful boxing technique and conditioning." },
  { email: "elena.cruz@gitfit.demo", first_name: "Elena", last_name: "Cruz", full_name: "Elena Cruz", specialty: "Pilates", goals: "Build precise core strength, control, and sustainable movement." },
  { email: "jordan.blake@gitfit.demo", first_name: "Jordan", last_name: "Blake", full_name: "Jordan Blake", specialty: "Strength", goals: "Help members build practical strength with excellent form." },
];

const classes = [
  { id: "class_021", name: "Power Boxing", type: "Boxing", instructor: "Diego Reyes", class_date: "2026-08-17", start_time: "12:00", duration_minutes: 45, capacity: 16, booked_count: 11 },
  { id: "class_022", name: "Boxing Fundamentals", type: "Boxing", instructor: "Diego Reyes", class_date: "2026-08-19", start_time: "17:00", duration_minutes: 60, capacity: 18, booked_count: 9 },
  { id: "class_023", name: "Knockout Conditioning", type: "Boxing", instructor: "Diego Reyes", class_date: "2026-08-22", start_time: "13:00", duration_minutes: 45, capacity: 16, booked_count: 12 },
  { id: "class_024", name: "Pilates Reform", type: "Pilates", instructor: "Elena Cruz", class_date: "2026-08-18", start_time: "09:00", duration_minutes: 60, capacity: 15, booked_count: 10 },
  { id: "class_025", name: "Core Pilates Flow", type: "Pilates", instructor: "Elena Cruz", class_date: "2026-08-20", start_time: "17:00", duration_minutes: 45, capacity: 16, booked_count: 8 },
  { id: "class_026", name: "Precision Pilates", type: "Pilates", instructor: "Elena Cruz", class_date: "2026-08-23", start_time: "11:45", duration_minutes: 60, capacity: 15, booked_count: 11 },
  { id: "class_027", name: "Strength Foundations", type: "Strength", instructor: "Jordan Blake", class_date: "2026-08-17", start_time: "16:30", duration_minutes: 60, capacity: 18, booked_count: 13 },
  { id: "class_028", name: "Iron Circuit", type: "Strength", instructor: "Jordan Blake", class_date: "2026-08-21", start_time: "12:00", duration_minutes: 45, capacity: 16, booked_count: 9 },
  { id: "class_029", name: "Total Strength", type: "Strength", instructor: "Jordan Blake", class_date: "2026-08-23", start_time: "14:00", duration_minutes: 60, capacity: 18, booked_count: 12 },
];

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
  const today = new Date().toISOString().slice(0, 10);
  const existingAuthUsers = await listAllAuthUsers();
  let created = 0;
  let reused = 0;

  for (const instructor of instructors) {
    const emailKey = instructor.email.toLowerCase();
    let authUserId = existingAuthUsers.get(emailKey);

    if (!authUserId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: instructor.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: instructor.full_name },
      });
      if (error) throw new Error(`Failed to create auth user for ${instructor.email}: ${error.message}`);
      authUserId = data.user.id;
      existingAuthUsers.set(emailKey, authUserId);
      created += 1;
    } else {
      reused += 1;
    }

    const { error: memberError } = await supabase.from("members").upsert({
      email: instructor.email,
      first_name: instructor.first_name,
      last_name: instructor.last_name,
      full_name: instructor.full_name,
      auth_user_id: authUserId,
      join_date: today,
      membership_tier: "premium",
      membership_status: "active",
      lifecycle_status: "active",
      goals: instructor.goals,
      preferred_class_types: instructor.specialty,
      fitness_level: "advanced",
      staff_notes: null,
      is_instructor: true,
    }, { onConflict: "email" });
    if (memberError) throw memberError;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", authUserId)
      .single();
    if (profileError) throw profileError;

    const { error: roleError } = await supabase
      .from("profiles")
      .update(profile.full_name ? { role: "staff" } : { role: "staff", full_name: instructor.full_name })
      .eq("id", authUserId);
    if (roleError) throw roleError;
  }
  console.log(`Auth accounts: ${created} created, ${reused} reused.`);

  const { error: classesError } = await supabase.from("classes").upsert(classes, { onConflict: "id" });
  if (classesError) throw classesError;
  console.log(`Upserted ${classes.length} instructor classes.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
