import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { launchMobilityPractice } from "@/lib/mobility-launch.browser";
import {
  currentMobilityRun,
  MOBILITY_SKILL_ORDER,
  MOBILITY_SKILLS,
  mobilityNextAction,
} from "@/lib/mobility-practice";
import { getLibraryClient } from "@/lib/supabase-log.browser";
import { listMobilityDataClient } from "@/lib/supabase-mobility.browser";

export function MobilityPracticeOverview({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const data = useQuery({ queryKey: ["mobility-practice"], queryFn: listMobilityDataClient });
  const library = useQuery({
    queryKey: ["library"],
    queryFn: getLibraryClient,
    staleTime: 300_000,
  });
  if (data.isLoading) return null;
  if (data.error)
    return <p className="text-sm text-destructive">Mobility practice could not be loaded.</p>;
  const toolkitExerciseById = new Map(
    (library.data?.exercises ?? []).map((exercise) => [exercise.id, exercise]),
  );
  const items = MOBILITY_SKILL_ORDER.map((skill) => {
    const run = currentMobilityRun(data.data?.runs ?? [], skill);
    const drills = data.data?.drills.filter((item) => item.runId === run?.id) ?? [];
    const sessions = data.data?.sessions.filter((item) => item.runId === run?.id) ?? [];
    return {
      skill,
      run,
      drills,
      sessions,
      action: mobilityNextAction({
        run,
        activeDrillCount: drills.filter((item) => item.isActive).length,
        mappedDrillCount: drills.filter(
          (item) =>
            item.isActive &&
            item.exerciseId &&
            toolkitExerciseById.get(item.exerciseId)?.toolkitSections.includes(skill),
        ).length,
      }),
    };
  });
  const shown = compact ? items.filter(({ run }) => run?.status === "active") : items;
  if (compact && !shown.length) return null;
  return (
    <section className="space-y-3" aria-label="Mobility practice">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Mobility practice</h2>
        <Button asChild variant="ghost" size="sm">
          <Link to="/mobility">View all areas</Link>
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map(({ skill, run, drills, sessions, action }) => (
          <Card key={skill}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{MOBILITY_SKILLS[skill].label}</p>
                <span className="text-xs text-muted-foreground">
                  {run
                    ? run.status === "paused"
                      ? "Paused"
                      : run.phase.replace("_", " ")
                    : "Not started"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {sessions[0] ? `Last practice ${sessions[0].date}` : "No practice yet"} ·{" "}
                {drills.filter((item) => item.isActive).length} active drills
              </p>
              {action.kind === "log" && run && library.data ? (
                <Button
                  size="sm"
                  onClick={() => launchMobilityPractice(run, drills, library.data, navigate)}
                >
                  {action.label}
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <Link to="/mobility">{action.label}</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
