import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Calendar, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  addSkillSession,
  getRecentSkills,
  getSkillsLibrary,
} from "@/lib/workout.functions";
import { Field, SimpleSelect, RecentList, type RecentEntry } from "./-form-bits";

const today = () => new Date().toISOString().slice(0, 10);

type SkillState = {
  date: string;
  skill: string;
  category: string;
  progression: string;
  sessionType: string;
  attempts: string;
  sets: string;
  bestHold: string;
  bestReps: string;
  assistance: string;
  quality: string;
  completed: boolean;
  notes: string;
};

const blank = (): SkillState => ({
  date: today(),
  skill: "",
  category: "",
  progression: "",
  sessionType: "",
  attempts: "",
  sets: "",
  bestHold: "",
  bestReps: "",
  assistance: "",
  quality: "",
  completed: true,
  notes: "",
});

export function SkillForm() {
  const qc = useQueryClient();
  const libFn = useServerFn(getSkillsLibrary);
  const recentFn = useServerFn(getRecentSkills);
  const addFn = useServerFn(addSkillSession);

  const lib = useQuery({ queryKey: ["skills-library"], queryFn: () => libFn() });
  const recent = useQuery({ queryKey: ["recent-skills"], queryFn: () => recentFn() });

  const [form, setForm] = useState<SkillState>(blank);
  const update = <K extends keyof SkillState>(k: K, v: SkillState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const skillNames = (lib.data?.skills ?? []).map((s) => s.name);

  const recentSkillChips = useMemo(() => {
    const seen = new Set<string>();
    const chips: string[] = [];
    for (const r of recent.data?.recent ?? []) {
      const name = r.skill?.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      chips.push(name);
      if (chips.length >= 8) break;
    }
    if (chips.length < 8) {
      for (const n of skillNames) {
        if (seen.has(n)) continue;
        seen.add(n);
        chips.push(n);
        if (chips.length >= 8) break;
      }
    }
    return chips;
  }, [recent.data, skillNames]);

  const mutate = useMutation({
    mutationFn: () => addFn({ data: form }),
    onSuccess: (res) => {
      toast.success(`Logged to row ${res.row}`);
      setForm((f) => ({
        ...blank(),
        date: f.date,
        skill: f.skill,
        category: f.category,
        sessionType: f.sessionType,
      }));
      qc.invalidateQueries({ queryKey: ["recent-skills"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = form.date && form.skill && !mutate.isPending;

  const recentEntries: RecentEntry[] =
    recent.data?.recent.map((r) => ({
      date: r.date,
      title: r.skill,
      meta:
        [
          r.progression,
          r.bestHold && `${r.bestHold}s`,
          r.bestReps && `${r.bestReps} reps`,
          r.sets && `${r.sets} sets`,
          r.quality,
        ]
          .filter(Boolean)
          .join(" · ") || r.sessionType,
      completed: r.completed,
    })) ?? [];

  return (
    <div className="space-y-6">
      <Card className="space-y-5 border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">New skill session</h2>
          <Badge variant="outline" className="gap-1 border-border text-muted-foreground">
            <Calendar className="h-3 w-3" /> {form.date}
          </Badge>
        </div>

        <Field label="Date">
          <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
        </Field>

        <Field label="Skill">
          <div className="space-y-2">
            <Input
              value={form.skill}
              onChange={(e) => update("skill", e.target.value)}
              placeholder="e.g. Front Lever"
              list="skill-list"
            />
            <datalist id="skill-list">
              {skillNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            {recentSkillChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {recentSkillChips.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => update("skill", n)}
                    className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-secondary-foreground transition hover:border-primary hover:text-primary"
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Input
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              placeholder="Calisthenics, Climbing…"
            />
          </Field>
          <Field label="Session Type">
            <SimpleSelect
              value={form.sessionType}
              onChange={(v) => update("sessionType", v)}
              options={lib.data?.sessionTypes ?? []}
            />
          </Field>
        </div>

        <Field label="Progression / Grade">
          <Input
            value={form.progression}
            onChange={(e) => update("progression", e.target.value)}
            placeholder="e.g. Tuck FL, V4, 5.11a"
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Attempts">
            <Input inputMode="numeric" value={form.attempts} onChange={(e) => update("attempts", e.target.value)} />
          </Field>
          <Field label="Sets">
            <Input inputMode="numeric" value={form.sets} onChange={(e) => update("sets", e.target.value)} />
          </Field>
          <Field label="Best Reps">
            <Input inputMode="numeric" value={form.bestReps} onChange={(e) => update("bestReps", e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Best Hold (sec)">
            <Input inputMode="decimal" value={form.bestHold} onChange={(e) => update("bestHold", e.target.value)} />
          </Field>
          <Field label="Assistance / Band">
            <Input
              value={form.assistance}
              onChange={(e) => update("assistance", e.target.value)}
              placeholder="Red band, -10kg…"
            />
          </Field>
        </div>

        <Field label="Quality">
          <SimpleSelect
            value={form.quality}
            onChange={(v) => update("quality", v)}
            options={lib.data?.qualities ?? []}
          />
        </Field>

        <Field label="Notes">
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Cues, attempts, conditions…"
          />
        </Field>

        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-3 py-2">
          <Label className="text-sm">Completed</Label>
          <Switch checked={form.completed} onCheckedChange={(v) => update("completed", v)} />
        </div>

        <Button
          onClick={() => mutate.mutate()}
          disabled={!canSubmit}
          className="h-12 w-full text-base font-semibold"
          style={{ backgroundImage: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
        >
          {mutate.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Plus className="mr-1 h-5 w-5" /> Log session
            </>
          )}
        </Button>
      </Card>

      <RecentList loading={recent.isLoading} entries={recentEntries} />
    </div>
  );
}
