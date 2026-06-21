import { describe, it, expect } from "vitest";
import { validateAgent, isValidAgent } from "../src/registry/validateAgent";

const cleanBody = `You are Sage, a Socratic strategist.

## Conexões
- MOC: [[Mental Models MOC]]
`;

const cleanFm = {
  name: "sage",
  title: "Sage — The Questioner",
  tags: ["#agente/strategy", "#sistema/sub-agente"],
};

function codes(fm: any, body: string, path = "agents/x.md"): string[] {
  return validateAgent(fm, body, path).map((i) => i.code);
}

describe("validateAgent", () => {
  it("returns no issues for a well-formed agent", () => {
    const issues = validateAgent(cleanFm, cleanBody, "agents/sage.md");
    expect(issues).toEqual([]);
    expect(isValidAgent(issues)).toBe(true);
  });

  it("flags an empty body as an error (no instructions)", () => {
    const issues = validateAgent(cleanFm, "\n## Conexões\n- [[MOC]]\n", "agents/x.md");
    expect(issues.some((i) => i.code === "no_instructions" && i.level === "error")).toBe(true);
    expect(isValidAgent(issues)).toBe(false);
  });

  it("warns when name is missing from frontmatter", () => {
    expect(codes({ title: "T", tags: ["#agente/x"] }, "Body. [[MOC]]")).toContain("no_name");
  });

  it("warns when the resolved id contains a space (breaks @mentions)", () => {
    const c = codes({ tags: ["#agente/x"] }, "Body. [[MOC]]", "agents/My Agent.md");
    expect(c).toContain("name_has_space");
  });

  it("warns when title is missing", () => {
    expect(codes({ name: "n", tags: ["#agente/x"] }, "Body. [[MOC]]")).toContain("no_title");
  });

  it("warns when no #agente/<categoria> tag is present", () => {
    expect(codes({ name: "n", title: "T" }, "Body. [[MOC]]")).toContain("no_agent_tag");
  });

  it("warns when the agent has no [[connections]]", () => {
    expect(codes({ name: "n", title: "T", tags: ["#agente/x"] }, "Body with no links.")).toContain(
      "no_connections",
    );
  });

  it("a clean agent is valid even if it has warnings only", () => {
    const issues = validateAgent({ name: "n" }, "Body with no links.", "agents/n.md");
    expect(issues.every((i) => i.level === "warn")).toBe(true);
    expect(isValidAgent(issues)).toBe(true);
  });
});
