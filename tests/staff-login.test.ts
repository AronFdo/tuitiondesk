import { describe, expect, it } from "vitest";
import { loginResultText } from "@/lib/staff-login";

describe("loginResultText", () => {
  it("confirms an invite or a linked account", () => {
    expect(loginResultText("invited")).toEqual({
      ok: true,
      text: "Invite sent. They set a password from the email, then sign in.",
    });
    expect(loginResultText("linked")?.ok).toBe(true);
  });

  it("explains a failed login and how to retry", () => {
    const result = loginResultText("family");
    expect(result?.ok).toBe(false);
    expect(result?.text).toContain("parent's account");
    expect(result?.text).toContain("Give login access");
  });

  it("ignores anything else in the address bar", () => {
    expect(loginResultText(undefined)).toBeNull();
    expect(loginResultText("toString")).toBeNull();
    expect(loginResultText("<b>hi</b>")).toBeNull();
  });
});
