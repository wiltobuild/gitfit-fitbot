const timePattern = /^\d{2}:\d{2}(:\d{2})?$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export type ClassCreationRequestInput = {
  name: string;
  type: string;
  classDate: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  reason: string | null;
};

export function parseClassCreationInput(body: unknown): ClassCreationRequestInput | null {
  const record = body as Record<string, unknown> | null;
  const name = typeof record?.name === "string" ? record.name.trim() : "";
  const type = typeof record?.type === "string" ? record.type.trim() : "";
  const classDate = typeof record?.classDate === "string" ? record.classDate.trim() : "";
  const startTime = typeof record?.startTime === "string" ? record.startTime.trim() : "";
  const durationMinutes = Number(record?.durationMinutes);
  const capacity = Number(record?.capacity);
  const reason = typeof record?.reason === "string" && record.reason.trim() ? record.reason.trim() : null;

  if (!name || !type) return null;
  if (!datePattern.test(classDate) || !timePattern.test(startTime)) return null;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;
  if (!Number.isFinite(capacity) || capacity <= 0) return null;

  return { name, type, classDate, startTime, durationMinutes, capacity, reason };
}
