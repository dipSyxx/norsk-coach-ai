"use client";

import React from "react"

import { useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import {
  Send,
  PanelLeft,
  Plus,
  ArrowDown,
  MessageSquare,
} from "lucide-react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ChatViewProps {
  sessionId: string | null;
  onNewSession: (mode?: string) => void;
  onToggleSidebar: () => void;
}

function getMessageText(msg: UIMessage): string {
  if (!msg.parts || !Array.isArray(msg.parts)) return "";
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function ChatView({
  sessionId,
  onNewSession,
  onToggleSidebar,
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, setMessages } = useChat({
    id: sessionId || undefined,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { sessionId },
    }),
  });

  // Reset messages when session changes
  useEffect(() => {
    setMessages([]);
    if (sessionId) {
      loadHistory(sessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function loadHistory(sid: string) {
    try {
      const res = await fetch(`/api/sessions/${sid}`);
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        const restored: UIMessage[] = data.messages.map(
          (m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            parts: [{ type: "text" as const, text: m.content }],
          })
        );
        setMessages(restored);
      }
    } catch {
      // Silently fail - empty chat is fine
    }
  }

  // Auto-scroll
  useEffect(() => {
    if (!showScrollBtn) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, showScrollBtn]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      100;
    setShowScrollBtn(!isNearBottom);
  }, []);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollBtn(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || status === "streaming" || status === "submitted")
      return;

    const text = input.trim();
    setInput("");
    sendMessage({ text });
  }

  // Empty state - no session selected
  if (!sessionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            Velkommen til chatten
          </h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Start en ny samtale med din norske AI-veileder. Velg en modus
            eller start en fri samtale.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => onNewSession("free_chat")}
              className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Ny samtale
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => onNewSession("rollespill")}
                className="flex-1 px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors"
              >
                Rollespill
              </button>
              <button
                onClick={() => onNewSession("grammatikk")}
                className="flex-1 px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors"
              >
                Grammatikk
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-1.5 rounded-md hover:bg-muted text-muted-foreground"
          aria-label="Vis samtaler"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground">
            Samtale
          </span>
        </div>
        {status === "streaming" && (
          <span className="text-xs text-primary animate-pulse">
            Veilederen skriver...
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Skriv din forste melding for å starte samtalen.
              </p>
            </div>
          </div>
        )}

        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <div className="relative">
          <button
            onClick={scrollToBottom}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 p-2 rounded-full bg-card border border-border shadow-sm hover:bg-muted transition-colors"
            aria-label="Rull ned"
          >
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border bg-card px-4 py-3 flex-shrink-0">
        <form
          onSubmit={handleSubmit}
          className="max-w-2xl mx-auto flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Skriv en melding..."
            rows={1}
            className="flex-1 resize-none bg-muted border-0 rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring max-h-32"
            style={{
              height: "auto",
              minHeight: "44px",
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height =
                Math.min(target.scrollHeight, 128) + "px";
            }}
          />
          <button
            type="submit"
            disabled={
              !input.trim() ||
              status === "streaming" ||
              status === "submitted"
            }
            className={cn(
              "p-3 rounded-lg transition-all flex-shrink-0",
              input.trim() &&
                status !== "streaming" &&
                status !== "submitted"
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            aria-label="Send melding"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          NorskCoach bruker AI. Sjekk viktig informasjon.
        </p>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = getMessageText(message);

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-xs font-bold">N</span>
        </div>
      )}
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md"
        )}
      >
        {text || (
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:0.3s]" />
          </span>
        )}
      </div>
    </div>
  );
}
