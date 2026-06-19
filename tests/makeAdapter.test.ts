import { describe, it, expect } from "vitest";
import { makeAdapter } from "../src/providers/ProviderAdapter";
import { AnthropicAdapter } from "../src/providers/AnthropicAdapter";
import { OpenAICompatibleAdapter } from "../src/providers/OpenAICompatibleAdapter";

describe("makeAdapter", () => {
  it("returns AnthropicAdapter for kind=anthropic", () => {
    expect(makeAdapter({ id: "c", kind: "anthropic", model: "m", apiKey: "k" })).toBeInstanceOf(AnthropicAdapter);
  });
  it("returns OpenAICompatibleAdapter for kind=openai-compat", () => {
    expect(makeAdapter({ id: "d", kind: "openai-compat", model: "m", apiKey: "k", baseURL: "u" })).toBeInstanceOf(OpenAICompatibleAdapter);
  });
});
