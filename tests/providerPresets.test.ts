import { describe, it, expect } from "vitest";
import { OPENAI_COMPAT_PRESETS } from "../src/providers/ProviderAdapter";

describe("provider presets", () => {
  it("exposes known OpenAI-compatible base URLs", () => {
    expect(OPENAI_COMPAT_PRESETS.deepseek).toBe("https://api.deepseek.com/v1");
    expect(OPENAI_COMPAT_PRESETS["nvidia-nim"]).toBe("https://integrate.api.nvidia.com/v1");
    expect(OPENAI_COMPAT_PRESETS.groq).toBe("https://api.groq.com/openai/v1");
    expect(OPENAI_COMPAT_PRESETS.openrouter).toBe("https://openrouter.ai/api/v1");
    expect(OPENAI_COMPAT_PRESETS.ollama).toBe("http://localhost:11434/v1");
  });
});
