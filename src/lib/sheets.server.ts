const SHEET_ID = "17bxY64sce1_QcoWVf0gYHlbWkOVwu3MvZj6eUtTbT7o";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

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
  const res = await fetch(`${GATEWAY}/spreadsheets/${SHEET_ID}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Sheets API ${res.status}: ${t}`);
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
    body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
  });
}

export async function findNextEmptyLogRow(): Promise<number> {
  // headers row 4, data starts row 5; check column E (Exercise)
  const rows = await getValues("Workout%20Log!E5:E1000");
  let i = 0;
  while (i < rows.length && rows[i] && rows[i][0] && rows[i][0].toString().trim() !== "") {
    i++;
  }
  return 5 + i;
}
