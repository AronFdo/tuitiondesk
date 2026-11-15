import { normalizePhone } from "@/lib/phone";
import {
  emptyStudent,
  parseLearningMode,
  parseMedium,
  parseNic,
  parseYesNo,
  studentRecord,
  studentSchema,
  type StudentInput,
} from "@/lib/student-fields";

// Bringing in a list of students from a spreadsheet saved as CSV. The browser
// runs this to show a preview, and the server runs it again on the same text
// before anything is saved, so the two always agree.

export const MAX_IMPORT_ROWS = 1000;

export type ImportField =
  | "fullName"
  | "firstName"
  | "lastName"
  | "dateOfBirth"
  | "gender"
  | "nic"
  | "religion"
  | "address"
  | "phone"
  | "email"
  | "occupation"
  | "qualification"
  | "school"
  | "medium"
  | "olResults"
  | "alResults"
  | "learningMode"
  | "guardianName"
  | "guardianPhone"
  | "guardianOccupation"
  | "fatherName"
  | "fatherOccupation"
  | "motherName"
  | "motherOccupation"
  | "emergencyContactName"
  | "emergencyContactPhone"
  // One "Emergency contact" column: a phone number or a name, read by its value.
  | "emergencyContact"
  | "hasSpecialNeeds"
  | "specialNeeds"
  | "courses"
  | "notes"
  | "photo";

export type ImportCourse = { id: string; name: string };
export type ExistingStudent = { fullName: string; dateOfBirth: string | null; nic?: string | null };

export type ImportRow = {
  // The row number as the spreadsheet shows it (the header is row 1).
  line: number;
  // For the preview: the name as it will show in the app, and key details.
  fullName: string;
  dateOfBirth: string;
  gender: "female" | "male" | "";
  nic: string;
  guardianName: string;
  guardianPhone: string;
  // The photo file named in the Photo column, matched to chosen photos later.
  photo: string;
  courseIds: string[];
  courseNames: string[];
  // Everything the row says about the student, in the form's shape.
  student: StudentInput;
  errors: string[];
  // Same name and date of birth as a student already in the class, or as an
  // earlier row in the file.
  duplicate: boolean;
};

export type ImportSheet =
  | { ok: false; error: string }
  | { ok: true; rows: ImportRow[]; ignoredColumns: string[] };

// Header text, lower-cased with everything but letters and digits removed:
// "Father's name" -> "fathersname".
const HEADER_ALIASES: Record<ImportField, string[]> = {
  fullName: ["name", "fullname", "studentname", "student", "studentfullname", "nameinfull"],
  firstName: ["firstname", "givenname", "forename", "firstnames", "givennames"],
  lastName: ["lastname", "surname", "familyname"],
  dateOfBirth: ["dob", "dateofbirth", "birthday", "birthdate", "born"],
  gender: ["gender", "sex"],
  nic: ["nic", "nicno", "nicnumber", "nationalid", "nationalidentitycard", "idnumber", "nationalidno"],
  religion: ["religion"],
  address: ["address", "homeaddress", "studentaddress"],
  phone: [
    "phone",
    "phoneno",
    "phonenumber",
    "mobile",
    "mobileno",
    "mobilenumber",
    "contact",
    "contactno",
    "contactnumber",
    "telephone",
    "studentphone",
    "studentcontact",
  ],
  email: ["email", "emailaddress", "studentemail", "mail"],
  occupation: ["occupation", "job", "studentoccupation"],
  qualification: ["qualification", "qualifications", "highestqualification"],
  school: ["school", "schoolname", "currentschool"],
  medium: ["medium", "languagemedium", "studymedium"],
  olResults: ["olresults", "olresult", "ol", "gceol", "ordinarylevel", "ordinarylevelresult", "ordinarylevelresults"],
  alResults: ["alresults", "alresult", "al", "gceal", "advancedlevel", "advancedlevelresult", "advancedlevelresults"],
  learningMode: ["learningmode", "mode", "onlinephysical", "onlineorphysical", "classmode"],
  guardianName: [
    "guardian",
    "guardianname",
    "guardiansname",
    "guardianfullname",
    "guardiansfullname",
    "parent",
    "parentname",
    "parentguardian",
    "parentguardianname",
  ],
  guardianPhone: [
    "guardianphone",
    "guardiansphone",
    "guardiancontact",
    "guardiancontactno",
    "guardiancontactnumber",
    "parentphone",
    "parentcontact",
    "parentguardiancontact",
    "parentguardianphone",
    "whatsapp",
  ],
  guardianOccupation: ["guardianoccupation", "guardiansoccupation"],
  fatherName: ["father", "fathername", "fathersname", "fatherfullname", "fathersfullname"],
  fatherOccupation: ["fatheroccupation", "fathersoccupation"],
  motherName: ["mother", "mothername", "mothersname", "motherfullname", "mothersfullname"],
  motherOccupation: ["motheroccupation", "mothersoccupation"],
  emergencyContactName: ["emergencycontactname", "emergencyname"],
  emergencyContactPhone: [
    "emergencycontactphone",
    "emergencyphone",
    "emergencycontactno",
    "emergencycontactnumber",
    "emergencynumber",
  ],
  emergencyContact: ["emergencycontact", "emergency"],
  hasSpecialNeeds: ["specialneeds", "hasspecialneeds", "doesstudenthavespecialneeds", "doesthestudenthavespecialneeds"],
  specialNeeds: ["specialneedsdetails", "specialneedsnotes", "whathelps", "whathelpsthem", "supportneeds"],
  courses: ["course", "courses", "class", "classes", "coursename"],
  notes: ["notes", "note", "remarks", "comments"],
  photo: ["photo", "photofile", "photofilename", "photoname", "picture", "image"],
};

// Example rows end with this so a forgotten one is caught, not imported.
export const EXAMPLE_MARK = "(example)";

function csvCell(value: string) {
  return /[",\r\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// The template people fill in: the header, then two example rows that use the
// class's own course names so the file imports as soon as the examples are
// replaced. Starts with a byte order mark so Excel reads Sinhala and Tamil
// names correctly.
export function templateCsv(courseNames: string[]) {
  const [first = "", second = ""] = courseNames;
  const rows = [
    TEMPLATE_COLUMNS,
    [
      "Nimal", `Perera ${EXAMPLE_MARK}`, "18/04/2008", "Male", "200812345678", "0771234567", "nimal@example.com",
      "12 Temple Road, Kandy", "Kingswood College", "Sinhala", "Physical", first,
      "Kamala Perera", "0712345678", "Sunil Perera", "Kamala Perera", "Kamala Perera", "0712345678", "", "nimal.jpg",
    ],
    [
      "Ayesha", `Fernando ${EXAMPLE_MARK}`, "2013-09-02", "Female", "", "", "",
      "", "", "English", "Online", second ? `${first}; ${second}` : first,
      "Ruwan Fernando", "0712345678", "", "", "", "", "Delete both example rows before importing", "",
    ],
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

// What a class usually has to hand at enrolment. Religion, special needs,
// results, qualifications and occupations are left to the student's page:
// sensitive or long, and rarely known on day one. They are still read when a
// sheet has those columns.
export const TEMPLATE_COLUMNS = [
  "First name",
  "Last name",
  "Date of birth",
  "Gender",
  "NIC",
  "Phone",
  "Email",
  "Address",
  "School",
  "Medium",
  "Learning mode",
  "Course",
  "Guardian name",
  "Guardian phone",
  "Father's name",
  "Mother's name",
  "Emergency contact name",
  "Emergency contact phone",
  "Notes",
  "Photo",
];

// RFC 4180 CSV, with the delimiter taken from the header line so files from
// Excel set to a comma-decimal locale (semicolons) and tab-separated text both
// work. Rows that are completely empty are dropped.
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && field === "") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n|\r/, 1)[0] ?? "";
  let best = ",";
  let bestCount = 0;
  for (const candidate of [",", ";", "\t"]) {
    let count = 0;
    let quoted = false;
    for (const char of firstLine) {
      if (char === '"') {
        quoted = !quoted;
      } else if (!quoted && char === candidate) {
        count += 1;
      }
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function headerKey(cell: string) {
  return cell.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fieldForHeader(cell: string): ImportField | null {
  const key = headerKey(cell);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [ImportField, string[]][]) {
    if (aliases.includes(key)) {
      return field;
    }
  }
  return null;
}

function collapse(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

// Dates the way people type them in Sri Lanka: day first (18/04/2012,
// 18-04-2012, 18.04.2012), or ISO (2012-04-18). A US-style month-first date is
// taken only when it cannot be read day-first (04/18/2012).
export function parseDateOfBirth(raw: string, today: string): string | null {
  const value = raw.trim();
  let year: number;
  let month: number;
  let day: number;

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(value);
  const dayFirst = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(value);
  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (dayFirst) {
    const first = Number(dayFirst[1]);
    const second = Number(dayFirst[2]);
    year = Number(dayFirst[3]);
    if (second > 12 && first <= 12) {
      [month, day] = [first, second];
    } else {
      [day, month] = [first, second];
    }
  } else {
    return null;
  }

  if (month < 1 || month > 12 || day < 1) {
    return null;
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > lastDay) {
    return null;
  }
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return date >= "1900-01-01" && date <= today ? date : null;
}

export function parseGender(raw: string): "female" | "male" | null {
  const value = raw.trim().toLowerCase();
  if (["f", "female", "girl"].includes(value)) {
    return "female";
  }
  if (["m", "male", "boy"].includes(value)) {
    return "male";
  }
  return null;
}

// Spreadsheets drop the leading zero of a phone number (771234567) and people
// write the country code without a plus (94771234567). Both are put back.
export function parseImportPhone(raw: string): { ok: true; e164: string | null } | { ok: false } {
  let value = raw.trim().replace(/[\s()-]/g, "");
  if (/^7\d{8}$/.test(value)) {
    value = `0${value}`;
  } else if (/^94\d{9}$/.test(value)) {
    value = `+${value}`;
  }
  const phone = normalizePhone(value);
  return phone.ok ? phone : { ok: false };
}

function courseKey(name: string) {
  return collapse(name).toLowerCase();
}

function duplicateKey(fullName: string, dateOfBirth: string | null) {
  return `${collapse(fullName).toLowerCase()}|${dateOfBirth ?? ""}`;
}

export function readStudentSheet(
  text: string,
  options: {
    courses: ImportCourse[];
    existing: ExistingStudent[];
    today: string;
    // For rows that name no course.
    defaultCourseId?: string | null;
  },
): ImportSheet {
  const table = parseCsv(text);
  if (table.length === 0) {
    return { ok: false, error: "That file is empty." };
  }

  const [header, ...body] = table;
  const columns = new Map<ImportField, number>();
  const ignoredColumns: string[] = [];
  header.forEach((cell, index) => {
    const field = fieldForHeader(cell);
    if (field && !columns.has(field)) {
      columns.set(field, index);
    } else if (cell.trim()) {
      ignoredColumns.push(cell.trim());
    }
  });

  if (!columns.has("fullName") && !columns.has("firstName")) {
    return {
      ok: false,
      error: "The first row needs a First name column (or a Name column). Download the template to see the columns.",
    };
  }
  if (body.length === 0) {
    return { ok: false, error: "That file has a header row but no students." };
  }
  if (body.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `That file has ${body.length} students. Bring in up to ${MAX_IMPORT_ROWS} at a time.`,
    };
  }

  const coursesByName = new Map(options.courses.map((course) => [courseKey(course.name), course]));
  const defaultCourse = options.defaultCourseId
    ? options.courses.find((course) => course.id === options.defaultCourseId) ?? null
    : null;
  const seen = new Set(options.existing.map((student) => duplicateKey(student.fullName, student.dateOfBirth)));
  const nicsInClass = new Set(options.existing.flatMap((student) => (student.nic ? [student.nic] : [])));
  const nicRows = new Map<string, number>();
  const splitNames = !columns.has("firstName");

  const rows = body.map((cells, index): ImportRow => {
    const line = index + 2;
    const cell = (field: ImportField) => {
      const column = columns.get(field);
      return column === undefined ? "" : (cells[column] ?? "");
    };
    const errors: string[] = [];

    // A single Name column: the last word is the last name.
    let firstName = collapse(cell("firstName"));
    let lastName = collapse(cell("lastName"));
    if (splitNames) {
      const whole = collapse(cell("fullName"));
      const cut = whole.lastIndexOf(" ");
      firstName = cut > 0 && !whole.toLowerCase().endsWith(EXAMPLE_MARK) ? whole.slice(0, cut) : whole;
      lastName = cut > 0 && !whole.toLowerCase().endsWith(EXAMPLE_MARK) ? whole.slice(cut + 1) : "";
    }
    const fullName = collapse(`${firstName} ${lastName}`);
    if (fullName.toLowerCase().endsWith(EXAMPLE_MARK)) {
      errors.push("This is an example row from the template. Delete it, then save and choose the file again.");
    } else if (!firstName) {
      errors.push("Enter the student's first name.");
    }

    const rawDate = cell("dateOfBirth").trim();
    const dateOfBirth = rawDate ? parseDateOfBirth(rawDate, options.today) : null;
    if (!rawDate) {
      errors.push("Enter the date of birth.");
    } else if (!dateOfBirth) {
      errors.push(`"${rawDate}" is not a date of birth. Use 18/04/2012.`);
    }

    const rawGender = cell("gender").trim();
    const gender = rawGender ? parseGender(rawGender) : null;
    if (!rawGender) {
      errors.push("Enter the gender.");
    } else if (!gender) {
      errors.push(`"${rawGender}" is not a gender. Use Female or Male.`);
    }

    const phoneOf = (field: ImportField, label: string) => {
      const raw = cell(field).trim();
      const parsed = parseImportPhone(raw);
      if (!parsed.ok) {
        errors.push(`${label} "${raw}" is not a phone number. Use 10 digits, like 0771234567.`);
        return "";
      }
      return parsed.e164 ?? "";
    };
    const phone = phoneOf("phone", "Phone");
    const guardianPhone = phoneOf("guardianPhone", "Guardian phone");
    let emergencyContactName = collapse(cell("emergencyContactName"));
    let emergencyContactPhone = phoneOf("emergencyContactPhone", "Emergency phone");
    const emergency = cell("emergencyContact").trim();
    if (emergency) {
      const asPhone = parseImportPhone(emergency);
      if (asPhone.ok && asPhone.e164 && !emergencyContactPhone) {
        emergencyContactPhone = asPhone.e164;
      } else if (!emergencyContactName) {
        emergencyContactName = collapse(emergency);
      }
    }

    const rawNic = cell("nic").trim();
    const nic = parseNic(rawNic);
    if (!nic.ok) {
      errors.push(`"${rawNic}" is not an NIC. Use 9 digits and V or X, or 12 digits.`);
    } else if (nic.value && nicsInClass.has(nic.value)) {
      errors.push(`A student with NIC ${nic.value} is already in the class.`);
    } else if (nic.value && nicRows.has(nic.value)) {
      errors.push(`Same NIC as row ${nicRows.get(nic.value)}. Each student needs their own.`);
    } else if (nic.value) {
      nicRows.set(nic.value, line);
    }

    const rawEmail = cell("email").trim();
    const emailValid = !rawEmail || studentSchema.shape.email.safeParse(rawEmail).success;
    if (!emailValid) {
      errors.push(`"${rawEmail}" is not an email address.`);
    }

    const rawMedium = cell("medium").trim();
    const medium = parseMedium(rawMedium);
    if (medium === null) {
      errors.push(`"${rawMedium}" is not a medium. Use Sinhala, Tamil or English.`);
    }
    const rawMode = cell("learningMode").trim();
    const learningMode = parseLearningMode(rawMode);
    if (learningMode === null) {
      errors.push(`"${rawMode}" is not a learning mode. Use Online or Physical.`);
    }
    const rawNeeds = cell("hasSpecialNeeds").trim();
    const needsDetails = cell("specialNeeds").trim();
    const yesNo = parseYesNo(rawNeeds);
    // "Special needs: needs a front seat" counts as a yes with details.
    const hasSpecialNeeds = yesNo ?? Boolean(rawNeeds);
    const specialNeeds = needsDetails || (yesNo === null ? rawNeeds : "");

    const courseIds: string[] = [];
    const courseNames: string[] = [];
    const named = cell("courses")
      .split(/[;|]/)
      .map(collapse)
      .filter(Boolean);
    for (const name of named) {
      const course = coursesByName.get(courseKey(name));
      if (!course) {
        errors.push(`There is no course called "${name}".`);
      } else if (!courseIds.includes(course.id)) {
        courseIds.push(course.id);
        courseNames.push(course.name);
      }
    }
    if (named.length === 0 && defaultCourse) {
      courseIds.push(defaultCourse.id);
      courseNames.push(defaultCourse.name);
    }

    const student: StudentInput = {
      ...emptyStudent,
      firstName,
      lastName,
      dateOfBirth: dateOfBirth ?? "",
      gender: gender ?? "",
      nic: nic.ok ? nic.value : "",
      religion: collapse(cell("religion")),
      address: cell("address").trim(),
      phone,
      email: emailValid ? rawEmail : "",
      occupation: collapse(cell("occupation")),
      qualification: collapse(cell("qualification")),
      school: collapse(cell("school")),
      medium: medium ?? "",
      olResults: cell("olResults").trim(),
      alResults: cell("alResults").trim(),
      learningMode: learningMode ?? "",
      guardianName: collapse(cell("guardianName")),
      guardianPhone,
      guardianOccupation: collapse(cell("guardianOccupation")),
      fatherName: collapse(cell("fatherName")),
      fatherOccupation: collapse(cell("fatherOccupation")),
      motherName: collapse(cell("motherName")),
      motherOccupation: collapse(cell("motherOccupation")),
      emergencyContactName,
      emergencyContactPhone,
      hasSpecialNeeds,
      specialNeeds,
      notes: cell("notes").trim(),
    };
    // The form's own rules (lengths and the rest), for anything not checked above.
    if (errors.length === 0) {
      const checked = studentSchema.safeParse(student);
      if (!checked.success) {
        errors.push(...new Set(checked.error.issues.map((issue) => issue.message)));
      }
    }

    let duplicate = false;
    if (fullName && dateOfBirth) {
      const key = duplicateKey(fullName, dateOfBirth);
      duplicate = seen.has(key);
      seen.add(key);
    }

    return {
      line,
      fullName,
      dateOfBirth: dateOfBirth ?? "",
      gender: gender ?? "",
      nic: student.nic,
      guardianName: student.guardianName,
      guardianPhone,
      photo: cell("photo").trim().slice(0, 255),
      courseIds,
      courseNames,
      student,
      errors,
      duplicate,
    };
  });

  return { ok: true, rows, ignoredColumns };
}

// The rows that will be saved, in order. The import returns one student id per
// row in this same order.
export function importableRows(rows: ImportRow[], includeDuplicates: boolean) {
  return rows.filter((row) => row.errors.length === 0 && (includeDuplicates || !row.duplicate));
}

// What the database receives for each saved row.
export function rowsToImport(rows: ImportRow[], includeDuplicates: boolean) {
  return importableRows(rows, includeDuplicates).map((row) => ({
    ...studentRecord(studentSchema.parse(row.student)),
    course_ids: row.courseIds,
  }));
}
