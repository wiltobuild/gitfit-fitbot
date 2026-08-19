import { requireUserOrRedirect } from "@/lib/auth/session";

import { AppointmentsExperience } from "./appointments-experience";

export default async function AppointmentsPage() {
  await requireUserOrRedirect();
  return <AppointmentsExperience />;
}
