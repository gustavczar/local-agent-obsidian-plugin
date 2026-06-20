import { describe, it, expect } from "vitest";
import { addConnectionToBody } from "../src/office/addConnection";

describe("addConnectionToBody", () => {
  it("appends a link after existing items in the Conexões section", () => {
    const out = addConnectionToBody("You are X.\n\n## Conexões\n- [[a]]\n", "b");
    expect(out).toContain("- [[a]]");
    expect(out).toContain("- [[b]]");
    expect(out.indexOf("[[b]]")).toBeGreaterThan(out.indexOf("[[a]]"));
  });

  it("creates a Conexões section when none exists", () => {
    const out = addConnectionToBody("You are X.", "b");
    expect(out).toMatch(/## Conexões\n- \[\[b\]\]/);
  });

  it("is a no-op when the link already exists", () => {
    const src = "## Conexões\n- [[b]]\n";
    expect(addConnectionToBody(src, "b")).toBe(src);
  });

  it("also recognizes an English Connections heading", () => {
    const out = addConnectionToBody("body\n\n## Connections\n- [[a]]\n", "c");
    expect(out).toContain("- [[c]]");
  });
});
