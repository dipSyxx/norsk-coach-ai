"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  MessageSquare,
  BookOpen,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";
import { AnimatePresence, motion } from "motion/react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/vocab", label: "Ordforråd", icon: BookOpen },
  { href: "/settings", label: "Innstillinger", icon: Settings },
];

export function AppNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await signOut({ callbackUrl: "/" });
    toast.success("Du er logget ut");
  }

  return (
    <>
      <header className="flex md:hidden items-center justify-between px-4 py-3 border-b border-border bg-card">
        <BrandLogo
          href="/dashboard"
          imageClassName="h-12 w-12"
          textClassName="text-lg"
        />
        <motion.button
          onClick={() => setMobileOpen((open) => !open)}
          className="p-2 text-muted-foreground hover:text-foreground"
          aria-label={mobileOpen ? "Lukk meny" : "Åpne meny"}
          whileTap={{ scale: 0.94 }}
          whileHover={{ scale: 1.03 }}
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </motion.button>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="md:hidden fixed inset-0 top-[53px] z-50 bg-background/95 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.nav
              className="flex flex-col p-4 gap-1"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {NAV_ITEMS.map((item) => (
                <motion.div
                  key={item.href}
                  whileHover={{ x: 2 }}
                  transition={{ type: "spring", stiffness: 340, damping: 22 }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                      pathname.startsWith(item.href)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              <motion.button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted mt-4 text-left"
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 340, damping: 22 }}
              >
                <LogOut className="h-5 w-5" />
                Logg ut
              </motion.button>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      <aside className="hidden md:flex flex-col w-60 border-r border-border bg-card h-screen sticky top-0">
        <div className="px-5 py-5">
          <BrandLogo
            href="/dashboard"
            imageClassName="h-12 w-12"
            textClassName="text-lg"
          />
        </div>

        <nav className="flex-1 flex flex-col px-3 gap-0.5">
          {NAV_ITEMS.map((item) => (
            <motion.div
              key={item.href}
              whileHover={{ x: 2 }}
              transition={{ type: "spring", stiffness: 340, damping: 22 }}
            >
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  pathname.startsWith(item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            </motion.div>
          ))}
        </nav>

        <div className="px-3 pb-4">
          <motion.button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted w-full"
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.99 }}
            transition={{ type: "spring", stiffness: 340, damping: 22 }}
          >
            <LogOut className="h-4 w-4" />
            Logg ut
          </motion.button>
        </div>
      </aside>
    </>
  );
}
