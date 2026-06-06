import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { Activity, BookOpen, LogOut, Settings as SettingsIcon, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { clearStoredSecret } from "@/lib/auth-middleware";

type NavItem = { to: string; label: string; icon: ReactNode };

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: <Activity className="h-4 w-4" /> },
  { to: "/library", label: "Library", icon: <BookOpen className="h-4 w-4" /> },
  { to: "/goals", label: "Goals", icon: <SettingsIcon className="h-4 w-4" /> },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-semibold leading-none sm:text-lg">Training Admin</h1>
            <p className="text-xs text-muted-foreground">
              Dashboard, library and goals for your training spreadsheet
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearStoredSecret();
              window.location.reload();
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-3 sm:px-5">
          {NAV.map((item) => {
            const active =
              pathname === item.to ||
              (item.to !== "/" && pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition sm:text-sm ${
                  active
                    ? "border-border bg-card text-foreground shadow"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6">{children}</main>
    </div>
  );
}
