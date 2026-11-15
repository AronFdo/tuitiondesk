import { describe, expect, it } from "vitest";
import { matchPhotos } from "../lib/photo-match";

const row = (line: number, fullName: string, photo = "") => ({ line, fullName, photo });

describe("matchPhotos", () => {
  it("uses the file named in the Photo column, ignoring case", () => {
    const result = matchPhotos([row(2, "Nimal Perera", "NIMAL.jpg")], ["nimal.JPG", "other.jpg"]);
    expect(result.byLine.get(2)).toEqual({ fileName: "nimal.JPG", problem: null });
    expect(result.unused).toEqual(["other.jpg"]);
  });

  it("accepts a Photo name without its extension when only one file fits", () => {
    const result = matchPhotos([row(2, "Nimal", "IMG_0042")], ["IMG_0042.jpeg"]);
    expect(result.byLine.get(2)?.fileName).toBe("IMG_0042.jpeg");
  });

  it("matches a photo named after the student when the column is empty", () => {
    const result = matchPhotos(
      [row(2, "Nimal Perera"), row(3, "Ayesha  Fernando")],
      ["nimal_perera.jpg", "Ayesha-Fernando.PNG"],
    );
    expect(result.byLine.get(2)?.fileName).toBe("nimal_perera.jpg");
    expect(result.byLine.get(3)?.fileName).toBe("Ayesha-Fernando.PNG");
    expect(result.unused).toEqual([]);
  });

  it("reports a named photo that was not chosen, and leaves the row without one", () => {
    const result = matchPhotos([row(2, "Nimal", "nimal.jpg")], []);
    expect(result.byLine.get(2)).toEqual({ fileName: null, problem: '"nimal.jpg" is not among the chosen photos.' });
  });

  it("never guesses between two photos named after the same student", () => {
    const result = matchPhotos([row(2, "Nimal Perera")], ["Nimal Perera.jpg", "nimal perera.png"]);
    expect(result.byLine.get(2)?.fileName).toBeNull();
    expect(result.byLine.get(2)?.problem).toContain("More than one photo");
  });

  it("gives one photo to one student only", () => {
    const result = matchPhotos([row(2, "A", "same.jpg"), row(3, "B", "same.jpg")], ["same.jpg"]);
    expect(result.byLine.get(2)?.fileName).toBeNull();
    expect(result.byLine.get(3)?.problem).toContain("rows 2, 3");
    expect(result.unused).toEqual(["same.jpg"]);
  });

  it("is quiet about a row with no photo at all", () => {
    expect(matchPhotos([row(2, "Nimal")], ["kasun.jpg"]).byLine.get(2)).toEqual({ fileName: null, problem: null });
  });

  it("warns about HEIC files but still tries them", () => {
    const match = matchPhotos([row(2, "Nimal", "nimal.heic")], ["nimal.HEIC"]).byLine.get(2);
    expect(match?.fileName).toBe("nimal.HEIC");
    expect(match?.problem).toContain("HEIC");
  });
});
