import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
  ChartNoAxesCombined,
  ClipboardList,
  Dumbbell,
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
  relatedPaths?: string[];
};

const NAV: NavItem[] = [
  {
    to: "/",
    label: "Today",
    icon: <Sun className="h-4 w-4" />,
  },
  {
    to: "/log",
    label: "Log",
    icon: <Dumbbell className="h-4 w-4" />,
  },
  {
    to: "/plan",
    label: "Plan",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    to: "/dashboard",
    label: "Review",
    icon: <ChartNoAxesCombined className="h-4 w-4" />,
    relatedPaths: ["/weekly-review", "/progress", "/history"],
  },
];

const REVIEW_NAV: Omit<NavItem, "icon">[] = [
  {
    to: "/dashboard",
    label: "Overview",
    relatedPaths: ["/weekly-review"],
  },
  {
    to: "/progress",
    label: "Progress",
  },
  {
    to: "/history",
    label: "History",
  },
];

const SETTINGS_PATHS = [
  "/manage",
  "/library",
  "/methods",
  "/rotation",
  "/goals",
  "/locations",
  "/programmes",
  "/data-quality",
];

function pathMatches(pathname: string, item: Pick<NavItem, "to" | "relatedPaths">) {
  return (
    pathname === item.to ||
    (item.to !== "/" && pathname.startsWith(`${item.to}/`)) ||
    item.relatedPaths?.some((path) => pathname === path || pathname.startsWith(`${path}/`)) === true
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const reviewActive = REVIEW_NAV.some((item) => pathMatches(pathname, item));
  const settingsActive = SETTINGS_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

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
            <p className="mt-1 hidden text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 sm:block">
              {APP_BUILD_LABEL}
            </p>
          </div>
          <Button
            asChild
            variant={settingsActive ? "secondary" : "ghost"}
            size="sm"
            className={`gap-2 px-2 sm:px-3 ${
              settingsActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Link
              to="/manage"
              aria-label="Settings"
              aria-current={settingsActive ? "page" : undefined}
              title="Settings"
            >
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
          </Button>
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
        <nav
          aria-label="Primary navigation"
          className="mx-auto hidden max-w-6xl gap-1 px-5 pb-3 sm:flex"
        >
          {NAV.map((item) => {
            const active = pathMatches(pathname, item);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-2 py-1.5 text-xs font-medium transition sm:px-3 sm:text-sm ${
                  active
                    ? "border-primary/40 bg-primary/10 text-primary shadow"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className={active ? "text-primary" : ""}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        {reviewActive ? (
          <div className="border-t border-border/70 bg-muted/15">
            <nav
              aria-label="Review sections"
              className="mx-auto grid max-w-6xl grid-cols-3 gap-1 px-3 py-2 sm:flex sm:px-5"
            >
              {REVIEW_NAV.map((item) => {
                const active = pathMatches(pathname, item);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-md px-3 py-1.5 text-center text-xs font-medium transition ${
                      active
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pb-24">{children}</main>
      <nav
        aria-label="Primary navigation"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-background/95 px-2 pt-2 shadow-[0_-10px_30px_rgba(0,0,0,0.24)] backdrop-blur sm:hidden [padding-bottom:calc(env(safe-area-inset-bottom)+0.5rem)]"
      >
        {NAV.map((item) => {
          const active = pathMatches(pathname, item);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition ${
                active ? "bg-primary/10 text-primary" : "text-muted-foreground"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
