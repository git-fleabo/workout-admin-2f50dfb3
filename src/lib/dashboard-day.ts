import { todayISO } from "./date";
import type { WeekDay } from "./training-types";

export function dashboardDaySummary(day: WeekDay) {
  if (day.workouts > 0) {
    return `${day.workouts} workout${day.workouts === 1 ? "" : "s"} · ${day.minutes > 0 ? `${Math.round(day.minutes)} min` : "duration not recorded"}`;
  }
  if (day.entries.length > 0) {
    return day.minutes > 0 ? `${Math.round(day.minutes)} min logged` : "Duration not recorded";
  }
  if (day.isRestDay) return "Rest day";
  return day.date > todayISO() ? "No activity logged yet" : "No activity logged";
}

export function dashboardDayLabel(day: WeekDay) {
  if (day.workouts > 0) return `${day.workouts} workout${day.workouts === 1 ? "" : "s"}`;
  if (day.entries.length > 0) return "Activity";
  if (day.isRestDay) return "Rest";
  return day.date > todayISO() ? "Upcoming" : "No activity";
}
