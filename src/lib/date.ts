function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function parseDateParts(dateStr: string): { day: number; month: number; year: number } | null {
  if (!dateStr) return null;

  // ISO YYYY-MM-DD (optionally with time)
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const year = +iso[1],
      month = +iso[2],
      day = +iso[3];
    const r = new Date(Date.UTC(year, month - 1, day));
    if (r.getUTCDate() !== day || r.getUTCMonth() !== month - 1) return null;
    return { day, month, year };
  }

  // DD/MM/YYYY or DD-MM-YYYY (UK)
  const dmy = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dmy) {
    let year = parseInt(dmy[3]);
    const month = parseInt(dmy[2]);
    const day = parseInt(dmy[1]);
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const r = new Date(Date.UTC(year, month - 1, day));
    if (r.getUTCDate() !== day || r.getUTCMonth() !== month - 1) return null;
    return { day, month, year };
  }

  // DD MMM YYYY or DD Month YYYY (UK display format)
  const dmyText = dateStr.trim().match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/);
  if (dmyText) {
    let year = parseInt(dmyText[3]);
    const monthName = dmyText[2].slice(0, 3).toLowerCase();
    const month = MONTHS.findIndex((m) => m.toLowerCase() === monthName) + 1;
    const day = parseInt(dmyText[1]);
    if (year < 100) year += 2000;
    if (month < 1 || day < 1 || day > 31) return null;
    const r = new Date(Date.UTC(year, month - 1, day));
    if (r.getUTCDate() !== day || r.getUTCMonth() !== month - 1) return null;
    return { day, month, year };
  }

  return null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatUKDate(dateStr: string): string {
  const d = parseDateParts(dateStr);
  if (!d) return dateStr || "";
  return `${pad2(d.day)} ${MONTHS[d.month - 1]} ${d.year}`;
}

export function formatUKDateShort(dateStr: string): string {
  const d = parseDateParts(dateStr);
  if (!d) return dateStr || "—";
  return `${pad2(d.day)} ${MONTHS[d.month - 1]}`;
}

export function formatUKDateNumeric(dateStr: string): string {
  const d = parseDateParts(dateStr);
  if (!d) return dateStr || "";
  return `${pad2(d.day)}/${pad2(d.month)}/${d.year}`;
}

export function toISODate(dateStr: string): string {
  const d = parseDateParts(dateStr);
  if (!d) return "";
  return `${d.year}-${pad2(d.month)}-${pad2(d.day)}`;
}

export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}
