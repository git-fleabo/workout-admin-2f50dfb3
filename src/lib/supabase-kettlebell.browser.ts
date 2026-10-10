import { kettlebellWorkoutSchema, type KettlebellWorkout } from "./kettlebell-workouts";
import { getCurrentPerson } from "./supabase-people.browser";
import { supabasePublicRpc, supabasePublicSelect } from "./supabase-public";
import { getLibraryClient } from "./supabase-log.browser";
import { listManagedTrainingLocationsClient } from "./supabase-training-locations.browser";
import { getSavedWorkoutPlanClient } from "./supabase-plans.browser";
import { todayISO } from "./date";

export async function getKettlebellCatalogueClient() {
  const person = await getCurrentPerson();
  if (!person) throw new Error("Connect your training profile first.");
  const [rows, locations, library, recent] = await Promise.all([
    supabasePublicSelect<Record<string, unknown>>("kettlebell_workouts", {
      select:
        "id,collection_key,category,source_number,title,summary,instructions,source_reference,bell_count,required_equipment_ids,duration_minutes,version,verified,is_available,prescription",
      person_id: `eq.${person.id}`,
      collection_key: "eq.strong_on",
      order: "category.asc,source_number.asc",
      limit: 1000,
    }),
    listManagedTrainingLocationsClient(),
    getLibraryClient(),
    supabasePublicSelect<{ kettlebell_workout_id: string }>("suggested_workouts", {
      select: "kettlebell_workout_id",
      person_id: `eq.${person.id}`,
      kettlebell_workout_id: "not.is.null",
      status: "eq.completed",
      order: "created_at.desc",
      limit: 15,
    }),
  ]);
  const workouts = rows.flatMap((row): KettlebellWorkout[] => {
    const parsed = kettlebellWorkoutSchema.safeParse({
      id: row.id,
      collectionKey: row.collection_key,
      category: row.category,
      sourceNumber: row.source_number,
      title: row.title,
      summary: row.summary,
      instructions: row.instructions,
      sourceReference: row.source_reference,
      bellCount: row.bell_count,
      requiredEquipmentIds: row.required_equipment_ids,
      durationMinutes: row.duration_minutes == null ? null : Number(row.duration_minutes),
      version: row.version,
      verified: row.verified,
      isAvailable: row.is_available,
      prescription: row.prescription,
    });
    return parsed.success ? [parsed.data] : [];
  });
  return {
    personId: person.id,
    workouts,
    totalRecords: rows.length,
    locations: locations.items.filter(
      (location) => location.isActive && (location.kind === "home" || location.kind === "gym"),
    ),
    equipmentItems: locations.equipmentItems.filter((item) => item.isActive),
    exercises: library.exercises,
    recentIds: recent.map((row) => row.kettlebell_workout_id),
  };
}

export async function startKettlebellWorkoutClient(
  workout: KettlebellWorkout,
  locationId: string,
  bellCount: 1 | 2,
  requestId: string,
) {
  const id = await supabasePublicRpc<string>("start_kettlebell_workout", {
    p_workout_id: workout.id,
    p_expected_version: workout.version,
    p_location_id: locationId,
    p_bell_count: bellCount,
    p_request_id: requestId,
    p_suggested_for: todayISO(),
  });
  const plan = await getSavedWorkoutPlanClient(id);
  if (
    plan.status !== "accepted" ||
    plan.kettlebellWorkoutId !== workout.id ||
    plan.programAssignmentId ||
    plan.programWorkoutId ||
    plan.goalId ||
    plan.mobilityRunId
  ) {
    throw new Error("This session could not be opened as a standalone workout.");
  }
  return plan;
}
