import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { can, PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/permissions";

// The newest SQL file that defines public.has_permission() is the live one.
function sqlGrants() {
  const dir = join(__dirname, "..", "supabase", "sql");
  const file = readdirSync(dir)
    .filter((name) => /^\d{3}_.*\.sql$/.test(name))
    .sort()
    .reverse()
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .find((sql) => sql.includes("-- permissions:begin"));
  if (!file) {
    throw new Error("No SQL file defines public.has_permission()");
  }
  const block = file.split("-- permissions:begin")[1].split("-- permissions:end")[0];
  return [...block.matchAll(/\('(\w+)', '([\w.]+)'\)/g)]
    .map(([, role, permission]) => `${role}:${permission}`)
    .sort();
}

describe("permissions", () => {
  it("match public.has_permission() in the SQL", () => {
    const app = Object.entries(ROLE_PERMISSIONS)
      .flatMap(([role, permissions]) => permissions.map((p) => `${role}:${p}`))
      .sort();
    expect(sqlGrants()).toEqual(app);
  });

  it("gives an admin every permission", () => {
    for (const permission of PERMISSIONS) {
      expect(can({ role: "admin" }, permission)).toBe(true);
    }
  });

  it("keeps fees, history and staff from teachers", () => {
    const teacher = { role: "teacher" };
    expect(can(teacher, "fees.view")).toBe(false);
    expect(can(teacher, "fees.record")).toBe(false);
    expect(can(teacher, "students.history")).toBe(false);
    expect(can(teacher, "staff.manage")).toBe(false);
  });

  it("gives parents, students and no one nothing", () => {
    expect(can({ role: "parent" }, "fees.view")).toBe(false);
    expect(can({ role: "student" }, "fees.view")).toBe(false);
    expect(can({ role: "toString" }, "fees.view")).toBe(false);
    expect(can(null, "fees.view")).toBe(false);
    expect(can(undefined, "fees.view")).toBe(false);
  });
});
