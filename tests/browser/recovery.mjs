// Run against the local app only. All non-local requests are intercepted; no live writes.
// PLAYWRIGHT_MODULE may point to the bundled Playwright installation.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = "http://127.0.0.1:4386";
const screenshots = "/tmp/tt-recovery-browser";
mkdirSync(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true });
const person = "00000000-0000-4000-8000-000000000001";
const run = "00000000-0000-4000-8000-000000000002";
const exercise = "00000000-0000-4000-8000-000000000003";
const date = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const yesterday = new Date(`${date}T12:00:00Z`);
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
const priorDate = yesterday.toISOString().slice(0, 10);
try {
  for (const width of [320, 390, 430, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      timezoneId: "Europe/London",
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.setDefaultNavigationTimeout(20000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const routines = [];
    const sessions = [];
    const reads = [];
    const writes = [];
    const pastTemplate = {
      id: "past",
      name: "Easy movement",
      mode: "quick",
      minutes: 5,
      weekdays: [],
      exercises: [
        {
          id: "e",
          exerciseId: null,
          name: "Easy raise",
          sets: 1,
          reps: "5",
          weight: null,
          hold: null,
          side: "none",
          load: "unloaded",
          setup: "Comfortable range",
          source: "",
        },
      ],
      notes: "",
      nextMorning: true,
      progression: "",
    };
    sessions.push({
      id: randomUUID(),
      person_id: person,
      routine_id: randomUUID(),
      legacy_run_id: null,
      template_id: "past",
      routine_name: "Prior shoulder practice",
      session_date: priorDate,
      status: "completed",
      snapshot: pastTemplate,
      actuals: [],
      pain: null,
      notes: "",
      response: null,
      response_notes: "",
      check_enabled: true,
      version: 1,
      completed_at: new Date().toISOString(),
      suggested_workout_id: null,
    });
    await page.addInitScript(
      ({ person }) => {
        localStorage.setItem(
          "supabase-session",
          JSON.stringify({
            access_token: "local-test-only",
            refresh_token: "local-test-only",
            user: { id: person },
            expires_at: 9999999999,
          }),
        );
      },
      { person },
    );
    await page.route("**/*", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin === origin) return route.continue();
      if (!url.pathname.includes("/rest/v1/")) return route.abort();
      const table = url.pathname.split("/rest/v1/")[1];
      const method = req.method();
      const params = url.searchParams;
      const body = req.postDataJSON();
      let result = [];
      if (method === "GET") {
        reads.push({ table, params: Object.fromEntries(params) });
        if (table === "people")
          result = [{ id: person, auth_user_id: person, display_name: "Local test" }];
        else if (table === "admin_people") result = [{ id: "admin", admin_person_id: person }];
        else if (table === "recovery_routines") result = routines;
        else if (table === "recovery_sessions") result = sessions;
        else if (table === "mobility_practice_runs")
          result = [
            {
              id: run,
              person_id: person,
              skill: "shoulder",
              status: "active",
              phase: "setup",
              started_on: priorDate,
              ended_on: null,
              review_on: null,
              readiness: "unchecked",
              plan_received: false,
              notes: "Existing toolkit note",
            },
          ];
        else if (table === "mobility_practice_drills")
          result = [
            {
              id: exercise,
              run_id: run,
              exercise_id: exercise,
              name: "Stick External Rotation",
              sort_order: 0,
              target_sets: 2,
              target_reps: "5 per side",
              target_hold_seconds: null,
              target_weight_kg: null,
              target_detail: "Comfortable range",
              lesson_url:
                "https://www.matthewismith.com/products/mobility-flexibility-toolkit/example",
              is_active: true,
            },
          ];
        else if (table === "exercises")
          result = [
            {
              id: exercise,
              name: "Dumbbell rotation",
              is_active: true,
              activity_types: { name: "Strength" },
              exercise_activity_types: [],
              default_metric: "weight_reps",
            },
          ];
        else if (table === "person_exercises")
          result = [
            { id: "person-exercise", person_id: person, exercise_id: exercise, is_enabled: true },
          ];
        else if (table === "activity_types")
          result = [{ id: "strength", name: "Strength", slug: "strength", sort_order: 1 }];
        if (params.get("id")?.startsWith("eq."))
          result = result.filter((r) => r.id === params.get("id").slice(3));
        if (params.has("offset")) result = result.slice(Number(params.get("offset")));
      } else {
        writes.push({ table, method, body });
        if (table === "recovery_routines" && method === "POST") {
          const r = { ...body[0], id: randomUUID(), version: 1 };
          routines.push(r);
          result = [r];
        } else if (table === "recovery_routines" && method === "PATCH") {
          const r = routines.find((r) => `eq.${r.id}` === params.get("id"));
          if (r && `eq.${r.version}` === params.get("version")) {
            Object.assign(r, body, { version: r.version + 1 });
            result = [r];
          }
        } else if (table === "rpc/start_recovery_session") {
          const r = routines.find((r) => r.id === body.p_routine_id);
          let s = sessions.find(
            (s) =>
              s.routine_id === body.p_routine_id &&
              s.template_id === body.p_template_id &&
              s.status === "draft",
          );
          if (!s) {
            s = {
              id: randomUUID(),
              person_id: person,
              routine_id: r.id,
              legacy_run_id: null,
              template_id: body.p_template_id,
              routine_name: r.name,
              session_date: body.p_date,
              status: "draft",
              snapshot: structuredClone(r.templates.find((t) => t.id === body.p_template_id)),
              actuals: [],
              pain: null,
              notes: "",
              response: null,
              response_notes: "",
              version: 1,
              completed_at: null,
              suggested_workout_id: null,
            };
            s.check_enabled = s.snapshot.nextMorning;
            sessions.unshift(s);
          }
          result = s;
        } else if (table === "recovery_sessions" && method === "PATCH") {
          const s = sessions.find((s) => `eq.${s.id}` === params.get("id"));
          if (s && `eq.${s.version}` === params.get("version")) {
            Object.assign(s, body, { version: s.version + 1 });
            result = [s];
          }
        } else if (!table.startsWith("rpc/")) throw Error("Unexpected mutation " + table);
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(result),
      });
    });
    async function measure(label) {
      await page.waitForTimeout(100);
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(scroll <= width, `${width} ${label} overflow: ${scroll}`);
    }
    console.log("opening", width);
    await page.goto(origin + "/mobility");
    console.log("opened", width);
    await page.getByRole("button", { name: "Create routine", exact: true }).waitFor();
    await page
      .getByRole("heading", { name: "Shoulder Mobility & Flexibility", exact: true })
      .waitFor();
    console.log("home loaded", width);
    const check = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: /Next-morning check/ }) });
    await check.getByRole("button", { name: "Same", exact: true }).click();
    await page.getByRole("button", { name: "Create routine", exact: true }).click();
    await page.getByLabel("Routine name", { exact: true }).fill("Left shoulder");
    await page.getByLabel("Exercise 1", { exact: true }).fill("Easy forward raise");
    await page.getByRole("button", { name: "Add session template", exact: true }).click();
    await page.getByLabel("Session name", { exact: true }).nth(1).fill("Strengthening");
    await page.getByLabel("Logging style", { exact: true }).nth(1).selectOption("measured");
    await page
      .getByLabel("Exercise library (optional)", { exact: true })
      .nth(1)
      .selectOption(exercise);
    await page.getByLabel("Mon", { exact: true }).nth(1).check();
    await page.getByLabel("Fri", { exact: true }).nth(1).check();
    await page.getByLabel("Target kg", { exact: true }).nth(1).fill("1.25");
    await page.getByText("Side, load meaning, setup and source", { exact: true }).nth(1).click();
    await page.getByLabel("Side", { exact: true }).nth(1).selectOption("each");
    await page.getByLabel("Weight means", { exact: true }).nth(1).selectOption("per_hand");
    await measure("editor");
    if (width === 390 || width === 1440)
      await page.screenshot({ path: `${screenshots}/editor-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Review routine", exact: true }).click();
    await measure("review");
    await page.getByRole("button", { name: "Apply and save routine", exact: true }).click();
    const card = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "Left shoulder", exact: true }) });
    await card.getByRole("button", { name: "Start", exact: true }).nth(0).click();
    await page.getByRole("button", { name: "Complete practice", exact: true }).click();
    await card.getByRole("button", { name: "Start", exact: true }).click();
    await page
      .getByRole("spinbutton", { name: "Dumbbell rotation left set 1 Reps", exact: true })
      .fill("12");
    await page
      .getByRole("spinbutton", { name: "Dumbbell rotation left set 1 kg / hand", exact: true })
      .fill("1.25");
    await page.getByText("Range / measurement and technique", { exact: true }).first().click();
    await page
      .getByLabel("Actual range / measurement (include units)", { exact: true })
      .first()
      .fill("70°");
    await measure("logger");
    if (width === 390 || width === 1440)
      await page.screenshot({ path: `${screenshots}/logger-${width}.png`, fullPage: true });
    await page.reload();
    await page
      .getByRole("spinbutton", { name: "Dumbbell rotation left set 1 Reps", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("spinbutton", { name: "Dumbbell rotation left set 1 Reps", exact: true })
        .inputValue(),
      "12",
    );
    await page.getByRole("button", { name: "Save and close", exact: true }).click();
    await card.getByRole("button", { name: "Resume", exact: true }).click();
    assert.equal(
      await page
        .getByRole("spinbutton", { name: "Dumbbell rotation left set 1 Reps", exact: true })
        .inputValue(),
      "12",
    );
    await page.getByRole("button", { name: "Save completed session", exact: true }).click();
    await card.getByRole("button", { name: "History & progress", exact: true }).click();
    await card.getByText(/Strengthening · completed/).click();
    await measure("history");
    assert.equal(
      sessions.filter((s) => s.routine_id === routines[0].id && s.status === "completed").length,
      2,
    );
    assert.equal(
      sessions.find((s) => s.routine_id === routines[0].id && s.snapshot.mode === "quick").actuals
        .length,
      0,
    );
    assert.equal(
      sessions.find((s) => s.routine_id === routines[0].id && s.snapshot.mode === "quick").pain,
      null,
    );
    assert.equal(sessions.find((s) => s.template_id === "past").response, "same");
    // Exercise actual main navigation and the affected routes with empty ordinary training fixtures.
    for (const label of ["Today", "Plan", "Log", "Review"]) {
      await page
        .getByRole("navigation", { name: "Primary navigation", exact: true })
        .filter({ visible: true })
        .getByRole("link", { name: label, exact: true })
        .click();
      await page.waitForTimeout(300);
      await measure(label);
    }
    await page.goto(origin + "/history");
    await page.waitForTimeout(300);
    await measure("regular history");
    await page.goto(origin + "/mobility");
    await page.getByRole("heading", { name: "Mobility & Recovery", exact: true }).waitFor();
    await measure("home");
    assert.equal(errors.length, 0, errors.join("\n"));
    assert.ok(
      reads
        .filter((r) => r.table === "sessions" && r.params.select?.includes("session_entries"))
        .every((r) => r.params.recovery_only === "eq.false"),
    );
    assert.ok(!writes.some((w) => ["sessions", "program_assignments"].includes(w.table)));
    console.log(
      JSON.stringify({
        width,
        result: "passed",
        completedRecoverySessions: 2,
        mutations: writes.length,
        productionRequests: 0,
      }),
    );
    await context.close();
  }
} finally {
  await browser.close();
}
