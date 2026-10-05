import { BrainCircuit, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CoachOutcomeReview } from "@/lib/coach-outcome";
import type { CoachOutcomeRating } from "@/lib/weekly-coach-recommendation";

const OPTIONS: Array<{ rating: CoachOutcomeRating; label: string }> = [
  { rating: "too_easy", label: "Too easy" },
  { rating: "right", label: "About right" },
  { rating: "too_hard", label: "Too hard" },
];

export function CoachOutcomeReviewCard({
  review,
  pending,
  onReview,
}: {
  review: CoachOutcomeReview;
  pending: boolean;
  onReview: (decisionId: string, rating: CoachOutcomeRating) => Promise<void>;
}) {
  const submit = async (rating: CoachOutcomeRating) => {
    try {
      await onReview(review.decisionId, rating);
    } catch {
      // The parent mutation reports the error and keeps the review available.
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-violet-400/30 bg-violet-400/[0.06] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-violet-300" />
            <p className="text-sm font-semibold">Coach check-in</p>
            <Badge variant="outline">One tap</Badge>
          </div>
          <p className="mt-2 text-sm font-medium">{review.question}</p>
          <p className="mt-1 text-xs text-muted-foreground">{review.sessionLabel}</p>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{review.detail}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => (
          <Button
            key={option.rating}
            type="button"
            size="sm"
            variant={option.rating === "right" ? "default" : "outline"}
            disabled={pending}
            onClick={() => void submit(option.rating)}
          >
            {pending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            {option.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        This records the result of the coach’s previous change. It does not alter your programme or
        today’s workout.
      </p>
    </div>
  );
}
