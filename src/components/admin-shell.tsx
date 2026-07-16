import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
  Activity,
  ChartNoAxesCombined,
  ClipboardList,
  Dumbbell,
  History,
  LogOut,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { APP_BUILD_LABEL } from "@/lib/build-info";
import { signOutOfSupabase } from "@/lib/supabase-public";

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  activeClass: string;
  iconClass: string;
  relatedPaths?: string[];
};

const NAV: NavItem[] = [
  {
    to: "/",
    label: "Today",
    icon: <Sun className="h-4 w-4" />,
    activeClass: "border-amber-500/40 bg-amber-500/10 text-amber-300 shadow",
    iconClass: "text-amber-400",
  },
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: <Activity className="h-4 w-4" />,
    activeClass: "border-sky-500/40 bg-sky-500/10 text-sky-300 shadow",
    iconClass: "text-sky-400",
  },
  {
    to: "/log",
    label: "Log",
    icon: <Dumbbell className="h-4 w-4" />,
    activeClass: "border-violet-500/40 bg-violet-500/10 text-violet-300 shadow",
    iconClass: "text-violet-400",
  },
  {
    to: "/plan",
    label: "Plan",
    icon: <ClipboardList className="h-4 w-4" />,
    activeClass: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300 shadow",
    iconClass: "text-fuchsia-400",
  },
  {
    to: "/progress",
    label: "Progress",
    icon: <ChartNoAxesCombined className="h-4 w-4" />,
    activeClass: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300 shadow",
    iconClass: "text-cyan-400",
  },
  {
    to: "/history",
    label: "History",
    icon: <History className="h-4 w-4" />,
    activeClass: "border-rose-500/40 bg-rose-500/10 text-rose-300 shadow",
    iconClass: "text-rose-400",
  },
  {
    to: "/manage",
    label: "Manage",
    icon: <SettingsIcon className="h-4 w-4" />,
    activeClass: "border-amber-500/40 bg-amber-500/10 text-amber-300 shadow",
    iconClass: "text-amber-400",
    relatedPaths: ["/library", "/methods", "/rotation", "/goals", "/locations"],
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-semibold leading-none sm:text-lg">Training Tracker</h1>
            <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
              {APP_BUILD_LABEL}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOutOfSupabase();
              window.location.reload();
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-3 sm:px-5">
          {NAV.map((item) => {
            const active =
              pathname === item.to ||
              (item.to !== "/" && pathname.startsWith(`${item.to}/`)) ||
              item.relatedPaths?.some(
                (path) => pathname === path || pathname.startsWith(`${path}/`),
              );
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition sm:text-sm ${
                  active
                    ? item.activeClass
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className={active ? item.iconClass : ""}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">{children}</main>
    </div>
  );
}
