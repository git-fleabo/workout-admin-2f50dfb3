import { supabasePublicSelect } from "./supabase-public";

type Params = Record<string, string | number | boolean | undefined>;

// History readers need every matching row, even if the server caps a response
// below our requested size. Do not return a partial series after a failed page.
export async function supabaseSelectAll<T>(table: string, params: Params = {}): Promise<T[]> {
  const rows: T[] = [];
  const seenPages = new Set<string>();
  const keys =
    table === "session_method_block_entries"
      ? ["block_id", "session_entry_id"]
      : table === "programme_session_dates"
        ? ["assignment_id", "program_workout_id"]
        : ["id"];
  const orderParts = String(params.order ?? "")
    .split(",")
    .filter(Boolean);
  for (const key of keys) {
    if (!orderParts.some((part) => part.startsWith(`${key}.`))) orderParts.push(`${key}.asc`);
  }
  const select = String(params.select ?? "*");
  const identitySelect =
    select === "*" || select === keys.join(",") || select.startsWith(`${keys.join(",")},`)
      ? select
      : `${keys.join(",")},${select}`;
  for (;;) {
    const page = await supabasePublicSelect<T>(table, {
      ...params,
      select: identitySelect,
      order: orderParts.join(","),
      limit: 500,
      offset: rows.length,
    });
    if (!page.length) return rows;
    const fingerprint = JSON.stringify(page);
    if (seenPages.has(fingerprint)) {
      throw new Error("Training history could not be loaded completely. Refresh and try again.");
    }
    seenPages.add(fingerprint);
    rows.push(...page);
  }
}

export async function supabaseSelectByIds<T>(
  table: string,
  column: string,
  ids: string[],
  params: Params = {},
) {
  const rows: T[] = [];
  const uniqueIds = [...new Set(ids)];
  for (let offset = 0; offset < uniqueIds.length; offset += 50) {
    rows.push(
      ...(await supabaseSelectAll<T>(table, {
        ...params,
        [column]: `in.(${uniqueIds.slice(offset, offset + 50).join(",")})`,
      })),
    );
  }
  return rows;
}
