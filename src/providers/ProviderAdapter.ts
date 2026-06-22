import { ChatMessage, ProviderConfig } from "../types";
import { AnthropicAdapter } from "./AnthropicAdapter";
import { OpenAICompatibleAdapter } from "./OpenAICompatibleAdapter";

export interface StreamOpts { system: string; signal?: AbortSignal; timeoutMs?: number; maxTokens?: number; }

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
export function providerErrorBody(res: { json?: unknown; text?: string }): string {
  const j = (res.json ?? {}) as { error?: { message?: unknown }; message?: unknown };
  const m = j.error?.message ?? j.message ?? res.text ?? "";
  return (typeof m === "string" ? m : "").slice(0, 300);
}

export const PROVIDER_TIMEOUT_MS = 90000;

/** Rejects if the promise does not settle within `ms` — guards against a provider that hangs forever. */
export async function withTimeout<T>(p: Promise<T>, ms = PROVIDER_TIMEOUT_MS): Promise<T> {
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(`Tempo esgotado (${Math.round(ms / 1000)}s) — o provider não respondeu.`)), ms);
  });
  try { return await Promise.race([p, timeout]); }
  finally { window.clearTimeout(timer); }
}

export function makeAdapter(cfg: ProviderConfig): ProviderAdapter {
  return cfg.kind === "anthropic" ? new AnthropicAdapter(cfg) : new OpenAICompatibleAdapter(cfg);
}
