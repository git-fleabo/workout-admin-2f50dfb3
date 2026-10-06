import assert from "node:assert/strict";
import test from "node:test";

import { addCalendarDays, calendarWeekDates, startOfMondayWeek } from "../src/lib/calendar-week.ts";

test("desktop weeks always start on Monday", () => {
  assert.equal(startOfMondayWeek("2026-10-06"), "2026-10-05");
  assert.equal(startOfMondayWeek("2026-10-11"), "2026-10-05");
  assert.equal(startOfMondayWeek("2026-10-12"), "2026-10-12");
});

test("week navigation crosses month and year boundaries safely", () => {
  assert.equal(addCalendarDays("2026-12-28", 7), "2027-01-04");
  assert.equal(addCalendarDays("2027-01-04", -7), "2026-12-28");
});

test("desktop week dates expose Monday through Sunday", () => {
  assert.deepEqual(calendarWeekDates("2026-10-05"), [
    "2026-10-05",
    "2026-10-06",
    "2026-10-07",
    "2026-10-08",
    "2026-10-09",
    "2026-10-10",
    "2026-10-11",
  ]);
});
