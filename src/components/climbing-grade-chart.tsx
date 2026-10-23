import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  CLIMBING_GRADE_SYSTEMS,
  climbingGradeOrdinal,
  climbingGradeProgress,
  type ClimbingProgressEntry,
} from "@/lib/climbing-metrics";

export function ClimbingGradeChart({ entries }: { entries: ClimbingProgressEntry[] }) {
  const points = climbingGradeProgress(entries);
  const unranked = entries.filter(
    (entry) => entry.grade.trim() && !climbingGradeOrdinal(entry.grade, entry.gradeSystem),
  );
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Climbing grade progress</CardTitle>
        <p className="text-xs text-muted-foreground">
          Highest recorded grade each month, including attempts. Each grading system is shown
          separately.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-2">
        {!points.length ? (
          <p className="text-sm text-muted-foreground">
            No supported graded climbs to chart yet. Log a grade and its grading system; time-only
            climbs remain in your history.
          </p>
        ) : null}
        {CLIMBING_GRADE_SYSTEMS.map((system) => {
          const data = points.filter((point) => point.gradeSystem === system);
          if (!data.length) return null;
          const ticks = [...new Set(data.map((point) => point.gradeOrdinal))].sort((a, b) => a - b);
          const label = (value: number) =>
            data.find((point) => point.gradeOrdinal === value)?.gradeLabel ?? "";
          return (
            <section key={system} aria-label={`${system} grade progress`}>
              <p className="mb-2 text-xs font-medium">{system}</p>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart
                  accessibilityLayer
                  data={data}
                  margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="var(--color-border)"
                    strokeDasharray="2 6"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    stroke="var(--color-muted-foreground)"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    width={48}
                    stroke="var(--color-muted-foreground)"
                    tickLine={false}
                    axisLine={false}
                    ticks={ticks}
                    domain={[0, "dataMax"]}
                    tickFormatter={label}
                    tick={{ fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <Tooltip<number, string>
                    contentStyle={{
                      background: "var(--color-popover)",
                      color: "var(--color-foreground)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                    }}
                    labelStyle={{ color: "var(--color-muted-foreground)" }}
                    cursor={{ fill: "var(--color-secondary)", opacity: 0.4 }}
                    formatter={(_value, _name, item) => [
                      String(item.payload?.highestGrade ?? ""),
                      "Highest recorded grade",
                    ]}
                  />
                  <Bar
                    dataKey="gradeOrdinal"
                    name="Highest recorded grade"
                    fill="var(--color-chart-2)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              <ul className="sr-only">
                {data.map((point) => (
                  <li key={point.month}>
                    {point.month}: {point.highestGrade} ({system})
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {unranked.length ? (
          <p className="text-xs text-muted-foreground">
            {unranked.length} grade record{unranked.length === 1 ? "" : "s"} could not be placed on
            these charts because the label or grading system is unsupported. Original grades remain
            in your history.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
