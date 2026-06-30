import { useQuery } from "@tanstack/react-query";
import { Sparkles, Trophy } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getPRsClient } from "@/lib/supabase-log.browser";
import { formatUKDateShort } from "@/lib/date";

export function PRsView() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["prs"],
    queryFn: getPRsClient,
  });
  const skillGroups = groupSkillPRs(data?.skills ?? []);

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
              <DateBadge date={pr.date} />
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
          {skillGroups.map((group) => (
            <Card
              key={group.skill}
              className="flex items-start gap-3 border-border bg-card p-3"
            >
              <DateBadge date={group.latestDate} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{group.skill}</p>
                <div className="mt-1 space-y-1">
                  {group.items.map((pr) => (
                    <div
                      key={`${pr.skill}-${pr.metric}`}
                      className="flex items-start justify-between gap-2"
                    >
                      <p className="min-w-0 truncate text-xs text-muted-foreground">
                        {[pr.progression, pr.metric === "hold" ? "Best hold" : "Best reps"]
                          .filter(Boolean)
                          .join(" · ")}
                        {pr.assistance === "assisted" &&
                          ` · Assisted${pr.assistanceLabel ? `: ${pr.assistanceLabel}` : ""}`}
                      </p>
                      <span className="shrink-0 text-sm font-semibold text-primary">
                        {pr.value}
                        {pr.unit === "s" ? "s" : ` ${pr.unit}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

type SkillPR = Awaited<ReturnType<typeof getPRsClient>>["skills"][number];

function movementKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function groupSkillPRs(skills: SkillPR[]) {
  const groups = new Map<string, { skill: string; latestDate: string; items: SkillPR[] }>();
  for (const pr of skills) {
    const key = movementKey(pr.skill);
    const group = groups.get(key) ?? { skill: pr.skill.trim(), latestDate: pr.date, items: [] };
    group.items.push(pr);
    if (pr.date > group.latestDate) group.latestDate = pr.date;
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => a.metric.localeCompare(b.metric)),
    }))
    .sort((a, b) => a.skill.localeCompare(b.skill));
}

function DateBadge({ date }: { date: string }) {
  return (
    <div className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary px-1 text-center font-mono text-xs leading-none text-muted-foreground tabular-nums">
      {formatUKDateShort(date)}
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
