<div align="center">

# 🏢 Local Agent Office

### Your second brain just became a company. Hire employees made of your own notes.

**Local Agent Office turns your Obsidian vault into a living team of AI agents.**
Each agent *is* a note. They live in your vault, read your knowledge, talk to each other,
**act on your notes (with your approval), remember what they learn, and brainstorm together** —
all rendered as a spatial office you can watch work in real time.

Bring your own key. Local-first. No telemetry. Works with Anthropic, OpenAI, DeepSeek, Groq, NVIDIA NIM, OpenRouter, or local Ollama.

<!-- TODO: add hero GIF here — the 30s demo (drag a topic → squad/brainstorm runs → notes appear). This GIF is the marketing. -->
<!-- ![demo](docs/demo.gif) -->

</div>

---

## Why this is different

Other agent frameworks are generic CLIs. **Local Agent Office is the only one native to Obsidian** — your agents are built from *your* notes, live in *your* vault, and produce *your* notes and canvases. It's an operating system for AI agents on top of your knowledge.

> If you already think in Obsidian, your team now thinks there too.

---

## ✨ What it does

### 🧠 Agents made of notes
Every agent is just a markdown note (frontmatter + system prompt + `## Connections`). Drop a `.md` in your agents folder and it becomes a worker. Author them by hand, from an **Elite template**, or let the **AI architect generate a full persona** from one sentence.

### 🏢 A living, spatial office
Agents are grouped into rooms (by tag), with avatars and connection lines drawn from their `[[wikilinks]]`. Cards **light up in real time** as agents think and work, with animated lines when they hand off to each other. Right-click any card for quick actions (chat, open note, connect, settings).

### 💬 Talk to them — anywhere
- **1:1 chat** in a side pane, with inline `@mentions` of agents and notes, and one-click "crystallize" to save the conversation as a note.
- **`@Agent: question` inside any note** → run a command → the answer drops in as a live callout (with `⏳ / 🤝 / ⚠️` status).

### 🛠️ Agency — agents that *act* on your vault
Ask an agent to do something and it proposes concrete actions (**create note**, **edit note**) — each gated by an **approval modal** with an editable preview and a **diff view** for edits. Approve, skip, or cancel. Every write leaves a provenance trail (`🤖 [[agent]] · date`). *Nothing touches your vault without your yes.*

### 🧠 Memory — agents that get better
Agents record durable learnings into a `## 🧠 Memória` section of their own note (with approval). Next time, that knowledge is automatically in their context — so they stop re-discovering the same things.

### 🤝 Squads — pipelines with checkpoints
Define a squad as a note (`1. [[agent]]: instruction`). Run it and each agent feeds the next (X→Y), pausing at every step for you to **approve / edit / redo / cancel**. The result is saved as a note.

### 💡 Multi-agent brainstorming room
Pick 2+ agents and a topic — they **discuss it automatically**, live in the office, then a facilitator synthesizes the conversation into a note with the full transcript + conclusions.

### 🗺️ Canvas mind-maps
`@Agent: topic` → generate a native Obsidian `.canvas` mind-map, laid out hierarchically.

### 📚 Knowledge from your vault
Agents pull in the notes they link to, any folders you configure, and — when nothing is set — auto-consult the most relevant notes for the question.

---

## 🚀 Quickstart

1. **Install** the plugin and enable it.
2. Open **Settings → Local Agent Office** → add a **provider** (kind, model, API key; base URL for OpenAI-compatible) and pick your **agents folder**.
3. Open the office (ribbon icon 🏢 or command **"Open Agent Office"**).
4. Click **+ Agent** → describe a persona → **✨ Generate with AI**, or write one by hand.
5. **Try these in 2 minutes:**
   - Click an agent → chat 1:1.
   - In any note, write `@<agent>: <question>` → run **"Responder @menção na linha atual"**.
   - Write `@<agent>: create a note summarizing X` → run **"Agir no cofre (@menção)"** → approve.
   - Run **"Brainstorm multi-agente"** → pick a few agents + a topic → watch them talk.

> **Tip:** for fast multi-agent runs, use a low-latency provider (Groq, DeepSeek). Rate-limited free tiers (e.g. NVIDIA NIM) can make turns slow.

---

## ⌨️ Commands

| Command | What it does |
|---|---|
| Open Agent Office | Opens the spatial office |
| Responder @menção na linha atual | Answer the nearest `@Agent:` in the note (inline callout) |
| Gerar Canvas da @menção na linha atual | Turn `@Agent: topic` into a `.canvas` mind-map |
| Agir no cofre (@menção) | Agent proposes vault actions (create/edit) with approval |
| Rodar squad (nota atual) | Run a squad note step-by-step with checkpoints |
| Brainstorm multi-agente | Pick agents + topic → automatic group discussion + synthesis |

---

## 🧩 Defining an agent

Any `.md` in your agents folder becomes a worker. Minimal example:

```markdown
---
name: escriba
title: Escriba — The Word Keeper
icon: "✍️"
color: "#7F77DD"
tags:
  - "#agente/escrita"
---

You are Escriba, a sharp editorial writer. You turn rough ideas into clear, compelling prose.

## 🧠 Memória
- (filled in automatically as the agent learns)

## Connections
- [[MOC - Writing]]
```

Full authoring contract (rooms, voice/values, delegation, context) is in
**[`skills/agent-authoring/SKILL.md`](skills/agent-authoring/SKILL.md)** — which is also a drop-in agent skill so your AI can help you write agents.

---

## 🔌 Providers (bring your own key)

Anthropic · OpenAI · DeepSeek · Groq · NVIDIA NIM · OpenRouter · Ollama (local) · any OpenAI-compatible endpoint.
Requests go **only** to the endpoint you configure. Each call is bounded by a timeout so a slow provider never hangs the UI.

## 🔒 Privacy & security

- **Local-first, no telemetry.** Your notes never leave your machine except as context in the requests *you* trigger to *your* chosen provider.
- API keys live in the plugin's `data.json` inside your vault. **Do not commit `data.json` to a public backup.**
- Every vault write goes through an explicit approval step.

---

## 🗺️ Roadmap

- Web fetch & directed read tools (agents reach beyond the vault)
- Drag-and-drop brainstorming stage in the office
- Squad architect (describe a goal → generate the whole team + workflow)
- Streaming responses, i18n (PT/EN)
- Persona packs & an agent validator

---

## 🛠️ Development

```bash
npm install
npm run dev     # watch build
npm test        # Vitest (PURE core)
npm run build   # typecheck + production bundle
```

Architecture: PURE, testable core (`src/agency`, `src/brainstorm`, `src/squad`, `src/canvas`, `src/context`, `src/registry`) + thin Obsidian view/command layer in `src/main.ts`. ~95 tests cover the core.

---

<div align="center">

**Made for people who live in their vault.**
Built with [Obsidian](https://obsidian.md) · MIT License

</div>
