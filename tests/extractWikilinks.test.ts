import { describe, it, expect } from "vitest";
import { extractWikilinks } from "../src/context/extractWikilinks";

describe("extractWikilinks", () => {
  it("extracts plain, aliased and heading links", () => {
    expect(extractWikilinks("veja [[Nota A]] e [[Nota B|apelido]] e [[Nota C#seção]]"))
      .toEqual(["Nota A", "Nota B", "Nota C"]);
  });

  it("de-dupes repeated links", () => {
    expect(extractWikilinks("[[X]] e de novo [[X]]")).toEqual(["X"]);
  });

  it("returns empty array when there are no links", () => {
    expect(extractWikilinks("sem links aqui")).toEqual([]);
  });
});
