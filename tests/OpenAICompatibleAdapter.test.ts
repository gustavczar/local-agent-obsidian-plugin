import { describe, it, expect, vi } from "vitest";
import { OpenAICompatibleAdapter } from "../src/providers/OpenAICompatibleAdapter";

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) { for (const ch of chunks) c.enqueue(enc.encode(ch)); c.close(); },
  });
}

describe("OpenAICompatibleAdapter", () => {
  it("yields content deltas from SSE", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n',
      "data: [DONE]\n",
    ];
    globalThis.fetch = vi.fn(async () => new Response(streamFrom(sse), { status: 200 })) as any;

    const a = new OpenAICompatibleAdapter({ id: "deepseek", kind: "openai-compat", model: "deepseek-chat", apiKey: "k", baseURL: "https://api.deepseek.com/v1" });
    let out = "";
    for await (const t of a.stream([{ role: "user", content: "hi" }], { system: "sys" })) out += t;
    expect(out).toBe("Hello");
  });

  it("throws on non-200", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 401 })) as any;
    const a = new OpenAICompatibleAdapter({ id: "x", kind: "openai-compat", model: "m", apiKey: "k", baseURL: "https://api.x.com/v1" });
    await expect(async () => { for await (const _ of a.stream([{ role: "user", content: "hi" }], { system: "s" })) {} })
      .rejects.toThrow(/401/);
  });
});
