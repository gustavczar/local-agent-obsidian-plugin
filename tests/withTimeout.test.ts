import { describe, it, expect } from "vitest";
import { withTimeout } from "../src/providers/ProviderAdapter";

describe("withTimeout", () => {
  it("resolves when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1000)).resolves.toBe("ok");
  });

  it("rejects with a timeout error when the promise hangs", async () => {
    await expect(withTimeout(new Promise<never>(() => {}), 20)).rejects.toThrow(/Tempo esgotado/);
  });
});
