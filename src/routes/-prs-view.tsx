import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Trophy } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getPRs } from "@/lib/workout.functions";
import { formatUKDateShort } from "@/lib/date";

export function PRsView() {
  const fetchPRs = useServerFn(getPRs);
  const { data, isLoading, error } = useQuery({
    queryKey: ["prs"],
    queryFn: () => fetchPRs(),
  });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <SectionHeader icon={<Trophy className="h-4 w-4" />} title="1RM PRs" />
        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Loading…</Card>}
        {error && (
          <Card className="p-4 text-sm text-destructive">Couldn't load PRs.</Card>
        )}
        {!isLoading && !error && data && data.oneRm.length === 0 && (
          <Card className="p-4 text-sm text-muted-foreground">No 1RM PRs yet.</Card>
        )}
        <div className="space-y-2">
          {data?.oneRm.map((pr) => (
            <Card
              key={pr.exercise}
              className="flex items-start gap-3 border-border bg-card p-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-mono text-muted-foreground">
                {formatUKDateShort(pr.date)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium">{pr.exercise}</p>
                  <span className="shrink-0 text-sm font-semibold text-primary">
                    {pr.estTotal || pr.estExternal || pr.externalWeight}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {[pr.type, pr.externalWeight && `${pr.externalWeight} × ${pr.reps || 1}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader icon={<Sparkles className="h-4 w-4" />} title="Skill PRs" />
        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Loading…</Card>}
        {!isLoading && !error && data && data.skills.length === 0 && (
          <Card className="p-4 text-sm text-muted-foreground">No skill PRs yet.</Card>
        )}
        <div className="space-y-2">
          {data?.skills.map((pr, i) => (
            <Card
              key={`${pr.skill}-${pr.progression}-${pr.metric}-${i}`}
              className="flex items-start gap-3 border-border bg-card p-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-mono text-muted-foreground">
                {formatUKDateShort(pr.date)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium">{pr.skill}</p>
                  <span className="shrink-0 text-sm font-semibold text-primary">
                    {pr.value}
                    {pr.unit === "s" ? "s" : ` ${pr.unit}`}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {[pr.progression, pr.metric === "hold" ? "Best hold" : "Best reps"]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-muted-foreground">{icon}</span>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
    </div>
  );
}

void Award;
