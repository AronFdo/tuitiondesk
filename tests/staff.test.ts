import { describe, expect, it } from "vitest";
import { emptyStaff, staffColumns, staffInput, staffSchema } from "@/lib/validation/staff";

describe("staffSchema", () => {
  it("needs only a name and stores blanks as null", () => {
    const parsed = staffSchema.safeParse({ ...emptyStaff, fullName: "  Nimali Perera " });
    expect(parsed.success).toBe(true);
    expect(parsed.success && staffColumns(parsed.data)).toEqual({
      full_name: "Nimali Perera",
      title: null,
      phone: null,
      email: null,
      nic: null,
      address: null,
      subjects: null,
      joined_on: null,
      notes: null,
    });
  });

  it("normalises phone, email and NIC", () => {
    const parsed = staffSchema.parse({
      ...emptyStaff,
      fullName: "Kasun",
      phone: "077 123 4567",
      email: " Kasun@Example.com ",
      nic: "851234567v",
      joinedOn: "2025-02-01",
    });
    expect(parsed.phone).toBe("+94771234567");
    expect(parsed.email).toBe("kasun@example.com");
    expect(parsed.nic).toBe("851234567V");
    expect(parsed.joinedOn).toBe("2025-02-01");
  });

  it("rejects bad details with a message for each", () => {
    const result = staffSchema.safeParse({
      ...emptyStaff,
      fullName: " ",
      phone: "12345",
      email: "nope",
      nic: "123",
      joinedOn: "Feb",
    });
    expect(result.success).toBe(false);
    const fields = result.success ? [] : result.error.issues.map((issue) => issue.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["fullName", "phone", "email", "nic", "joinedOn"]));
  });
});

describe("staffInput", () => {
  it("turns a stored row back into form values", () => {
    expect(
      staffInput({
        full_name: "Kasun",
        title: "Teacher",
        phone: "+94771234567",
        email: null,
        nic: null,
        address: null,
        subjects: "English",
        joined_on: "2025-02-01",
        notes: null,
      }),
    ).toMatchObject({ phone: "0771234567", email: "", subjects: "English", joinedOn: "2025-02-01" });
  });
});
