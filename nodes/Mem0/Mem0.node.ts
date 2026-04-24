import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { mem0ApiRequest, buildKeyValueFromCollection, normalizeFilterValue } from './GenericFunctions';
import { memoryOperations, memoryFields } from './descriptions/MemoryDescription';
import { configOperations, configFields } from './descriptions/ConfigDescription';

export class Mem0 implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Mem0',
		name: 'mem0',
		icon: 'file:mem0.svg',
		group: ['transform'],
		documentationUrl: 'https://docs.mem0.ai/',
		version: 1,
		description: 'Interact with the Mem0 API – intelligent memory layer for AI',
		defaults: { name: 'Mem0' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{ name: 'mem0SelfHostedApi', required: true },
		],
		codex: {
			categories: ['AI', 'Memory'],
			subcategories: {
				AI: ['Memory', 'Agents & LLMs'],
				Memory: ['AI Memory', 'Persistent Storage'],
			},
			resources: {
				primaryDocumentation: [{ url: 'https://docs.mem0.ai/' }],
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Memory', value: 'memory' },
					{ name: 'Config / Maintenance', value: 'config' },
				],
				default: 'memory',
				description: 'Choose the type of resource to manage',
			},
			// All operations and fields from description files
			...memoryOperations,
			...memoryFields,
			...configOperations,
			...configFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				// ── MEMORY ───────────────────────────────────────────────
				if (resource === 'memory') {
					if (operation === 'add') {
						const messageContent = this.getNodeParameter('messageContent', i) as string;
						const messageType = this.getNodeParameter('messageType', i) as string;
						const userId = this.getNodeParameter('userId', i, '') as string;
						const agentId = this.getNodeParameter('agentId', i, '') as string;
						const runId = this.getNodeParameter('runId', i, '') as string;
						const additionalFields = this.getNodeParameter('additionalFields', i, {}) as any;

						const body: any = { messages: [{ role: messageType, content: messageContent }] };
						if (userId) body.user_id = userId;
						if (agentId) body.agent_id = agentId;
						if (runId) body.run_id = runId;

						const metadata = buildKeyValueFromCollection(additionalFields.metadata);
						if (metadata) body.metadata = metadata;
						if (additionalFields.includes) body.includes = additionalFields.includes;
						if (additionalFields.excludes) body.excludes = additionalFields.excludes;
						if (typeof additionalFields.infer === 'boolean') body.infer = additionalFields.infer;

						if (additionalFields.customCategories?.items) {
							const cats: Record<string, string> = {};
							for (const item of additionalFields.customCategories.items) {
								cats[item.name] = item.value;
							}
							body.custom_categories = cats;
						}

						const response = await mem0ApiRequest.call(this, 'POST', '/memories', body);
						returnData.push({ json: response });
					} else if (operation === 'get') {
						const memoryId = this.getNodeParameter('memoryId', i) as string;
						const response = await mem0ApiRequest.call(this, 'GET', `/memories/${memoryId}`);
						returnData.push({ json: response });
					} else if (operation === 'getAll') {
						const userId = this.getNodeParameter('userId', i, '') as string;
						const agentId = this.getNodeParameter('agentId', i, '') as string;
						const runId = this.getNodeParameter('runId', i, '') as string;
						const qs: any = {};
						if (userId) qs.user_id = userId;
						if (agentId) qs.agent_id = agentId;
						if (runId) qs.run_id = runId;

						const response = await mem0ApiRequest.call(this, 'GET', '/memories', {}, qs);
						if (Array.isArray(response)) {
							for (const item of response) returnData.push({ json: item });
						} else {
							returnData.push({ json: response });
						}
					} else if (operation === 'delete') {
						const memoryId = this.getNodeParameter('memoryId', i) as string;
						const response = await mem0ApiRequest.call(this, 'DELETE', `/memories/${memoryId}`);
						returnData.push({ json: response });
					} else if (operation === 'deleteAll') {
						const userId = this.getNodeParameter('userId', i, '') as string;
						const agentId = this.getNodeParameter('agentId', i, '') as string;
						const runId = this.getNodeParameter('runId', i, '') as string;
						const qs: any = {};
						if (userId) qs.user_id = userId;
						if (agentId) qs.agent_id = agentId;
						if (runId) qs.run_id = runId;

						const response = await mem0ApiRequest.call(this, 'DELETE', '/memories', {}, qs);
						returnData.push({ json: response });
					} else if (operation === 'update') {
						const memoryId = this.getNodeParameter('memoryId', i) as string;
						const updateFields = this.getNodeParameter('updateFields', i, {}) as any;
						const body: any = {};
						if (updateFields.text) body.text = updateFields.text;
						const metadata = buildKeyValueFromCollection(updateFields.metadata);
						if (metadata) body.metadata = metadata;

						const response = await mem0ApiRequest.call(this, 'PUT', `/memories/${memoryId}`, body);
						returnData.push({ json: response });
					} else if (operation === 'search') {
						const query = this.getNodeParameter('query', i) as string;
						const userId = this.getNodeParameter('userId', i, '') as string;
						const agentId = this.getNodeParameter('agentId', i, '') as string;
						const runId = this.getNodeParameter('runId', i, '') as string;
						const options = this.getNodeParameter('options', i, {}) as any;

						const body: any = { query };
						if (userId) body.user_id = userId;
						if (agentId) body.agent_id = agentId;
						if (runId) body.run_id = runId;
						if (options.topK) body.top_k = options.topK;
						if (options.rerank !== undefined) body.rerank = options.rerank;
						if (typeof options.fields === 'string' && options.fields) {
							body.fields = options.fields.split(',').map((f: string) => f.trim());
						}
						const metaFilter = buildKeyValueFromCollection(options.metadata);
						if (metaFilter) body.metadata = metaFilter;

						const response = await mem0ApiRequest.call(this, 'POST', '/search', body);
						if (Array.isArray(response)) {
							for (const item of response) returnData.push({ json: item });
						} else {
							returnData.push({ json: response });
						}
					} else if (operation === 'searchV2') {
						const query = this.getNodeParameter('query', i) as string;
						const userId = this.getNodeParameter('userId', i, '') as string;
						const options = this.getNodeParameter('options', i, {}) as any;

						const rules: any[] = options.filters?.rules ?? [];
						const operatorMap: Record<string, string> = {
							notEquals: 'ne',
							contains: 'icontains',
							greaterThan: 'gt',
							lessThan: 'lt',
						};
						const andFilters: any[] = [];
						for (const rule of Array.isArray(rules) ? rules : []) {
							const field = (rule.field ?? '').trim();
							const op = (rule.operation ?? 'equals').toString();
							const rawValue = rule.value ?? '';
							if (!field) continue;
							const value = normalizeFilterValue(String(rawValue));
							if (op === 'equals') {
								andFilters.push({ [field]: value });
							} else if (op in operatorMap) {
								andFilters.push({ [operatorMap[op]]: { [field]: value } });
							}
						}

						const body: any = { query, filters: andFilters.length ? { AND: andFilters } : {} };
						if (userId) body.user_id = userId;
						if (options.topK) body.top_k = options.topK;
						if (options.rerank !== undefined) body.rerank = options.rerank;
						if (typeof options.fields === 'string' && options.fields.trim()) {
							body.fields = options.fields.split(',').map((f: string) => f.trim()).filter((f: string) => f.length);
						}

						const response = await mem0ApiRequest.call(this, 'POST', '/search', body);
						if (Array.isArray(response)) {
							for (const item of response) returnData.push({ json: item });
						} else {
							returnData.push({ json: response });
						}
					} else if (operation === 'history') {
						const memoryId = this.getNodeParameter('memoryId', i) as string;
						const response = await mem0ApiRequest.call(this, 'GET', `/memories/${memoryId}/history`);
						if (Array.isArray(response)) {
							for (const item of response) returnData.push({ json: item });
						} else {
							returnData.push({ json: response });
						}
					}
				}
				// ── ENTITY ───────────────────────────────────────────────
				// ── ORGANIZATION ─────────────────────────────────────────
				// ── PROJECT ──────────────────────────────────────────────
				// ── CONFIG (self-hosted) ─────────────────────────────────
				else if (resource === 'config') {
					if (operation === 'health') {
						const response = await mem0ApiRequest.call(this, 'GET', '/');
						returnData.push({ json: response });
					} else if (operation === 'getConfig') {
						const response = await mem0ApiRequest.call(this, 'GET', '/configure');
						returnData.push({ json: response });
					} else if (operation === 'getProviders') {
						const response = await mem0ApiRequest.call(this, 'GET', '/configure/providers');
						returnData.push({ json: response });
					} else if (operation === 'configure') {
						const configRaw = this.getNodeParameter('configJson', i, '{}') as string;
						let configObj: any;
						try {
							configObj = typeof configRaw === 'string' ? JSON.parse(configRaw) : configRaw;
						} catch {
							throw new NodeOperationError(this.getNode(), 'Config JSON is invalid. Please provide a valid JSON object.');
						}
						const response = await mem0ApiRequest.call(this, 'POST', '/configure', configObj);
						returnData.push({ json: response || { success: true } });
					} else if (operation === 'reset') {
						const response = await mem0ApiRequest.call(this, 'POST', '/reset', {});
						returnData.push({ json: response || { success: true } });
					} else {
						throw new NodeOperationError(this.getNode(), `Unsupported config operation: ${operation}`);
					}
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported self-hosted resource: ${resource}`);
				}
			} catch (error: any) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: error.message }, pairedItem: { item: i } });
					continue;
				}
				throw error;
			}
		}
		return [returnData];
	}
}
