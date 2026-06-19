import { ChatMessage, ProviderConfig } from "../types";
import { AnthropicAdapter } from "./AnthropicAdapter";
import { OpenAICompatibleAdapter } from "./OpenAICompatibleAdapter";

export interface StreamOpts { system: string; signal?: AbortSignal; }

export interface ProviderAdapter {
  /** Yields text deltas as they arrive. */
  stream(messages: ChatMessage[], opts: StreamOpts): AsyncIterable<string>;
}

export const OPENAI_COMPAT_PRESETS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com/v1",
  "nvidia-nim": "https://integrate.api.nvidia.com/v1",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  ollama: "http://localhost:11434/v1",
};

/** Parses an SSE byte stream into `data:` payload strings (skips comments/[DONE]). */
export async function* sseLines(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (line.startsWith("data:")) {
        const payload = line.slice(5).trim();
        if (payload && payload !== "[DONE]") yield payload;
      }
    }
  }
}

export function makeAdapter(cfg: ProviderConfig): ProviderAdapter {
  return cfg.kind === "anthropic" ? new AnthropicAdapter(cfg) : new OpenAICompatibleAdapter(cfg);
}
