import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { listRecoveryClient } from "@/lib/supabase-recovery.browser";
import { templateDue } from "@/lib/recovery";
import { todayISO } from "@/lib/date";
const KEY = "tt:show-recovery-shortcut";
export function RecoveryShortcut() {
  const [hidden, setHidden] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(KEY) === "hidden",
  );
  const data = useQuery({ queryKey: ["recovery"], queryFn: listRecoveryClient, enabled: !hidden });
  const today = todayISO();
  const due =
    data.data?.routines.reduce(
      (count, r) =>
        count +
        r.templates.filter((t) => templateDue(t, r.status, r.id, data.data!.sessions, today))
          .length,
      0,
    ) ?? 0;
  const legacyDue = data.data?.schedules.filter((s) => s.suggested_for === today).length ?? 0;
  const drafts = data.data?.sessions.filter((s) => s.status === "draft").length ?? 0;
  if (hidden || !(due + legacyDue + drafts)) return null;
  return (
    <aside className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
      <Link to="/mobility" className="font-medium text-primary">
        Mobility &amp; Recovery · {due + legacyDue} due{drafts ? ` · ${drafts} to resume` : ""}
      </Link>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          localStorage.setItem(KEY, "hidden");
          setHidden(true);
        }}
      >
        Hide shortcut
      </Button>
    </aside>
  );
}
