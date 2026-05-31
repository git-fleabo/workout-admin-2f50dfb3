import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { formatUKDate, formatUKDateShort, toISODate } from "@/lib/date";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type RecentEntry = {
  date: string;
  title: string;
  meta: string;
  completed: boolean;
};

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [text, setText] = useState(() => formatUKDate(value));

  useEffect(() => {
    setText(formatUKDate(value));
  }, [value]);

  return (
    <Input
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        const iso = toISODate(next);
        if (iso) onChange(iso);
      }}
      onBlur={() => setText(formatUKDate(value))}
      placeholder="DD MMM YYYY"
    />
  );
}

export function SimpleSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <Select
      value={value || "__none"}
      onValueChange={(v) => onChange(v === "__none" ? "" : v)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder ?? "—"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">— Any —</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function RecentList({
  loading,
  entries,
  onSelect,
}: {
  loading: boolean;
  entries: RecentEntry[];
  onSelect?: (index: number) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Recent
        </h2>
        {onSelect && (
          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
            tap to re-log
          </span>
        )}
      </div>
      {loading && <Card className="p-4 text-sm text-muted-foreground">Loading…</Card>}
      {!loading && entries.length === 0 && (
        <Card className="p-4 text-sm text-muted-foreground">No entries yet.</Card>
      )}
      <div className="space-y-2">
        {entries.map((r, i) => {
          const inner = (
            <>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-mono text-muted-foreground">
                {formatUKDateShort(r.date)}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium">{r.title}</p>
                  {r.completed && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">{r.meta}</p>
              </div>
            </>
          );
          if (onSelect) {
            return (
              <Card key={i} className="border-border bg-card p-0">
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  className="flex w-full items-start gap-3 rounded-xl p-3 text-left transition hover:border-primary/40 hover:bg-secondary/40"
                >
                  {inner}
                </button>
              </Card>
            );
          }
          return (
            <Card key={i} className="flex items-start gap-3 border-border bg-card p-3">
              {inner}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
