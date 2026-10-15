import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { reviewGoal, reviewHistory, reviewPoint } from "../helpers/goal-review-fixtures";
import { GoalTrendDisclosure } from "@/components/goal-trend";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
  }: {
    children: ReactNode;
    to: string;
    search?: Record<string, string>;
  }) => <a href={to + (search ? `?${new URLSearchParams(search)}` : "")}>{children}</a>,
}));

const input = () => ({
  goal: reviewGoal(),
  weekStart: "2026-10-12",
  reviewEnd: "2026-10-14",
  exerciseHistory: reviewHistory([
    reviewPoint("2026-09-22", 90),
    reviewPoint("2026-10-06", 75),
    reviewPoint("2026-10-13", 80),
    reviewPoint("2026-10-15", 110),
  ]),
});

async function openTrend() {
  await userEvent.click(screen.getByText("Four-week trend", { exact: true }));
  return screen.findByRole("group", { name: /weekly results/ });
}

it("keeps the trend optional and opens four accessible weekly values with no future results", async () => {
  render(<GoalTrendDisclosure input={input()} />);
  expect(screen.queryByRole("group", { name: /weekly results/ })).not.toBeInTheDocument();
  const chart = await openTrend();
  expect(within(chart).getAllByRole("button")).toHaveLength(4);
  expect(
    within(chart).getByRole("button", { name: /12 Oct 2026 to 14 Oct 2026: 80 kg, week so far/ }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("region")).toHaveTextContent("Best this week: 80 kg");
  expect(screen.getByRole("link", { name: /View this week’s best log/ })).toHaveAttribute(
    "href",
    "/history?session=session-2026-10-13",
  );
  expect(screen.queryByText(/110/)).not.toBeInTheDocument();
});

it("selects a gap without showing the previous personal best as fresh evidence", async () => {
  render(<GoalTrendDisclosure input={input()} />);
  const chart = await openTrend();
  await userEvent.click(
    within(chart).getByRole("button", { name: /28 Sep 2026 to 04 Oct 2026: Not measured/ }),
  );
  expect(screen.getByRole("region")).toHaveTextContent("Best this week: Not measured");
  expect(screen.getByRole("region")).toHaveTextContent(
    "This does not establish whether performance changed",
  );
  expect(within(screen.getByRole("region")).queryByRole("link")).not.toBeInTheDocument();
});

it("supports keyboard selection and shows only the selected week's source links", async () => {
  render(<GoalTrendDisclosure input={input()} />);
  const chart = await openTrend();
  const oldest = within(chart).getByRole("button", { name: /21 Sep 2026 to 27 Sep 2026/ });
  oldest.focus();
  await userEvent.keyboard("{Enter}");
  expect(oldest).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("region")).toHaveTextContent("Best this week: 90 kg");
  expect(screen.getByRole("link", { name: /View this week’s best log/ })).toHaveAttribute(
    "href",
    "/history?session=session-2026-09-22",
  );
  expect(within(screen.getByRole("region")).queryByText(/80 kg/)).not.toBeInTheDocument();
});

it("resets selection to the reviewed week when navigating and labels completed weeks correctly", async () => {
  const { rerender } = render(<GoalTrendDisclosure input={input()} />);
  const chart = await openTrend();
  await userEvent.click(within(chart).getByRole("button", { name: /21 Sep 2026/ }));
  rerender(
    <GoalTrendDisclosure
      input={{ ...input(), weekStart: "2026-10-05", reviewEnd: "2026-10-11" }}
    />,
  );
  expect(screen.getByRole("region")).toHaveTextContent("05 Oct–11 Oct 2026");
  expect(screen.getByRole("region")).toHaveTextContent("Best this week: 75 kg");
  expect(screen.queryByText("So far")).not.toBeInTheDocument();
});

it("keeps check-in trends separate from performance and omits charts for manual milestones", async () => {
  const { rerender } = render(
    <GoalTrendDisclosure
      input={{
        ...input(),
        goal: reviewGoal({
          goalType: "legacy",
          target: "Climb V5",
          checkins: [
            {
              id: "practice",
              date: "2026-10-13",
              note: "Practice only",
              createdAt: "",
              isToday: false,
            },
          ],
        }),
      }}
    />,
  );
  await openTrend();
  expect(screen.getByText(/Counts do not measure performance/)).toBeInTheDocument();
  expect(screen.getByRole("region")).toHaveTextContent("Recorded this week: 1 check-in");
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  rerender(
    <GoalTrendDisclosure
      input={{ ...input(), goal: reviewGoal({ goalType: "milestone", goalMetric: "completed" }) }}
    />,
  );
  expect(screen.queryByText("Four-week trend")).not.toBeInTheDocument();
});

it("distinguishes missing session time from a known empty week", async () => {
  render(
    <GoalTrendDisclosure
      input={{
        ...input(),
        goal: reviewGoal({ goalType: "consistency", goalMetric: "minutes", targetUnit: "minutes" }),
        activitySessions: [
          { id: "none", date: "2026-10-06", minutes: 0 },
          { id: "timed", date: "2026-10-13", minutes: 30 },
          { id: "missing", date: "2026-10-14", minutes: 0 },
        ],
      }}
    />,
  );
  const chart = await openTrend();
  expect(screen.getByRole("region")).toHaveTextContent("At least 30 minutes");
  await userEvent.click(
    within(chart).getByRole("button", { name: /05 Oct 2026 to 11 Oct 2026: Time not recorded/ }),
  );
  expect(screen.getByRole("region")).toHaveTextContent("Recorded this week: Time not recorded");
  await userEvent.click(
    within(chart).getByRole("button", { name: /21 Sep 2026 to 27 Sep 2026: 0 minutes/ }),
  );
  expect(screen.getByRole("region")).toHaveTextContent("Recorded this week: 0 minutes");
  expect(screen.getByRole("region")).toHaveTextContent("No completed sessions recorded");
});

it("reports absent selected metrics alongside the remaining valid sources", async () => {
  render(
    <GoalTrendDisclosure
      input={{
        ...input(),
        exerciseHistory: reviewHistory([
          reviewPoint("2026-10-12", null),
          reviewPoint("2026-10-13", 80),
        ]),
      }}
    />,
  );
  await openTrend();
  expect(screen.getByRole("region")).toHaveTextContent(
    "1 logged session is missing the selected measurement",
  );
  expect(screen.getByRole("region")).toHaveTextContent("Best this week: 80 kg");
});
