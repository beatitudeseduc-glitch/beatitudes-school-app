import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../netlify/functions/portal.mts", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
const browser = await readFile(new URL("../assets/app.js", import.meta.url), "utf8");

test("management-only resources have server-side guards", () => {
  for (const route of ['route === "parents"', 'route === "fees"', 'route === "staff"']) {
    const position = api.indexOf(route);
    assert.notEqual(position, -1);
    assert.match(api.slice(position, position + 260), /managementOnly\(user\.role\)/);
  }
});

test("teacher writes verify pupil class assignment", () => {
  assert.equal((api.match(/canAccessPupil\(user, pupilId\)/g) || []).length, 2);
  assert.match(api, /teacherClasses\.teacherId/);
});

test("fee information preserves existing figures and includes secondary tuition", () => {
  for (const amount of ["K2,000", "K3,500", "K300", "K350", "K900", "K30"]) assert.ok(html.includes(amount));
  assert.match(html, /Secondary-school tuition<\/td><td>K3,500<\/td><td>Term/);
});

test("records have durable database tables", () => {
  for (const table of ["profiles", "pupils", "attendance", "fee_records", "academic_results", "notices"]) assert.ok(schema.includes(`\"${table}\"`));
});

test("the browser cannot create roles or accounts", () => {
  assert.ok(!browser.includes("admin.createUser"));
  assert.ok(!browser.includes("app_metadata"));
  assert.match(api, /managementOnly\(user\.role\).*const role/s);
});

test("no default test credentials are shipped", () => {
  assert.ok(!/password\s*[:=]\s*["'][^"']+["']/i.test(browser));
  assert.ok(!/management@|teacher@/i.test(html));
});
