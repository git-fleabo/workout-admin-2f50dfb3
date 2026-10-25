import { todayISO } from "./date";
import type { WeekDay } from "./training-types";

export function dashboardDaySummary(day: WeekDay) {
  if (day.workouts > 0) {
    return `${day.workouts} workout${day.workouts === 1 ? "" : "s"} · ${day.minutes > 0 ? `${Math.round(day.minutes)} min` : "duration not recorded"}`;
  }
  if (day.entries.length > 0) {
    return day.minutes > 0 ? `${Math.round(day.minutes)} min logged` : "Duration not recorded";
  }
  return day.date > todayISO() ? "No activity logged yet" : "Rest day";
}
