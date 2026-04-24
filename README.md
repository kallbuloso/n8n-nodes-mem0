# n8n-nodes-mem0

[![npm version](https://img.shields.io/npm/v/@amaralkarl/n8n-nodes-mem0)](https://www.npmjs.com/package/@amaralkarl/n8n-nodes-mem0)
[![npm downloads](https://img.shields.io/npm/dm/@amaralkarl/n8n-nodes-mem0)](https://www.npmjs.com/package/@amaralkarl/n8n-nodes-mem0)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

n8n community node package that integrates [Mem0](https://mem0.ai) â€” an intelligent memory layer for AI agents â€” into your n8n workflows.

Supports **self-hosted Mem0 instances only**.

---

## Nodes Included

| Node | Description |
|---|---|
| **Mem0** | Node for managing memories and self-hosted config/maintenance |
| **Mem0 Chat Memory** | AI Agent memory source â€” supplies conversation history to an AI Agent node |
| **Mem0 AI Tools** | AI Agent tools provider â€” exposes search, add, get, delete, and history as callable tools |

---

## Installation

### Via Community Nodes UI (recommended)

1. Open your n8n instance
2. Go to **Settings â†’ Community Nodes**
3. Search for `@amaralkarl/n8n-nodes-mem0`
4. Click **Install**

### Manual

```bash
npm install @amaralkarl/n8n-nodes-mem0
```

Then restart your n8n instance.

---

## Credential Setup

1. Deploy a Mem0 OSS instance (see [mem0 docs](https://docs.mem0.ai/open-source/quickstart))
2. In n8n, create a **Mem0 Self-Hosted API** credential with:
   - **Base URL** (e.g., `http://localhost:8000`)
   - **API Key** (optional, if your instance requires one)

---

## Node Reference

### Mem0 (CRUD)

General-purpose node for managing memories and self-hosted config/maintenance.

#### Memory Operations

| Operation | Description |
|---|---|
| Add | Store a message or conversation turn as a memory |
| Get | Retrieve a single memory by ID |
| Get All | List all memories for a user/agent/run |
| Search | Semantic search using v1 endpoint |
| Update | Update a memory's text or metadata |
| Delete | Delete a specific memory by ID |
| Delete All | Delete all memories for a user/agent/run |
| History | Get the change history of a memory |

#### Config Operations

| Operation | Description |
|---|---|
| Health | Check instance health |
| Get Config | Retrieve current configuration |
| Switch | Switch between LLM providers (gemini, openrouter, nvidia, qwen) |
| Configure | Full configuration update via JSON |
| Reset | Reset configuration to defaults |

---

### Mem0 Chat Memory

Supplies conversation history to an **AI Agent** node as a memory source.

Connect the **Memory** output to the AI Agent's memory input.

**Retrieval Modes:**

| Mode | Description |
|---|---|
| Basic | Returns the last N raw memories, preserving role (user/assistant/system) |
| Summary | Returns a single summarized text block of all memories |
| Semantic (v1) | Semantic similarity search using the v1 `/memories/search/` endpoint |
| Semantic (v2) | Advanced semantic search with metadata filters via the v2 endpoint |
| Hybrid | Combines semantic v2 + recent memories, scored with time-decay and MMR diversity |

**Hybrid mode parameters:**
- **Alpha** â€” weight of semantic relevance vs. recency (0â€“1, default 0.65)
- **Half-life (hours)** â€” decay rate for time-based scoring (default 48h)
- **Max Return** â€” maximum memories returned to the agent (default 30)
- **MMR Lambda** â€” balance between relevance and diversity (default 0.5)

**Session ID:** Automatically reads `runId`, `sessionId`, or `chatId` from the incoming node data, or you can define a custom key (supports n8n expressions).

---

### Mem0 AI Tools

Exposes Mem0 operations as callable tools for an **AI Agent** node.

Connect the **Tool** output to the AI Agent's tool input. The agent will decide when and how to call each tool.

**Available Tools:**

| Tool | Description |
|---|---|
| `mem0_search_memory` | Semantic search for relevant memories |
| `mem0_add_memory` | Save new content as a memory |
| `mem0_get_all_memories` | Retrieve all memories for a user/agent |
| `mem0_delete_memory` | Delete a memory by ID |
| `mem0_get_memory_history` | Get the change history of a memory |

All tools accept optional `user_id`, `agent_id`, and `run_id` overrides per call.

---

## Self-Hosted Notes

The self-hosted Mem0 instance does not use versioned API prefixes. This package automatically translates versioned endpoints:

- `/v1/memories` â†’ `/memories`
- `/v1/memories/search/` -> `/search`
- `/v2/memories/search/` -> `/search`

The Config operations (health, getConfig, switch, configure, reset) are available for self-hosted instances.

---

## License

[MIT](LICENSE)
