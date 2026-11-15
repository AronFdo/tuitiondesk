import { describe, expect, it } from "vitest";
import {
  emptyStudent,
  parseLearningMode,
  parseMedium,
  parseNic,
  parseYesNo,
  studentColumns,
  studentInput,
  studentRecord,
  studentSchema,
  type StudentRow,
} from "../lib/student-fields";

const base = {
  ...emptyStudent,
  firstName: "Nimal",
  lastName: "Perera",
  dateOfBirth: "2012-04-18",
  gender: "male" as const,
};

describe("studentSchema", () => {
  it("needs only first name, date of birth and gender", () => {
    expect(studentSchema.safeParse(base).success).toBe(true);
  });

  it("names the missing required field", () => {
    expect(studentSchema.safeParse({ ...base, firstName: " " }).error?.issues[0]?.message).toBe("Enter the first name.");
    expect(studentSchema.safeParse({ ...base, gender: "" }).error?.issues[0]?.message).toBe("Choose the gender.");
    expect(studentSchema.safeParse({ ...base, dateOfBirth: "" }).error?.issues[0]?.message).toBe("Enter the date of birth.");
    expect(studentSchema.safeParse({ ...base, dateOfBirth: "2999-01-01" }).error?.issues[0]?.message).toBe(
      "That date of birth is not right.",
    );
  });

  it("checks NIC, phones and email", () => {
    expect(studentSchema.safeParse({ ...base, nic: "12345" }).success).toBe(false);
    expect(studentSchema.safeParse({ ...base, phone: "123" }).success).toBe(false);
    expect(studentSchema.safeParse({ ...base, emergencyContactPhone: "077123" }).success).toBe(false);
    expect(studentSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
    expect(
      studentSchema.safeParse({ ...base, nic: "851234567v", phone: "077 123 4567", email: "a@b.lk" }).success,
    ).toBe(true);
  });
});

describe("parsers", () => {
  it("reads old and new NICs", () => {
    expect(parseNic("851234567v")).toEqual({ ok: true, value: "851234567V" });
    expect(parseNic("2005 1234 5678")).toEqual({ ok: true, value: "200512345678" });
    expect(parseNic("")).toEqual({ ok: true, value: "" });
    expect(parseNic("85123456")).toEqual({ ok: false });
  });

  it("reads medium, learning mode and yes/no the way people write them", () => {
    expect(parseMedium("Sinhala medium")).toBe("sinhala");
    expect(parseMedium("E")).toBe("english");
    expect(parseMedium("French")).toBeNull();
    expect(parseLearningMode("In person")).toBe("physical");
    expect(parseLearningMode("Zoom")).toBe("online");
    expect(parseLearningMode("sometimes")).toBeNull();
    expect(parseYesNo("Yes")).toBe(true);
    expect(parseYesNo("")).toBe(false);
    expect(parseYesNo("maybe")).toBeNull();
  });
});

describe("studentRecord", () => {
  it("stores phones in +94 form, the NIC uppercase and drops special needs when unticked", () => {
    const values = studentSchema.parse({
      ...base,
      nic: "851234567v",
      phone: "0771234567",
      email: "Nimal@Example.LK",
      specialNeeds: "Front seat",
      hasSpecialNeeds: false,
    });
    expect(studentRecord(values)).toMatchObject({
      nic: "851234567V",
      phone: "+94771234567",
      email: "nimal@example.lk",
      special_needs: "",
    });
    expect(studentColumns(values)).toMatchObject({ special_needs: null, religion: null, first_name: "Nimal" });
  });

  it("round-trips a stored row back into the form", () => {
    const row = {
      ...Object.fromEntries(Object.keys(studentRecord(studentSchema.parse(base))).map((key) => [key, null])),
      full_name: "Nimal Perera",
      first_name: "Nimal",
      last_name: "Perera",
      date_of_birth: "2012-04-18",
      gender: "male",
      guardian_phone: "+94771234567",
      has_special_needs: false,
    } as StudentRow;
    expect(studentInput(row)).toMatchObject({ firstName: "Nimal", lastName: "Perera", guardianPhone: "0771234567" });
  });
});
