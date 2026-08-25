import { requireUserOrRedirect } from "@/lib/auth/session";

import { ChatExperience } from "./chat-experience";

export default async function ChatPage() {
  await requireUserOrRedirect();
  return <ChatExperience />;
}
