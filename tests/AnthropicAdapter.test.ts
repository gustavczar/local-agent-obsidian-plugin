import { describe, it, expect } from "vitest";
import { AnthropicAdapter } from "../src/providers/AnthropicAdapter";
import { obsidianMock } from "obsidian";

async function collect(it: AsyncIterable<string>): Promise<string> {
  let out = ""; for await (const t of it) out += t; return out;
}

describe("AnthropicAdapter", () => {
  it("yields the full message text from a non-streaming response", async () => {
    obsidianMock.requestUrl = async () => ({ status: 200, json: { content: [{ type: "text", text: "Hi there" }] }, text: "" });
    const a = new AnthropicAdapter({ id: "claude", kind: "anthropic", model: "claude-opus-4-8", apiKey: "k" });
    expect(await collect(a.stream([{ role: "user", content: "hi" }], { system: "sys" }))).toBe("Hi there");
  });

  it("throws with status + body on error", async () => {
    obsidianMock.requestUrl = async () => ({ status: 401, json: { error: { message: "bad key" } }, text: "" });
    const a = new AnthropicAdapter({ id: "c", kind: "anthropic", model: "m", apiKey: "k" });
    await expect(collect(a.stream([{ role: "user", content: "hi" }], { system: "s" }))).rejects.toThrow(/401.*bad key/);
  });
});
