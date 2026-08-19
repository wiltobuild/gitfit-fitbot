import { requireUserOrRedirect } from "@/lib/auth/session";

import SiteNav from "@/app/components/site-nav";

import { AppointmentsExperience } from "./appointments-experience";

export default async function AppointmentsPage() {
  await requireUserOrRedirect();
  return <main className="appointments-shell"><header className="appointments-header"><SiteNav /></header><AppointmentsExperience /></main>;
}
