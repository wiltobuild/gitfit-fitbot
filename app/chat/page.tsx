import { requireUserOrRedirect } from "@/lib/auth/session";

import { ChatExperience } from "./chat-experience";

export default async function ChatPage() {
  const { role } = await requireUserOrRedirect();
  return <ChatExperience canBookClass={role === "client"} />;
}
