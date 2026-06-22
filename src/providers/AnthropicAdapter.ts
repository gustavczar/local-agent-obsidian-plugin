import { requestUrl } from "obsidian";
import { ChatMessage, ProviderConfig } from "../types";
import { ProviderAdapter, StreamOpts, providerErrorBody, withTimeout } from "./ProviderAdapter";

export class AnthropicAdapter implements ProviderAdapter {
  constructor(private cfg: ProviderConfig) {}

  // Uses Obsidian's requestUrl (main process) to avoid renderer CORS. Non-streaming: yields the full reply once.
  async *stream(messages: ChatMessage[], opts: StreamOpts): AsyncIterable<string> {
    if (!this.cfg.model) throw new Error("Modelo não configurado para este provider.");
    const res = await withTimeout(requestUrl({
      url: "https://api.anthropic.com/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.cfg.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.cfg.model,
        max_tokens: opts.maxTokens && opts.maxTokens > 0 ? opts.maxTokens : 4096,
        system: opts.system,
        messages,
      }),
      throw: false,
    }), opts.timeoutMs);

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Anthropic ${res.status}: ${providerErrorBody(res)}`);
    }

    const data = res.json as { content?: { type?: string; text?: string }[] } | undefined;
    const text = (data?.content ?? [])
      .map((b) => (b.type === "text" ? b.text ?? "" : ""))
      .join("");
    if (text) yield text;
  }
}
