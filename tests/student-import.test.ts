import { describe, expect, it } from "vitest";
import {
  templateCsv,
  parseCsv,
  parseDateOfBirth,
  parseImportPhone,
  readStudentSheet,
  rowsToImport,
} from "../lib/student-import";

const today = "2026-11-10";
const courses = [
  { id: "c1", name: "B1 Preliminary" },
  { id: "c2", name: "A2 Key" },
];
const options = { courses, existing: [], today };

describe("parseCsv", () => {
  it("reads quoted fields with commas, quotes and line breaks", () => {
    expect(parseCsv('a,"b, c","say ""hi""","two\nlines"\r\n1,2,3,4')).toEqual([
      ["a", "b, c", 'say "hi"', "two\nlines"],
      ["1", "2", "3", "4"],
    ]);
  });

  it("detects semicolon and tab delimiters and drops a byte order mark", () => {
    expect(parseCsv("﻿Name;Gender\nNimal;M")).toEqual([
      ["Name", "Gender"],
      ["Nimal", "M"],
    ]);
    expect(parseCsv("Name\tGender\nNimal\tM\n")).toEqual([
      ["Name", "Gender"],
      ["Nimal", "M"],
    ]);
  });

  it("skips empty rows", () => {
    expect(parseCsv("a,b\n,\n\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseDateOfBirth", () => {
  it("reads day-first and ISO dates", () => {
    expect(parseDateOfBirth("18/04/2012", today)).toBe("2012-04-18");
    expect(parseDateOfBirth("8-4-2012", today)).toBe("2012-04-08");
    expect(parseDateOfBirth("18.04.2012", today)).toBe("2012-04-18");
    expect(parseDateOfBirth("2012-04-18", today)).toBe("2012-04-18");
  });

  it("reads month-first only when day-first is impossible", () => {
    expect(parseDateOfBirth("04/18/2012", today)).toBe("2012-04-18");
    expect(parseDateOfBirth("04/05/2012", today)).toBe("2012-05-04");
  });

  it("turns away impossible, future and short-year dates", () => {
    expect(parseDateOfBirth("31/02/2012", today)).toBeNull();
    expect(parseDateOfBirth("01/01/2030", today)).toBeNull();
    expect(parseDateOfBirth("18/04/12", today)).toBeNull();
    expect(parseDateOfBirth("April 2012", today)).toBeNull();
  });
});

describe("parseImportPhone", () => {
  it("puts back a leading zero or plus that a spreadsheet dropped", () => {
    expect(parseImportPhone("771234567")).toEqual({ ok: true, e164: "+94771234567" });
    expect(parseImportPhone("94771234567")).toEqual({ ok: true, e164: "+94771234567" });
    expect(parseImportPhone("077 123 4567")).toEqual({ ok: true, e164: "+94771234567" });
    expect(parseImportPhone("")).toEqual({ ok: true, e164: null });
    expect(parseImportPhone("12345")).toEqual({ ok: false });
  });
});

describe("readStudentSheet", () => {
  it("builds a template that uses the class's course names", () => {
    const csv = templateCsv(["B1 Preliminary", "A2 Key"]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const sheet = readStudentSheet(csv, options);
    expect(sheet.ok).toBe(true);
    if (!sheet.ok) return;
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[0]).toMatchObject({
      line: 2,
      dateOfBirth: "2008-04-18",
      gender: "male",
      nic: "200812345678",
      student: expect.objectContaining({ startDate: "2025-01-03" }),
      guardianPhone: "+94712345678",
      courseIds: ["c1"],
    });
    expect(sheet.rows[1].courseIds).toEqual(["c1", "c2"]);
    // A blank start date means today.
    expect(sheet.rows[1].student.startDate).toBe(today);
  });

  it("refuses the template's example rows so they are never imported", () => {
    const sheet = readStudentSheet(templateCsv(["B1 Preliminary"]), options);
    expect(sheet.ok && sheet.rows.every((row) => row.errors.length === 1)).toBe(true);
    expect(sheet.ok && sheet.rows[0].errors[0]).toContain("example row");
    if (!sheet.ok) return;
    expect(rowsToImport(sheet.rows, true)).toEqual([]);
  });

  it("works for a class with no courses yet", () => {
    const sheet = readStudentSheet(templateCsv([]), options);
    expect(sheet.ok && sheet.rows[0].courseIds).toEqual([]);
  });

  it("quotes course names that contain commas", () => {
    expect(templateCsv(["Grade 6, Saturday"])).toContain('"Grade 6, Saturday"');
  });

  it("accepts other header names and reports columns it ignores", () => {
    const sheet = readStudentSheet("Student Name,DOB,Sex,Mobile,Class,Grade\nNimal,1/2/2012,boy,0771234567,a2 key,6", options);
    expect(sheet.ok && sheet.rows[0]).toMatchObject({ gender: "male", courseIds: ["c2"], errors: [] });
    expect(sheet.ok && sheet.ignoredColumns).toEqual(["Grade"]);
  });

  it("needs a name column", () => {
    expect(readStudentSheet("DOB,Gender\n2012-01-01,M", options)).toEqual({
      ok: false,
      error: "The first row needs a First name column (or a Name column). Download the template to see the columns.",
    });
  });

  it("lists every problem on a row", () => {
    const sheet = readStudentSheet("Name,DOB,Gender,Phone,Course\n,32/01/2012,x,123,Maths", options);
    expect(sheet.ok && sheet.rows[0].errors).toEqual([
      "Enter the student's first name.",
      '"32/01/2012" is not a date of birth. Use 18/04/2012.',
      '"x" is not a gender. Use Female or Male.',
      'Phone "123" is not a phone number. Use 10 digits, like 0771234567.',
      'There is no course called "Maths".',
    ]);
  });

  it("puts rows with no course on the chosen course", () => {
    const sheet = readStudentSheet("Name,DOB,Gender\nNimal,2012-01-01,M", { ...options, defaultCourseId: "c1" });
    expect(sheet.ok && sheet.rows[0].courseIds).toEqual(["c1"]);
  });

  it("flags students already in the class and repeats within the file", () => {
    const sheet = readStudentSheet(
      "Name,DOB,Gender\nNimal  Perera,2012-01-01,M\nAyesha,2013-01-01,F\nayesha,01/01/2013,F",
      { ...options, existing: [{ fullName: "nimal perera", dateOfBirth: "2012-01-01" }] },
    );
    expect(sheet.ok && sheet.rows.map((row) => row.duplicate)).toEqual([true, false, true]);
    if (!sheet.ok) return;
    expect(rowsToImport(sheet.rows, false).map((row) => row.first_name)).toEqual(["Ayesha"]);
    expect(rowsToImport(sheet.rows, true)).toHaveLength(3);
  });

  it("refuses more than 1000 students", () => {
    const body = Array.from({ length: 1001 }, (_, i) => `S${i},2012-01-01,M`).join("\n");
    const sheet = readStudentSheet(`Name,DOB,Gender\n${body}`, options);
    expect(sheet.ok).toBe(false);
  });

  it("reads separate first and last name columns", () => {
    const sheet = readStudentSheet("First name,Surname,DOB,Gender\nW.A.D. Nimali,Perera,2012-01-01,F", options);
    expect(sheet.ok && sheet.rows[0]).toMatchObject({ fullName: "W.A.D. Nimali Perera" });
    expect(sheet.ok && sheet.rows[0].student).toMatchObject({ firstName: "W.A.D. Nimali", lastName: "Perera" });
  });

  it("splits a single Name column at the last word", () => {
    const sheet = readStudentSheet("Name,DOB,Gender\nKasun Chamara Silva,2012-01-01,M\nMadonna,2012-01-01,F", options);
    expect(sheet.ok && sheet.rows.map((row) => [row.student.firstName, row.student.lastName])).toEqual([
      ["Kasun Chamara", "Silva"],
      ["Madonna", ""],
    ]);
  });

  it("reads every detail column under its usual names", () => {
    const sheet = readStudentSheet(
      [
        "First name,Last name,DOB,Gender,NIC No,Religion,Contact no,E-mail,Address,School,Medium,Learning mode,O/L results,A/L results,Qualification,Occupation,Father's name,Father's occupation,Mother's name,Mother's occupation,Guardian's full name,Guardian contact,Guardian's occupation,Emergency contact,Special needs",
        'Nimal,Perera,2008-04-18,M,851234567v,Buddhist,771234567,Nimal@Example.com,"1 Main St, Kandy",Royal College,Sinhala medium,In person,"Maths A, Science B",,G.C.E. O/L,,Sunil,Driver,Kamala,Teacher,Kamala Perera,0712345678,Teacher,0779998887,Needs a front seat',
      ].join("\n"),
      options,
    );
    expect(sheet.ok && sheet.ignoredColumns).toEqual([]);
    expect(sheet.ok && sheet.rows[0].errors).toEqual([]);
    expect(sheet.ok && sheet.rows[0].student).toMatchObject({
      nic: "851234567V",
      religion: "Buddhist",
      phone: "+94771234567",
      email: "Nimal@Example.com",
      address: "1 Main St, Kandy",
      medium: "sinhala",
      learningMode: "physical",
      olResults: "Maths A, Science B",
      fatherName: "Sunil",
      motherOccupation: "Teacher",
      guardianPhone: "+94712345678",
      emergencyContactPhone: "+94779998887",
      hasSpecialNeeds: true,
      specialNeeds: "Needs a front seat",
    });
    if (!sheet.ok) return;
    expect(rowsToImport(sheet.rows, false)[0]).toMatchObject({ email: "nimal@example.com", nic: "851234567V" });
  });

  it("explains values it cannot read", () => {
    const sheet = readStudentSheet(
      "Name,DOB,Gender,NIC,Email,Medium,Learning mode\nNimal,2012-01-01,M,12345,nope,French,Sometimes",
      options,
    );
    expect(sheet.ok && sheet.rows[0].errors).toEqual([
      '"12345" is not an NIC. Use 9 digits and V or X, or 12 digits.',
      '"nope" is not an email address.',
      '"French" is not a medium. Use Sinhala, Tamil or English.',
      '"Sometimes" is not a learning mode. Use Online or Physical.',
    ]);
  });

  it("refuses an NIC already in the class or repeated in the file", () => {
    const sheet = readStudentSheet(
      "Name,DOB,Gender,NIC\nA,2012-01-01,M,200812345678\nB,2012-01-01,M,851234567V\nC,2012-01-01,M,851234567v",
      { ...options, existing: [{ fullName: "Old", dateOfBirth: null, nic: "200812345678" }] },
    );
    expect(sheet.ok && sheet.rows.map((row) => row.errors)).toEqual([
      ["A student with NIC 200812345678 is already in the class."],
      [],
      ["Same NIC as row 3. Each student needs their own."],
    ]);
  });

  it("reads a lone Emergency contact column as a phone or a name", () => {
    const sheet = readStudentSheet(
      "Name,DOB,Gender,Emergency contact\nA,2012-01-01,M,0771112223\nB,2012-01-01,M,Aunt Mala",
      options,
    );
    expect(sheet.ok && sheet.rows.map((row) => [row.student.emergencyContactPhone, row.student.emergencyContactName])).toEqual([
      ["+94771112223", ""],
      ["", "Aunt Mala"],
    ]);
  });

  it("takes yes or no for special needs, with details from their own column", () => {
    const sheet = readStudentSheet(
      "Name,DOB,Gender,Special needs,Special needs details\nA,2012-01-01,M,Yes,Hearing aid\nB,2012-01-01,M,No,",
      options,
    );
    expect(sheet.ok && sheet.rows.map((row) => [row.student.hasSpecialNeeds, row.student.specialNeeds])).toEqual([
      [true, "Hearing aid"],
      [false, ""],
    ]);
  });
});

describe("start date column", () => {
  it("reads Joined, Start date and the like, and flags a bad date", () => {
    const sheet = readStudentSheet(
      "First name,Date of birth,Gender,Joined\nNimal,18/04/2012,M,06/01/2025\nKamal,18/04/2012,M,soon\n",
      options,
    );
    expect(sheet.ok).toBe(true);
    if (!sheet.ok) return;
    expect(sheet.rows[0].errors).toEqual([]);
    expect(sheet.rows[0].student.startDate).toBe("2025-01-06");
    expect(rowsToImport(sheet.rows, true)[0]).toMatchObject({ start_date: "2025-01-06" });
    expect(sheet.rows[1].errors[0]).toContain('"soon" is not a start date');
  });
});
