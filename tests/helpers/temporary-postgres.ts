import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const binaries = ["initdb", "pg_ctl", "psql"];
export const pgBin =
  process.env.PERSONAL_PROGRAMME_PG_BIN ??
  (process.env.PATH ?? "")
    .split(delimiter)
    .find((folder) => binaries.every((binary) => existsSync(join(folder, binary))));
export const pgSkip = pgBin
  ? false
  : "Local PostgreSQL binaries unavailable; set PERSONAL_PROGRAMME_PG_BIN.";
export const literal = (value: unknown) => `'${String(value).replaceAll("'", "''")}'`;
export const json = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`;

export function temporaryPostgres() {
  if (!pgBin) throw new Error(String(pgSkip));
  const root = mkdtempSync(join(tmpdir(), "tt-pg-"));
  const data = join(root, "data");
  const run = (binary: string, args: string[], input?: string) =>
    execFileSync(join(pgBin, binary), args, {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  let started = false;
  const close = () => {
    try {
      if (started) run("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };
  try {
    run("initdb", ["-D", data, "-A", "trust", "--no-locale"]);
    // Socket only; each test has its own directory and cannot reach a live DB.
    run("pg_ctl", [
      "-D",
      data,
      "-l",
      join(root, "log"),
      "-o",
      `-h '' -k ${root} -p 54439`,
      "-w",
      "start",
    ]);
    started = true;
  } catch (error) {
    close();
    throw error;
  }
  const sql = (query: string, person?: string, role = "authenticated") =>
    run(
      "psql",
      [
        "-h",
        root,
        "-p",
        "54439",
        "-d",
        "postgres",
        "-X",
        "-q",
        "-A",
        "-t",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      `${person ? `set role ${role}; set request.jwt.claim.sub=${literal(person)};` : ""}\n${query}`,
    ).trim();
  const file = (url: URL) => sql(readFileSync(url, "utf8"));
  return { root, sql, file, close };
}
