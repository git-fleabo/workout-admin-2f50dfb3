export type ClimbingProgressRow = {
  date: string;
  grade: string;
  gradeSystem: string | null;
  sendType: string | null;
  isProject: boolean | null;
};

export type ClimbingEntryRecord = {
  entry_metrics: Array<{
    metric_key: string;
    metric_value: number | string | null;
    metric_text: string | null;
  }> | null;
  sessions: { session_date: string } | null;
};

export function climbingProgressFromEntries(rows: ClimbingEntryRecord[]): ClimbingProgressRow[] {
  return rows.flatMap((row) => {
    const date = row.sessions?.session_date;
    const metrics = row.entry_metrics ?? [];
    const metric = (key: string) => metrics.find((item) => item.metric_key === key);
    const grade = metric("grade")?.metric_text?.trim();
    if (!date || !grade) return [];
    const projectValue = metric("is_project")?.metric_value;
    return [
      {
        date,
        grade,
        gradeSystem: metric("grade_system")?.metric_text?.trim() || null,
        sendType: metric("send_type")?.metric_text?.trim() || null,
        isProject: projectValue == null ? null : Number(projectValue) > 0,
      },
    ];
  });
}
