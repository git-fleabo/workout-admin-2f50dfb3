import { useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function DesktopProgressWorkspace({
  exercises,
  exerciseId,
  onExerciseChange,
  header,
  filters,
  methods,
  contentState,
  highlight,
  stats,
  charts,
  recommendation,
  comparisons,
  history,
  climbing,
  personalBests,
}: {
  exercises: Array<{ id: string; name: string; workoutType: string }>;
  exerciseId: string;
  onExerciseChange: (id: string) => void;
  header: ReactNode;
  filters: ReactNode;
  methods: ReactNode;
  contentState: ReactNode;
  highlight: ReactNode;
  stats: ReactNode;
  charts: ReactNode;
  recommendation: ReactNode;
  comparisons: ReactNode;
  history: ReactNode;
  climbing: ReactNode;
  personalBests: ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState("trends");
  const activeView =
    (view === "comparison" && !comparisons) || (view === "climbing" && !climbing) ? "trends" : view;
  const matches = exercises.filter((exercise) =>
    `${exercise.name} ${exercise.workoutType}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <div className="space-y-5" data-testid="desktop-progress-workspace">
      {header}
      <div className="grid grid-cols-[260px_minmax(0,1fr)] items-start gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside
          aria-label="Exercise selection and filters"
          className="sticky top-48 max-h-[calc(100vh-13rem)] space-y-5 overflow-y-auto rounded-xl border border-border bg-card p-4"
        >
          <div>
            <h2 className="text-sm font-semibold">Exercises</h2>
            <label className="relative mt-3 block">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search logged exercises"
                placeholder="Find an exercise…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </label>
            <div className="mt-2 max-h-64 space-y-1 overflow-y-auto" aria-label="Logged exercises">
              {matches.length ? (
                matches.map((exercise) => (
                  <button
                    key={exercise.id}
                    type="button"
                    aria-pressed={exercise.id === exerciseId}
                    onClick={() => onExerciseChange(exercise.id)}
                    className={cn(
                      "block w-full rounded-lg border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      exercise.id === exerciseId
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-transparent hover:bg-muted/50",
                    )}
                  >
                    <span className="block break-words font-medium">{exercise.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {exercise.workoutType}
                    </span>
                  </button>
                ))
              ) : (
                <p className="p-2 text-xs text-muted-foreground">No matching exercises.</p>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Exercises with recorded logs, plus any exercise opened from a goal.
            </p>
          </div>
          <section aria-label="Progress filters" className="space-y-4 border-t border-border pt-4">
            <h2 className="text-sm font-semibold">Compare recorded training</h2>
            <div className="[&>div]:flex-col [&>div]:items-stretch [&>div>div]:flex-wrap [&>div>div]:overflow-visible">
              {filters}
            </div>
            <div className="[&>div>div]:flex-wrap [&>div>div]:overflow-visible">{methods}</div>
          </section>
        </aside>
        <div className="min-w-0 space-y-4">
          <Tabs value={activeView} onValueChange={setView}>
            <TabsList aria-label="Progress views" className="h-auto flex-wrap justify-start">
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="history">Session history</TabsTrigger>
              {comparisons ? <TabsTrigger value="comparison">Methods & plan</TabsTrigger> : null}
              {climbing ? <TabsTrigger value="climbing">Climbing overview</TabsTrigger> : null}
              <TabsTrigger value="bests">Personal bests</TabsTrigger>
            </TabsList>
            <TabsContent value="trends" className="space-y-4">
              {contentState || (
                <>
                  {highlight}
                  {stats}
                  <div className="space-y-4">{charts}</div>
                  {recommendation}
                </>
              )}
            </TabsContent>
            <TabsContent value="history">{contentState || history}</TabsContent>
            {comparisons ? (
              <TabsContent value="comparison">{contentState || comparisons}</TabsContent>
            ) : null}
            {climbing ? <TabsContent value="climbing">{climbing}</TabsContent> : null}
            <TabsContent value="bests">{personalBests}</TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
