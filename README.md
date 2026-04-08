# n8n-nodes-mem0

[![npm version](https://img.shields.io/npm/v/n8n-nodes-mem0)](https://www.npmjs.com/package/n8n-nodes-mem0)
[![npm downloads](https://img.shields.io/npm/dm/n8n-nodes-mem0)](https://www.npmjs.com/package/n8n-nodes-mem0)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

n8n community node package that integrates [Mem0](https://mem0.ai) — an intelligent memory layer for AI agents — into your n8n workflows.

Supports both the **Mem0 cloud** (mem0.ai) and **self-hosted** Mem0 instances.

---

## Nodes Included

| Node | Description |
|---|---|
| **Mem0** | Full CRUD node for managing memories, entities, organizations, projects, and config |
| **Mem0 Chat Memory** | AI Agent memory source — supplies conversation history to an AI Agent node |
| **Mem0 AI Tools** | AI Agent tools provider — exposes search, add, get, delete, and history as callable tools |

---

## Installation

### Via Community Nodes UI (recommended)

1. Open your n8n instance
2. Go to **Settings → Community Nodes**
3. Search for `n8n-nodes-mem0`
4. Click **Install**

### Manual

```bash
npm install n8n-nodes-mem0
```

Then restart your n8n instance.

---

## Credential Setup

### Cloud (mem0.ai)

1. Sign up at [mem0.ai](https://mem0.ai) and obtain an API key
2. In n8n, create a **Mem0 API** credential with:
   - **API Key** (required)
   - **Organization ID** (optional)
   - **Project ID** (optional)

### Self-Hosted

1. Deploy a Mem0 OSS instance (see [mem0 docs](https://docs.mem0.ai/open-source/quickstart))
2. In n8n, create a **Mem0 Self-Hosted API** credential with:
   - **Base URL** (e.g., `http://localhost:8000`)
   - **API Key** (optional, if your instance requires one)

---

## Node Reference

### Mem0 (CRUD)

General-purpose node for managing all Mem0 resources.

**Authentication:** Cloud or Self-Hosted

#### Memory Operations (Cloud & Self-Hosted)

| Operation | Description |
|---|---|
| Add | Store a message or conversation turn as a memory |
| Get | Retrieve a single memory by ID |
| Get All | List all memories for a user/agent/run |
| Search | Semantic search using v1 endpoint |
| Search V2 | Advanced semantic search with filter rules (cloud only) |
| Update | Update a memory's text or metadata |
| Delete | Delete a specific memory by ID |
| Delete All | Delete all memories for a user/agent/run |
| History | Get the change history of a memory |

#### Entity Operations (Cloud)

Manage user, agent, app, and session entities.
Operations: Create, Get, Get All, Update, Delete

#### Organization Operations (Cloud)

Manage organizations with name, slug, description, and metadata.
Operations: Create, Get, Get All, Update, Delete

#### Project Operations (Cloud)

Manage projects within organizations.
Operations: Create, Get, Get All, Update, Delete

#### Config Operations (Self-Hosted)

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
- **Alpha** — weight of semantic relevance vs. recency (0–1, default 0.65)
- **Half-life (hours)** — decay rate for time-based scoring (default 48h)
- **Max Return** — maximum memories returned to the agent (default 30)
- **MMR Lambda** — balance between relevance and diversity (default 0.5)

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

The self-hosted Mem0 instance does not use versioned API prefixes. This package automatically translates cloud endpoints:

- `/v1/memories` → `/memories`
- `/v2/memories/search/` → `/memories/search/`

The Config operations (health, getConfig, switch, configure, reset) are only available for self-hosted instances.

---

## License

[MIT](LICENSE)
