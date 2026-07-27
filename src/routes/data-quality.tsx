import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, DatabaseZap, Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SettingsBackLink } from "@/components/settings-back-link";
import {
  getDataQualityAuditClient,
  type DataQualityRow,
} from "@/lib/supabase-data-quality.browser";
import { formatUKDate } from "@/lib/date";

export const Route = createFileRoute("/data-quality")({
  head: () => ({
    meta: [
      { title: "Data Quality · Training Tracker" },
      {
        name: "description",
        content: "Read-only audit of historical workout data and migration quality.",
      },
    ],
  }),
  component: DataQualityPage,
});

function ConfidenceBadge({ row }: { row: DataQualityRow }) {
  if (row.confidence === "high") {
    return (
      <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
        High confidence
      </Badge>
    );
  }
  if (row.confidence === "ambiguous") {
    return <Badge className="border-amber-400/25 bg-amber-400/10 text-amber-200">Ambiguous</Badge>;
  }
  if (row.confidence === "manual") {
    return <Badge variant="outline">Manual review</Badge>;
  }
  return null;
}

function DataQualityPage() {
  const audit = useQuery({
    queryKey: ["data-quality-audit"],
    queryFn: getDataQualityAuditClient,
    staleTime: 60_000,
    refetchOnMount: "always",
  });

  if (audit.isLoading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Running read-only audit…
      </div>
    );
  }

  if (audit.isError || !audit.data) {
    return (
      <Card className="mx-auto max-w-2xl space-y-3 p-5">
        <div className="flex items-center gap-2 font-semibold text-destructive">
          <AlertTriangle className="h-5 w-5" /> Audit unavailable
        </div>
        <p className="text-sm text-muted-foreground">
          {audit.error instanceof Error ? audit.error.message : "The audit could not be loaded."}
        </p>
        <Button variant="outline" onClick={() => audit.refetch()}>
          Try again
        </Button>
      </Card>
    );
  }

  const totalIssues = audit.data.categories.reduce(
    (total, category) => total + category.rows.length,
    0,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-4 border-b border-border pb-5">
        <SettingsBackLink />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">
              <DatabaseZap className="h-4 w-4" /> Supabase audit
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Data Quality</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Read-only visibility into historical ambiguity, provenance and calculation safety.
              Nothing on this screen changes workout data.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => audit.refetch()}
              disabled={audit.isFetching}
            >
              <RefreshCw className={`mr-1 h-4 w-4 ${audit.isFetching ? "animate-spin" : ""}`} />
              {audit.isFetching ? "Refreshing…" : "Refresh audit"}
            </Button>
            <Badge variant="outline" className="border-cyan-400/25 bg-cyan-400/10 text-cyan-200">
              Read only
            </Badge>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-2xl font-semibold">{audit.data.sessionCount}</div>
            <div className="text-xs text-muted-foreground">Completed sessions audited</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-semibold">{totalIssues}</div>
            <div className="text-xs text-muted-foreground">Rows and candidate groups surfaced</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm font-medium">
              {new Date(audit.data.capturedAt).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div className="text-xs text-muted-foreground">
              Last live refresh · runs on open, not on a schedule
            </div>
          </Card>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {audit.data.categories.map((category) => (
          <Card key={category.key} className="overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 className="font-semibold">{category.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {category.description}
                </p>
              </div>
              <Badge variant="secondary">{category.rows.length}</Badge>
            </div>
            {category.rows.length ? (
              <div className="max-h-96 divide-y divide-border overflow-y-auto">
                {category.rows.map((row) => (
                  <div key={`${category.key}:${row.id}`} className="space-y-2 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">{row.title}</div>
                        {row.date ? (
                          <div className="text-xs text-muted-foreground">
                            {formatUKDate(row.date)}
                          </div>
                        ) : null}
                      </div>
                      <ConfidenceBadge row={row} />
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{row.detail}</p>
                    <code className="block break-all text-[10px] text-muted-foreground/70">
                      {row.id}
                    </code>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-4 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> No rows in this category
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
