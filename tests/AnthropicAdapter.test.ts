import { describe, it, expect, vi } from "vitest";
import { AnthropicAdapter } from "../src/providers/AnthropicAdapter";

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({ start(c) { for (const ch of chunks) c.enqueue(enc.encode(ch)); c.close(); } });
}

describe("AnthropicAdapter", () => {
  it("yields text from content_block_delta events", async () => {
    const sse = [
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" there"}}\n',
      'data: {"type":"message_stop"}\n',
    ];
    globalThis.fetch = vi.fn(async () => new Response(streamFrom(sse), { status: 200 })) as any;

    const a = new AnthropicAdapter({ id: "claude", kind: "anthropic", model: "claude-opus-4-8", apiKey: "k" });
    let out = "";
    for await (const t of a.stream([{ role: "user", content: "hi" }], { system: "sys" })) out += t;
    expect(out).toBe("Hi there");
  });
});
