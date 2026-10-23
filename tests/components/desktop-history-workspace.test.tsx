import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { TimelineEntry } from "@/lib/supabase-timeline.browser";

const mocks = vi.hoisted(() => ({ timeline: vi.fn(), remove: vi.fn(), desktop: true }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (config: unknown) => config }));
vi.mock("@/hooks/use-desktop", () => ({ useIsDesktop: () => mocks.desktop }));
vi.mock("@/lib/supabase-timeline.browser", () => ({ getTimelineDataClient: mocks.timeline }));
vi.mock("@/lib/supabase-log.browser", () => ({ deleteSessionClient: mocks.remove }));
import { HistoryPage } from "@/routes/history";

function entry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    id: "bench",
    sessionId: "strength",
    kind: "workout",
    date: "2026-10-20",
    title: "Bench Press",
    subtitle: "Strength A",
    details: ["60 kg × 5"],
    notes: "Shared session note",
    minutes: 40,
    value: null,
    isPr: false,
    ...overrides,
  };
}
let entries: TimelineEntry[];
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
  mocks.desktop = true;
  entries = [
    entry(),
    entry({ id: "squat", title: "High Bar Squat", details: ["50 kg × 6"] }),
    entry({
      id: "climb",
      sessionId: "climbing",
      kind: "climb",
      date: "2026-10-22",
      title: "Bouldering",
      subtitle: "Climbing",
      details: ["V4"],
      notes: "Worked on footwork",
      minutes: 0,
    }),
    entry({
      id: "measurement",
      sessionId: null,
      kind: "bodyweight",
      date: "2026-10-19",
      title: "Bodyweight",
      subtitle: "67 kg",
      details: [],
      notes: "",
      minutes: null,
    }),
  ];
  mocks.timeline.mockImplementation(async () => ({ entries }));
  mocks.remove.mockImplementation(async (id: string) => {
    entries = entries.filter((row) => row.sessionId !== id);
  });
});
afterEach(() => vi.useRealTimers());
function show(requestedSessionId?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const element = () => (
    <QueryClientProvider client={client}>
      <HistoryPage requestedSessionId={requestedSessionId} />
    </QueryClientProvider>
  );
  return { ...render(element()), element, client };
}

it("searches complete grouped sessions, retains notes, and leaves period totals unchanged", async () => {
  const user = userEvent.setup();
  show();
  await screen.findByRole("table", { name: "Training records" });
  await user.type(screen.getByRole("textbox", { name: "Search this period" }), "bench");
  const rows = within(screen.getByRole("table")).getAllByRole("row");
  expect(rows).toHaveLength(2);
  const inspector = within(screen.getByRole("complementary", { name: "Selected history record" }));
  expect(inspector.getByText("High Bar Squat · 50 kg × 6")).toBeVisible();
  expect(inspector.getByText("Bench Press · 60 kg × 5")).toBeVisible();
  expect(screen.getByRole("complementary").textContent?.match(/Shared session note/g)).toHaveLength(
    1,
  );
  expect(screen.getByText("Entries").parentElement).toHaveTextContent("4");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.clear(screen.getByRole("textbox", { name: "Search this period" }));
  await user.type(screen.getByRole("textbox", { name: "Search this period" }), "footwork");
  expect(screen.getByRole("complementary")).toHaveTextContent("Bouldering");
});

it("sorts all matching dates before paging and changes the selection when filters remove it", async () => {
  const user = userEvent.setup();
  show();
  const table = await screen.findByRole("table");
  expect(within(table).getAllByRole("row")[1]).toHaveTextContent("Bouldering");
  await user.selectOptions(screen.getByRole("combobox", { name: "Sort records" }), "oldest");
  expect(within(table).getAllByRole("row")[1]).toHaveTextContent("Bodyweight");
  await user.click(screen.getByRole("button", { name: "Workouts", exact: true }));
  expect(screen.getByRole("complementary")).toHaveTextContent("Strength A");
  expect(within(table).getAllByRole("row")).toHaveLength(2);
  await user.type(screen.getByRole("textbox", { name: "Search this period" }), "missing");
  expect(screen.getByText("No records match your search in this period.")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Delete session" })).not.toBeInTheDocument();
});

it("opens a historical source in the inspector and restores the mobile dialog on resize", async () => {
  entries = [
    entry({ date: "2025-08-04" }),
    entry({ id: "squat", title: "High Bar Squat", date: "2025-08-04" }),
  ];
  const view = show("strength");
  await screen.findByTestId("desktop-history-workspace");
  await waitFor(() => expect(screen.getByRole("complementary")).toHaveTextContent("04 Aug 2025"));
  expect(screen.getByRole("complementary")).toHaveTextContent("High Bar Squat");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  mocks.desktop = false;
  view.rerender(view.element());
  expect(screen.queryByTestId("desktop-history-workspace")).not.toBeInTheDocument();
  expect(await screen.findByRole("dialog")).toHaveTextContent("04 Aug 2025");
});

it("only deletes the selected whole session after confirmation and refreshes related sources", async () => {
  const user = userEvent.setup();
  const { client } = show();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  await screen.findByRole("table");
  await user.click(screen.getByRole("button", { name: /^Strength A/ }));
  await user.click(screen.getByRole("button", { name: "Delete session" }));
  expect(mocks.remove).not.toHaveBeenCalled();
  const confirm = screen.getByRole("alertdialog");
  await user.click(within(confirm).getByRole("button", { name: /Delete/ }));
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("strength"));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: /^Strength A/ })).not.toBeInTheDocument(),
  );
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["weekly-review"] });
  expect(screen.getByRole("complementary")).not.toHaveTextContent("Bench Press");
});

it("searches beyond the loaded dates and pages from the chosen end of the period", async () => {
  entries = Array.from({ length: 31 }, (_, index) =>
    entry({
      id: `measurement-${index + 1}`,
      sessionId: null,
      kind: "bodyweight",
      date: `2026-10-${String(index + 1).padStart(2, "0")}`,
      title: `Measurement ${index + 1}`,
      details: [],
      notes: "",
    }),
  );
  const user = userEvent.setup();
  show();
  await screen.findByRole("table");
  await user.selectOptions(screen.getByRole("combobox", { name: "Sort records" }), "oldest");
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("row")[1]).toHaveTextContent("Measurement 1");
  expect(within(table).queryByRole("button", { name: /^Measurement 31/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Show more history/ })).toBeVisible();
  await user.type(screen.getByRole("textbox", { name: "Search this period" }), "Measurement 31");
  expect(within(table).getByRole("button", { name: /^Measurement 31/ })).toBeVisible();
  expect(screen.getByRole("complementary")).toHaveTextContent("Measurement 31");
  await user.clear(screen.getByRole("textbox", { name: "Search this period" }));
  await user.click(screen.getByRole("button", { name: /Show more history/ }));
  expect(within(table).getAllByRole("row")).toHaveLength(32);
});
