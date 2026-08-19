export type ClassType = "Yoga" | "Cycling" | "HIIT";

export type ClassSession = {
  id: string;
  name: string;
  type: ClassType;
  instructor: string;
  day: string;
  date: string;
  time: string;
  duration: number;
  capacity: number;
  bookedCount: number;
};

export type Member = {
  id: string;
  name: string;
  email: string;
  tier: string;
  monthlyCredits: number | null;
  remainingCredits: number | null;
  bookedClassIds: string[];
};

export type Booking = {
  id: string;
  memberId: string;
  classId: string;
  status: "confirmed" | "cancelled";
  bookedAt: string;
};

export type ScheduledClass = ClassSession & {
  isBookedByCurrentMember: boolean;
};
export type CurrentMember = Pick<
  Member,
  "id" | "name" | "tier" | "monthlyCredits" | "remainingCredits"
>;
export type AppointmentsState = {
  classes: ScheduledClass[];
  currentMember: CurrentMember;
};
