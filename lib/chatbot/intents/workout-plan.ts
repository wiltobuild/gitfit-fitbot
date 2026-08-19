import type { Intent } from "@/lib/chatbot/types";

type Goal = "strength" | "cardio" | "flexibility" | "general";
type Equipment = "bodyweight" | "dumbbells" | "full-gym";
type Level = "beginner" | "intermediate" | "advanced";

type Exercise = {
  name: string;
  durationMinutes: number;
  notes?: string;
  levels: Level[];
};

type WorkoutBlock = {
  label: "Warmup" | "Main" | "Cooldown";
  exercises: Array<Pick<Exercise, "name" | "durationMinutes" | "notes">>;
};

const exerciseLibrary: Record<Goal, Partial<Record<Equipment, Exercise[]>>> = {
  strength: {
    bodyweight: [
      { name: "Bodyweight squats", durationMinutes: 4, notes: "Move slowly and keep your chest tall.", levels: ["beginner", "intermediate", "advanced"] },
      { name: "Incline or standard push-ups", durationMinutes: 4, notes: "Use an elevated surface as needed.", levels: ["beginner", "intermediate", "advanced"] },
      { name: "Glute bridges", durationMinutes: 3, levels: ["beginner", "intermediate", "advanced"] },
      { name: "Reverse lunges", durationMinutes: 4, levels: ["intermediate", "advanced"] },
    ],
    dumbbells: [
      { name: "Dumbbell goblet squats", durationMinutes: 4, levels: ["beginner", "intermediate", "advanced"] },
      { name: "Dumbbell floor press", durationMinutes: 4, levels: ["beginner", "intermediate", "advanced"] },
      { name: "Dumbbell rows", durationMinutes: 4, levels: ["beginner", "intermediate", "advanced"] },
      { name: "Dumbbell Romanian deadlifts", durationMinutes: 4, levels: ["intermediate", "advanced"] },
    ],
    "full-gym": [
      { name: "Leg press", durationMinutes: 4, levels: ["beginner", "intermediate", "advanced"] },
      { name: "Machine chest press", durationMinutes: 4, levels: ["beginner", "intermediate", "advanced"] },
      { name: "Lat pulldowns", durationMinutes: 4, levels: ["beginner", "intermediate", "advanced"] },
      { name: "Barbell deadlifts", durationMinutes: 4, notes: "Use a load and technique you can control.", levels: ["advanced"] },
    ],
  },
  cardio: {
    bodyweight: [
      { name: "March in place", durationMinutes: 3, levels: ["beginner", "intermediate", "advanced"] },
      { name: "Step jacks", durationMinutes: 3, levels: ["beginner", "intermediate", "advanced"] },
      { name: "High knees", durationMinutes: 3, levels: ["intermediate", "advanced"] },
      { name: "Mountain climbers", durationMinutes: 3, levels: ["advanced"] },
    ],
  },
  flexibility: {
    bodyweight: [
      { name: "Cat-cow", durationMinutes: 3, levels: ["beginner", "intermediate", "advanced"] },
      { name: "World's greatest stretch", durationMinutes: 3, levels: ["intermediate", "advanced"] },
      { name: "Hip flexor stretch", durationMinutes: 3, levels: ["beginner", "intermediate", "advanced"] },
      { name: "Child's pose with side reach", durationMinutes: 3, levels: ["beginner", "intermediate", "advanced"] },
    ],
  },
  general: {
    bodyweight: [
      { name: "Bodyweight squats", durationMinutes: 3, levels: ["beginner", "intermediate", "advanced"] },
      { name: "Incline or standard push-ups", durationMinutes: 3, levels: ["beginner", "intermediate", "advanced"] },
      { name: "Step jacks", durationMinutes: 3, levels: ["beginner", "intermediate", "advanced"] },
      { name: "Bird dogs", durationMinutes: 3, levels: ["beginner", "intermediate", "advanced"] },
    ],
  },
};

const warmupExercises: Exercise[] = [
  { name: "Easy march and arm circles", durationMinutes: 2, levels: ["beginner", "intermediate", "advanced"] },
  { name: "Dynamic hip and shoulder mobility", durationMinutes: 3, levels: ["beginner", "intermediate", "advanced"] },
];

const cooldownExercises: Exercise[] = [
  { name: "Easy breathing and walk in place", durationMinutes: 2, levels: ["beginner", "intermediate", "advanced"] },
  { name: "Gentle full-body stretch", durationMinutes: 3, levels: ["beginner", "intermediate", "advanced"] },
];

function parseDuration(message: string) {
  const match = message.match(/\b(\d{1,3})\s*-?\s*(?:min(?:ute)?s?)\b/i);
  return match ? Number(match[1]) : 30;
}

function parseGoal(message: string): Goal {
  if (/\b(strength|strong|muscle)\b/i.test(message)) return "strength";
  if (/\b(cardio|conditioning|endurance)\b/i.test(message)) return "cardio";
  if (/\b(flexibility|mobility|stretch)\b/i.test(message)) return "flexibility";
  return "general";
}

function parseEquipment(message: string): Equipment {
  if (/\bdumbbells?\b/i.test(message)) return "dumbbells";
  if (/\b(gym|barbell|machines?)\b/i.test(message)) return "full-gym";
  return "bodyweight";
}

function parseLevel(message: string): Level {
  if (/\b(intermediate)\b/i.test(message)) return "intermediate";
  if (/\b(advanced|experienced)\b/i.test(message)) return "advanced";
  return "beginner";
}

function selectExercises(goal: Goal, equipment: Equipment, level: Level) {
  const exercises = exerciseLibrary[goal][equipment] ?? exerciseLibrary[goal].bodyweight ?? exerciseLibrary.general.bodyweight!;
  const levelMatches = exercises.filter((exercise) => exercise.levels.includes(level));
  return levelMatches.length ? levelMatches : exercises;
}

function fillBlock(exercises: Exercise[], minutes: number) {
  const filled: WorkoutBlock["exercises"] = [];
  let remaining = minutes;
  let index = 0;

  while (remaining > 0) {
    const exercise = exercises[index % exercises.length];
    const durationMinutes = Math.min(exercise.durationMinutes, remaining);
    filled.push({ name: exercise.name, durationMinutes, ...(exercise.notes ? { notes: exercise.notes } : {}) });
    remaining -= durationMinutes;
    index += 1;
  }

  return filled;
}

function formatBlock(block: WorkoutBlock) {
  return `${block.label} (${block.exercises.reduce((total, exercise) => total + exercise.durationMinutes, 0)} min)\n${block.exercises
    .map((exercise) => `- ${exercise.name} — ${exercise.durationMinutes} min${exercise.notes ? ` (${exercise.notes})` : ""}`)
    .join("\n")}`;
}

export const workoutPlanIntent: Intent = {
  id: "workout-plan",
  description: "Creates a deterministic, template-based workout plan.",
  roles: ["client", "staff"],
  match: (message) => {
    const normalized = message.toLowerCase();
    const hasWorkoutTerm = /\b(workout|exercise|training)\b/.test(normalized);
    const hasPlanningTerm = /\b(plan|build|give me|need (?:a|an)|quick|help me|create)\b/.test(normalized);
    const hasDuration = /\b\d{1,3}\s*-?\s*(?:min(?:ute)?s?)\b/.test(normalized);
    const asksForWorkout = /\bworkout\s+for\b/.test(normalized);
    const asksForWeeklyPlan = /\b(?:help me )?plan my week\b/.test(normalized);

    return asksForWeeklyPlan || (hasWorkoutTerm && (hasPlanningTerm || hasDuration || asksForWorkout));
  },
  handle: (message) => {
    const durationMinutes = parseDuration(message);
    const goal = parseGoal(message);
    const equipment = parseEquipment(message);
    const level = parseLevel(message);
    const warmupMinutes = Math.min(5, Math.max(3, Math.round(durationMinutes * 0.1)));
    const cooldownMinutes = Math.min(5, Math.max(3, Math.round(durationMinutes * 0.1)));
    const mainMinutes = Math.max(1, durationMinutes - warmupMinutes - cooldownMinutes);
    const blocks: WorkoutBlock[] = [
      { label: "Warmup", exercises: fillBlock(warmupExercises, warmupMinutes) },
      { label: "Main", exercises: fillBlock(selectExercises(goal, equipment, level), mainMinutes) },
      { label: "Cooldown", exercises: fillBlock(cooldownExercises, cooldownMinutes) },
    ];
    const reply = [
      `Here’s your ${durationMinutes}-minute ${goal} workout (${equipment}, ${level} level).`,
      ...blocks.map(formatBlock),
      "This is a template plan, not personalized coaching—check with a qualified professional for guidance beyond general fitness.",
    ].join("\n\n");

    return {
      reply,
      data: { durationMinutes, goal, equipment, level, blocks },
      card: { kind: "workout", title: `${durationMinutes}-minute ${goal} workout`, blocks: blocks.flatMap((block) => block.exercises.map((exercise) => ({ name: exercise.name, detail: `${exercise.durationMinutes} min${exercise.notes ? ` · ${exercise.notes}` : ""}`, blockLabel: block.label }))) },
    };
  },
};
