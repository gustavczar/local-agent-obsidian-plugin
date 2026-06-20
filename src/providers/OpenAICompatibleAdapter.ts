import { requestUrl } from "obsidian";
import { ChatMessage, ProviderConfig } from "../types";
import { ProviderAdapter, StreamOpts, providerErrorBody, withTimeout } from "./ProviderAdapter";

export class OpenAICompatibleAdapter implements ProviderAdapter {
  constructor(private cfg: ProviderConfig) {}

  // Uses Obsidian's requestUrl (main process) to avoid renderer CORS. Non-streaming: yields the full reply once.
  async *stream(messages: ChatMessage[], opts: StreamOpts): AsyncIterable<string> {
    if (!this.cfg.baseURL) throw new Error("Base URL não configurada para este provider.");
    if (!this.cfg.model) throw new Error("Modelo não configurado para este provider.");
    const url = `${this.cfg.baseURL.replace(/\/+$/, "")}/chat/completions`;
    const res = await withTimeout(requestUrl({
      url,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: this.cfg.model,
        messages: [{ role: "system", content: opts.system }, ...messages],
      }),
      throw: false,
    }));

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Provider ${res.status}: ${providerErrorBody(res)}`);
    }

    const text: string = res.json?.choices?.[0]?.message?.content ?? "";
    if (text) yield text;
  }
}
