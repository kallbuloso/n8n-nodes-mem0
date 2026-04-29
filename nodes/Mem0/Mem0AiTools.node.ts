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

const { DynamicStructuredTool } = require('@langchain/core/tools');

// ── Helper types ─────────────────────────────────────────────────────────────
function jsonSchema(properties: Record<string, any>, required: string[] = []) {
	return {
		type: 'object',
		properties,
		required,
		additionalProperties: false,
	};
}

function stringProp(description: string) {
	return { type: 'string', description };
}

function numberProp(description: string) {
	return { type: 'number', description };
}

function objectProp(description: string) {
	return { type: 'object', description, additionalProperties: true };
}

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
			resources: {
				primaryDocumentation: [{ url: 'https://docs.mem0.ai/open-source/features/rest-api' }],
			},
		},
		properties: [
			{
				displayName: 'Agent ID',
				name: 'agentId',
				type: 'string',
				default: '',
				description: 'Optional agent ID to scope memories to a specific agent',
				placeholder: 'my_agent',
			},
			{
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				default: '',
				description: 'Default user ID to scope all memory operations. Can be overridden per tool call.',
				placeholder: 'user_123',
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
						displayName: 'Limit (topK)',
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
				schema: jsonSchema({
					query: stringProp('Natural language search query'),
					user_id: stringProp('Override the default user ID'),
					agent_id: stringProp('Override the default agent ID'),
					run_id: stringProp('Override the default run/session ID'),
					limit: numberProp(`Max results to return (default: ${topKDefault})`),
					top_k: numberProp('Legacy alias for limit'),
					filters: objectProp('Additional filters as key-value pairs'),
				}, ['query']),
				func: async ({ query, user_id, agent_id, run_id, limit, top_k, filters }: any = {}) => {
					const runIndex = startToolRun({ tool: 'mem0_search_memory', query, user_id: user_id || userId });
					log('debug', '[Mem0] mem0_search_memory called', { query });
					try {
						const body: any = { query: query || '', ...buildBaseParams() };
						if (user_id) body.user_id = user_id;
						if (agent_id) body.agent_id = agent_id;
						if (run_id) body.run_id = run_id;
						const effectiveLimit = Number(limit ?? top_k ?? topKDefault);
						if (effectiveLimit > 0) body.limit = effectiveLimit;
						if (searchOptions.rerank !== undefined) body.rerank = Boolean(searchOptions.rerank);
						if (filters) body.filters = filters;
						const result = await mem0ApiRequest.call(self, 'POST', '/search', body);
						const memories = extractResults(result).slice(
							0,
							effectiveLimit > 0 ? effectiveLimit : undefined,
						);
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
				schema: jsonSchema({
					content: stringProp('Text content to remember'),
					role: {
						type: 'string',
						description: '"user" | "assistant" | "system" (default: "user")',
						enum: ['user', 'assistant', 'system'],
					},
					user_id: stringProp('Override the default user ID'),
					agent_id: stringProp('Override the default agent ID'),
					run_id: stringProp('Override the default run/session ID'),
					metadata: objectProp('Additional metadata tags as key-value pairs'),
				}, ['content']),
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
				schema: jsonSchema({
					user_id: stringProp('Override the default user ID'),
					agent_id: stringProp('Filter by agent ID'),
					run_id: stringProp('Filter by session/run ID'),
				}),
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
				schema: jsonSchema({
					memory_id: stringProp('The unique ID of the memory to delete'),
				}, ['memory_id']),
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
				schema: jsonSchema({
					memory_id: stringProp('The unique ID of the memory'),
				}, ['memory_id']),
				func: async ({ memory_id }: any = {}) => {
					const runIndex = startToolRun({ tool: 'mem0_get_memory_history', memory_id });
					try {
						if (!memory_id) {
							const errObj = { error: 'memory_id is required' };
							endToolRun(runIndex, errObj);
							return JSON.stringify(errObj);
						}
						const result = await mem0ApiRequest.call(self, 'GET', `/memories/${memory_id}/history`);
						const history = extractResults(result);
						const observationResult = { history, count: history.length };
						endToolRun(runIndex, observationResult);
						return JSON.stringify(history);
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
