import { describe, it, expect, vi } from "vitest";
import { ChatSession } from "../src/chat/ChatSession";
import { Agent } from "../src/types";

const agent: Agent = { name: "nexo", title: "Nexo", systemPrompt: "You are Nexo.", room: "E", connections: [], filePath: "nexo.md" };

const fakeAdapter = {
  async *stream() { yield "Hel"; yield "lo"; },
};

describe("ChatSession", () => {
  it("streams a reply, stores both messages, toggles working state", async () => {
    const states: boolean[] = [];
    const session = new ChatSession(agent, fakeAdapter as any, async () => []);
    session.onStateChange((working) => states.push(working));

    let streamed = "";
    session.onToken((t) => (streamed += t));

    await session.send("oi");

    expect(streamed).toBe("Hello");
    expect(session.messages).toEqual([
      { role: "user", content: "oi" },
      { role: "assistant", content: "Hello" },
    ]);
    expect(states).toEqual([true, false]);
  });
});
