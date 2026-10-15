import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import type { TimelineEntry } from "@/lib/supabase-timeline.browser";

const mocks = vi.hoisted(() => ({ timeline: vi.fn(), remove: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (config: unknown) => config }));
vi.mock("@/lib/supabase-timeline.browser", () => ({ getTimelineDataClient: mocks.timeline }));
vi.mock("@/lib/supabase-log.browser", () => ({ deleteSessionClient: mocks.remove }));
import { HistoryPage } from "@/routes/history";

function entry(overrides: Partial<TimelineEntry>): TimelineEntry {
  return {
    id: "bench-entry",
    sessionId: "evidence-session",
    kind: "workout",
    date: "2025-08-04",
    title: "Bench press",
    subtitle: "Strength workout",
    details: ["80 kg", "5 reps"],
    notes: "Recorded after training",
    minutes: 45,
    value: null,
    isPr: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.timeline.mockResolvedValue({
    entries: [entry({}), entry({ id: "row-entry", title: "Row", details: ["40 kg", "8 reps"] })],
  });
});

function renderHistory(session = "evidence-session") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <HistoryPage requestedSessionId={session} />
      </QueryClientProvider>,
    ),
  };
}

it("opens the exact source session outside the current month and retains all movements", async () => {
  renderHistory();
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveTextContent("04 Aug 2025");
  expect(dialog).toHaveTextContent("Bench press · 80 kg · 5 reps");
  expect(dialog).toHaveTextContent("Row · 40 kg · 8 reps");
  expect(dialog).toHaveTextContent("Recorded after training");
  expect(mocks.remove).not.toHaveBeenCalled();
  await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(screen.getByRole("heading", { name: "Strength workout", exact: true })).toBeVisible();
});

it("does not reopen a dismissed evidence dialog when its source query refreshes", async () => {
  const { client } = renderHistory();
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  await client.invalidateQueries({ queryKey: ["timeline"] });
  await waitFor(() => expect(mocks.timeline).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("explains when the source has been removed rather than opening another session", async () => {
  renderHistory("deleted-session");
  await screen.findByText(/This source session is no longer available/);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(mocks.remove).not.toHaveBeenCalled();
});

it("opens a new evidence link while remaining on History", async () => {
  mocks.timeline.mockResolvedValue({
    entries: [
      entry({}),
      entry({ id: "second", sessionId: "second-session", date: "2026-09-01", title: "Squat" }),
    ],
  });
  const { rerender, client } = renderHistory();
  await screen.findByRole("dialog");
  rerender(
    <QueryClientProvider client={client}>
      <HistoryPage requestedSessionId="second-session" />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByRole("dialog")).toHaveTextContent("Squat"));
  expect(screen.getByRole("dialog")).toHaveTextContent("01 Sep 2026");
});
