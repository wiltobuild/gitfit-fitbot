// Standalone data generator for team review — no Supabase writes, no schema
// changes. Produces the 300-row synthetic member dataset described in
// docs/tasks/shared-member-data/plan.md as CSV + styled XLSX so the team can
// review the shape/content before it's loaded for real (see seed-members.ts,
// which uses the exact same generateMembers() from member-data.ts).
//
// Run with: npx tsx supabase/seed/generate-members-preview.ts

import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";
import { generateMembers } from "./member-data";

const members = generateMembers();

// ---- CSV ----

const csvColumns = Object.keys(members[0]);
const csvEscape = (v: unknown) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvLines = [csvColumns.join(",")];
for (const m of members) csvLines.push(csvColumns.map((c) => csvEscape((m as Record<string, unknown>)[c])).join(","));
writeFileSync("docs/tasks/shared-member-data/members-preview.csv", csvLines.join("\n") + "\n", "utf8");

// ---- XLSX ----

async function writeXlsx() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Members preview");

  sheet.columns = [
    { header: "ID", key: "preview_id", width: 11 },
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
    { header: "Staff notes", key: "staff_notes", width: 36 },
    { header: "Instructor?", key: "is_instructor", width: 11 },
  ];

  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6E3FE0" } };
    cell.alignment = { vertical: "middle" };
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: "R1" };

  for (const m of members) sheet.addRow(m);

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F1FA" } };
      });
    }
  });

  await workbook.xlsx.writeFile("docs/tasks/shared-member-data/members-preview.xlsx");
}

writeXlsx().then(() => {
  const counts = members.reduce((acc: Record<string, number>, m) => {
    acc[m.lifecycle_status] = (acc[m.lifecycle_status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Generated ${members.length} members.`);
  console.log("Lifecycle distribution:", counts);
  console.log("Account holders:", members.filter((m) => m.has_account).length);
  console.log("Wrote docs/tasks/shared-member-data/members-preview.csv");
  console.log("Wrote docs/tasks/shared-member-data/members-preview.xlsx");
});
