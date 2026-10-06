const DAY_MS = 86_400_000;

function parseCalendarDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

export function addCalendarDays(iso: string, days: number) {
  return new Date(parseCalendarDate(iso).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function startOfMondayWeek(iso: string) {
  return addCalendarDays(iso, -((parseCalendarDate(iso).getUTCDay() + 6) % 7));
}

export function calendarWeekDates(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(weekStart, index));
}
