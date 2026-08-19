// Exports the live `members` table to a styled .xlsx for sharing with the
// team. Excludes staff_notes (staff-only visibility per the plan) and
// internal ids/auth_user_id (not useful to teammates, just UUID noise).
//
// Run with: npx tsx supabase/seed/export-members.ts
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: members, error } = await supabase
    .from("members")
    .select(
      "email, first_name, last_name, full_name, birthdate, phone, auth_user_id, join_date, membership_tier, membership_status, last_visit_date, lifecycle_status, goals, preferred_class_types, fitness_level, is_instructor",
    )
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!members || members.length === 0) throw new Error("No members found — run seed-members.ts first.");

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("GitFit Members");

  sheet.columns = [
    { header: "Email", key: "email", width: 30 },
    { header: "First name", key: "first_name", width: 14 },
    { header: "Last name", key: "last_name", width: 14 },
    { header: "Full name", key: "full_name", width: 20 },
    { header: "Birthdate", key: "birthdate", width: 12 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Has account?", key: "has_account", width: 13 },
    { header: "Join date", key: "join_date", width: 12 },
    { header: "Membership tier", key: "membership_tier", width: 15 },
    { header: "Membership status", key: "membership_status", width: 17 },
    { header: "Last visit", key: "last_visit_date", width: 12 },
    { header: "Lifecycle status", key: "lifecycle_status", width: 15 },
    { header: "Goals", key: "goals", width: 32 },
    { header: "Preferred class types", key: "preferred_class_types", width: 20 },
    { header: "Fitness level", key: "fitness_level", width: 14 },
    { header: "Instructor?", key: "is_instructor", width: 11 },
  ];

  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6E3FE0" } };
    cell.alignment = { vertical: "middle" };
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: "P1" };

  for (const m of members) {
    sheet.addRow({
      email: m.email,
      first_name: m.first_name,
      last_name: m.last_name,
      full_name: m.full_name,
      birthdate: m.birthdate,
      phone: m.phone,
      has_account: m.auth_user_id !== null,
      join_date: m.join_date,
      membership_tier: m.membership_tier,
      membership_status: m.membership_status,
      last_visit_date: m.last_visit_date,
      lifecycle_status: m.lifecycle_status,
      goals: m.goals,
      preferred_class_types: m.preferred_class_types,
      fitness_level: m.fitness_level,
      is_instructor: m.is_instructor,
    });
  }

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F1FA" } };
      });
    }
  });

  const outPath = "docs/tasks/shared-member-data/members-export.xlsx";
  await workbook.xlsx.writeFile(outPath);

  const counts = members.reduce((acc: Record<string, number>, m) => {
    const key = m.lifecycle_status as string;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Exported ${members.length} live members to ${outPath}`);
  console.log("Lifecycle distribution:", counts);
  console.log("Account holders:", members.filter((m) => m.auth_user_id !== null).length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
