import type { CSSProperties } from "react";

type InstructorAvatarProps = { name: string; size: 32 | 40; loading?: "eager" | "lazy" };

const instructorPhotoNames = new Set(["sofia martinez", "marcus lee", "avery thompson"]);

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

export function InstructorAvatar({ name, size, loading = "eager" }: InstructorAvatarProps) {
  const normalizedName = name.trim().toLowerCase();
  const slug = normalizedName.replace(/\s+/g, "-");
  const hasPhoto = instructorPhotoNames.has(normalizedName);

  return <span className="instructor-avatar" style={{ "--instructor-avatar-size": `${size}px` } as CSSProperties}>
    {hasPhoto ? <img alt="" src={`/instructors/${slug}.jpg`} width={size} height={size} loading={loading} /> : <span aria-hidden="true">{initials(name)}</span>}
  </span>;
}
