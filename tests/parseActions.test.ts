import { describe, it, expect } from "vitest";
import { parseActions } from "../src/agency/parseActions";

describe("parseActions", () => {
  it("parses a clean actions JSON", () => {
    const out = parseActions('{"actions":[{"tool":"create_note","path":"a.md","content":"x"}]}');
    expect(out).toEqual([{ tool: "create_note", path: "a.md", content: "x" }]);
  });

  it("parses JSON wrapped in prose and fences", () => {
    const reply = 'Claro!\n```json\n{"actions":[{"tool":"edit_note","path":"b.md","mode":"append","content":"y"}]}\n```\npronto';
    expect(parseActions(reply)).toEqual([{ tool: "edit_note", path: "b.md", mode: "append", content: "y" }]);
  });

  it("defaults missing edit mode to append", () => {
    const out = parseActions('{"actions":[{"tool":"edit_note","path":"b.md","content":"y"}]}');
    expect(out).toEqual([{ tool: "edit_note", path: "b.md", mode: "append", content: "y" }]);
  });

  it("drops unknown tools and entries missing fields", () => {
    const out = parseActions('{"actions":[{"tool":"delete_note","path":"a.md"},{"tool":"create_note","path":"","content":"x"},{"tool":"create_note","path":"ok.md","content":"z"}]}');
    expect(out).toEqual([{ tool: "create_note", path: "ok.md", content: "z" }]);
  });

  it("returns [] for valid JSON with empty actions", () => {
    expect(parseActions('{"actions":[]}')).toEqual([]);
  });

  it("returns null when no parseable actions object", () => {
    expect(parseActions("desculpe, não consigo")).toBeNull();
    expect(parseActions('{"nodes":[]}')).toBeNull();
  });
});
