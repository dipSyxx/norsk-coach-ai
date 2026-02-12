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
  Trash2,
  Download,
} from "lucide-react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "motion/react";

interface ChatViewProps {
  sessionId: string | null;
  onNewSession: (mode?: string) => void;
  onToggleSidebar: () => void;
  onStreamFinish?: () => void;
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
  onStreamFinish,
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [input, setInput] = useState("");
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const prevStatusRef = useRef<string | undefined>(undefined);

  const { messages, sendMessage, status, setMessages } = useChat({
    id: sessionId || undefined,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { sessionId },
    }),
    onError: (err) => {
      const msg = err?.message ?? "";
      if (msg.includes("429") || msg.includes("Too many")) {
        toast.error("For mange meldinger. Vent litt før du prøver igjen.");
      } else if (msg.includes("400") || msg.includes("too long") || msg.includes("appropriate")) {
        try {
          const body = (err as { body?: { error?: string } })?.body;
          const apiMsg = typeof body?.error === "string" ? body.error : null;
          toast.error(apiMsg ?? "Meldingen kunne ikke sendes. Prøv igjen.");
        } catch {
          toast.error("Meldingen kunne ikke sendes. Prøv igjen.");
        }
      } else {
        toast.error("Noe gikk galt. Prøv igjen senere.");
      }
    },
  });

  useEffect(() => {
    if (prevStatusRef.current === "streaming" && status === "ready") {
      onStreamFinish?.();
    }
    prevStatusRef.current = status;
  }, [status, onStreamFinish]);

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
        const restored: (UIMessage & { created_at?: string })[] = data.messages.map(
          (m: { id: string; role: string; content: string; created_at?: string }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            parts: [{ type: "text" as const, text: m.content }],
            created_at: m.created_at,
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

  async function handleExportSession() {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/export?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `session-${sessionId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Samtalen er eksportert");
    } catch {
      toast.error("Kunne ikke eksportere samtalen");
    }
  }

  async function handleClearChat() {
    if (!sessionId) return;
    setClearing(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessages([]);
        setClearDialogOpen(false);
        toast.success("Chatten er tømt");
      } else {
        toast.error("Kunne ikke tømme chatten");
      }
    } catch {
      toast.error("Kunne ikke tømme chatten");
    } finally {
      setClearing(false);
    }
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
      <motion.div
        className="flex-1 min-h-0 flex flex-col items-center justify-center px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="text-center max-w-sm">
          <motion.div
            className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <MessageSquare className="h-8 w-8" />
          </motion.div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            Velkommen til chatten
          </h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Start en ny samtale med din norske AI-veileder. Velg en modus
            eller start en fri samtale.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={onToggleSidebar}
              className="md:hidden inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors"
              aria-label="Velg samtale"
            >
              <PanelLeft className="h-4 w-4" />
              Velg samtale
            </button>
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
      </motion.div>
    );
  }

  return (
    <motion.div
      className="flex-1 min-h-0 flex flex-col min-w-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
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
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Eksporter samtale"
          onClick={handleExportSession}
        >
          <Download className="h-4 w-4" />
        </Button>
        <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Tøm chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tøm chat</AlertDialogTitle>
              <AlertDialogDescription>
                Er du sikker på at du vil slette alle meldinger i denne samtalen? Denne handlingen kan ikke angres.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleClearChat();
                }}
                disabled={clearing}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {clearing ? "Tømmer..." : "Tøm chat"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.div
            className="relative"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
          >
            <button
              onClick={scrollToBottom}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 p-2 rounded-full bg-card border border-border shadow-sm hover:bg-muted transition-colors"
              aria-label="Rull ned"
            >
              <ArrowDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
    </motion.div>
  );
}

function formatMessageTime(createdAt: string | undefined): string {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "Akkurat nå";
  if (minutes < 60) return `${minutes} min siden`;
  if (hours < 24) return `${hours}t siden`;
  if (days < 7) return `${days}d siden`;
  return date.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
}

function ChatBubble({ message }: { message: UIMessage & { created_at?: string } }) {
  const isUser = message.role === "user";
  const text = getMessageText(message);
  const timeStr = formatMessageTime(message.created_at);

  return (
    <motion.div
      className={cn(
        "flex gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      {!isUser && (
        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-xs font-bold">N</span>
        </div>
      )}
      <div className={cn("flex flex-col gap-0.5 max-w-[80%]", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 w-full text-sm leading-relaxed whitespace-pre-wrap",
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
        {timeStr && (
          <span className="text-[10px] text-muted-foreground">
            {timeStr}
          </span>
        )}
      </div>
    </motion.div>
  );
}
