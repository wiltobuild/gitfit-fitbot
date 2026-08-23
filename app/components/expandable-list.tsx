"use client";

import { Fragment, useState, type ReactNode } from "react";

type ExpandableListProps<T> = {
  items: T[];
  initialCount: number;
  renderItem: (item: T, index: number) => ReactNode;
  getKey: (item: T, index: number) => string;
  className?: string;
  showMoreLabel?: (remaining: number) => string;
  showLessLabel?: string;
};

export function ExpandableList<T>({
  items,
  initialCount,
  renderItem,
  getKey,
  className,
  showMoreLabel = (remaining) => `Show ${remaining} more`,
  showLessLabel = "Show less",
}: ExpandableListProps<T>) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, initialCount);
  const hasMore = items.length > initialCount;

  return <>
    <div className={className}>{visibleItems.map((item, index) => <Fragment key={getKey(item, index)}>{renderItem(item, index)}</Fragment>)}</div>
    {hasMore ? <button className="btn btn-ghost expandable-list-toggle" onClick={() => setExpanded((current) => !current)} type="button">{expanded ? showLessLabel : showMoreLabel(items.length - initialCount)}</button> : null}
  </>;
}
