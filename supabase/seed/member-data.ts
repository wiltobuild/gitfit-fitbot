// Shared generation logic for the 300-member synthetic dataset — used by
// both the no-write preview generator (generate-members-preview.ts) and the
// real seed script (seed-members.ts), so what gets loaded into Supabase is
// byte-identical to what the team already reviewed.

import { faker } from "@faker-js/faker";

export const SEED = 20260819; // fixed seed — reproducible across runs
export const TOTAL_MEMBERS = 300;
export const ACCOUNT_HOLDER_COUNT = 25; // subset that gets real Supabase Auth logins
export const EMAIL_DOMAIN = "gitfit.demo"; // obviously-synthetic — never a real domain
export const DEMO_PASSWORD = "Welcome!"; // same password already used for the 4 staff accounts

const CLASS_TYPES = ["Yoga", "Cycling", "HIIT"]; // matches supabase/migrations/0004_classes.sql
const GOALS = [
  "Build strength",
  "Lose weight",
  "Improve flexibility",
  "Train for an event",
  "General fitness",
  "Stress relief",
  "Build endurance",
];
const MEMBERSHIP_TIERS = ["basic", "premium"];
const FITNESS_LEVELS = ["beginner", "intermediate", "advanced"];
const STAFF_NOTES_SAMPLES = [
  "Prefers morning classes.",
  "Recovering from a knee injury — low impact only for now.",
  "Very engaged — potential class ambassador.",
  "Asked about switching to premium tier.",
  "Travels frequently, bookings are irregular.",
  "Training for a half-marathon this fall.",
];

// The 3 existing instructors from supabase/migrations/0004_classes.sql —
// seeded as members with is_instructor = true so `classes.instructor`
// (currently free text) has a real backing member row.
const EXISTING_INSTRUCTORS = ["Sofia Martinez", "Marcus Lee", "Avery Thompson"];

export type GeneratedMember = {
  preview_id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  birthdate: string;
  phone: string;
  has_account: boolean;
  join_date: string;
  membership_tier: string;
  membership_status: string;
  last_visit_date: string;
  lifecycle_status: "active" | "at_risk" | "lapsed";
  goals: string;
  preferred_class_types: string;
  fitness_level: string;
  staff_notes: string;
  is_instructor: boolean;
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(faker.number.float({ min: 0, max: 0.999999 }) * arr.length)];
}

function pickSome<T>(arr: T[], min: number, max: number): T[] {
  const count = faker.number.int({ min, max });
  return faker.helpers.arrayElements(arr, count);
}

function lifecycleStatus(index: number): "active" | "at_risk" | "lapsed" {
  const ratio = index / TOTAL_MEMBERS;
  if (ratio < 0.55) return "active";
  if (ratio < 0.8) return "at_risk";
  return "lapsed";
}

function lastVisitDateFor(status: string) {
  const today = new Date("2026-08-19T00:00:00Z");
  const daysAgo =
    status === "active"
      ? faker.number.int({ min: 0, max: 13 })
      : status === "at_risk"
        ? faker.number.int({ min: 30, max: 60 })
        : faker.number.int({ min: 90, max: 240 });
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function joinDate() {
  const today = new Date("2026-08-19T00:00:00Z");
  const daysAgo = faker.number.int({ min: 14, max: 730 });
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function membershipStatusFor(lifecycle: string) {
  const roll = faker.number.float({ min: 0, max: 1 });
  if (lifecycle === "lapsed") {
    if (roll < 0.35) return "cancelled";
    if (roll < 0.55) return "paused";
    return "active";
  }
  if (lifecycle === "at_risk") {
    if (roll < 0.12) return "paused";
    return "active";
  }
  return "active";
}

export function generateMembers(): GeneratedMember[] {
  faker.seed(SEED);

  const usedEmails = new Set<string>();
  function uniqueEmail(firstName: string, lastName: string) {
    const base = `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, "");
    let email = `${base}@${EMAIL_DOMAIN}`;
    let n = 1;
    while (usedEmails.has(email)) {
      n += 1;
      email = `${base}${n}@${EMAIL_DOMAIN}`;
    }
    usedEmails.add(email);
    return email;
  }

  const accountHolderIndices = new Set<number>();
  {
    const stride = TOTAL_MEMBERS / ACCOUNT_HOLDER_COUNT;
    for (let i = 0; i < ACCOUNT_HOLDER_COUNT; i++) {
      accountHolderIndices.add(Math.floor(i * stride));
    }
  }

  const members: GeneratedMember[] = [];

  for (let i = 0; i < TOTAL_MEMBERS; i++) {
    const generatedFirstName = faker.person.firstName();
    const generatedLastName = faker.person.lastName();
    const isInstructor = i < EXISTING_INSTRUCTORS.length;
    const [firstName, lastName] = isInstructor
      ? EXISTING_INSTRUCTORS[i].split(" ")
      : [generatedFirstName, generatedLastName];
    const fullName = `${firstName} ${lastName}`;
    const email = uniqueEmail(firstName, lastName);
    // refDate is pinned (not real "now") — faker.date.birthdate otherwise
    // anchors to the actual current time, making the "fixed seed" promise
    // false: re-running the script at a different moment shifts a handful
    // of ages across a day boundary even with the same faker.seed().
    const birthdate = faker.date
      .birthdate({ min: 18, max: 68, mode: "age", refDate: "2026-08-19T00:00:00Z" })
      .toISOString()
      .slice(0, 10);

    const lifecycle_status = isInstructor ? "active" : lifecycleStatus(i - EXISTING_INSTRUCTORS.length);
    const hasAccount = isInstructor || accountHolderIndices.has(i);

    members.push({
      preview_id: `mem_${String(i + 1).padStart(4, "0")}`,
      email,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      birthdate,
      phone: `(555) ${faker.number.int({ min: 200, max: 999 })}-${String(faker.number.int({ min: 0, max: 9999 })).padStart(4, "0")}`,
      has_account: hasAccount,
      join_date: joinDate(),
      membership_tier: pick(MEMBERSHIP_TIERS),
      membership_status: membershipStatusFor(lifecycle_status),
      last_visit_date: lastVisitDateFor(lifecycle_status),
      lifecycle_status,
      goals: pickSome(GOALS, 1, 2).join("; "),
      preferred_class_types: pickSome(CLASS_TYPES, 1, 2).join("; "),
      fitness_level: pick(FITNESS_LEVELS),
      staff_notes: faker.number.float({ min: 0, max: 1 }) < 0.15 ? pick(STAFF_NOTES_SAMPLES) : "",
      is_instructor: isInstructor,
    });
  }

  return members;
}
