import { supabasePublicSelect } from "./supabase-public";
import { getCurrentPerson } from "./supabase-people.browser";

export type ClimbingProgressRow = {
  date: string;
  grade: string | null;
  gradeSystem: string | null;
  sendType: string | null;
  isProject: boolean | null;
};

export async function getClimbingProgressClient(): Promise<ClimbingProgressRow[]> {
  const person = await getCurrentPerson();
  if (!person) throw new Error("This account is not linked to a training profile.");
  const rows = await supabasePublicSelect<{
    grade: string | null;
    grade_system: string | null;
    send_type: string | null;
    is_project: boolean | null;
    sessions: { session_date: string } | null;
  }>("session_entries", {
    select: "grade,grade_system,send_type,is_project,sessions!inner(session_date,person_id)",
    "sessions.person_id": `eq.${person.id}`,
    completed: "eq.true",
    limit: 5000,
  });
  return rows
    .filter((row) => row.sessions?.session_date)
    .map((row) => ({
      date: row.sessions?.session_date ?? "",
      grade: row.grade,
      gradeSystem: row.grade_system,
      sendType: row.send_type,
      isProject: row.is_project,
    }));
}
