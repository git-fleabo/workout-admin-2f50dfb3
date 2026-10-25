import type { DashboardData } from "../../src/lib/supabase-dashboard.browser";

export function dashboardFixture(): DashboardData {
  return {
    thisWeekStart: "2026-10-19",
    kpis: {
      workoutsThisWeek: 3,
      minutesThisWeek: 135,
      activeDaysThisWeek: 3,
      climbingHoursThisMonth: 6,
      climbingSessionsThisMonth: 4,
      latestBodyweight: 67,
      totalPRs: 12,
    },
    goals: { weeklyWorkouts: 4, weeklyMinutes: 180 },
    weekDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, index) => {
      const trained = [0, 2, 4].includes(index);
      const exercises =
        index === 4
          ? ["Bench Press", "High Bar Squat"]
          : index === 2
            ? ["Bouldering"]
            : index === 0
              ? ["Deadlift", "Seated Dumbbell Press"]
              : [];
      return {
        date: `2026-10-${19 + index}`,
        label,
        workouts: trained ? 1 : 0,
        minutes: trained ? 45 : 0,
        isToday: index === 6,
        exercises,
        entries: exercises.map((exercise) => ({
          exercise,
          activityLabel: exercise === "Bouldering" ? "Climbing" : "Strength",
          completed: true,
          counts: true,
          notes: exercise === "High Bar Squat" ? "Controlled reps, comfortable depth." : "",
          details:
            exercise === "Bouldering"
              ? [
                  { label: "Grade", value: "V4" },
                  { label: "Problems", value: "12" },
                ]
              : [
                  { label: "Sets", value: "3" },
                  { label: "Reps", value: "6" },
                  { label: "Weight", value: "60 kg" },
                ],
        })),
      };
    }),
    workoutsByWeek: Array.from({ length: 16 }, (_, index) => ({
      weekStart: `2026-07-${String(1 + index).padStart(2, "0")}`,
      label: `Week ${index + 1}`,
      workouts: [3, 4, 3, 2, 4][index % 5],
      minutes: 135,
    })),
    climbingByMonth: [],
    bodyweight: [],
    monthlySummary: ["Oct", "Sep", "Aug", "Jul"].map((label, index) => ({
      monthStart: `2026-${10 - index}-01`,
      label: `${label} 2026`,
      workouts: 12 + index,
      minutes: 540 + index * 30,
      climbSessions: 4,
      climbHours: 6,
    })),
    recentPRs: [
      {
        kind: "1rm",
        title: "Bench Press",
        value: "82.5 kg",
        detail: "Estimated 1RM",
        date: "2026-10-23",
      },
      { kind: "skill", title: "Front Lever", value: "8 sec", detail: "Hold", date: "2026-10-21" },
    ],
    climbing: {
      sessionsLast30Days: 4,
      hoursLast30Days: 6,
      bouldersLast30Days: 48,
      latestGrade: "V4",
      latestClimb: { date: "2026-10-21", name: "Bouldering" },
    },
    strength: {
      bestLift: { name: "Deadlift", value: 110, date: "2026-10-19" },
      latestTest: { name: "Bench Press", value: 82.5, date: "2026-10-23" },
      exercisesTracked: 8,
    },
    trend: {
      firstWorkoutDate: "2026-07-01",
      weeksTraining: 16,
      totalWorkouts: 54,
      totalMinutes: 2430,
      totalClimbHours: 24,
      totalClimbSessions: 16,
      avgWorkoutsPerWeek: 3.4,
      bodyweightDelta: -0.5,
      startingBodyweight: 67.5,
    },
  };
}
