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

/** Extracts a short human-readable error message from a requestUrl response. */
export function providerErrorBody(res: { json?: any; text?: string }): string {
  const m = res?.json?.error?.message ?? res?.json?.message ?? res?.text ?? "";
  return String(m).slice(0, 300);
}

export function makeAdapter(cfg: ProviderConfig): ProviderAdapter {
  return cfg.kind === "anthropic" ? new AnthropicAdapter(cfg) : new OpenAICompatibleAdapter(cfg);
}
