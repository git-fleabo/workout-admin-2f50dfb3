import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { RestDayControl } from "@/components/rest-day-control";

const mocks = vi.hoisted(() => ({ list: vi.fn(), set: vi.fn() }));
vi.mock("@/lib/supabase-rest-days.browser", () => ({
  listTrainingRestDaysClient: mocks.list,
  setTrainingRestDayClient: mocks.set,
}));
beforeEach(() => {
  mocks.list.mockResolvedValue([]);
  mocks.set.mockReset().mockResolvedValue(3);
});
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RestDayControl date="2026-10-25" allowDateChange />
    </QueryClientProvider>,
  );
}
it("marks an arbitrary past or future date and refreshes calendar data", async () => {
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole("button", { name: "Mark rest day" }));
  const field = screen.getByLabelText("Date");
  await user.clear(field);
  await user.type(field, "2026-10-18");
  await user.click(screen.getAllByRole("button", { name: "Mark rest day" }).at(-1)!);
  await waitFor(() => expect(mocks.set).toHaveBeenCalledWith("2026-10-18", true, true));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
it("can undo dates or remove just the label", async () => {
  mocks.list.mockResolvedValue([{ rest_date: "2026-10-25" }]);
  const user = userEvent.setup();
  mount();
  await user.click(await screen.findByRole("button", { name: "Undo rest day" }));
  await user.click(screen.getByRole("button", { name: "Remove label only" }));
  await waitFor(() => expect(mocks.set).toHaveBeenCalledWith("2026-10-25", false, false));
});
it("keeps errors visible and offers label-only removal after a conflicting Undo", async () => {
  mocks.list.mockResolvedValue([{ rest_date: "2026-10-25" }]);
  mocks.set.mockRejectedValue(new Error("A moved workout changed or started."));
  const user = userEvent.setup();
  mount();
  await user.click(await screen.findByRole("button", { name: "Undo rest day" }));
  await user.click(screen.getAllByRole("button", { name: "Undo rest day" }).at(-1)!);
  expect(await screen.findByRole("alert")).toHaveTextContent("changed or started");
  expect(screen.getByRole("button", { name: "Remove label only" })).toBeEnabled();
});
it("cancel makes no changes", async () => {
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole("button", { name: "Mark rest day" }));
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(mocks.set).not.toHaveBeenCalled();
});
