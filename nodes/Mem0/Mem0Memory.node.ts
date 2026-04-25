/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-this-alias */
import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { mem0ApiRequest, extractResults } from './GenericFunctions';
import type { IMem0Memory } from './types';

// ── LangChain message type loading ───────────────────────────────────────────
// Falls back to minimal shims so the node works even if @langchain/core is
// not directly resolvable from the community-node install path.
let HumanMessage: any, AIMessage: any, SystemMessage: any;
(function () {
	const candidates = ['@langchain/core/messages', 'langchain/messages'];
	for (const mod of candidates) {
		try {
			const m = require(mod);
			if (m && m.HumanMessage) {
				HumanMessage = m.HumanMessage;
				AIMessage = m.AIMessage;
				SystemMessage = m.SystemMessage || m.HumanMessage;
				return;
			}
		} catch {
			/* continue */
		}
	}
	class BaseMsg {
		content: string;
		lc_namespace = ['langchain_core', 'messages'];
		lc_serializable = true;
		additional_kwargs = {};
		constructor(content: string) {
			this.content = content;
		}
	}
	HumanMessage = class extends BaseMsg {
		_getType() { return 'human'; }
		get type() { return 'human'; }
	};
	AIMessage = class extends BaseMsg {
		_getType() { return 'ai'; }
		get type() { return 'ai'; }
	};
	SystemMessage = class extends BaseMsg {
		_getType() { return 'system'; }
		get type() { return 'system'; }
	};
})();

// ── Session key resolver ─────────────────────────────────────────────────────
function resolveSessionKey(ctx: any, itemIndex: number): string {
	const sessionIdType = ctx.getNodeParameter('sessionIdType', itemIndex, 'fromInput');
	if (sessionIdType === 'customKey') {
		return String(ctx.getNodeParameter('sessionKey', itemIndex, '') || `session_${ctx.getNode().id}`);
	}
	try {
		const items = ctx.getInputData();
		const item = items && (items[itemIndex] || items[0]);
		const json = item && item.json;
		if (json) {
			const key = json.runId || json.run_id || json.sessionId || json.session_id || json.chatId;
			if (key) return String(key);
		}
	} catch {
		/* ignore */
	}
	return `session_${ctx.getNode().id}`;
}

// ── Hybrid retrieval helpers (ported from @surreal7) ─────────────────────────
const LN2 = Math.log(2);

function idOf(m: any): string {
	return m.id || m.uuid || m._id || m.memory_id || m.pk || JSON.stringify(m).slice(0, 1000);
}
function createdOf(m: any): string | undefined {
	return m.created_at || m.createdAt || m.timestamp || m.time || m.date;
}
function scoreOf(m: any): number {
	return m.score ?? m.similarity ?? m.relevance ?? m.rank ?? 1;
}
function calcRecency(m: any, now: number, halfLife: number, fallback: number): number {
	const created = createdOf(m);
	if (created) {
		const t = new Date(created).getTime();
		if (!isNaN(t)) {
			const ageH = Math.max(0, (now - t) / 3600000);
			return Math.exp(-LN2 * (ageH / Math.max(1, halfLife)));
		}
	}
	return fallback;
}

interface ScoredEntry {
	m: IMem0Memory;
	semanticScore: number;
	recencyScore: number;
	hybrid: number;
}

function mergeAndScore(
	semMemories: IMem0Memory[],
	recents: IMem0Memory[],
	alpha: number,
	halfLife: number,
): ScoredEntry[] {
	const now = Date.now();
	const merged = new Map<string, ScoredEntry>();

	for (const m of semMemories) {
		const id = idOf(m);
		const recency = calcRecency(m, now, halfLife, 0.5);
		const sem = Number(scoreOf(m));
		merged.set(id, { m, semanticScore: sem, recencyScore: recency, hybrid: alpha * sem + (1 - alpha) * recency });
	}

	for (const m of recents) {
		const id = idOf(m);
		const recency = calcRecency(m, now, halfLife, 0.7);
		const prev = merged.get(id);
		const sem = prev?.semanticScore ?? 0;
		const hybrid = alpha * sem + (1 - alpha) * recency;
		merged.set(id, { m: prev?.m ?? m, semanticScore: sem, recencyScore: recency, hybrid });
	}

	return Array.from(merged.values());
}

function applyMMR(ranked: ScoredEntry[], maxReturn: number, mmrLambda: number): ScoredEntry[] {
	if (ranked.length <= 2) return ranked.slice(0, maxReturn);
	const selected: ScoredEntry[] = [];
	const rest = [...ranked];
	selected.push(rest.shift()!);

	while (selected.length < Math.min(maxReturn, ranked.length) && rest.length) {
		let bestIdx = 0;
		let bestScore = -Infinity;
		for (let i = 0; i < rest.length; i++) {
			const cand = rest[i];
			const rel = cand.hybrid;
			const sim = Math.max(...selected.map(s => 1 - Math.abs(s.hybrid - cand.hybrid)));
			const mmrScore = mmrLambda * rel - (1 - mmrLambda) * sim;
			if (mmrScore > bestScore) {
				bestScore = mmrScore;
				bestIdx = i;
			}
		}
		selected.push(rest.splice(bestIdx, 1)[0]);
	}
	return selected;
}

function memoryToContent(m: IMem0Memory): string {
	return m.memory ?? m.text ?? m.content ?? JSON.stringify(m);
}

// ── Module-level retrieval function (called from supplyData closures) ────────
async function _loadWithRetrievalMode(
	ctx: ISupplyDataFunctions,
	retrievalMode: string,
	memParams: Record<string, string>,
	adv: any,
	query: string,
	contextWindowLength: number,
): Promise<any[]> {
	if (retrievalMode === 'semantic' || retrievalMode === 'semanticV2' || retrievalMode === 'hybrid') {
		const body: any = { query };
		if (memParams.user_id) body.user_id = memParams.user_id;
		if (memParams.agent_id) body.agent_id = memParams.agent_id;
		if (memParams.run_id) body.run_id = memParams.run_id;
		const limit = Number(adv.topK || 0);
		if (limit > 0) body.limit = limit;
		if (adv.rerank !== undefined) body.rerank = Boolean(adv.rerank);
		if (typeof adv.fields === 'string' && adv.fields) {
			body.fields = adv.fields.split(',').map((f: string) => f.trim());
		}
		if (retrievalMode === 'semanticV2' || retrievalMode === 'hybrid') {
			try {
				const filters = typeof adv.filters === 'string' ? JSON.parse(adv.filters) : (adv.filters || {});
				body.filters = filters;
			} catch {
				/* ignore parse errors */
			}
		}

		const semRes = await mem0ApiRequest.call(ctx, 'POST', '/search', body);
		const semMemories: IMem0Memory[] = extractResults(semRes).slice(0, limit > 0 ? limit : undefined);

		if (retrievalMode === 'hybrid') {
			// Fetch recent memories
			const qs: any = { ...memParams };
			const recRes = await mem0ApiRequest.call(ctx, 'GET', '/memories', {}, qs);
			let recents: IMem0Memory[] = extractResults(recRes);
			const lastN = Number(adv.lastN ?? 20);
			if (lastN > 0) recents = recents.slice(-lastN);

			const alpha = Number(adv.alpha ?? 0.65);
			const halfLife = Number(adv.halfLifeHours ?? 48);
			const maxReturn = Number(adv.maxReturn ?? 30);
			const mmr = adv.mmr !== undefined ? Boolean(adv.mmr) : true;
			const mmrLambda = Number(adv.mmrLambda ?? 0.5);

			let ranked = mergeAndScore(semMemories, recents, alpha, halfLife);
			ranked.sort((a, b) => b.hybrid - a.hybrid);

			if (mmr) {
				ranked = applyMMR(ranked, maxReturn, mmrLambda);
			}

			return ranked.slice(0, maxReturn).map(r =>
				new SystemMessage(memoryToContent(r.m)),
			);
		}

		// plain semantic search
		return semMemories.map(m => new SystemMessage(memoryToContent(m)));
	}

	// basic or summary mode
	const qs: any = { ...memParams };
	const res = await mem0ApiRequest.call(ctx, 'GET', '/memories', {}, qs);
	let memories: IMem0Memory[] = extractResults(res);
	if (adv.lastN && Number(adv.lastN) > 0) {
		memories = memories.slice(-Number(adv.lastN));
	}

	if (retrievalMode === 'summary') {
		const text = memories.map(m => memoryToContent(m)).join('\n');
		return [new SystemMessage(`Summary of memories:\n${text}`)];
	}

	// basic: use context window and preserve roles
	if (contextWindowLength > 0) {
		memories = memories.slice(-contextWindowLength * 2);
	}
	return memories.map((m) => {
		const content = memoryToContent(m);
		const role = (m.metadata && (m.metadata as any).role) || (m as any).role || 'system';
		if (role === 'user' || role === 'human') return new HumanMessage(content);
		if (role === 'assistant' || role === 'ai') return new AIMessage(content);
		return new SystemMessage(content);
	});
}

// ── Node class ───────────────────────────────────────────────────────────────
export class Mem0Memory implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Mem0 Chat Memory',
		name: 'mem0Memory',
		icon: 'file:mem0.svg',
		group: ['transform'],
		version: 1,
		description: 'Store and retrieve chat conversation history using Mem0. Connect the "ai_memory" output to an AI Agent memory input.',
		defaults: { name: 'Mem0 Chat Memory' },
		inputs: [],
		outputs: [NodeConnectionTypes.AiMemory],
		outputNames: ['Memory'],
		credentials: [
			{ name: 'mem0SelfHostedApi', required: true },
		],
		codex: {
			categories: ['AI'],
			subcategories: { AI: ['Memory'] },
			resources: { primaryDocumentation: [{ url: 'https://docs.mem0.ai/' }] },
		},
		properties: [
			{
				displayName: 'Session ID Type',
				name: 'sessionIdType',
				type: 'options',
				options: [
					{
						name: 'Take from Previous Node Automatically',
						value: 'fromInput',
						description: 'Reads runId / sessionId / chatId from the incoming node data',
					},
					{
						name: 'Define Below',
						value: 'customKey',
						description: 'Provide your own session key (supports expressions)',
					},
				],
				default: 'fromInput',
				description: 'How to determine the session identifier (run_id) used to scope chat history in Mem0',
			},
			{
				displayName: 'Session Key',
				name: 'sessionKey',
				type: 'string',
				default: '',
				displayOptions: { show: { sessionIdType: ['customKey'] } },
				description: 'Unique identifier for this conversation session. Maps to run_id in Mem0.',
				placeholder: '={{ $json.message.chat.id }}',
			},
			{
				displayName: 'Agent ID',
				name: 'agentId',
				type: 'string',
				default: '',
				required: true,
				description: 'Unique identifier for the agent using this memory. All memories are scoped to this agent.',
				placeholder: 'my_sales_agent',
			},
			{
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				default: '',
				description: 'Optional user ID to further scope memories to a specific user (useful for multi-user agents)',
				placeholder: 'user_123',
			},
			{
				displayName: 'Retrieval Mode',
				name: 'retrievalMode',
				type: 'options',
				options: [
					{ name: 'Basic', value: 'basic', description: 'Returns raw recent memories' },
					{ name: 'Summary', value: 'summary', description: 'Returns a joined text summary' },
					{ name: 'Semantic', value: 'semantic', description: 'Semantic search with optional rerank' },
					{ name: 'Semantic With Filters', value: 'semanticV2', description: 'Semantic search with filters' },
					{ name: 'Hybrid', value: 'hybrid', description: 'Combines semantic search + recents with time-decay scoring and MMR diversity' },
				],
				default: 'basic',
			},
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				default: '={{ $json.query || $json.lastUserMessage || "" }}',
				description: 'Natural language query for semantic retrieval modes',
				displayOptions: { show: { retrievalMode: ['semantic', 'semanticV2', 'hybrid'] } },
			},
			{
				displayName: 'Context Window Length',
				name: 'contextWindowLength',
				type: 'number',
				default: 10,
				typeOptions: { minValue: 0 },
				description: 'Number of recent messages to load (0 = all). Each exchange counts as 2.',
				displayOptions: { show: { retrievalMode: ['basic'] } },
			},
			{
				displayName: 'Advanced',
				name: 'advanced',
				type: 'collection',
				placeholder: 'Options',
				default: {},
				options: [
					{ displayName: 'Run ID', name: 'runId', type: 'string', default: '' },
					{
						displayName: 'Limit', name: 'topK', type: 'number',
						typeOptions: { minValue: 1 }, default: 25,
						description: 'Number of memories to retrieve (semantic/hybrid modes)',
					},
					{
						displayName: 'Rerank', name: 'rerank', type: 'boolean', default: true,
						description: 'Rerank results for better relevance',
						displayOptions: { show: { '/retrievalMode': ['semantic', 'semanticV2', 'hybrid'] } },
					},
					{
						displayName: 'Fields (comma-separated)', name: 'fields', type: 'string', default: '',
						description: 'Specific fields to return from the API',
						displayOptions: { show: { '/retrievalMode': ['semantic', 'semanticV2', 'hybrid'] } },
					},
					{
						displayName: 'Filters (JSON)', name: 'filters', type: 'json', default: '{}',
						description: 'Advanced filter object for search',
						displayOptions: { show: { '/retrievalMode': ['semanticV2', 'hybrid'] } },
					},
					{
						displayName: 'Last N (recents)', name: 'lastN', type: 'number', default: 20,
						description: 'Limit recent memories count',
						displayOptions: { show: { '/retrievalMode': ['basic', 'summary', 'hybrid'] } },
					},
					{
						displayName: 'Alpha (semantic weight)', name: 'alpha', type: 'number',
						typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 }, default: 0.65,
						description: 'Weight of semantic relevance in hybrid scoring',
						displayOptions: { show: { '/retrievalMode': ['hybrid'] } },
					},
					{
						displayName: 'Half-life (hours)', name: 'halfLifeHours', type: 'number',
						typeOptions: { minValue: 1 }, default: 48,
						description: 'Half-life in hours for time-decay calculation',
						displayOptions: { show: { '/retrievalMode': ['hybrid'] } },
					},
					{
						displayName: 'Max Return', name: 'maxReturn', type: 'number',
						typeOptions: { minValue: 1 }, default: 30,
						description: 'Final number of memories returned to the agent',
						displayOptions: { show: { '/retrievalMode': ['hybrid'] } },
					},
					{
						displayName: 'MMR (diversity)', name: 'mmr', type: 'boolean', default: true,
						description: 'Apply Maximal Marginal Relevance for result diversity',
						displayOptions: { show: { '/retrievalMode': ['hybrid'] } },
					},
					{
						displayName: 'MMR Lambda', name: 'mmrLambda', type: 'number',
						typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 }, default: 0.5,
						description: 'Balance between relevance and diversity in MMR',
						displayOptions: { show: { '/retrievalMode': ['hybrid'] } },
					},
				],
			},
		],
	};

	// ── supplyData: called by AI Agent to get memory object ──────────────
	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const self: ISupplyDataFunctions = this;
		const sessionKey = resolveSessionKey(this, itemIndex);
		const agentId = (this.getNodeParameter('agentId', itemIndex, '') as string) || '';
		const userId = (this.getNodeParameter('userId', itemIndex, '') as string) || '';
		const retrievalMode = (this.getNodeParameter('retrievalMode', itemIndex, 'basic') as string);
		const contextWindowLength = Number(this.getNodeParameter('contextWindowLength', itemIndex, 10));
		const adv = (this.getNodeParameter('advanced', itemIndex, {}) || {}) as any;
		const query = (this.getNodeParameter('query', itemIndex, '') as string) || '';

		function buildMemParams(): Record<string, string> {
			const p: Record<string, string> = { run_id: sessionKey };
			if (userId) p.user_id = userId;
			if (agentId) p.agent_id = agentId;
			return p;
		}

		const memoryObj = {
			memoryKeys: ['chat_history'],
			chatHistory: {
				async getMessages() {
					try {
						return await _loadWithRetrievalMode(
							self, retrievalMode, buildMemParams(), adv, query, contextWindowLength,
						);
					} catch {
						return [];
					}
				},
				async addUserMessage(message: string) {
					try {
						await mem0ApiRequest.call(self, 'POST', '/memories', {
							messages: [{ role: 'user', content: String(message) }],
							infer: false,
							metadata: { source: 'agent_interaction' },
							...buildMemParams(),
						});
					} catch {
						/* ignore */
					}
				},
				async addAIChatMessage(message: string) {
					try {
						await mem0ApiRequest.call(self, 'POST', '/memories', {
							messages: [{ role: 'assistant', content: String(message) }],
							infer: false,
							metadata: { source: 'agent_interaction' },
							...buildMemParams(),
						});
					} catch {
						/* ignore */
					}
				},
				async clear() {
					/* Intentionally no-op: do not let an agent-triggered clear delete persisted memories. */
				},
			},

			async loadMemoryVariables(_values: any) {
				let runIndex = 0;
				try {
					const { index } = self.addInputData('ai_memory', [[{ json: { action: 'loadMemoryVariables', values: _values } }]]);
					runIndex = index;
				} catch {
					/* addInputData may not exist in older n8n versions */
				}
				// For semantic retrieval modes, the query should come from the current
				// user input passed by the AI Agent, falling back to the static node parameter.
				const effectiveQuery = ((_values?.input || _values?.query) as string) || query;
				try {
					const messages = await _loadWithRetrievalMode(
						self, retrievalMode, buildMemParams(), adv, effectiveQuery, contextWindowLength,
					);
					const response = { chat_history: messages };
					try {
						self.addOutputData('ai_memory', runIndex, [[{ json: { action: 'loadMemoryVariables', chatHistory: messages } }]]);
					} catch {
						/* ignore */
					}
					return response;
				} catch (err: any) {
					try {
						self.addOutputData('ai_memory', runIndex, [[{ json: { action: 'loadMemoryVariables', error: err?.message ?? String(err), chatHistory: [] } }]]);
					} catch {
						/* ignore */
					}
					// Re-throw so the AI Agent sees the error rather than silently getting empty memory
					throw err;
				}
			},

			async saveContext(inputValues: any, outputValues: any) {
				let runIndex = 0;
				try {
					const { index } = self.addInputData('ai_memory', [[{ json: { action: 'saveContext', input: inputValues, output: outputValues } }]]);
					runIndex = index;
				} catch {
					/* ignore */
				}
				try {
					const messages: { role: string; content: string }[] = [];
					const userInput = inputValues && (inputValues.input || inputValues.human_input || inputValues.query || inputValues.chatInput);
					const aiOutput = outputValues && (outputValues.output || outputValues.response || outputValues.text);
					if (userInput) messages.push({ role: 'user', content: String(userInput) });
					if (aiOutput) messages.push({ role: 'assistant', content: String(aiOutput) });
					if (messages.length === 0) {
						try { self.addOutputData('ai_memory', runIndex, [[{ json: { action: 'saveContext', skipped: true } }]]); } catch { /* ignore */ }
						return;
					}
					await mem0ApiRequest.call(self, 'POST', '/memories', {
						messages,
						infer: false,
						metadata: { source: 'agent_interaction' },
						...buildMemParams(),
					});
					try { self.addOutputData('ai_memory', runIndex, [[{ json: { action: 'saveContext', saved: messages.length } }]]); } catch { /* ignore */ }
				} catch {
					try { self.addOutputData('ai_memory', runIndex, [[{ json: { action: 'saveContext', error: 'failed' } }]]); } catch { /* ignore */ }
				}
			},

			async clear() {
				/* Intentionally no-op: do not let an agent-triggered clear delete persisted memories. */
			},
		};

		return { response: memoryObj };
	}

	// ── execute fallback ─────────────────────────────────────────────────
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		return [items.map((_item, i) => ({
			json: {
				message: 'Mem0 Chat Memory is ready. Connect the "ai_memory" output to an AI Agent node.',
				sessionKey: resolveSessionKey(this, i),
			},
		}))];
	}
}
