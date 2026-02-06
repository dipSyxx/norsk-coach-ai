"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { SessionSidebar } from "@/components/session-sidebar";
import { ChatView } from "@/components/chat-view";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ChatSession {
  id: string;
  title: string;
  mode: string;
  topic: string | null;
  created_at: string;
  updated_at: string;
  message_count: string;
}

export function ChatInterface() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionParam = searchParams.get("session");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    sessionParam
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: sessionsData } = useSWR<{ sessions: ChatSession[] }>(
    "/api/sessions",
    fetcher,
    { refreshInterval: 10000 }
  );
  const sessions = sessionsData?.sessions || [];

  // Update active session from URL
  useEffect(() => {
    if (sessionParam) {
      setActiveSessionId(sessionParam);
    }
  }, [sessionParam]);

  const handleNewSession = useCallback(
    async (mode: string = "free_chat") => {
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        });
        const data = await res.json();
        if (data.session) {
          setActiveSessionId(data.session.id);
          router.push(`/chat?session=${data.session.id}`);
          mutate("/api/sessions");
          setSidebarOpen(false);
        }
      } catch (err) {
        console.error("Failed to create session:", err);
      }
    },
    [router]
  );

  const handleSelectSession = useCallback(
    (id: string) => {
      setActiveSessionId(id);
      router.push(`/chat?session=${id}`);
      setSidebarOpen(false);
    },
    [router]
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/sessions/${id}`, { method: "DELETE" });
        mutate("/api/sessions");
        if (activeSessionId === id) {
          setActiveSessionId(null);
          router.push("/chat");
        }
      } catch (err) {
        console.error("Failed to delete session:", err);
      }
    },
    [activeSessionId, router]
  );

  return (
    <div className="flex h-[calc(100vh-53px)] md:h-screen">
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewSession={handleNewSession}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        mobileOpen={sidebarOpen}
        onMobileToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <ChatView
        sessionId={activeSessionId}
        onNewSession={handleNewSession}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />
    </div>
  );
}
