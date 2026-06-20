import { describe, it, expect } from "vitest";
import { buildCanvas } from "../src/canvas/buildCanvas";

describe("buildCanvas", () => {
  it("produces valid JSON Canvas nodes with layout + required fields", () => {
    const out = buildCanvas({
      nodes: [{ id: "1", text: "A" }, { id: "2", text: "B" }],
      edges: [{ from: "1", to: "2", label: "leva a" }],
    });
    const json = JSON.parse(out);
    expect(json.nodes).toHaveLength(2);
    for (const n of json.nodes) {
      expect(n.type).toBe("text");
      expect(typeof n.x).toBe("number");
      expect(typeof n.width).toBe("number");
    }
    expect(json.edges[0]).toMatchObject({ fromNode: "1", toNode: "2", label: "leva a" });
  });

  it("drops edges that reference unknown nodes", () => {
    const out = buildCanvas({ nodes: [{ id: "1", text: "A" }], edges: [{ from: "1", to: "ghost" }] });
    expect(JSON.parse(out).edges).toHaveLength(0);
  });
});
