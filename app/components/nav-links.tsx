"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { IconCalendar, IconDashboard, IconShield, IconSparkle } from "@/app/components/icons";

type NavLinksProps = {
  role: string;
};

const links = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { href: "/appointments", label: "Book a class", icon: IconCalendar },
  { href: "/chat", label: "FitBot", icon: IconSparkle },
] as const;

export default function NavLinks({ role }: NavLinksProps) {
  const pathname = usePathname();
  const navLinks = role === "staff" || role === "admin" ? [...links, { href: "/staff", label: "Staff", icon: IconShield }] : links;

  return (
    <div className="nav-links">
      {navLinks.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;

        return (
          <Link className={`nav-link${isActive ? " active" : ""}`} href={href} aria-current={isActive ? "page" : undefined} key={href}>
            <Icon />
            <span className="sr-only">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
