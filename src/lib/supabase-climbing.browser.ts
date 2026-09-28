import { supabasePublicSelect } from "./supabase-public";
import { getCurrentPerson } from "./supabase-people.browser";
import {
  climbingProgressFromEntries,
  type ClimbingEntryRecord,
  type ClimbingProgressRow,
} from "./climbing-progress";

export type { ClimbingProgressRow } from "./climbing-progress";

export async function getClimbingProgressClient(): Promise<ClimbingProgressRow[]> {
  const person = await getCurrentPerson();
  if (!person) throw new Error("This account is not linked to a training profile.");
  const rows = await supabasePublicSelect<ClimbingEntryRecord>("session_entries", {
    select:
      "entry_metrics(metric_key,metric_value,metric_text),sessions!inner(session_date,person_id)",
    "sessions.person_id": `eq.${person.id}`,
    completed: "eq.true",
    limit: 5000,
  });
  return climbingProgressFromEntries(rows);
}
