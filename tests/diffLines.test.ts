import { describe, it, expect } from "vitest";
import { diffLines } from "../src/agency/diffLines";

describe("diffLines", () => {
  it("marks identical lines as same", () => {
    expect(diffLines("a\nb", "a\nb")).toEqual([
      { type: "same", text: "a" },
      { type: "same", text: "b" },
    ]);
  });

  it("marks added and removed lines", () => {
    const segs = diffLines("a\nb", "a\nc");
    expect(segs).toContainEqual({ type: "same", text: "a" });
    expect(segs).toContainEqual({ type: "del", text: "b" });
    expect(segs).toContainEqual({ type: "add", text: "c" });
  });

  it("treats empty before as all-add", () => {
    expect(diffLines("", "x")).toEqual([{ type: "add", text: "x" }]);
  });

  it("treats empty after as all-del", () => {
    expect(diffLines("x", "")).toEqual([{ type: "del", text: "x" }]);
  });
});
