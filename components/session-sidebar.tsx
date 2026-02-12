"use client";

import { Plus, Trash2, MessageSquare, PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";

interface Session {
  id: string;
  title: string;
  mode: string;
  updated_at: string;
  message_count: string;
}

interface SessionSidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onNewSession: (mode?: string) => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  mobileOpen: boolean;
  onMobileToggle: () => void;
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  mobileOpen,
  onMobileToggle,
}: SessionSidebarProps) {
  const content = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="font-semibold text-foreground text-sm">Samtaler</h2>
        <div className="flex items-center gap-1">
          <motion.button
            onClick={() => onNewSession("free_chat")}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Ny samtale"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Plus className="h-4 w-4" />
          </motion.button>
          <motion.button
            onClick={onMobileToggle}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors md:hidden"
            aria-label="Lukk sidebar"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.95 }}
          >
            <PanelLeftClose className="h-4 w-4" />
          </motion.button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {sessions.length === 0 ? (
          <div className="text-center py-8 px-4">
            <MessageSquare className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Ingen samtaler ennå</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <AnimatePresence initial={false}>
              {sessions.map((session) => (
                <motion.div
                  key={session.id}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors",
                    activeSessionId === session.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                  onClick={() => onSelectSession(session.id)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && onSelectSession(session.id)
                  }
                  role="button"
                  tabIndex={0}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  whileHover={{ x: 1.5 }}
                  transition={{ type: "spring", stiffness: 330, damping: 24 }}
                >
                  <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="flex-1 truncate text-xs">
                    {session.title}
                  </span>
                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-all"
                    aria-label={`Slett ${session.title}`}
                    whileTap={{ scale: 0.92 }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="px-3 py-3 border-t border-border flex flex-col gap-1">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider px-1 mb-1">
          Hurtigmodus
        </span>
        {[
          { mode: "rollespill", label: "Rollespill" },
          { mode: "grammatikk", label: "Grammatikk" },
          { mode: "rett_teksten", label: "Rett teksten" },
          { mode: "ovelse", label: "Lag øvelse" },
        ].map((m, index) => (
          <motion.button
            key={m.mode}
            onClick={() => onNewSession(m.mode)}
            className="text-xs text-left px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            whileHover={{ x: 1.5 }}
            whileTap={{ scale: 0.98 }}
          >
            {m.label}
          </motion.button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <motion.div
        className="hidden md:block w-56 border-r border-border bg-card flex-shrink-0"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {content}
      </motion.div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="md:hidden fixed inset-0 z-50 flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-foreground/20"
              onClick={onMobileToggle}
              onKeyDown={(e) => e.key === "Escape" && onMobileToggle()}
              role="button"
              tabIndex={-1}
              aria-label="Lukk sidebar"
            />
            <motion.div
              className="relative w-64 bg-card border-r border-border z-50"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {content}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
