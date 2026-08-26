import type { ReactNode } from "react";

import { InstructorAvatar } from "@/app/components/instructor-avatar";
import { fillLevel } from "@/lib/classes/fill-level";

export type ScheduleRowCapacity = { booked: number; capacity: number };

export type ScheduleRowProps = {
  name: ReactNode;
  /**
   * Rendered as direct sibling(s) of the name inside .staff-class-summary
   * (a CSS grid, one row per direct child) -- wrap the primary line in its
   * own <span> and any secondary line (e.g. a promo trace) in its own
   * <small>/etc rather than nesting them, so each gets its own row.
   */
  meta: ReactNode;
  instructor?: string;
  avatarSize?: 32 | 40 | 64;
  capacity?: ScheduleRowCapacity;
  capacityLabel?: ReactNode;
  showProgressBar?: boolean;
  highlighted?: boolean;
  actions?: ReactNode;
  className?: string;
  /** "div" when this is nested inside another <li> (e.g. an expandable roster wrapper). */
  as?: "li" | "div";
};

// The shared row for "a scheduled class" wherever it's just being listed/
// referenced (Live Register, trainer schedule, dashboards) -- not the
// booking page's card, which is a structurally different, richer surface
// (description copy, its own primary-page layout) that this was never meant
// to force into a matching shape. Reuses the staff-class-row/staff-fill-*
// classes that Live Register and My Schedule already shared before this
// component existed, rather than introducing a second parallel set of
// "compact row" CSS.
export function ScheduleRow({
  name,
  meta,
  instructor,
  avatarSize = 40,
  capacity,
  capacityLabel,
  showProgressBar = true,
  highlighted,
  actions,
  className,
  as: Tag = "li",
}: ScheduleRowProps) {
  const level = capacity ? fillLevel(capacity.booked, capacity.capacity) : null;

  return (
    <Tag
      className={[
        "staff-class-row",
        level ? `staff-fill-${level}` : "",
        highlighted ? "staff-class-priority" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {instructor ? <InstructorAvatar name={instructor} size={avatarSize} /> : null}
      <div className="staff-class-summary">
        <strong>{name}</strong>
        {meta}
      </div>
      {capacity ? (
        <div className="staff-fill-unit">
          <div className="staff-fill-label">
            {capacityLabel ?? <span className="staff-fill-status">{`${capacity.booked}/${capacity.capacity} booked`}</span>}
          </div>
          {showProgressBar ? (
            <span className="staff-fill-track" aria-label={`${capacity.booked} of ${capacity.capacity} spots booked`}>
              <span style={{ width: `${Math.min(100, capacity.capacity ? (capacity.booked / capacity.capacity) * 100 : 0)}%` }} />
            </span>
          ) : null}
        </div>
      ) : null}
      {actions ? <div className="staff-schedule-actions">{actions}</div> : null}
    </Tag>
  );
}
