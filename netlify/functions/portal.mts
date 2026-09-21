import type { Config } from "@netlify/functions";
import { admin, getUser } from "@netlify/identity";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { attendance, classes, feeRecords, notices, parents, profiles, pupils, results, teacherClasses } from "../../db/schema.ts";

// Netlify injects the managed database connection into this server-only function.

type Role = "management" | "teacher";
const ok = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store", "x-portal-storage": "netlify-database" } });
const fail = (message: string, status = 400) => ok({ error: message }, status);
const clean = (value: unknown, max = 180) => String(value ?? "").trim().slice(0, max);
const required = (value: unknown, label: string, max = 180) => { const result = clean(value, max); if (!result) throw new Error(`${label} is required.`); return result; };

async function identity() {
  const user = await getUser();
  if (!user) throw Object.assign(new Error("Please sign in."), { status: 401 });
  const roles = (user.roles ?? []).map((role) => role.toLowerCase());
  const role = roles.includes("management") ? "management" : roles.includes("teacher") ? "teacher" : null;
  if (!role) throw Object.assign(new Error("This account has no portal role."), { status: 403 });
  const email = user.email ?? `${user.id}@identity.local`;
  const [stored] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  if (stored && !stored.active) throw Object.assign(new Error("This portal account is inactive."), { status: 403 });
  if (!stored) await db.insert(profiles).values({ id: user.id, email, fullName: user.name ?? email, role });
  else if (stored.role !== role || stored.email !== email) await db.update(profiles).set({ role, email }).where(eq(profiles.id, user.id));
  return { id: user.id, email, name: user.name ?? stored?.fullName ?? email, role: role as Role };
}

async function allowedClassIds(user: { id: string; role: Role }) {
  if (user.role === "management") return null;
  return (await db.select({ id: teacherClasses.classId }).from(teacherClasses).where(eq(teacherClasses.teacherId, user.id))).map((row) => row.id);
}
async function canAccessPupil(user: { id: string; role: Role }, pupilId: string) {
  if (user.role === "management") return true;
  const ids = await allowedClassIds(user);
  if (!ids?.length) return false;
  return Boolean((await db.select({ id: pupils.id }).from(pupils).where(and(eq(pupils.id, pupilId), inArray(pupils.classId, ids))).limit(1))[0]);
}
const managementOnly = (role: Role) => { if (role !== "management") throw Object.assign(new Error("Management access is required."), { status: 403 }); };

async function listPupils(user: { id: string; role: Role }) {
  const classIds = await allowedClassIds(user);
  if (classIds?.length === 0) return [];
  return db.select({ id: pupils.id, admissionNumber: pupils.admissionNumber, fullName: pupils.fullName, gender: pupils.gender, dateOfBirth: pupils.dateOfBirth, classId: pupils.classId, className: classes.name, parentId: pupils.parentId, parentName: parents.fullName, parentPhone: parents.phone, active: pupils.active })
    .from(pupils).innerJoin(classes, eq(pupils.classId, classes.id)).leftJoin(parents, eq(pupils.parentId, parents.id))
    .where(classIds ? inArray(pupils.classId, classIds) : undefined).orderBy(pupils.fullName);
}

export default async (request: Request) => {
  try {
    const user = await identity();
    const url = new URL(request.url);
    const route = url.pathname.replace(/^\/api\/?/, "");
    const method = request.method;
    const body = method === "POST" || method === "PUT" ? await request.json() : {};

    if (route === "session" && method === "GET") return ok({ user });
    if (route === "dashboard" && method === "GET") {
      const visible = await listPupils(user);
      const classIds = new Set(visible.map((p) => p.classId));
      return ok({ role: user.role, pupilCount: visible.length, classCount: classIds.size, title: user.role === "management" ? "Management Dashboard" : "Teacher Dashboard" });
    }
    if (route === "classes" && method === "GET") {
      const ids = await allowedClassIds(user);
      if (ids?.length === 0) return ok([]);
      return ok(await db.select().from(classes).where(ids ? inArray(classes.id, ids) : undefined).orderBy(classes.name));
    }
    if (route === "pupils" && method === "GET") return ok(await listPupils(user));
    if (route === "pupils" && method === "POST") {
      managementOnly(user.role);
      const [record] = await db.insert(pupils).values({ admissionNumber: required(body.admissionNumber, "Admission number", 50), fullName: required(body.fullName, "Pupil name"), gender: clean(body.gender, 20) || null, dateOfBirth: clean(body.dateOfBirth, 10) || null, classId: required(body.classId, "Class"), parentId: clean(body.parentId, 50) || null }).returning();
      return ok(record, 201);
    }
    if (route.startsWith("pupils/") && method === "PUT") {
      managementOnly(user.role); const id = route.split("/")[1];
      const [record] = await db.update(pupils).set({ admissionNumber: required(body.admissionNumber, "Admission number", 50), fullName: required(body.fullName, "Pupil name"), gender: clean(body.gender, 20) || null, dateOfBirth: clean(body.dateOfBirth, 10) || null, classId: required(body.classId, "Class"), parentId: clean(body.parentId, 50) || null, active: body.active !== false }).where(eq(pupils.id, id)).returning();
      return record ? ok(record) : fail("Pupil not found.", 404);
    }
    if (route === "parents" && method === "GET") { managementOnly(user.role); return ok(await db.select().from(parents).orderBy(parents.fullName)); }
    if (route === "parents" && method === "POST") {
      managementOnly(user.role); const [record] = await db.insert(parents).values({ fullName: required(body.fullName, "Parent name"), phone: required(body.phone, "Phone", 40), email: clean(body.email) || null, address: clean(body.address, 500) || null }).returning(); return ok(record, 201);
    }
    if (route === "attendance" && method === "GET") {
      const visible = await listPupils(user); const ids = visible.map((p) => p.id); if (!ids.length) return ok([]);
      const date = clean(url.searchParams.get("date"), 10);
      return ok(await db.select({ id: attendance.id, pupilId: attendance.pupilId, pupilName: pupils.fullName, attendanceDate: attendance.attendanceDate, status: attendance.status }).from(attendance).innerJoin(pupils, eq(attendance.pupilId, pupils.id)).where(and(inArray(attendance.pupilId, ids), date ? eq(attendance.attendanceDate, date) : undefined)).orderBy(pupils.fullName));
    }
    if (route === "attendance" && method === "POST") {
      const pupilId = required(body.pupilId, "Pupil"); if (!(await canAccessPupil(user, pupilId))) return fail("You are not assigned to this pupil's class.", 403);
      const attendanceDate = required(body.attendanceDate, "Date", 10); const status = required(body.status, "Status", 10) as "Present" | "Absent" | "Late";
      if (!["Present", "Absent", "Late"].includes(status)) return fail("Invalid attendance status.");
      const [record] = await db.insert(attendance).values({ pupilId, attendanceDate, status, recordedBy: user.id }).onConflictDoUpdate({ target: [attendance.pupilId, attendance.attendanceDate], set: { status, recordedBy: user.id, updatedAt: new Date() } }).returning(); return ok(record);
    }
    if (route === "results" && method === "GET") {
      const visible = await listPupils(user); const ids = visible.map((p) => p.id); if (!ids.length) return ok([]);
      return ok(await db.select({ id: results.id, pupilId: results.pupilId, pupilName: pupils.fullName, subject: results.subject, assessment: results.assessment, term: results.term, score: results.score, maximumScore: results.maximumScore }).from(results).innerJoin(pupils, eq(results.pupilId, pupils.id)).where(inArray(results.pupilId, ids)).orderBy(desc(results.updatedAt)));
    }
    if (route === "results" && method === "POST") {
      const pupilId = required(body.pupilId, "Pupil"); if (!(await canAccessPupil(user, pupilId))) return fail("You are not assigned to this pupil's class.", 403);
      const score = Number(body.score), maximumScore = Number(body.maximumScore ?? 100); if (!Number.isFinite(score) || !Number.isFinite(maximumScore) || score < 0 || maximumScore <= 0 || score > maximumScore) return fail("Enter a valid score and maximum score.");
      const values = { pupilId, subject: required(body.subject, "Subject", 80), assessment: required(body.assessment, "Assessment", 80), term: required(body.term, "Term", 40), score: String(score), maximumScore: String(maximumScore), recordedBy: user.id };
      const [record] = await db.insert(results).values(values).onConflictDoUpdate({ target: [results.pupilId, results.subject, results.assessment, results.term], set: { score: values.score, maximumScore: values.maximumScore, recordedBy: user.id, updatedAt: new Date() } }).returning(); return ok(record);
    }
    if (route === "fees" && method === "GET") { managementOnly(user.role); return ok(await db.select({ id: feeRecords.id, pupilId: feeRecords.pupilId, pupilName: pupils.fullName, term: feeRecords.term, item: feeRecords.item, amountDue: feeRecords.amountDue, amountPaid: feeRecords.amountPaid, paymentDate: feeRecords.paymentDate, reference: feeRecords.reference }).from(feeRecords).innerJoin(pupils, eq(feeRecords.pupilId, pupils.id)).orderBy(desc(feeRecords.createdAt))); }
    if (route === "fees" && method === "POST") { managementOnly(user.role); const due = Number(body.amountDue), paid = Number(body.amountPaid ?? 0); if (!Number.isFinite(due) || !Number.isFinite(paid) || due < 0 || paid < 0) return fail("Enter valid fee amounts."); const [record] = await db.insert(feeRecords).values({ pupilId: required(body.pupilId, "Pupil"), term: required(body.term, "Term", 40), item: required(body.item, "Item", 100), amountDue: String(due), amountPaid: String(paid), paymentDate: clean(body.paymentDate, 10) || null, reference: clean(body.reference, 100) || null, recordedBy: user.id }).returning(); return ok(record, 201); }
    if (route === "notices" && method === "GET") return ok(await db.select().from(notices).where(user.role === "teacher" ? inArray(notices.audience, ["all", "teachers"]) : undefined).orderBy(desc(notices.createdAt)));
    if (route === "notices" && method === "POST") { managementOnly(user.role); const [record] = await db.insert(notices).values({ title: required(body.title, "Title"), body: required(body.body, "Notice", 4000), audience: ["all", "teachers", "management"].includes(body.audience) ? body.audience : "all", createdBy: user.id }).returning(); return ok(record, 201); }
    if (route === "staff" && method === "GET") { managementOnly(user.role); const staff = await db.select().from(profiles).orderBy(profiles.fullName); const assigned = await db.select().from(teacherClasses); return ok(staff.map((person) => ({ ...person, classIds: assigned.filter((item) => item.teacherId === person.id).map((item) => item.classId) }))); }
    if (route === "staff" && method === "POST") {
      managementOnly(user.role); const role = body.role === "management" ? "management" : "teacher"; const email = required(body.email, "Email").toLowerCase(); const password = required(body.password, "Temporary password", 200); if (password.length < 8) return fail("Temporary password must be at least 8 characters.");
      const created = await admin.createUser({ email, password, data: { app_metadata: { roles: [role] }, user_metadata: { full_name: required(body.fullName, "Name") } } });
      await db.insert(profiles).values({ id: created.id, email, fullName: required(body.fullName, "Name"), role, phone: clean(body.phone, 40) || null });
      if (role === "teacher" && Array.isArray(body.classIds) && body.classIds.length) await db.insert(teacherClasses).values(body.classIds.map((classId: unknown) => ({ teacherId: created.id, classId: required(classId, "Class") })));
      return ok({ id: created.id, email, role }, 201);
    }
    if (route.startsWith("staff/") && route.endsWith("/assignments") && method === "PUT") {
      managementOnly(user.role); const teacherId = route.split("/")[1]; await db.delete(teacherClasses).where(eq(teacherClasses.teacherId, teacherId)); const ids = Array.isArray(body.classIds) ? body.classIds : []; if (ids.length) await db.insert(teacherClasses).values(ids.map((classId: unknown) => ({ teacherId, classId: required(classId, "Class") }))); return ok({ teacherId, classIds: ids });
    }
    if (route.startsWith("staff/") && method === "PUT") {
      managementOnly(user.role); const staffId = route.split("/")[1]; if (staffId === user.id && body.active === false) return fail("You cannot deactivate your own account.");
      const role = body.role === "management" ? "management" : "teacher"; const [record] = await db.update(profiles).set({ role, active: body.active !== false }).where(eq(profiles.id, staffId)).returning(); if (!record) return fail("Staff member not found.", 404);
      await admin.updateUser(staffId, { app_metadata: { roles: [role] } }); await db.delete(teacherClasses).where(eq(teacherClasses.teacherId, staffId)); const ids = role === "teacher" && Array.isArray(body.classIds) ? body.classIds : []; if (ids.length) await db.insert(teacherClasses).values(ids.map((classId: unknown) => ({ teacherId: staffId, classId: required(classId, "Class") }))); return ok(record);
    }
    return fail("Not found.", 404);
  } catch (error) {
    const e = error as Error & { status?: number }; console.error("Portal request failed", e.message);
    return fail(e.status && [400, 401, 403, 404].includes(e.status) ? e.message : "The request could not be completed.", e.status ?? 500);
  }
};

export const config: Config = { path: "/api/*" };
