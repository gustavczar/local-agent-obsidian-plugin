import { describe, it, expect } from "vitest";
import { computeLayout } from "../src/office/layout";
import { Agent } from "../src/types";

function agent(name: string, room: string): Agent {
  return { name, title: name, systemPrompt: "", room, connections: [], filePath: name + ".md" };
}

describe("computeLayout", () => {
  it("creates one room box per distinct room", () => {
    const out = computeLayout([agent("a", "Estrategia"), agent("b", "Dados"), agent("c", "Estrategia")], {}, { w: 800, h: 600 });
    expect(out.rooms.map((r) => r.name).sort()).toEqual(["Dados", "Estrategia"]);
  });

  it("uses a saved position when present, else auto-places inside the room", () => {
    const out = computeLayout([agent("a", "Estrategia")], { a: { x: 123, y: 45 } }, { w: 800, h: 600 });
    const node = out.nodes.find((n) => n.name === "a")!;
    expect(node).toMatchObject({ x: 123, y: 45 });
  });

  it("auto-placed nodes fall within their room box", () => {
    const out = computeLayout([agent("a", "Dados")], {}, { w: 800, h: 600 });
    const room = out.rooms.find((r) => r.name === "Dados")!;
    const node = out.nodes.find((n) => n.name === "a")!;
    expect(node.x).toBeGreaterThanOrEqual(room.x);
    expect(node.x).toBeLessThanOrEqual(room.x + room.w);
  });
});
