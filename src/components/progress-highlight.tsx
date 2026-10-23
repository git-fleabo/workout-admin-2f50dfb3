import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";

type HighlightStat = {
  label: string;
  value: string;
  detail: string;
  change?: number | null;
  changeDirection?: "up" | "down";
};

export function ProgressHighlight({
  exerciseName,
  stat,
  periodLabel,
  locationLabel,
  methodLabel,
}: {
  exerciseName: string;
  stat?: HighlightStat;
  periodLabel: string;
  locationLabel: string;
  methodLabel: string;
}) {
  if (!stat) return null;
  const measured = stat.value !== "—";
  const change =
    measured && stat.change != null && Number.isFinite(stat.change) ? stat.change : null;
  const improved = change != null && (stat.changeDirection === "down" ? change < 0 : change > 0);
  const Icon = change == null || change === 0 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <Card
      aria-label="Progress highlight"
      className="session-spotlight border-primary/30 p-5 sm:p-7"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            {stat.label} · {exerciseName}
          </p>
          <p className="mt-3 break-words text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
            {measured ? stat.value : "Not measured"}
          </p>
          {!(change != null && stat.detail.endsWith("vs prior period")) ? (
            <p className="mt-3 text-sm text-muted-foreground">{stat.detail}</p>
          ) : null}
        </div>
        {change != null ? (
          <div
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${improved ? "bg-success/10 text-success" : "bg-secondary/60 text-foreground"}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span>
              {change > 0 ? "+" : ""}
              {change}% vs prior period
            </span>
          </div>
        ) : null}
      </div>
      <p className="mt-5 border-t border-border/60 pt-4 text-sm text-muted-foreground">
        {periodLabel} · {locationLabel} · {methodLabel}
      </p>
    </Card>
  );
}
