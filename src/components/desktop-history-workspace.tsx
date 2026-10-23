import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUKDate } from "@/lib/date";
import type { TimelineEntry } from "@/lib/supabase-timeline.browser";

export function DesktopHistoryWorkspace({
  header,
  sourceNotice,
  filters,
  stats,
  consistency,
  story,
  entries,
  totalRecords,
  selected,
  onSelect,
  search,
  onSearchChange,
  sort,
  onSortChange,
  details,
  pagination,
}: {
  header: ReactNode;
  sourceNotice: ReactNode;
  filters: ReactNode;
  stats: ReactNode;
  consistency: ReactNode;
  story: ReactNode;
  entries: TimelineEntry[];
  totalRecords: number;
  selected: TimelineEntry | null;
  onSelect: (entry: TimelineEntry) => void;
  search: string;
  onSearchChange: (value: string) => void;
  sort: "newest" | "oldest";
  onSortChange: (value: "newest" | "oldest") => void;
  details: ReactNode;
  pagination: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-5" data-testid="desktop-history-workspace">
      {header}
      {sourceNotice}
      <Card className="space-y-4 p-4">
        {filters}
        <div className="flex items-end gap-4 border-t border-border pt-4">
          <label className="relative block max-w-xl flex-1">
            <span className="mb-1.5 block text-xs font-medium">Search this period</span>
            <Search className="pointer-events-none absolute bottom-3.5 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Session, exercise or notes…"
              className="pl-9"
            />
          </label>
          <label className="block text-xs font-medium">
            Sort records
            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value as "newest" | "oldest")}
              className="mt-1.5 block h-12 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
          <p className="max-w-56 pb-2 text-xs text-muted-foreground">
            Totals cover the selected period and activity filter. Search narrows the records below.
          </p>
        </div>
      </Card>
      {stats}
      <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 space-y-4">
          {story}
          <Card className="min-w-0 overflow-hidden">
            <div className="border-b border-border p-4">
              <h2 className="font-semibold">Training records</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Showing {entries.length} of {totalRecords} matching records. Select a row to read
                its details.
              </p>
            </div>
            {entries.length ? (
              <Table aria-label="Training records">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Record</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="pr-4 text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow
                      key={entry.id}
                      data-state={selected?.id === entry.id ? "selected" : undefined}
                    >
                      <TableCell className="max-w-sm pl-4">
                        <button
                          type="button"
                          aria-pressed={selected?.id === entry.id}
                          onClick={() => onSelect(entry)}
                          className="w-full rounded-sm py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="block break-words text-sm font-semibold text-primary">
                            {entry.title}
                            {entry.isPr ? (
                              <Badge className="ml-2 bg-amber-500 text-black">PR</Badge>
                            ) : null}
                          </div>
                          <span className="mt-1 block break-words text-xs text-muted-foreground">
                            {entry.subtitle}
                          </span>
                        </button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatUKDate(entry.date)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {entry.kind === "one_rm"
                          ? "1RM"
                          : entry.kind === "bodyweight"
                            ? "Bodyweight"
                            : entry.kind === "climb"
                              ? "Climb"
                              : "Workout"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap pr-4 text-right text-xs tabular-nums">
                        {entry.minutes != null && entry.minutes > 0
                          ? entry.minutes < 1
                            ? `${Math.round(entry.minutes * 60)} sec`
                            : `${Number(entry.minutes.toFixed(1))} min`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {search.trim()
                  ? "No records match your search in this period."
                  : "No history for this view."}
              </p>
            )}
          </Card>
          {pagination}
          {consistency}
        </div>
        <aside
          aria-label="Selected history record"
          className="sticky top-48 max-h-[calc(100vh-13rem)] overflow-y-auto rounded-xl border border-border bg-card p-5"
        >
          {selected ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Selected record
              </p>
              <h2 className="mt-2 break-words text-lg font-semibold">{selected.title}</h2>
              <p className="mb-4 mt-1 text-xs text-muted-foreground">
                {formatUKDate(selected.date)} · {selected.subtitle}
              </p>
              {details}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Choose a record to inspect its session details and notes.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
