import { requireAuth } from "@/lib/auth";
import { ChatInterface } from "@/components/chat-interface";

export default async function ChatPage() {
  await requireAuth();
  return <ChatInterface />;
}
