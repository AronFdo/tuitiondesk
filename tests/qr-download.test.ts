import { describe, expect, it } from "vitest";
import { attachmentHeader, qrFileName } from "@/lib/qr-download";

describe("qrFileName", () => {
  it("uses the student's name", () => {
    expect(qrFileName("Amal Perera", "TD-00042")).toBe("Amal Perera.png");
  });

  it("drops characters file systems reject and tidies spaces", () => {
    expect(qrFileName('  A/B: "C"  <D>  ', "TD-1")).toBe("A B C D.png");
    expect(qrFileName("..hidden", "TD-1")).toBe("hidden.png");
  });

  it("keeps Sinhala and Tamil names", () => {
    expect(qrFileName("අමල් පෙරේරා", "TD-1")).toBe("අමල් පෙරේරා.png");
    expect(qrFileName("அமல்", "TD-1")).toBe("அமல்.png");
  });

  it("falls back to the code, then a plain name", () => {
    expect(qrFileName("  ", "TD-00042")).toBe("TD-00042.png");
    expect(qrFileName("///", "")).toBe("student.png");
  });
});

describe("attachmentHeader", () => {
  it("sends the real name and an ASCII fallback", () => {
    expect(attachmentHeader("Amal Perera.png", "TD-1.png")).toBe(
      `attachment; filename="Amal Perera.png"; filename*=UTF-8''Amal%20Perera.png`,
    );
  });

  it("falls back for names with no ASCII letters", () => {
    expect(attachmentHeader("අමල්.png", "TD-1.png")).toBe(
      `attachment; filename="TD-1.png"; filename*=UTF-8''${encodeURIComponent("අමල්.png")}`,
    );
  });
});
