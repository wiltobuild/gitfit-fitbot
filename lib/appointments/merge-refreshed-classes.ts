export type ClassSession = {
  id: string;
  name: string;
  type: string;
  instructor: string;
  class_date: string;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  booked_count: number;
  isBookedByCurrentUser: boolean;
};

// Merges a fresh /api/appointments/classes response into the client's current
// `classes` state. Membership and ordering follow `refreshed` (the server's
// canonical view) so added/removed classes and live capacity always win.
// The one exception: the class matching `pendingId` (a booking/cancel this
// user just made locally) keeps its CURRENT isBookedByCurrentUser, so a
// refetch that predates that write can't silently revert it.
export function mergeRefreshedClasses(
  current: ClassSession[],
  refreshed: ClassSession[],
  pendingId?: string | null,
): ClassSession[] {
  const currentById = new Map(current.map((row) => [row.id, row]));

  return refreshed.map((row) => {
    if (row.id === pendingId) {
      const pendingRow = currentById.get(row.id);
      if (pendingRow) return { ...row, isBookedByCurrentUser: pendingRow.isBookedByCurrentUser };
    }
    return row;
  });
}
