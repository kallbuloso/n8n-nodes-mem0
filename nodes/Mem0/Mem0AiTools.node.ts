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

// ── Zod loading ──────────────────────────────────────────────────────────────
let z: any = null;
try { z = require('zod'); } catch { /* no zod */ }

// ── DynamicStructuredTool loading ────────────────────────────────────────────
let DynamicStructuredTool: any;
(function () {
	const candidates = ['@langchain/core/tools', 'langchain/tools'];
	for (const mod of candidates) {
		try {
			const exported = require(mod);
			if (exported && exported.DynamicStructuredTool) {
				DynamicStructuredTool = exported.DynamicStructuredTool;
				return;
			}
		} catch {
			/* continue */
		}
	}
	// Minimal shim satisfying the structured-tool contract used by n8n AI Agent
	DynamicStructuredTool = class DynamicStructuredToolShim {
		name: string;
		description: string;
		schema: any;
		func: any;
		returnDirect = false;
		verbose = false;
		lc_namespace = ['langchain_core', 'tools'];
		lc_serializable = true;

		constructor({ name, description, schema, func }: any) {
			this.name = name;
			this.description = description;
			this.schema = schema || (z ? z.object({}).passthrough() : null);
			this.func = func;
		}
		async invoke(input: any) {
			const inputObj = typeof input === 'string'
				? (() => { try { return JSON.parse(input); } catch { return { input }; } })()
				: (input || {});
			return this.func(inputObj);
		}
		async call(arg: any) {
			return this.invoke(arg);
		}
		_type() { return 'structured'; }
	};
})();

// ── Helper types ─────────────────────────────────────────────────────────────
function strOpt(desc: string) { return z ? z.string().optional().describe(desc) : undefined; }
function numOpt(desc: string) { return z ? z.number().optional().describe(desc) : undefined; }
function recOpt(desc: string) { return z ? z.record(z.any()).optional().describe(desc) : undefined; }

// ── Node class ───────────────────────────────────────────────────────────────
export class Mem0AiTools implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Mem0 AI Tools',
		name: 'mem0AiTools',
		icon: 'file:mem0.svg',
		group: ['transform'],
		version: 1,
		description: 'Provides Mem0 memory tools (search, add, get, delete) to an AI Agent node',
		defaults: { name: 'Mem0 AI Tools' },
		inputs: [],
		outputs: [NodeConnectionTypes.AiTool],
		outputNames: ['Tool'],
		credentials: [
			{ name: 'mem0SelfHostedApi', required: true },
		],
		codex: {
			categories: ['AI'],
			subcategories: { AI: ['Tools', 'Agents & LLMs'] },
			resources: { primaryDocumentation: [{ url: 'https://docs.mem0.ai/' }] },
		},
		properties: [
			{
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				default: '',
				description: 'Default user ID to scope all memory operations. Can be overridden per tool call.',
				placeholder: 'user_123',
			},
			{
				displayName: 'Agent ID',
				name: 'agentId',
				type: 'string',
				default: '',
				description: 'Optional agent ID to scope memories to a specific agent',
				placeholder: 'my_agent',
			},
			{
				displayName: 'Run ID',
				name: 'runId',
				type: 'string',
				default: '',
				description: 'Optional run/session ID to scope memories to a specific session',
				placeholder: 'session_001',
			},
			{
				displayName: 'Tools to Enable',
				name: 'enabledTools',
				type: 'multiOptions',
				options: [
					{ name: 'Search Memory', value: 'search', description: 'Search memories using semantic similarity' },
					{ name: 'Add Memory', value: 'add', description: 'Store a new memory or conversation turn' },
					{ name: 'Get All Memories', value: 'getAll', description: 'Retrieve all stored memories for a user' },
					{ name: 'Delete Memory', value: 'delete', description: 'Delete a specific memory by its ID' },
					{ name: 'Get Memory History', value: 'history', description: 'Get the change history of a specific memory' },
				],
				default: ['search', 'add', 'getAll'],
				description: 'Select which tools to expose to the AI Agent',
			},
			{
				displayName: 'Tool Description',
				name: 'toolDescription',
				type: 'string',
				default: 'Interact with Mem0 memory storage: search, add, retrieve, and delete memories for AI agents',
				description: 'Describe the tool to help the AI agent understand when and how to use it',
				typeOptions: { rows: 3 },
			},
			{
				displayName: 'Search Options',
				name: 'searchOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { enabledTools: ['search'] } },
				options: [
					{
						displayName: 'Top K',
						name: 'topK',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 10,
						description: 'Maximum number of memories to return per search',
					},
					{
						displayName: 'Rerank Results',
						name: 'rerank',
						type: 'boolean',
						default: false,
						description: 'Enable intelligent reranking to improve result relevance',
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const self: ISupplyDataFunctions = this;
		const userId = (this.getNodeParameter('userId', itemIndex, '') as string) || '';
		const agentId = (this.getNodeParameter('agentId', itemIndex, '') as string) || '';
		const runId = (this.getNodeParameter('runId', itemIndex, '') as string) || '';
		const enabledTools = this.getNodeParameter('enabledTools', itemIndex, ['search', 'add', 'getAll']) as string[];
		const searchOptions = (this.getNodeParameter('searchOptions', itemIndex, {}) || {}) as any;

		function buildBaseParams() {
			const params: Record<string, string> = {};
			if (userId) params.user_id = userId;
			if (agentId) params.agent_id = agentId;
			if (runId) params.run_id = runId;
			return params;
		}

		function log(level: string, message: string, meta?: any) {
			try {
				const logger = (self as any).logger;
				if (logger && typeof logger[level] === 'function') {
					logger[level](message, meta);
				}
			} catch { /* ignore */ }
		}

		function startToolRun(inputPayload: any): number {
			try {
				const { index } = self.addInputData('ai_tool', [[{ json: inputPayload }]]);
				return index;
			} catch { return 0; }
		}

		function endToolRun(runIndex: number, data: any) {
			try {
				const json = (data !== null && typeof data === 'object' && !Array.isArray(data)) ? data : { result: data };
				self.addOutputData('ai_tool', runIndex, [[{ json }]]);
			} catch { /* ignore */ }
		}

		const tools: any[] = [];

		// ── Tool: mem0_search_memory ──────────────────────────────────
		if (Array.isArray(enabledTools) && enabledTools.includes('search')) {
			const topKDefault = searchOptions.topK || 10;
			tools.push(new DynamicStructuredTool({
				name: 'mem0_search_memory',
				description: 'Search Mem0 memories using semantic similarity. Returns relevant memory objects.',
				schema: z ? z.object({
					query: z.string().describe('Natural language search query'),
					user_id: strOpt('Override the default user ID'),
					agent_id: strOpt('Override the default agent ID'),
					run_id: strOpt('Override the default run/session ID'),
					top_k: numOpt(`Max results to return (default: ${topKDefault})`),
					filters: recOpt('Additional filters as key-value pairs'),
				}) : null,
				func: async ({ query, user_id, agent_id, run_id, top_k, filters }: any = {}) => {
					const runIndex = startToolRun({ tool: 'mem0_search_memory', query, user_id: user_id || userId });
					log('debug', '[Mem0] mem0_search_memory called', { query });
					try {
						const body: any = { query: query || '', ...buildBaseParams() };
						if (user_id) body.user_id = user_id;
						if (agent_id) body.agent_id = agent_id;
						if (run_id) body.run_id = run_id;
						body.top_k = top_k != null ? Number(top_k) : Number(topKDefault);
						if (searchOptions.rerank !== undefined) body.rerank = Boolean(searchOptions.rerank);
						if (filters) body.filters = filters;
						const result = await mem0ApiRequest.call(self, 'POST', '/search', body);
						const memories = extractResults(result);
						const observationResult = { memories, count: memories.length };
						endToolRun(runIndex, observationResult);
						return JSON.stringify(memories);
					} catch (err: any) {
						const errObj = { error: err.message || String(err) };
						endToolRun(runIndex, errObj);
						return JSON.stringify(errObj);
					}
				},
			}));
		}

		// ── Tool: mem0_add_memory ────────────────────────────────────
		if (Array.isArray(enabledTools) && enabledTools.includes('add')) {
			tools.push(new DynamicStructuredTool({
				name: 'mem0_add_memory',
				description: 'Save a new memory or conversation turn to Mem0. Returns the saved memory object.',
				schema: z ? z.object({
					content: z.string().describe('Text content to remember'),
					role: strOpt('"user" | "assistant" | "system" (default: "user")'),
					user_id: strOpt('Override the default user ID'),
					agent_id: strOpt('Override the default agent ID'),
					run_id: strOpt('Override the default run/session ID'),
					metadata: recOpt('Additional metadata tags as key-value pairs'),
				}) : null,
				func: async ({ content, role, user_id, agent_id, run_id, metadata }: any = {}) => {
					const runIndex = startToolRun({ tool: 'mem0_add_memory', content, role: role || 'user' });
					try {
						const body: any = { messages: [{ role: role || 'user', content: content || '' }], ...buildBaseParams() };
						if (user_id) body.user_id = user_id;
						if (agent_id) body.agent_id = agent_id;
						if (run_id) body.run_id = run_id;
						if (metadata) body.metadata = metadata;
						const result = await mem0ApiRequest.call(self, 'POST', '/memories', body);
						endToolRun(runIndex, result);
						return JSON.stringify(result);
					} catch (err: any) {
						const errObj = { error: err.message || String(err) };
						endToolRun(runIndex, errObj);
						return JSON.stringify(errObj);
					}
				},
			}));
		}

		// ── Tool: mem0_get_all_memories ──────────────────────────────
		if (Array.isArray(enabledTools) && enabledTools.includes('getAll')) {
			tools.push(new DynamicStructuredTool({
				name: 'mem0_get_all_memories',
				description: 'Retrieve all stored memories for a user from Mem0. Returns an array of memory objects.',
				schema: z ? z.object({
					user_id: strOpt('Override the default user ID'),
					agent_id: strOpt('Filter by agent ID'),
					run_id: strOpt('Filter by session/run ID'),
				}) : null,
				func: async ({ user_id, agent_id, run_id }: any = {}) => {
					const runIndex = startToolRun({ tool: 'mem0_get_all_memories', user_id: user_id || userId });
					try {
						const qs: any = {};
						const effectiveUserId = user_id || userId;
						if (effectiveUserId) qs.user_id = effectiveUserId;
						if (agent_id || agentId) qs.agent_id = agent_id || agentId;
						if (run_id || runId) qs.run_id = run_id || runId;
						const result = await mem0ApiRequest.call(self, 'GET', '/memories', {}, qs);
						const memories = extractResults(result);
						const observationResult = { memories, count: memories.length };
						endToolRun(runIndex, observationResult);
						return JSON.stringify(memories);
					} catch (err: any) {
						const errObj = { error: err.message || String(err) };
						endToolRun(runIndex, errObj);
						return JSON.stringify(errObj);
					}
				},
			}));
		}

		// ── Tool: mem0_delete_memory ─────────────────────────────────
		if (Array.isArray(enabledTools) && enabledTools.includes('delete')) {
			tools.push(new DynamicStructuredTool({
				name: 'mem0_delete_memory',
				description: 'Delete a specific memory from Mem0 by its ID. Returns a confirmation message.',
				schema: z ? z.object({
					memory_id: z.string().describe('The unique ID of the memory to delete'),
				}) : null,
				func: async ({ memory_id }: any = {}) => {
					const runIndex = startToolRun({ tool: 'mem0_delete_memory', memory_id });
					try {
						if (!memory_id) {
							const errObj = { error: 'memory_id is required' };
							endToolRun(runIndex, errObj);
							return JSON.stringify(errObj);
						}
						const result = await mem0ApiRequest.call(self, 'DELETE', `/memories/${memory_id}`);
						const observationResult = result || { message: 'Memory deleted successfully' };
						endToolRun(runIndex, observationResult);
						return JSON.stringify(observationResult);
					} catch (err: any) {
						const errObj = { error: err.message || String(err) };
						endToolRun(runIndex, errObj);
						return JSON.stringify(errObj);
					}
				},
			}));
		}

		// ── Tool: mem0_get_memory_history ────────────────────────────
		if (Array.isArray(enabledTools) && enabledTools.includes('history')) {
			tools.push(new DynamicStructuredTool({
				name: 'mem0_get_memory_history',
				description: 'Get the change history of a specific memory from Mem0. Returns an array of history entries.',
				schema: z ? z.object({
					memory_id: z.string().describe('The unique ID of the memory'),
				}) : null,
				func: async ({ memory_id }: any = {}) => {
					const runIndex = startToolRun({ tool: 'mem0_get_memory_history', memory_id });
					try {
						if (!memory_id) {
							const errObj = { error: 'memory_id is required' };
							endToolRun(runIndex, errObj);
							return JSON.stringify(errObj);
						}
						const result = await mem0ApiRequest.call(self, 'GET', `/memories/${memory_id}/history`);
						const observationResult = Array.isArray(result) ? { history: result, count: result.length } : result;
						endToolRun(runIndex, observationResult);
						return JSON.stringify(result);
					} catch (err: any) {
						const errObj = { error: err.message || String(err) };
						endToolRun(runIndex, errObj);
						return JSON.stringify(errObj);
					}
				},
			}));
		}

		return { response: tools };
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		for (let i = 0; i < items.length; i++) {
			returnData.push({
				json: {
					message: 'Mem0 AI Tools node is ready. Connect the "ai_tool" output to an AI Agent node.',
					enabledTools: this.getNodeParameter('enabledTools', i, []),
				},
			});
		}
		return [returnData];
	}
}
