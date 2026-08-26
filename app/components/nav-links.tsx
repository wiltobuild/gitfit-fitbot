"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { IconCalendar, IconDashboard, IconShield, IconUsers } from "@/app/components/icons";

type NavLinksProps = {
  role: string;
};

type NavLink = { href: string; label: string; icon: typeof IconCalendar };

// FitBot has its own always-available floating launcher on every page
// (see ChatbotOverlay) -- a dedicated nav tab to the same feature was
// redundant with it, so it's not listed here.
const bookAClass: NavLink = { href: "/appointments", label: "Book a class", icon: IconCalendar };
const dashboard: NavLink = { href: "/dashboard", label: "Dashboard", icon: IconDashboard };
const staffConsole: NavLink = { href: "/staff", label: "Staff", icon: IconShield };
const retention: NavLink = { href: "/retention", label: "Retention", icon: IconUsers };

// Personal ("my stuff") vs operational ("run the studio") is a role
// question, not a fixed link list: a client's dashboard is their own
// bookings/streak (personal), an admin's dashboard is studio-wide KPIs
// (operational), and staff doesn't get a separate dashboard entry at all
// -- /dashboard just redirects them straight to /staff now, so a second
// nav entry pointing at the same destination would be a link to a link.
// Booking a class is a client-only action -- staff/admin operate the
// studio, they don't book into it as a member, so neither gets a "My
// stuff" group at all.
function getLinkGroups(role: string): { myStuff: NavLink[]; runTheStudio: NavLink[] } {
  if (role === "admin") return { myStuff: [], runTheStudio: [dashboard, staffConsole, retention] };
  if (role === "staff") return { myStuff: [], runTheStudio: [staffConsole, retention] };
  return { myStuff: [dashboard, bookAClass], runTheStudio: [] };
}

export default function NavLinks({ role }: NavLinksProps) {
  const pathname = usePathname();
  const { myStuff, runTheStudio } = getLinkGroups(role);

  const renderLink = ({ href, label, icon: Icon }: NavLink) => {
    const isActive = pathname === href;
    return (
      <Link className={`nav-link${isActive ? " active" : ""}`} href={href} aria-current={isActive ? "page" : undefined} key={href}>
        <Icon />
        <span className="sr-only">{label}</span>
      </Link>
    );
  };

  return (
    <div className="nav-links">
      {myStuff.length ? <div className="nav-link-group" aria-label="My stuff">{myStuff.map(renderLink)}</div> : null}
      {myStuff.length && runTheStudio.length ? <span className="nav-link-divider" aria-hidden="true" /> : null}
      {runTheStudio.length ? <div className="nav-link-group" aria-label="Run the studio">{runTheStudio.map(renderLink)}</div> : null}
    </div>
  );
}
