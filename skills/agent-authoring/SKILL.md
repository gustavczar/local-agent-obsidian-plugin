---
name: authoring-local-agents
description: Use when creating or editing agent notes for the Local Agent Office Obsidian plugin — defines the exact frontmatter, body, and ## Connections contract the plugin parses so an agent shows up in the office, lands in the right room, and chats with the right system prompt and context.
---

# Authoring Agents for Local Agent Office

In Local Agent Office, **an agent is just a Markdown note in your vault**. The plugin scans a configured folder, parses each note, and turns it into a worker you can see in the office and chat with 1:1.

This skill documents the exact contract the plugin reads. Follow it and your agent appears automatically — no code, no config files.

## The contract (what the plugin parses)

A note becomes an agent when **both** are true:

1. It lives **under the configured agents folder** (Settings → Local Agent Office → *Agents folder*).
2. Its frontmatter `tags` contains **either** `#sistema/sub-agente` **or** any `#agente/<category>` tag.

From a valid agent note the plugin reads:

| Field | Source | Notes |
|---|---|---|
| **name** | frontmatter `name` | Unique id. Falls back to the file path if missing — always set it. |
| **title** | frontmatter `title` | Display name in the office/chat. Falls back to `name`. |
| **room** | first `#agente/<category>` tag | The office groups agents into rooms by category. No `#agente/*` tag → room `Geral`. The label is shown capitalized (`#agente/strategy` → room **Strategy**). |
| **system prompt** | the note **body** | Everything after the frontmatter, **minus** the `## Connections` section. |
| **connections** | `[[wikilinks]]` in the body | Drawn as lines in the office; their note contents are auto-loaded as context when you chat. |

> The `## Conexões` / `## Connections` heading and everything below it is stripped from the system prompt (so your link list doesn't pollute the agent's instructions) but still parsed for connections.

## Template

```markdown
---
name: sage
title: Sage — The Questioner
tags:
  - "#agente/strategy"
  - "#sistema/sub-agente"
---
You are Sage, a Socratic strategist. [ONE-SENTENCE CORE PURPOSE.]

When invoked:
1. [First action — restate the question in one line]
2. [Core method]
3. [Delivery format]

Rules:
- [A non-negotiable]
- [A style boundary]
- [What to never do]

End with: "[A signature closing line.]"

## Connections
- [[Mental Models MOC]]
- [[Some Related Agent]]
```

## How the pieces map to the office

- **Rooms** come from your `#agente/<category>` tags. Use a consistent vocabulary (`strategy`, `finance`, `content`, `research`…) so related agents share a room.
- **Lines between desks** come from `[[wikilinks]]` in `## Connections`. Link an agent to its MOCs and to other agents it collaborates with.
- **Glow** turns on while that agent is generating a reply — nothing to author, it's automatic.
- **Position** is auto-placed inside the room; drag a desk and the plugin remembers it.

## Context: how an agent "knows" your vault

When you chat with an agent, the plugin builds its prompt from:

1. The note **body** (its system prompt).
2. The **contents of every note it links to** in `## Connections` (its declared knowledge).
3. Any note you **@mention** in the chat input.

So to give an agent expertise, link it to the relevant MOCs/notes. No embeddings, no indexing — the links *are* the knowledge.

## Best practices

- **One clear purpose per agent.** A focused "decision lens" beats a vague "assistant."
- **Write the body as real instructions**, not a description. "You are X. When invoked: 1… 2…" works well.
- **Curate connections.** 2–6 high-signal links (its MOCs + a couple of sibling agents). Don't link everything.
- **Pick categories deliberately** — they become rooms. Fewer, meaningful rooms read better than one room per agent.
- **Keep secrets out.** The body is sent to your chosen model provider; don't paste credentials.

## Troubleshooting — "my agent doesn't show up"

- Note isn't under the configured **agents folder** → fix the path in Settings, or move the note.
- Missing the agent tag → add `#sistema/sub-agente` or a `#agente/<category>` tag.
- No `name` in frontmatter → add one (the plugin works without it but you'll see the file path).
- Edited it and nothing changed → the office watches the vault and reloads on save; re-open the office, or use **Settings → Reload agents**.

## Minimal example

```markdown
---
name: ledger
title: Ledger — The CFO
tags:
  - "#agente/finance"
  - "#sistema/sub-agente"
---
You are Ledger, a pragmatic CFO. You translate ideas into unit economics: LTV, CAC, runway, and the one number that matters.

## Connections
- [[Finance MOC]]
```

See `examples/agents/` in this repo for ready-to-copy starters.
