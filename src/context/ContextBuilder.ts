import { Agent, ChatMessage, ContextNote, BuiltPrompt } from "../types";

export function buildPrompt(agent: Agent, messages: ChatMessage[], notes: ContextNote[]): BuiltPrompt {
  let system = agent.systemPrompt;
  if (notes.length) {
    const blocks = notes
      .map((n) => `### ${n.path.replace(/\.md$/, "")}\n${n.content.trim()}`)
      .join("\n\n");
    system += `\n\n---\n## Conhecimento do cofre (contexto)\n${blocks}`;
  }
  return { system, messages };
}
