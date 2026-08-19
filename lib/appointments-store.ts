import classesData from "@/app/appointments/data/classes.json";
import bookingsData from "@/app/appointments/data/bookings.json";
import membersData from "@/app/appointments/data/members.json";
import type {
  AppointmentsState,
  Booking,
  ClassSession,
  Member
} from "@/app/appointments/types";

export const CURRENT_MEMBER_ID = "member_001";
export type AppointmentErrorCode =
  | "class_not_found"
  | "class_full"
  | "insufficient_credits"
  | "already_booked"
  | "not_booked";
export type AppointmentResult =
  | { ok: true; state: AppointmentsState }
  | { ok: false; code: AppointmentErrorCode; message: string };

const classes: ClassSession[] = structuredClone(classesData) as ClassSession[];
const members: Member[] = structuredClone(membersData) as Member[];
const loadedCurrentMember = members.find(
  (member) => member.id === CURRENT_MEMBER_ID
);
if (!loadedCurrentMember)
  throw new Error(
    `Current member ${CURRENT_MEMBER_ID} was not found in the appointment seed data.`
  );
const currentMember: Member = loadedCurrentMember;

const heldClassIds = new Set(
  (bookingsData as Booking[])
    .filter(
      (booking) =>
        booking.memberId === CURRENT_MEMBER_ID && booking.status === "confirmed"
    )
    .map((booking) => booking.classId)
);

function error(code: AppointmentErrorCode, message: string): AppointmentResult {
  return { ok: false, code, message };
}

export function getState(): AppointmentsState {
  return {
    classes: classes.map((classSession) => ({
      ...classSession,
      isBookedByCurrentMember: heldClassIds.has(classSession.id)
    })),
    currentMember: {
      id: currentMember.id,
      name: currentMember.name,
      tier: currentMember.tier,
      monthlyCredits: currentMember.monthlyCredits,
      remainingCredits: currentMember.remainingCredits
    }
  };
}

export function reserve(classId: string): AppointmentResult {
  const classSession = classes.find((item) => item.id === classId);
  if (!classSession)
    return error("class_not_found", "That class could not be found.");
  if (heldClassIds.has(classId))
    return error(
      "already_booked",
      "You already have a spot reserved in this class."
    );
  if (classSession.bookedCount >= classSession.capacity)
    return error("class_full", "This class has no open spots.");
  if (
    currentMember.remainingCredits !== null &&
    currentMember.remainingCredits <= 0
  )
    return error(
      "insufficient_credits",
      "You do not have any class credits remaining."
    );
  classSession.bookedCount += 1;
  heldClassIds.add(classId);
  if (currentMember.remainingCredits !== null)
    currentMember.remainingCredits -= 1;
  return { ok: true, state: getState() };
}

export function cancel(classId: string): AppointmentResult {
  const classSession = classes.find((item) => item.id === classId);
  if (!classSession)
    return error("class_not_found", "That class could not be found.");
  if (!heldClassIds.has(classId))
    return error(
      "not_booked",
      "You do not have a spot reserved in this class."
    );
  classSession.bookedCount -= 1;
  heldClassIds.delete(classId);
  if (currentMember.remainingCredits !== null)
    currentMember.remainingCredits += 1;
  return { ok: true, state: getState() };
}
