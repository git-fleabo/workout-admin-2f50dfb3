import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { dashboardFixture } from "../fixtures/dashboard";
import { DESKTOP_WORKSPACE_QUERY } from "@/hooks/use-desktop";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/supabase-dashboard.browser", () => ({ getDashboardDataClient: mocks.load }));
vi.mock("@/lib/date", async (original) => ({
  ...(await original<typeof import("@/lib/date")>()),
  todayISO: () => "2026-10-25",
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("recharts", async (original) => ({
  ...(await original<typeof import("recharts")>()),
  ResponsiveContainer: () => <div aria-label="Training trend chart" />,
}));
import { DashboardPage } from "@/routes/dashboard";

let desktop = true;
let mediaChanged: () => void;
beforeEach(() => {
  desktop = true;
  mocks.load.mockReset().mockResolvedValue(dashboardFixture());
  window.matchMedia = (media: string) => ({
    media,
    get matches() {
      return desktop && media === DESKTOP_WORKSPACE_QUERY;
    },
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener(_name, listener) {
      mediaChanged = listener as () => void;
    },
    removeEventListener() {},
    dispatchEvent: () => true,
  });
});
function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DashboardPage />
    </QueryClientProvider>,
  );
  return client;
}

it("opens the latest trained day and lets desktop users inspect other days without a modal", async () => {
  const user = userEvent.setup();
  open();
  const selected = await screen.findByRole("region", { name: "Selected day" });
  expect(within(selected).getByText("Bench Press")).toBeVisible();
  expect(screen.getByRole("button", { name: /23 Oct 2026/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await user.click(screen.getByRole("button", { name: /21 Oct 2026/ }));
  expect(within(selected).getByText("Bouldering")).toBeVisible();
  expect(within(selected).queryByText("Bench Press")).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("complementary", { name: "Training snapshot" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Progress" })).toHaveAttribute("href", "/progress");
  // Rest days remain keyboard-accessible and show an honest empty state.
  const rest = screen.getByRole("button", { name: /22 Oct 2026/ });
  rest.focus();
  await user.keyboard("{Enter}");
  expect(rest).toHaveAttribute("aria-pressed", "true");
  expect(within(selected).getByText("Nothing logged for this day.")).toBeVisible();
});

it("keeps mobile day details in a dialog, including when leaving the desktop breakpoint", async () => {
  const user = userEvent.setup();
  open();
  await screen.findByRole("region", { name: "Selected day" });
  act(() => {
    desktop = false;
    mediaChanged();
  });
  expect(screen.queryByTestId("desktop-dashboard-workspace")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /Fri23/ }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("Bench Press")).toBeVisible();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("does not interpret missing durations as zero minutes and preserves selection after refresh", async () => {
  const data = dashboardFixture();
  data.kpis.minutesThisWeek = 0;
  data.weekDays[4].minutes = 0;
  mocks.load.mockResolvedValue(data);
  const user = userEvent.setup();
  open();
  const selected = await screen.findByRole("region", { name: "Selected day" });
  expect(within(selected).getByText(/duration not recorded/)).toBeVisible();
  expect(screen.getByText("Not recorded")).toBeVisible();
  await user.click(screen.getByRole("button", { name: /21 Oct 2026/ }));
  await user.click(screen.getByRole("button", { name: "Refresh dashboard" }));
  expect(mocks.load).toHaveBeenCalledTimes(2);
  expect(within(selected).getByText("Bouldering")).toBeVisible();
});

it("handles a week with no activity and no strength or climbing history", async () => {
  const data = dashboardFixture();
  data.weekDays.forEach((day) =>
    Object.assign(day, { workouts: 0, minutes: 0, exercises: [], entries: [] }),
  );
  data.kpis.workoutsThisWeek = 0;
  data.kpis.minutesThisWeek = 0;
  data.strength.bestLift = null;
  data.strength.latestTest = null;
  data.climbing.latestClimb = null;
  data.recentPRs = [];
  data.workoutsByWeek = [];
  mocks.load.mockResolvedValue(data);
  open();
  const selected = await screen.findByRole("region", { name: "Selected day" });
  expect(within(selected).getByText("Nothing logged for this day.")).toBeVisible();
  expect(screen.getByRole("button", { name: /25 Oct 2026/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByText("No 1RM tests logged yet.")).toBeVisible();
  expect(screen.getByText("No climbing logged yet.")).toBeVisible();
  expect(screen.getByText("No workout data yet.")).toBeVisible();
});
