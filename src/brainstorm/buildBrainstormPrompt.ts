export type Turn = { agent: string; text: string };

/** The per-turn prompt for an agent in a group brainstorm (sees the transcript so far). */
export function buildBrainstormTurnPrompt(topic: string, transcript: Turn[], agentTitle: string): string {
  if (!transcript.length) {
    return `Você está num brainstorming em grupo sobre: "${topic}".\n` +
      `Você abre a discussão. Dê sua perspectiva inicial em 2 a 4 frases, na sua voz como ${agentTitle}.`;
  }
  const convo = transcript.map((t) => `${t.agent}: ${t.text}`).join("\n");
  return `Brainstorming em grupo sobre: "${topic}".\n\nConversa até agora:\n${convo}\n\n` +
    `Contribua com SUA perspectiva como ${agentTitle} — concorde, discorde ou traga algo novo, em 2 a 4 frases. ` +
    `Não repita o que já foi dito.`;
}

export const FACILITATOR_SYSTEM =
  "Você é um facilitador de brainstorming neutro e objetivo. Sintetiza discussões em pontos acionáveis.";

/** The synthesis prompt given to the facilitator after the discussion. */
export function buildFacilitatorPrompt(topic: string, transcript: Turn[]): string {
  const convo = transcript.map((t) => `${t.agent}: ${t.text}`).join("\n");
  return `Discussão sobre: "${topic}".\n\n${convo}\n\n` +
    `Sintetize em: principais pontos, convergências, divergências e próximos passos/decisões. ` +
    `Seja conciso e use bullets.`;
}
