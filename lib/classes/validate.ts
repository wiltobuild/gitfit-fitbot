import type { ClassInput } from "@/lib/classes/queries";

const timePattern = /^\d{2}:\d{2}(:\d{2})?$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function parseClassInput(body: unknown): ClassInput | null {
  const record = body as Record<string, unknown> | null;
  const name = typeof record?.name === "string" ? record.name.trim() : "";
  const type = typeof record?.type === "string" ? record.type.trim() : "";
  const instructorMemberId = typeof record?.instructorMemberId === "string" ? record.instructorMemberId.trim() : "";
  const instructorName = typeof record?.instructorName === "string" ? record.instructorName.trim() : "";
  const classDate = typeof record?.classDate === "string" ? record.classDate.trim() : "";
  const startTime = typeof record?.startTime === "string" ? record.startTime.trim() : "";
  const durationMinutes = Number(record?.durationMinutes);
  const capacity = Number(record?.capacity);

  if (!name || !type || !instructorMemberId || !instructorName) return null;
  if (!datePattern.test(classDate) || !timePattern.test(startTime)) return null;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;
  if (!Number.isFinite(capacity) || capacity <= 0) return null;

  return { name, type, instructorMemberId, instructorName, classDate, startTime, durationMinutes, capacity };
}
