import { describe, expect, it } from "vitest";
import { projectMomentum, rubberBand, shouldDismiss } from "../components/ui/use-sheet-drag";

describe("sheet drag", () => {
  it("projects a flick the way scrolling decelerates", () => {
    expect(projectMomentum(0)).toBe(0);
    expect(projectMomentum(1000)).toBeCloseTo(499, 0);
    expect(projectMomentum(-1000)).toBeCloseTo(-499, 0);
  });

  it("resists more the further it is pulled past the edge", () => {
    const small = rubberBand(20, 600);
    const large = rubberBand(200, 600);
    expect(small).toBeLessThan(20);
    expect(large).toBeLessThan(200);
    expect(large / 200).toBeLessThan(small / 20);
  });

  it("closes past half way, or on a quick flick from near the top", () => {
    expect(shouldDismiss(320, 0, 600)).toBe(true);
    expect(shouldDismiss(200, 0, 600)).toBe(false);
    expect(shouldDismiss(60, 900, 600)).toBe(true);
  });

  it("stays open when the finger was heading back up, or barely moved", () => {
    expect(shouldDismiss(400, -500, 600)).toBe(false);
    expect(shouldDismiss(4, 2000, 600)).toBe(false);
  });
});
