import type { INodeProperties } from 'n8n-workflow';

export const entityOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['entity'] } },
		options: [
			{ name: 'Create', value: 'create', description: 'Create a new entity', action: 'Create an entity' },
			{ name: 'Delete', value: 'delete', description: 'Delete an entity', action: 'Delete an entity' },
			{ name: 'Get', value: 'get', description: 'Get entity by ID', action: 'Get an entity' },
			{ name: 'List Multiple', value: 'getAll', description: 'List entities', action: 'List multiple entities' },
			{ name: 'Update', value: 'update', description: 'Update an entity', action: 'Update an entity' },
		],
		default: 'getAll',
	},
];

export const entityFields: INodeProperties[] = [
	{
		displayName: 'Entity Type',
		name: 'entityType',
		type: 'options',
		options: [
			{ name: 'User', value: 'user' },
			{ name: 'Agent', value: 'agent' },
			{ name: 'Application', value: 'app' },
			{ name: 'Session', value: 'run' },
		],
		default: 'user',
		displayOptions: { show: { resource: ['entity'], operation: ['create', 'delete', 'get', 'update'] } },
		required: true,
		description: 'Entity type for the selected operation',
	},
	{
		displayName: 'Entity ID',
		name: 'entityId',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['entity'], operation: ['delete', 'get', 'update'] } },
		required: true,
		description: 'Unique identifier of the entity',
		placeholder: 'entity_xyz123',
	},
	{
		displayName: 'Entity Name',
		name: 'entityName',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['entity'], operation: ['create'] } },
		required: true,
		description: 'Friendly name for the new entity',
	},
	{
		displayName: 'Additional Fields',
		name: 'entityAdditionalFields',
		type: 'collection',
		default: {},
		displayOptions: { show: { resource: ['entity'], operation: ['create'] } },
		description: 'Define organization, project or metadata for the entity',
		options: [
			{ displayName: 'Organization ID', name: 'organizationId', type: 'string', default: '' },
			{ displayName: 'Project ID', name: 'projectId', type: 'string', default: '' },
			{
				displayName: 'Metadata',
				name: 'metadata',
				type: 'fixedCollection',
				default: {},
				options: [
					{
						name: 'entries',
						displayName: 'Entries',
						values: [
							{ displayName: 'Key', name: 'key', type: 'string', default: '' },
							{ displayName: 'Value', name: 'value', type: 'string', default: '' },
						],
					},
				],
			},
		],
	},
	{
		displayName: 'Update Fields',
		name: 'entityUpdateFields',
		type: 'collection',
		default: {},
		displayOptions: { show: { resource: ['entity'], operation: ['update'] } },
		description: 'Select the fields you want to update',
		options: [
			{ displayName: 'New Name', name: 'name', type: 'string', default: '' },
			{ displayName: 'Organization ID', name: 'organizationId', type: 'string', default: '' },
			{ displayName: 'Project ID', name: 'projectId', type: 'string', default: '' },
			{
				displayName: 'Metadata',
				name: 'metadata',
				type: 'fixedCollection',
				default: {},
				options: [
					{
						name: 'entries',
						displayName: 'Entries',
						values: [
							{ displayName: 'Key', name: 'key', type: 'string', default: '' },
							{ displayName: 'Value', name: 'value', type: 'string', default: '' },
						],
					},
				],
			},
		],
	},
	{
		displayName: 'Entity Filters',
		name: 'entityFilters',
		type: 'collection',
		default: {},
		displayOptions: { show: { resource: ['entity'], operation: ['getAll'] } },
		description: 'Optional filters to list entities',
		options: [
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				options: [
					{ name: 'User', value: 'user' },
					{ name: 'Agent', value: 'agent' },
					{ name: 'Application', value: 'app' },
					{ name: 'Session', value: 'run' },
				],
				default: 'user',
			},
			{ displayName: 'Organization ID', name: 'organizationId', type: 'string', default: '' },
			{ displayName: 'Project ID', name: 'projectId', type: 'string', default: '' },
		],
	},
];
