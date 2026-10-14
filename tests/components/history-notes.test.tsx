import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { TimelineEntry } from "@/lib/supabase-timeline.browser";

const mocks = vi.hoisted(() => ({ entries: [] as TimelineEntry[] }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (config: unknown) => config }));
vi.mock("@/lib/supabase-timeline.browser", () => ({
  getTimelineDataClient: async () => ({ entries: mocks.entries }),
}));
vi.mock("@/lib/supabase-log.browser", () => ({ deleteSessionClient: vi.fn() }));
import { HistoryPage } from "@/routes/history";

afterEach(() => vi.useRealTimers());
function renderHistory() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <HistoryPage />
    </QueryClientProvider>,
  );
}
function entry(id: string, notes: string): TimelineEntry {
  return {
    id,
    sessionId: "session",
    date: "2026-10-14",
    title: id,
    subtitle: "Test session",
    kind: "workout",
    notes,
    details: [],
    minutes: 10,
    value: null,
    isPr: false,
  };
}

it("shows shared session notes once and preserves distinct movement notes", async () => {
  mocks.entries = [
    entry("Bench Press", "Shared session note."),
    entry("Ring L-Sit Hold", "Shared session note."),
    entry("Grip", "Different movement note."),
  ];
  renderHistory();
  await userEvent.click(await screen.findByRole("button", { name: /^Test session/ }));
  const review = await screen.findByRole("dialog");
  expect(review.textContent?.match(/Shared session note\./g)).toHaveLength(1);
  expect(review).toHaveTextContent("Different movement note.");
});

it("keeps summary notes visible with the original prescription behind a disclosure", async () => {
  mocks.entries = [
    {
      ...entry(
        "KB summary",
        "Stopped at rung 6.\nPrescribed workout (reference only)\nOriginal timing, load guidance and ordered targets.",
      ),
      details: ["Summary log", "Weight used: 16 kg"],
    },
  ];
  renderHistory();
  await userEvent.click(await screen.findByRole("button", { name: /^KB summary/ }));
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveClass("max-h-[90vh]", "overflow-y-auto");
  expect(within(dialog).getByText("Stopped at rung 6.")).toBeVisible();
  const disclosure = within(dialog).getByText("Prescribed workout (reference only)");
  expect(disclosure.closest("details")).not.toHaveAttribute("open");
  expect(
    within(dialog).getByText("Original timing, load guidance and ordered targets."),
  ).not.toBeVisible();
  await userEvent.click(disclosure);
  expect(
    within(dialog).getByText("Original timing, load guidance and ordered targets."),
  ).toBeVisible();
});
