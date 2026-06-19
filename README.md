# Local Agent Office

Turn your Obsidian vault's AI agents into a living, observable office. Each agent is a markdown note (frontmatter + system prompt + `## Conexões`); the plugin renders them as a spatial floor-plan and lets you chat 1:1 with each one.

## Features (MVP)
- Spatial office: agents grouped into rooms (by `#agente/<category>` tag), with connection lines from their `[[wikilinks]]`.
- Live glow when an agent is generating a reply.
- 1:1 chat in a native pane; agents auto-load the notes they link to, plus `@mention` any note.
- Provider-agnostic: bring your own key — Anthropic, OpenAI, DeepSeek, NVIDIA NIM, Groq, OpenRouter, Ollama (local), or any OpenAI-compatible endpoint.
- "Crystallize" a conversation into a vault note.

## Setup
1. Install, then open **Settings → Local Agent Office**.
2. Set your **agents folder** and add a **provider** (kind, model, API key; base URL for OpenAI-compatible).
3. Open the office via the ribbon icon or the "Open Agent Office" command.

## Defining an agent
See `examples/agents/`. Any `.md` under your agents folder with a `#sistema/sub-agente` or `#agente/*` tag becomes a worker.

## Security
API keys are stored in the plugin's `data.json` inside your vault. **Do not commit `data.json` to a public backup.** The plugin sends requests only to the provider endpoint you configure; no telemetry.

## Development
`npm install` · `npm run dev` (watch) · `npm test` (Vitest) · `npm run build`.
