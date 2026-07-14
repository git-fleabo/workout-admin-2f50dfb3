import {
  supabasePublicDelete,
  supabasePublicInsert,
  supabasePublicSelect,
  supabasePublicUpdate,
} from "./supabase-public";
import { getCurrentPerson } from "./supabase-people.browser";

type DailyRotationItemRecord = {
  id: string;
  person_id: string;
  name: string;
  target: string | null;
  cue: string | null;
  selection_weight: number;
  active_days: number[];
  minimum_days_between: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type DailyRotationAssignmentRecord = {
  id: string;
  person_id: string;
  item_id: string;
  assigned_date: string;
  completed_at: string | null;
  created_at: string;
};

export type DailyRotationItem = {
  id: string;
  name: string;
  target: string;
  cue: string;
  selectionWeight: number;
  activeDays: number[];
  minimumDaysBetween: number;
  isActive: boolean;
  sortOrder: number;
};

export type DailyRotationItemFields = Omit<DailyRotationItem, "id" | "sortOrder">;

export type TodayDailyRotation = {
  assignmentId: string;
  assignedDate: string;
  completedAt: string | null;
  item: DailyRotationItem;
};

function mapItem(row: DailyRotationItemRecord): DailyRotationItem {
  return {
    id: row.id,
    name: row.name,
    target: row.target ?? "",
    cue: row.cue ?? "",
    selectionWeight: row.selection_weight,
    activeDays: row.active_days,
    minimumDaysBetween: row.minimum_days_between,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

async function requirePerson() {
  const person = await getCurrentPerson();
  if (!person) throw new Error("Claim your profile first.");
  return person;
}

export async function listDailyRotationItemsClient() {
  const person = await getCurrentPerson();
  if (!person) {
    return { needsProfileClaim: true as const, items: [] as DailyRotationItem[] };
  }
  const rows = await supabasePublicSelect<DailyRotationItemRecord>("daily_rotation_items", {
    select:
      "id,person_id,name,target,cue,selection_weight,active_days,minimum_days_between,is_active,sort_order,created_at,updated_at",
    person_id: `eq.${person.id}`,
    order: "sort_order.asc,created_at.asc",
  });
  return { needsProfileClaim: false as const, items: rows.map(mapItem) };
}

export async function addDailyRotationItemClient(fields: DailyRotationItemFields) {
  const person = await requirePerson();
  const rows = await supabasePublicSelect<Pick<DailyRotationItemRecord, "sort_order">>(
    "daily_rotation_items",
    {
      select: "sort_order",
      person_id: `eq.${person.id}`,
      order: "sort_order.desc",
      limit: 1,
    },
  );
  await supabasePublicInsert<DailyRotationItemRecord>("daily_rotation_items", {
    person_id: person.id,
    name: fields.name.trim(),
    target: fields.target.trim() || null,
    cue: fields.cue.trim() || null,
    selection_weight: fields.selectionWeight,
    active_days: [...fields.activeDays].sort((a, b) => a - b),
    minimum_days_between: fields.minimumDaysBetween,
    is_active: fields.isActive,
    sort_order: (rows[0]?.sort_order ?? -1) + 1,
  });
  return { ok: true };
}

export async function updateDailyRotationItemClient(id: string, fields: DailyRotationItemFields) {
  const person = await requirePerson();
  await supabasePublicUpdate<DailyRotationItemRecord>(
    "daily_rotation_items",
    { id: `eq.${id}`, person_id: `eq.${person.id}` },
    {
      name: fields.name.trim(),
      target: fields.target.trim() || null,
      cue: fields.cue.trim() || null,
      selection_weight: fields.selectionWeight,
      active_days: [...fields.activeDays].sort((a, b) => a - b),
      minimum_days_between: fields.minimumDaysBetween,
      is_active: fields.isActive,
    },
  );
  return { ok: true };
}

export async function deleteDailyRotationItemClient(id: string) {
  const person = await requirePerson();
  await supabasePublicDelete<DailyRotationItemRecord>("daily_rotation_items", {
    id: `eq.${id}`,
    person_id: `eq.${person.id}`,
  });
  return { ok: true };
}

function isoWeekday(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function daysBetween(earlier: string, later: string) {
  const start = Date.parse(`${earlier}T00:00:00Z`);
  const end = Date.parse(`${later}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

function dateDaysAgo(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function weightedPick(items: DailyRotationItem[], seed: string) {
  const totalWeight = items.reduce((sum, item) => sum + item.selectionWeight, 0);
  let position = stableHash(seed) % totalWeight;
  for (const item of items) {
    if (position < item.selectionWeight) return item;
    position -= item.selectionWeight;
  }
  return items[items.length - 1];
}

async function findAssignment(personId: string, date: string) {
  const assignments = await supabasePublicSelect<DailyRotationAssignmentRecord>(
    "daily_rotation_assignments",
    {
      select: "id,person_id,item_id,assigned_date,completed_at,created_at",
      person_id: `eq.${personId}`,
      assigned_date: `eq.${date}`,
      limit: 1,
    },
  );
  const assignment = assignments[0];
  if (!assignment) return null;
  const items = await supabasePublicSelect<DailyRotationItemRecord>("daily_rotation_items", {
    select:
      "id,person_id,name,target,cue,selection_weight,active_days,minimum_days_between,is_active,sort_order,created_at,updated_at",
    id: `eq.${assignment.item_id}`,
    person_id: `eq.${personId}`,
    limit: 1,
  });
  if (!items[0]) return null;
  return {
    assignmentId: assignment.id,
    assignedDate: assignment.assigned_date,
    completedAt: assignment.completed_at,
    item: mapItem(items[0]),
  } satisfies TodayDailyRotation;
}

export async function getTodayDailyRotationClient(date: string) {
  const person = await getCurrentPerson();
  if (!person) {
    return {
      needsProfileClaim: true as const,
      hasConfiguredItems: false,
      rotation: null as TodayDailyRotation | null,
    };
  }

  const existing = await findAssignment(person.id, date);
  if (existing) {
    return { needsProfileClaim: false as const, hasConfiguredItems: true, rotation: existing };
  }

  const itemRows = await supabasePublicSelect<DailyRotationItemRecord>("daily_rotation_items", {
    select:
      "id,person_id,name,target,cue,selection_weight,active_days,minimum_days_between,is_active,sort_order,created_at,updated_at",
    person_id: `eq.${person.id}`,
    is_active: "eq.true",
    order: "sort_order.asc,created_at.asc",
  });
  const weekday = isoWeekday(date);
  const weekdayItems = itemRows.map(mapItem).filter((item) => item.activeDays.includes(weekday));
  if (!weekdayItems.length) {
    return {
      needsProfileClaim: false as const,
      hasConfiguredItems: itemRows.length > 0,
      rotation: null as TodayDailyRotation | null,
    };
  }

  const history = await supabasePublicSelect<DailyRotationAssignmentRecord>(
    "daily_rotation_assignments",
    {
      select: "id,person_id,item_id,assigned_date,completed_at,created_at",
      person_id: `eq.${person.id}`,
      assigned_date: `gte.${dateDaysAgo(date, 31)}`,
      order: "assigned_date.desc",
      limit: 500,
    },
  );
  const latestDateByItem = new Map<string, string>();
  for (const assignment of history) {
    if (!latestDateByItem.has(assignment.item_id)) {
      latestDateByItem.set(assignment.item_id, assignment.assigned_date);
    }
  }
  const gapEligible = weekdayItems.filter((item) => {
    const lastDate = latestDateByItem.get(item.id);
    return !lastDate || daysBetween(lastDate, date) > item.minimumDaysBetween;
  });
  const candidates = gapEligible.length ? gapEligible : weekdayItems;
  const chosen = weightedPick(
    candidates,
    `${person.id}:${date}:${candidates.map((item) => item.id).join(":")}`,
  );

  try {
    await supabasePublicInsert<DailyRotationAssignmentRecord>("daily_rotation_assignments", {
      person_id: person.id,
      item_id: chosen.id,
      assigned_date: date,
    });
  } catch (error) {
    const concurrent = await findAssignment(person.id, date);
    if (concurrent) {
      return {
        needsProfileClaim: false as const,
        hasConfiguredItems: true,
        rotation: concurrent,
      };
    }
    throw error;
  }
  const created = await findAssignment(person.id, date);
  if (!created) throw new Error("Today's rotation item could not be loaded.");
  return { needsProfileClaim: false as const, hasConfiguredItems: true, rotation: created };
}

export async function setDailyRotationCompletedClient(assignmentId: string, completed: boolean) {
  const person = await requirePerson();
  await supabasePublicUpdate<DailyRotationAssignmentRecord>(
    "daily_rotation_assignments",
    { id: `eq.${assignmentId}`, person_id: `eq.${person.id}` },
    { completed_at: completed ? new Date().toISOString() : null },
  );
  return { ok: true };
}
