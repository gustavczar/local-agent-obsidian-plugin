import { Agent, ChatMessage, ContextNote, BuiltPrompt } from "../types";

export function buildPrompt(
  agent: Agent,
  messages: ChatMessage[],
  notes: ContextNote[],
  delegates: string[] = [],
): BuiltPrompt {
  let system = agent.systemPrompt;
  if (notes.length) {
    const blocks = notes
      .map((n) => `### ${n.path.replace(/\.md$/, "")}\n${n.content.trim()}`)
      .join("\n\n");
    system += `\n\n---\n## Conhecimento do cofre (contexto)\n${blocks}`;
  }
  if (delegates.length) {
    system += `\n\n---\n## Delegação\nSe a pergunta estiver claramente FORA do seu domínio, responda APENAS com "DELEGATE: <nome>" escolhendo um destes colegas conectados: ${delegates.join(", ")}. Caso contrário, responda normalmente sem mencionar isto.`;
  }
  return { system, messages };
}
