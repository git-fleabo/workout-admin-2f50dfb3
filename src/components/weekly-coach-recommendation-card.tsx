import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatUKDateShort } from "@/lib/date";
import type { WeeklyCoachRecommendation } from "@/lib/weekly-coach-recommendation";

function dayLabel(date: string) {
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
  return `${weekday} · ${formatUKDateShort(date)}`;
}

export function WeeklyCoachRecommendationCard({
  recommendation,
  pending,
  onDecision,
}: {
  recommendation: WeeklyCoachRecommendation;
  pending: boolean;
  onDecision: (decision: "accepted" | "rejected", chosenDate?: string) => Promise<void>;
}) {
  const [chosenDate, setChosenDate] = useState(recommendation.proposedDate);

  useEffect(() => {
    setChosenDate(recommendation.proposedDate);
  }, [recommendation.key, recommendation.proposedDate]);

  const decide = async (decision: "accepted" | "rejected") => {
    try {
      await onDecision(
        decision,
        decision === "accepted" && recommendation.type === "move_session" ? chosenDate : undefined,
      );
    } catch {
      // The parent mutation reports the error and leaves the recommendation available.
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/[0.06] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-fuchsia-300" />
            <p className="text-sm font-semibold">Coach suggestion</p>
            <Badge variant="outline">Review first</Badge>
          </div>
          <p className="mt-2 text-sm font-medium">{recommendation.title}</p>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{recommendation.rationale}</p>
          {recommendation.learningNote ? (
            <p className="mt-2 max-w-2xl text-xs text-fuchsia-200">
              Learned from your reviews: {recommendation.learningNote}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {recommendation.type === "move_session" ? (
          <div className="min-w-52 space-y-1.5">
            <label className="text-xs font-medium" htmlFor="coach-destination-date">
              Move to
            </label>
            <Select value={chosenDate} onValueChange={setChosenDate} disabled={pending}>
              <SelectTrigger id="coach-destination-date">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {recommendation.availableDates.map((date) => (
                  <SelectItem key={date} value={date}>
                    {dayLabel(date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {recommendation.type === "adjust_support_dose" ? (
          <div className="rounded-lg border border-border/70 bg-background/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Current </span>
            {recommendation.currentSets} × {recommendation.currentValue} {recommendation.doseUnit}
            <ArrowRight className="mx-2 inline h-3.5 w-3.5" />
            <span className="text-muted-foreground">Proposed </span>
            {recommendation.targetSets} × {recommendation.targetValue} {recommendation.doseUnit}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void decide("accepted")} disabled={pending}>
            {pending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowRight className="mr-1 h-3.5 w-3.5" />
            )}
            {recommendation.type === "move_session"
              ? "Apply move"
              : recommendation.type === "skip_support_session"
                ? "Skip this session"
                : "Apply dose"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void decide("rejected")}
            disabled={pending}
          >
            Not this week
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {recommendation.type === "move_session"
          ? "Accepting moves this planned extra session only. Your strength programme remains unchanged."
          : recommendation.type === "skip_support_session"
            ? "Accepting skips this maintenance support session only. Your strength programme and higher priorities remain unchanged."
            : "Accepting changes this upcoming support dose only. Your strength programme prescription remains unchanged."}
      </p>
    </div>
  );
}
