"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { IconCalendar, IconDashboard, IconShield, IconUsers } from "@/app/components/icons";

type NavLinksProps = {
  role: string;
};

// FitBot has its own always-available floating launcher on every page
// (see ChatbotOverlay) -- a dedicated nav tab to the same feature was
// redundant with it, so it's not listed here.
const links = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { href: "/appointments", label: "Book a class", icon: IconCalendar },
] as const;

export default function NavLinks({ role }: NavLinksProps) {
  const pathname = usePathname();
  const navLinks = role === "staff" || role === "admin" ? [...links, { href: "/staff", label: "Staff", icon: IconShield }, { href: "/retention", label: "Retention", icon: IconUsers }] : links;

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
