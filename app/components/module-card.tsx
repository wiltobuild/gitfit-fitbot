import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

type ModuleCardProps = {
  href: string;
  title: string;
  description: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  animationDelay?: string;
};

export default function ModuleCard({ href, title, description, icon: Icon, animationDelay }: ModuleCardProps) {
  return (
    <Link className="module-card animate-fade-up" href={href} style={{ animationDelay }}>
      {Icon && <span className="module-card-icon"><Icon /></span>}
      <h2>{title}</h2>
      <p>{description}</p>
      <b aria-hidden="true">→</b>
    </Link>
  );
}
