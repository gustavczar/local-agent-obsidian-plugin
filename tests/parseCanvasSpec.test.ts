import { describe, it, expect } from "vitest";
import { parseCanvasSpec } from "../src/canvas/parseCanvasSpec";

describe("parseCanvasSpec", () => {
  it("parses a fenced json block with prose around it", () => {
    const reply = 'Claro! Aqui está:\n```json\n{"nodes":[{"id":"1","text":"Ideia"}],"edges":[]}\n```\nEspero que ajude.';
    const spec = parseCanvasSpec(reply);
    expect(spec?.nodes).toEqual([{ id: "1", text: "Ideia" }]);
  });

  it("parses raw json without fences and coerces ids to strings", () => {
    const spec = parseCanvasSpec('{"nodes":[{"id":1,"text":"A"},{"id":2,"text":"B"}],"edges":[{"from":1,"to":2,"label":"x"}]}');
    expect(spec?.nodes.map((n) => n.id)).toEqual(["1", "2"]);
    expect(spec?.edges).toEqual([{ from: "1", to: "2", label: "x" }]);
  });

  it("returns null when there is no usable spec", () => {
    expect(parseCanvasSpec("desculpe, não consigo")).toBeNull();
    expect(parseCanvasSpec('{"nodes":[]}')).toBeNull();
  });
});
