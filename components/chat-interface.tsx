"use client";

import { useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { SessionSidebar } from "@/components/session-sidebar";
import { ChatView } from "@/components/chat-view";
import { SessionVocabPanel } from "@/components/session-vocab-panel";

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
  const activeSessionId = sessionParam;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [vocabRefreshKey, setVocabRefreshKey] = useState(0);

  const refetchSessionVocab = useCallback(() => {
    if (activeSessionId) {
      setVocabRefreshKey((k) => k + 1);
      mutate(`/api/sessions/${activeSessionId}/vocab`);
    }
  }, [activeSessionId]);

  const { data: sessionsData } = useSWR<{ sessions: ChatSession[] }>(
    "/api/sessions",
    fetcher,
    { refreshInterval: 10000 }
  );
  const sessions = sessionsData?.sessions || [];

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
        onStreamFinish={refetchSessionVocab}
      />
      <SessionVocabPanel
        sessionId={activeSessionId}
        refreshKey={vocabRefreshKey}
      />
    </div>
  );
}
