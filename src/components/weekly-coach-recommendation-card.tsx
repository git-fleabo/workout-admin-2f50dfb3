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
      await onDecision(decision, decision === "accepted" ? chosenDate : undefined);
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
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
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
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void decide("accepted")} disabled={pending}>
            {pending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowRight className="mr-1 h-3.5 w-3.5" />
            )}
            Apply move
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
        Accepting moves this planned extra session only. Your strength programme remains unchanged.
      </p>
    </div>
  );
}
