const DEFAULT_SHEET_ID = "17bxY64sce1_QcoWVf0gYHlbWkOVwu3MvZj6eUtTbT7o";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

function sheetId() {
  return process.env.GOOGLE_SHEET_ID || DEFAULT_SHEET_ID;
}

function authHeaders() {
  const lov = process.env.LOVABLE_API_KEY;
  const key = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY missing");
  if (!key) throw new Error("GOOGLE_SHEETS_API_KEY missing");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": key,
    "Content-Type": "application/json",
  };
}

async function gw(path: string, init?: RequestInit) {
  const res = await fetch(`${GATEWAY}/spreadsheets/${sheetId()}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("Sheets API error", res.status, t);
    throw new Error("Failed to reach the spreadsheet. Please try again.");
  }
  return res.json();
}

export async function getValues(range: string): Promise<string[][]> {
  const data = await gw(`/values/${range}`);
  return (data.values ?? []) as string[][];
}

export async function batchUpdateValues(
  data: { range: string; values: (string | number | boolean)[][] }[],
) {
  return gw(`/values:batchUpdate`, {
    method: "POST",
    // RAW prevents formula injection (e.g. =IMPORTDATA) from user-supplied text.
    body: JSON.stringify({ valueInputOption: "RAW", data }),
  });
}

// Spreadsheet-level batchUpdate (e.g. deleteDimension, addSheet).
export async function spreadsheetBatchUpdate(requests: unknown[]) {
  return gw(`:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests }),
  });
}

// Known sheet IDs in the spreadsheet.
export const SHEET_IDS = {
  exerciseLibrary: 1064688843,
  goals: 1975505418,
  workoutLog: 1179123507,
  climbingLog: 962168523,
  oneRMTracker: 117611871,
  skillsTracker: 257980060,
} as const;

// Delete a single sheet row (1-based row number).
export async function deleteSheetRow(sheetId: number, rowNumber: number) {
  await spreadsheetBatchUpdate([
    {
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: rowNumber - 1,
          endIndex: rowNumber,
        },
      },
    },
  ]);
}

async function findNextEmptyRow(range: string, startRow: number): Promise<number> {
  const rows = await getValues(range);
  let i = 0;
  while (i < rows.length && rows[i] && rows[i][0] && rows[i][0].toString().trim() !== "") {
    i++;
  }
  return startRow + i;
}

export function findNextEmptyLogRow() {
  // Workout Log: headers row 4, data starts row 5; check column E (Exercise)
  return findNextEmptyRow("Workout%20Log!E5:E1000", 5);
}

export function findNextEmptyClimbRow() {
  // Climbing Log: headers row 9, data starts row 10; check column A (Date)
  return findNextEmptyRow("Climbing%20Log!A10:A1000", 10);
}

export function findNextEmptySkillRow() {
  // Skill Practice Log: headers row 40, data starts row 41; check column B (Skill)
  return findNextEmptyRow("Skills%20Tracker!B41:B1000", 41);
}

export function findNextEmpty1RMRow() {
  // 1RM Test Log: headers row 69, data starts row 70; check column D (Exercise)
  return findNextEmptyRow("1RM%20Tracker!D70:D1000", 70);
}

export function findNextEmptyBodyweightRow() {
  // Bodyweight Log: headers row 6, data starts row 7; check column J (Date)
  return findNextEmptyRow("1RM%20Tracker!J7:J200", 7);
}
