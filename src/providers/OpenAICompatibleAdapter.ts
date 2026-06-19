import { ChatMessage, ProviderConfig } from "../types";
import { ProviderAdapter, StreamOpts, sseLines } from "./ProviderAdapter";

export class OpenAICompatibleAdapter implements ProviderAdapter {
  constructor(private cfg: ProviderConfig) {}

  async *stream(messages: ChatMessage[], opts: StreamOpts): AsyncIterable<string> {
    const url = `${this.cfg.baseURL!.replace(/\/+$/, "")}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: this.cfg.model,
        stream: true,
        messages: [{ role: "system", content: opts.system }, ...messages],
      }),
      signal: opts.signal,
    });

    if (!res.ok || !res.body) throw new Error(`Provider error ${res.status}`);

    for await (const payload of sseLines(res.body)) {
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch { /* ignore keepalive/partial */ }
    }
  }
}
