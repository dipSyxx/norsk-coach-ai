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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    mobileLabel: "Hjem",
    icon: LayoutDashboard,
  },
  { href: "/chat", label: "Chat", mobileLabel: "Chat", icon: MessageSquare },
  {
    href: "/vocab",
    label: "Ordforråd",
    mobileLabel: "Ord",
    icon: BookOpen,
  },
  {
    href: "/settings",
    label: "Innstillinger",
    mobileLabel: "Innst.",
    icon: Settings,
  },
];

export function AppNav() {
  const pathname = usePathname();

  async function handleLogout() {
    await signOut({ callbackUrl: "/" });
    toast.success("Du er logget ut");
  }

  return (
    <>
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4 gap-1 px-2 pt-2 pb-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <motion.div key={item.href} whileTap={{ scale: 0.97 }}>
                <Link
                  href={item.href}
                  aria-label={item.label}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition-colors",
                    active
                      ? "bg-primary/12 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="leading-none">{item.mobileLabel}</span>
                </Link>
              </motion.div>
            );
          })}

        </div>
      </nav>

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
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            </motion.div>
          ))}
        </nav>

        <div className="px-3 pb-4">
          <Button
            asChild
            type="button"
            variant="ghost"
            className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <motion.button
              type="button"
              onClick={handleLogout}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.99 }}
              transition={{ type: "spring", stiffness: 340, damping: 22 }}
            >
              <LogOut className="h-4 w-4" />
              Logg ut
            </motion.button>
          </Button>
        </div>
      </aside>
    </>
  );
}
