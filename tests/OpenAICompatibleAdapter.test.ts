import { describe, it, expect } from "vitest";
import { OpenAICompatibleAdapter } from "../src/providers/OpenAICompatibleAdapter";
import { obsidianMock } from "obsidian";

async function collect(it: AsyncIterable<string>): Promise<string> {
  let out = ""; for await (const t of it) out += t; return out;
}

describe("OpenAICompatibleAdapter", () => {
  it("yields the assistant message content", async () => {
    obsidianMock.requestUrl = async () => ({ status: 200, json: { choices: [{ message: { content: "Hello" } }] }, text: "" });
    const a = new OpenAICompatibleAdapter({ id: "deepseek", kind: "openai-compat", model: "deepseek-chat", apiKey: "k", baseURL: "https://api.deepseek.com/v1" });
    expect(await collect(a.stream([{ role: "user", content: "hi" }], { system: "sys" }))).toBe("Hello");
  });

  it("throws on non-2xx with body", async () => {
    obsidianMock.requestUrl = async () => ({ status: 401, json: { error: { message: "nope" } }, text: "" });
    const a = new OpenAICompatibleAdapter({ id: "x", kind: "openai-compat", model: "m", apiKey: "k", baseURL: "https://api.x.com/v1" });
    await expect(collect(a.stream([{ role: "user", content: "hi" }], { system: "s" }))).rejects.toThrow(/401.*nope/);
  });

  it("throws a clear error when baseURL is missing (M3 regression)", async () => {
    const a = new OpenAICompatibleAdapter({ id: "x", kind: "openai-compat", model: "m", apiKey: "k" });
    await expect(collect(a.stream([{ role: "user", content: "hi" }], { system: "s" }))).rejects.toThrow(/Base URL/);
  });
});
