import { ChatMessage, ProviderConfig } from "../types";
import { ProviderAdapter, StreamOpts, sseLines } from "./ProviderAdapter";

export class AnthropicAdapter implements ProviderAdapter {
  constructor(private cfg: ProviderConfig) {}

  async *stream(messages: ChatMessage[], opts: StreamOpts): AsyncIterable<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.cfg.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: this.cfg.model,
        max_tokens: 4096,
        stream: true,
        system: opts.system,
        messages,
      }),
      signal: opts.signal,
    });

    if (!res.ok || !res.body) throw new Error(`Provider error ${res.status}`);

    for await (const payload of sseLines(res.body)) {
      try {
        const json = JSON.parse(payload);
        if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
          yield json.delta.text as string;
        }
      } catch { /* ignore */ }
    }
  }
}
