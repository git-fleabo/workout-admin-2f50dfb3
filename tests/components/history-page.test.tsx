import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (config: unknown) => config }));
vi.mock("@/lib/supabase-timeline.browser", () => ({
  getTimelineDataClient: async () => ({
    entries: Array.from({ length: 31 }, (_, index) => ({
      id: `entry-${index}`,
      sessionId: null,
      kind: "bodyweight",
      date: `2026-10-${String(index + 1).padStart(2, "0")}`,
      title: `Measurement ${index + 1}`,
      subtitle: "Bodyweight",
      details: [],
      notes: "",
      minutes: null,
      value: 80,
      isPr: false,
    })),
  }),
}));
vi.mock("@/lib/supabase-log.browser", () => ({ deleteSessionClient: vi.fn() }));
import { HistoryPage } from "@/routes/history";
afterEach(() => vi.useRealTimers());
it("shows more dates on demand, keeps totals complete and resets paging with the period", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <HistoryPage />
    </QueryClientProvider>,
  );
  const more = await screen.findByRole("button", { name: "Show more history (1 dates remaining)" });
  expect(screen.getAllByRole("heading", { name: /Measurement \d+/ })).toHaveLength(30);
  expect(
    screen.getByRole("heading", { name: "History", exact: true }).parentElement,
  ).toHaveTextContent(/31 measurements/);
  await userEvent.click(more);
  expect(screen.getAllByRole("heading", { name: /Measurement \d+/ })).toHaveLength(31);
  expect(screen.queryByRole("button", { name: /Show more history/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Previous period" }));
  await waitFor(() => expect(screen.getByText("No history for this view.")).toBeInTheDocument());
  await userEvent.click(screen.getByRole("button", { name: "Next period" }));
  expect(
    await screen.findByRole("button", { name: "Show more history (1 dates remaining)" }),
  ).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { name: /Measurement \d+/ })).toHaveLength(30);
});
