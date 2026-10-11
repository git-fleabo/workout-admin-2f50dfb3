import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
const mocks = vi.hoisted(() => ({
  charts: [] as { gradeOrdinal: number; gradeSystem: string }[][],
  keys: [] as string[],
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({
    children,
    data,
  }: {
    children: ReactNode;
    data: { gradeOrdinal: number; gradeSystem: string }[];
  }) => {
    mocks.charts.push(data);
    return <div>{children}</div>;
  },
  Bar: ({ dataKey }: { dataKey: string }) => {
    mocks.keys.push(dataKey);
    return null;
  },
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));
import { ClimbingGradeChart } from "@/components/climbing-grade-chart";
beforeEach(() => {
  mocks.charts = [];
  mocks.keys = [];
});
it("passes numeric values to separate system charts while retaining readable original labels", () => {
  render(
    <ClimbingGradeChart
      entries={[
        { date: "2026-10-05", grade: "V10", gradeSystem: "V-scale" },
        { date: "2026-10-06", grade: "6b+", gradeSystem: "Font" },
      ]}
    />,
  );
  expect(mocks.charts).toHaveLength(2);
  expect(
    mocks.charts.every(
      (chart) =>
        new Set(chart.map((point) => point.gradeSystem)).size === 1 &&
        chart.every((point) => typeof point.gradeOrdinal === "number" && point.gradeOrdinal > 0),
    ),
  ).toBe(true);
  expect(mocks.keys).toEqual(["gradeOrdinal", "gradeOrdinal"]);
  expect(screen.getByRole("region", { name: "V-scale grade progress" })).toHaveTextContent(
    "2026-10: V10",
  );
  expect(screen.getByRole("region", { name: "Font grade progress" })).toHaveTextContent(
    "2026-10: 6b+",
  );
});
it("shows an explicit unsupported state rather than an empty numeric plot", () => {
  render(
    <ClimbingGradeChart
      entries={[{ date: "2026-10-05", grade: "blue", gradeSystem: "wall colours" }]}
    />,
  );
  expect(screen.getByText(/No supported graded climbs to chart yet/)).toBeInTheDocument();
  expect(screen.getByText(/1 grade record could not be placed/)).toBeInTheDocument();
  expect(mocks.charts).toHaveLength(0);
});
