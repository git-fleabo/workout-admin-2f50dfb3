export function countLabel(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

// Keep the saved session name intact; only add a week when it is absent.
export function programmeSessionLabel(name: string, week?: number | null) {
  return week && !new RegExp(`\\bweek\\s*${week}\\b`, "i").test(name)
    ? `Week ${week} · ${name}`
    : name;
}
