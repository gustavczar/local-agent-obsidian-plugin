import { Agent, ChatMessage } from "../types";
import { ProviderAdapter } from "../providers/ProviderAdapter";
import { buildPrompt } from "../context/ContextBuilder";

type NotesResolver = (agent: Agent, mentions: string[], query: string) => Promise<{ path: string; content: string }[]>;

export class ChatSession {
  messages: ChatMessage[] = [];
  private tokenCbs: Array<(t: string) => void> = [];
  private stateCbs: Array<(working: boolean) => void> = [];

  constructor(private agent: Agent, private adapter: ProviderAdapter, private resolve: NotesResolver) {}

  /** Returns an unsubscribe fn so callers can scope a listener to one send. */
  onToken(cb: (t: string) => void): () => void {
    this.tokenCbs.push(cb);
    return () => { this.tokenCbs = this.tokenCbs.filter((c) => c !== cb); };
  }
  onStateChange(cb: (working: boolean) => void): () => void {
    this.stateCbs.push(cb);
    return () => { this.stateCbs = this.stateCbs.filter((c) => c !== cb); };
  }
  private setWorking(w: boolean) { for (const cb of this.stateCbs) cb(w); }

  async send(text: string, mentions: string[] = []): Promise<void> {
    this.messages.push({ role: "user", content: text });
    const notes = await this.resolve(this.agent, mentions, text);
    const { system, messages } = buildPrompt(this.agent, this.messages, notes);

    this.setWorking(true);
    let reply = "";
    try {
      for await (const tok of this.adapter.stream(messages, { system })) {
        reply += tok;
        for (const cb of this.tokenCbs) cb(tok);
      }
      this.messages.push({ role: "assistant", content: reply });
    } finally {
      this.setWorking(false);
    }
  }
}
