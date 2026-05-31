function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // ISO YYYY-MM-DD (optionally with time)
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const y = +iso[1], m = +iso[2], d = +iso[3];
    const r = new Date(Date.UTC(y, m - 1, d));
    if (r.getUTCDate() !== d || r.getUTCMonth() !== m - 1) return null;
    return r;
  }

  // DD/MM/YYYY or DD-MM-YYYY (UK)
  const dmy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let y = parseInt(dmy[3]);
    const m = parseInt(dmy[2]);
    const d = parseInt(dmy[1]);
    if (y < 100) y += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const r = new Date(Date.UTC(y, m - 1, d));
    if (r.getUTCDate() !== d || r.getUTCMonth() !== m - 1) return null;
    return r;
  }

  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export function formatUKDate(dateStr: string): string {
  const d = parseDate(dateStr);
  if (!d) return dateStr || "";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatUKDateShort(dateStr: string): string {
  const d = parseDate(dateStr);
  if (!d) return dateStr || "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}
