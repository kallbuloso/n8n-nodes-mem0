import type { INodeProperties } from 'n8n-workflow';

export const memoryOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: { resource: ['memory'] },
		},
		options: [
			{ name: 'Add', value: 'add', description: 'Add new memories', action: 'Add a memory' },
			{ name: 'Delete', value: 'delete', description: 'Delete a memory by ID', action: 'Delete a memory' },
			{ name: 'Delete All', value: 'deleteAll', description: 'Delete all with filters', action: 'Delete all memories' },
			{ name: 'Get', value: 'get', description: 'Get a memory by ID', action: 'Get a memory' },
			{ name: 'List Multiple', value: 'getAll', description: 'List memories', action: 'List multiple memories' },
			{ name: 'History', value: 'history', description: 'Get memory history', action: 'Get memory history' },
			{ name: 'Semantic Search', value: 'search', description: 'Semantic search', action: 'Search memories' },
			{ name: 'Advanced Search', value: 'searchV2', description: 'Semantic search with filters', action: 'Search memories advanced' },
			{ name: 'Update', value: 'update', description: 'Update memory by ID', action: 'Update a memory' },
		],
		default: 'add',
	},
];

export const memoryFields: INodeProperties[] = [
	// ── Scope identifiers ────────────────────────────────────────────────
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		default: '',
		displayOptions: {
			show: { resource: ['memory'], operation: ['add', 'getAll', 'deleteAll', 'search', 'searchV2'] },
		},
		description: 'Unique user identifier to associate with the memory',
		placeholder: 'user_123',
	},
	{
		displayName: 'Agent ID',
		name: 'agentId',
		type: 'string',
		default: '',
		displayOptions: {
			show: { resource: ['memory'], operation: ['add', 'getAll', 'deleteAll', 'search', 'searchV2'] },
		},
		description: 'Identifier of the AI agent/assistant that is interacting',
		placeholder: 'sales_agent',
	},
	{
		displayName: 'Run ID',
		name: 'runId',
		type: 'string',
		default: '',
		displayOptions: {
			show: { resource: ['memory'], operation: ['add', 'getAll', 'deleteAll', 'search', 'searchV2'] },
		},
		description: 'Identifier of the current session/run',
		placeholder: 'session_2024_001',
	},

	// ── Add operation fields ─────────────────────────────────────────────
	{
		displayName: 'Message Content',
		name: 'messageContent',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		required: true,
		displayOptions: {
			show: { resource: ['memory'], operation: ['add'] },
		},
		description: 'The text or content of the message to be stored in memory',
		placeholder: 'Hello, my name is John...',
	},
	{
		displayName: 'Message Role',
		name: 'messageType',
		type: 'options',
		options: [
			{ name: 'User', value: 'user', description: 'Message from the user' },
			{ name: 'Assistant', value: 'assistant', description: 'Message from the AI assistant' },
			{ name: 'System', value: 'system', description: 'System-level instruction' },
		],
		default: 'user',
		displayOptions: {
			show: { resource: ['memory'], operation: ['add'] },
		},
		description: 'The role of the message sender in the conversation',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['memory'], operation: ['add'] } },
		options: [
			{
				displayName: 'Custom Categories',
				name: 'customCategories',
				type: 'fixedCollection',
				default: {},
				description: 'Custom categories to organize the memory',
				options: [
					{
						name: 'items',
						displayName: 'Categories',
						values: [
							{ displayName: 'Category Name', name: 'name', type: 'string', default: '', placeholder: 'type' },
							{ displayName: 'Category Value', name: 'value', type: 'string', default: '', placeholder: 'preference' },
						],
					},
				],
			},
			{
				displayName: 'Exclude Fields',
				name: 'excludes',
				type: 'string',
				default: '',
				description: 'List of fields that should NOT be memorized',
				placeholder: 'password,ssn,email',
			},
			{
				displayName: 'Include Only',
				name: 'includes',
				type: 'string',
				default: '',
				description: 'List of specific fields that MUST be memorized',
				placeholder: 'name,preferences,settings',
			},
			{
				displayName: 'Automatic Inference',
				name: 'infer',
				type: 'boolean',
				default: true,
				description: 'Enable automatic inference of context and relationships by Mem0',
			},
			{
				displayName: 'Metadata',
				name: 'metadata',
				type: 'fixedCollection',
				default: {},
				description: 'Additional information about the memory',
				options: [
					{
						name: 'entries',
						displayName: 'Entries',
						values: [
							{ displayName: 'Key', name: 'key', type: 'string', default: '', placeholder: 'source' },
							{ displayName: 'Value', name: 'value', type: 'string', default: '', placeholder: 'chat' },
						],
					},
				],
			},
		],
	},

	// ── Memory ID (get / delete / update / history) ──────────────────────
	{
		displayName: 'Memory ID',
		name: 'memoryId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: { resource: ['memory'], operation: ['get', 'delete', 'update', 'history'] },
		},
		description: 'Unique identifier of the specific memory',
		placeholder: 'mem_abc123xyz',
	},

	// ── Update fields ────────────────────────────────────────────────────
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['memory'], operation: ['update'] } },
		options: [
			{
				displayName: 'New Text',
				name: 'text',
				type: 'string',
				default: '',
				description: 'New content/text for the memory',
				placeholder: 'Updated memory text',
			},
			{
				displayName: 'Updated Metadata',
				name: 'metadata',
				type: 'fixedCollection',
				default: {},
				description: 'New metadata to replace the existing ones',
				options: [
					{
						name: 'entries',
						displayName: 'Entries',
						values: [
							{ displayName: 'Key', name: 'key', type: 'string', default: '', placeholder: 'timestamp' },
							{ displayName: 'Value', name: 'value', type: 'string', default: '', placeholder: '2024-01-15' },
						],
					},
				],
			},
		],
	},

	// ── Search fields ────────────────────────────────────────────────────
	{
		displayName: 'Search Query',
		name: 'query',
		type: 'string',
		default: '',
		displayOptions: {
			show: { resource: ['memory'], operation: ['search', 'searchV2'] },
		},
		required: true,
		description: 'Text for semantic search in memories',
		placeholder: 'What are the user interface preferences?',
	},
	{
		displayName: 'Search Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: { resource: ['memory'], operation: ['search', 'searchV2'] },
		},
		options: [
			{
				displayName: 'Limit (topK)',
				name: 'topK',
				type: 'number',
				default: 10,
				description: 'Maximum number of memories to return (default: 10)',
			},
			{
				displayName: 'Rerank Results',
				name: 'rerank',
				type: 'boolean',
				default: false,
				description: 'Enable intelligent reranking to improve relevance',
			},
			{
				displayName: 'Fields to Return',
				name: 'fields',
				type: 'string',
				default: '',
				description: 'List of specific fields to include in the response, separated by comma',
				placeholder: 'id,memory,metadata,created_at',
			},
			{
				displayName: 'Filter by Metadata',
				name: 'metadata',
				type: 'fixedCollection',
				default: {},
				description: 'Filter to search only memories with specific metadata',
				options: [
					{
						name: 'entries',
						displayName: 'Filters',
						values: [
							{ displayName: 'Metadata Key', name: 'key', type: 'string', default: '', placeholder: 'category' },
							{ displayName: 'Expected Value', name: 'value', type: 'string', default: '', placeholder: 'preferences' },
						],
					},
				],
			},
			{
				displayName: 'Advanced Filters',
				name: 'filters',
				type: 'fixedCollection',
				default: {},
				required: false,
				typeOptions: { multipleValues: true },
				displayOptions: {
					show: { '/operation': ['searchV2'] },
				},
				description: 'Add filter rules without writing code. Each rule is combined with AND in the search.',
				options: [
					{
						name: 'rules',
						displayName: 'Rules',
						values: [
							{
								displayName: 'Field',
								name: 'field',
								type: 'string',
								default: '',
								required: true,
								description: 'Name of the field to filter, e.g.: memory, user_id, metadata.preferences',
								placeholder: 'metadata.category',
							},
							{
								displayName: 'Operation',
								name: 'operation',
								type: 'options',
								options: [
									{ name: 'Equals', value: 'equals', description: 'Field must equal the provided value' },
									{ name: 'Not Equals', value: 'notEquals', description: 'Field must differ from the provided value' },
									{ name: 'Contains', value: 'contains', description: 'Field contains (case-insensitive) the provided value' },
									{ name: 'Greater Than', value: 'greaterThan', description: 'Numeric/date field greater than the value' },
									{ name: 'Less Than', value: 'lessThan', description: 'Numeric/date field less than the value' },
								],
								default: 'equals',
								required: true,
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								required: true,
								description: 'Value to compare with the selected field',
								placeholder: 'preferences',
							},
						],
					},
				],
			},
		],
	},
];
