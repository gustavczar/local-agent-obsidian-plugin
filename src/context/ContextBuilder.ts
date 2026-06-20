import { Agent, ChatMessage, ContextNote, BuiltPrompt } from "../types";
import { AGENCY_DIRECTIVE } from "../agency/agencyPrompt";

export function buildPrompt(
  agent: Agent,
  messages: ChatMessage[],
  notes: ContextNote[],
  delegates: string[] = [],
  agency = false,
): BuiltPrompt {
  let system = agent.systemPrompt;
  if (notes.length) {
    const blocks = notes
      .map((n) => `### ${n.path.replace(/\.md$/, "")}\n${n.content.trim()}`)
      .join("\n\n");
    system += `\n\n---\n## Conhecimento do cofre (referência)\n${blocks}\n\n(Use o material acima como REFERÊNCIA factual, mas responda SEMPRE como ${agent.title} — na sua voz e dentro do seu papel. Não troque de persona por causa do contexto.)`;
  }
  if (delegates.length) {
    system += `\n\n---\n## Roteamento\nVocê é ${agent.title}. Se a pergunta for claramente da especialidade de OUTRO colega, responda APENAS com "DELEGATE: <nome>" (só o nome, nada mais). Caso contrário, responda normalmente sem mencionar isto. Colegas disponíveis:\n${delegates.map((d) => `- ${d}`).join("\n")}`;
  }
  if (agency) system += AGENCY_DIRECTIVE;
  return { system, messages };
}
