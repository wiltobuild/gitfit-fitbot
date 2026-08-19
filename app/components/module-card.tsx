import Link from "next/link";

type ModuleCardProps = {
  href: string;
  title: string;
  description: string;
  icon?: string;
};

export default function ModuleCard({ href, title, description, icon }: ModuleCardProps) {
  return (
    <Link className="module-card" href={href}>
      {icon && <span className="module-card-icon" aria-hidden="true">{icon}</span>}
      <h2>{title}</h2>
      <p>{description}</p>
      <b aria-hidden="true">→</b>
    </Link>
  );
}
