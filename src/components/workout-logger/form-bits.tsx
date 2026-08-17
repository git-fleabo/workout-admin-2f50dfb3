import { History, Loader2, Trash2 } from "lucide-react";
import { formatUKDateShort } from "@/lib/date";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type RecentEntry = {
  id?: string;
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

export function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function SimpleSelect({
  value,
  onChange,
  options,
  placeholder,
  noneLabel = "Any",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  noneLabel?: string;
}) {
  const cleanOptions = Array.from(new Set(options.map((o) => o.trim()).filter(Boolean)));
  return (
    <Select value={value || "__none"} onValueChange={(v) => onChange(v === "__none" ? "" : v)}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder ?? "—"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">— {noneLabel} —</SelectItem>
        {cleanOptions.map((o) => (
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
  onDelete,
  deletingId,
}: {
  loading: boolean;
  entries: RecentEntry[];
  onSelect?: (index: number) => void;
  onDelete?: (entry: RecentEntry, index: number) => void;
  deletingId?: string | null;
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
          const deleting = Boolean(r.id && deletingId === r.id);
          const deleteButton =
            onDelete && r.id ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={deleting}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(r, i);
                }}
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${r.title}`}
                title="Delete"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            ) : null;
          const inner = (
            <>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-mono text-muted-foreground">
                {formatUKDateShort(r.date)}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium">{r.title}</p>
                  {r.completed && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                </div>
                <p className="truncate text-xs text-muted-foreground">{r.meta}</p>
              </div>
            </>
          );
          if (onSelect) {
            return (
              <Card key={i} className="flex items-start gap-1 border-border bg-card p-0">
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  className="flex min-w-0 flex-1 items-start gap-3 rounded-xl p-3 text-left transition hover:border-primary/40 hover:bg-secondary/40"
                >
                  {inner}
                </button>
                {deleteButton && <div className="pr-2 pt-2">{deleteButton}</div>}
              </Card>
            );
          }
          return (
            <Card key={i} className="flex items-start gap-3 border-border bg-card p-3">
              {inner}
              {deleteButton}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export type DeleteTarget = {
  id: string;
  title: string;
  description: string;
};

export function DeleteConfirmDialog({
  target,
  busy,
  onCancel,
  onConfirm,
}: {
  target: DeleteTarget | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (id: string) => void;
}) {
  return (
    <AlertDialog open={Boolean(target)} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
          <AlertDialogDescription>{target?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!target || busy}
            onClick={(e) => {
              e.preventDefault();
              if (target) onConfirm(target.id);
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Deleting
              </>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
