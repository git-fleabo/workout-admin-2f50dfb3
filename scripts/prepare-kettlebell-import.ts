import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { KETTLEBELL_CATEGORIES, kettlebellWorkoutSchema } from "../src/lib/kettlebell-workouts.ts";

const pilotSchema = z
  .object({
    personId: z.string().uuid(),
    workouts: z.array(kettlebellWorkoutSchema).min(5).max(15),
  })
  .strict();
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

// Produces a private reviewable import; never connects to the database or handles credentials.
export function prepareKettlebellPilotImport(input: unknown) {
  const pilot = pilotSchema.parse(input);
  const expected = new Set(
    KETTLEBELL_CATEGORIES.filter((category) =>
      pilot.workouts.some((workout) => workout.category === category),
    ).flatMap((category) => [1, 2, 3, 4, 5].map((number) => `${category}:${number}`)),
  );
  const ids = new Set<string>();
  for (const workout of pilot.workouts) {
    const key = `${workout.category}:${workout.sourceNumber}`;
    if (!expected.delete(key) || ids.has(workout.id))
      throw new Error("Use exactly workouts 1–5 in each supplied category, with unique IDs.");
    ids.add(workout.id);
  }
  if (expected.size) throw new Error("Each supplied category must contain all of workouts 1–5.");
  const rows = pilot.workouts.map((w) => ({
    id: w.id,
    person_id: pilot.personId,
    collection_key: w.collectionKey,
    category: w.category,
    source_number: w.sourceNumber,
    title: w.title,
    summary: w.summary,
    instructions: w.instructions,
    source_reference: w.sourceReference,
    bell_count: w.bellCount,
    required_equipment_ids: w.requiredEquipmentIds,
    duration_minutes: w.durationMinutes,
    verified: w.verified,
    is_available: w.isAvailable,
    prescription: w.prescription,
  }));
  return `-- Personal workout content: review locally; do not commit this file.\n-- Initial batch: source workouts 1–5 in Strength, Muscle and Conditioning.\nbegin;\ninsert into public.kettlebell_workouts(id,person_id,collection_key,category,source_number,title,summary,instructions,source_reference,bell_count,required_equipment_ids,duration_minutes,verified,is_available,prescription)\nselect id,person_id,collection_key,category,source_number,title,summary,instructions,source_reference,bell_count,required_equipment_ids,duration_minutes,verified,is_available,prescription\nfrom jsonb_to_recordset(${literal(JSON.stringify(rows))}::jsonb) as r(id uuid,person_id uuid,collection_key text,category text,source_number integer,title text,summary text,instructions text,source_reference text,bell_count integer,required_equipment_ids uuid[],duration_minutes numeric,verified boolean,is_available boolean,prescription jsonb)\non conflict(person_id,collection_key,category,source_number) do update set title=excluded.title,summary=excluded.summary,instructions=excluded.instructions,source_reference=excluded.source_reference,bell_count=excluded.bell_count,required_equipment_ids=excluded.required_equipment_ids,duration_minutes=excluded.duration_minutes,verified=excluded.verified,is_available=excluded.is_available,prescription=excluded.prescription;\ncommit;\n`;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const inputPath = process.argv[2];
    if (!inputPath)
      throw new Error(
        "Usage: node --experimental-strip-types scripts/prepare-kettlebell-import.ts /path/to/pilot.json",
      );
    const sql = prepareKettlebellPilotImport(JSON.parse(readFileSync(inputPath, "utf8")));
    const folder = resolve("kettlebell-import.local");
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    const output = join(folder, "pilot.sql");
    writeFileSync(output, sql, { mode: 0o600 });
    console.log(
      `Prepared the supplied complete category batches for review: ${output}. No database changes made.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Import preparation failed.");
    process.exitCode = 1;
  }
}
