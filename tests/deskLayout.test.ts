import { describe, it, expect } from "vitest";
import { autoColumns, needsAutoPlacement, computeOfficeLayout } from "../src/office/deskLayout";

const at = (id: string, col: number, row: number) => ({ id, desk: { col, row } });

describe("autoColumns", () => {
  it("keeps small teams at three columns", () => {
    expect(autoColumns(1)).toBe(3);
    expect(autoColumns(6)).toBe(3);
    expect(autoColumns(9)).toBe(3);
  });

  it("widens instead of deepening as the team grows", () => {
    // 10 agents used to be 3 wide by 4 deep, which forced the camera to zoom out.
    expect(autoColumns(10)).toBe(4);
    expect(autoColumns(16)).toBe(4);
    expect(autoColumns(30)).toBe(6);
  });
});

describe("needsAutoPlacement", () => {
  it("respects desks the run state assigned", () => {
    expect(needsAutoPlacement([at("a", 1, 1), at("b", 2, 1)])).toBe(false);
  });

  it("takes over when every desk is identical", () => {
    expect(needsAutoPlacement([at("a", 1, 1), at("b", 1, 1)])).toBe(true);
  });

  it("takes over when desks are missing or zero", () => {
    expect(needsAutoPlacement([{ id: "a" }, at("b", 2, 1)])).toBe(true);
    expect(needsAutoPlacement([at("a", 0, 0), at("b", 2, 1)])).toBe(true);
  });

  it("says no for an empty floor", () => {
    expect(needsAutoPlacement([])).toBe(false);
  });
});

describe("computeOfficeLayout", () => {
  it("lays 10 unplaced agents out wider than deep", () => {
    const agents = Array.from({ length: 10 }, (_, i) => ({ id: `a${i}` }));
    const layout = computeOfficeLayout(agents);

    expect(layout.cols).toBe(4);
    expect(layout.rows).toBe(3);
    expect(layout.roomW).toBeGreaterThan(0);
    expect(layout.placements).toHaveLength(10);
  });

  it("honours explicit desk positions", () => {
    const layout = computeOfficeLayout([at("a", 3, 2), at("b", 1, 1)]);

    expect(layout.placements[0]).toMatchObject({ id: "a", col: 3, row: 2 });
    expect(layout.placements[1]).toMatchObject({ id: "b", col: 1, row: 1 });
  });

  it("gives every agent a distinct spot", () => {
    const agents = Array.from({ length: 7 }, (_, i) => ({ id: `a${i}` }));
    const spots = computeOfficeLayout(agents).placements.map((p) => `${p.x},${p.y}`);

    expect(new Set(spots).size).toBe(7);
  });

  it("never returns a room narrower than the minimum", () => {
    expect(computeOfficeLayout([{ id: "solo" }]).roomW).toBeGreaterThanOrEqual(580);
  });
});
