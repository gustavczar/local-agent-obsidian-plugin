# Local Agent Office — Full Guide

Everything the plugin does, how each piece works, and how to run it lean. No prior setup knowledge assumed.

---

## 1. The idea

Your vault becomes a **team of AI agents**. Each agent is an ordinary markdown note (a persona). The plugin renders them as a spatial office and lets them **chat, act on your notes (with approval), remember what they learn, delegate, run as pipelines, and brainstorm together**.

**What makes it different:** it isn't a single "chat with your vault" assistant. It's a multi-agent system where the agents *are* your notes, *act* in your vault, and *collaborate* — visualized live. Knowledge retrieval is a supporting feature, not the product.

---

## 2. Setup

1. Enable the plugin.
2. Settings → **Local Agent Office**:
   - **Pasta de agentes** — folder scanned for agent notes (any `.md` there becomes an agent).
   - **Add provider** — kind (Anthropic or OpenAI-compatible), model, API key; base URL for OpenAI-compatible (type a preset name like `groq`, `deepseek`, `openai`, `nvidia-nim`, `openrouter`, `ollama`, or paste a full URL). Mark one as **Provider ativo**.
3. Open the office (ribbon 🏢 or command **Open Agent Office**).

---

## 3. Features

### Agents (notes → workers)
An agent note = YAML frontmatter (`name`, `title`, optional `icon`/`color`, `#agente/<room>` tag) + a body that is the system prompt + an optional `## Connections` section with `[[wikilinks]]`. The whole body (minus `## Connections`) becomes the agent's instructions — including any `## 🧠 Memória` section. Create agents with **+ Agente** (manual template or **✨ generate with AI**).

### The office
Cards grouped into rooms (by tag), with avatars. Hover a card → its connections light up (lines drawn from `[[wikilinks]]`). Cards glow while an agent is working, with animated lines on hand-offs. **Right-click a card** → chat / open the agent note / connect / settings.

### 1:1 chat
Side pane. `@mention` agents or notes inline. "Crystallize" saves the conversation as a note.

### @agent inside any note
Write `@Agent: your question` on a line → run **Responder @menção na linha atual** → the answer appears as a callout with live status. Routing (if on) can forward to a better-fit teammate.

### Agency — acting on the vault
Write `@Agent: do X` → run **Agir no cofre (@menção)**. The agent proposes actions:
- **create_note** — make a new note.
- **edit_note** — append to or replace a note (a diff preview shows append/replace before you approve).
- **append_memory** — record a durable learning into its own `## 🧠 Memória`.

Each action opens an approval modal (editable content; approve / skip / cancel). Every written note gets a provenance footer (`🤖 [[agent]] · date`). Nothing is written without approval. Output folder follows: an explicit path the agent gives → **Pasta de saída da agência** → conversations folder → vault root.

### Memory
`append_memory` writes a bullet under the agent's `## 🧠 Memória`. Because that section is part of the agent's note body, it is automatically in the agent's context next time — so agents stop re-discovering the same facts.

### Squads (pipelines with checkpoints)
A squad is a note with a numbered list: `1. [[agent]]: instruction`. Run **Rodar squad (nota atual)**. Steps run in order; each step's approved output feeds the next; you approve / edit / redo / cancel at every step. `[[wikilinks]]` inside a step's instruction are pulled in as context. The run is saved as a note.

### Brainstorming room
Run **Brainstorm multi-agente** → pick 2+ agents + a topic + rounds. They discuss automatically (cap on rounds, **Parar** button stops instantly), live in the office, then a neutral facilitator synthesizes the conversation. The full transcript + synthesis is saved as a note with participant links.

### Canvas
`@Agent: topic` → **Gerar Canvas da @menção** → a native `.canvas` mind-map.

---

## 4. Token economy (controls)

Multi-agent runs make many calls. You control the cost. Settings → **Economia de tokens**:

- **Modo economia** — every call uses *lean context*: it skips vault auto-consult and context folders, sending only the agent's persona + its `[[connections]]` + the task. Big token savings; less retrieval depth. (Brainstorm always runs lean regardless.)
- **Teto de tokens por resposta** — `max_tokens` cap on the model's output. `0` = provider default.
- **Provider leve** — a cheap/fast model used for brainstorm, squads, and routing; your 1:1 chat keeps the active (strong) model. Routing replies are capped tiny automatically.

**What "lean" drops:** the heavy context (auto-consulted vault notes + configured context folders). **What it keeps:** the agent's own definition/persona, its `## 🧠 Memória`, its `[[connections]]`, and any explicit `@mentions`.

---

## 5. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| A turn says "não respondeu (provider lento/rate-limit)" | The provider throttled or was slow. Set a **Provider leve** to a small fast model, and/or lower **Teto de tokens**, and/or use fewer agents/rounds. The run skips that turn and continues. |
| Brainstorm only completes one turn | Provider rate limit (tokens-per-minute). Use a light model as **Provider leve** — that's what it's for. |
| "Tempo esgotado — o provider não respondeu" | The provider hung past the timeout. Try a faster model/provider. |
| Connection lines / delegation not visible | Reload the office (Ctrl+R). Lines render above the cards. |
| An agent didn't pick up a note | If economy/lean is on, vault auto-consult is skipped — link the note in the agent's `## Connections` or `@mention` it. |

---

## 6. Commands

| Command | Purpose |
|---|---|
| Open Agent Office | Open the office |
| Responder @menção na linha atual | Answer the nearest `@Agent:` in the note |
| Gerar Canvas da @menção na linha atual | `@Agent: topic` → `.canvas` mind-map |
| Agir no cofre (@menção) | Agent proposes vault actions (create/edit/memory) with approval |
| Rodar squad (nota atual) | Run a squad note step-by-step |
| Brainstorm multi-agente | Group discussion + synthesis |

---

## 7. Privacy

Local-first, no telemetry. Notes leave your machine only as context in the requests you trigger to the provider you chose. API keys live in `data.json` inside the vault — don't commit it to a public backup.
