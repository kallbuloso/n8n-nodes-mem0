import type { INodeProperties } from 'n8n-workflow';

export const projectOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['project'] } },
		options: [
			{ name: 'Create', value: 'create', description: 'Create project', action: 'Create project' },
			{ name: 'Delete', value: 'delete', description: 'Delete project', action: 'Delete project' },
			{ name: 'Get', value: 'get', description: 'Get project by ID', action: 'Get project' },
			{ name: 'List Multiple', value: 'getAll', description: 'List projects', action: 'List projects' },
			{ name: 'Update', value: 'update', description: 'Update project', action: 'Update project' },
		],
		default: 'getAll',
	},
];

export const projectFields: INodeProperties[] = [
	{
		displayName: 'Project ID',
		name: 'projectId',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['project'], operation: ['get', 'update', 'delete'] } },
		required: true,
		description: 'Unique identifier of the project',
	},
	{
		displayName: 'Organization ID',
		name: 'projectOrganizationId',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['project'], operation: ['create'] } },
		required: true,
		description: 'Organization that owns the project',
	},
	{
		displayName: 'Project Name',
		name: 'projectName',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['project'], operation: ['create'] } },
		required: true,
		description: 'Display name of the project',
	},
	{
		displayName: 'Additional Fields',
		name: 'projectAdditionalFields',
		type: 'collection',
		default: {},
		displayOptions: { show: { resource: ['project'], operation: ['create'] } },
		options: [
			{ displayName: 'Description', name: 'description', type: 'string', typeOptions: { rows: 3 }, default: '' },
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
		name: 'projectUpdateFields',
		type: 'collection',
		default: {},
		displayOptions: { show: { resource: ['project'], operation: ['update'] } },
		options: [
			{ displayName: 'New Name', name: 'name', type: 'string', default: '' },
			{ displayName: 'Description', name: 'description', type: 'string', typeOptions: { rows: 3 }, default: '' },
			{ displayName: 'Organization ID', name: 'organizationId', type: 'string', default: '' },
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
		displayName: 'Project Filters',
		name: 'projectFilters',
		type: 'collection',
		default: {},
		displayOptions: { show: { resource: ['project'], operation: ['getAll'] } },
		description: 'Optional filters to list projects',
		options: [
			{ displayName: 'Organization ID', name: 'organizationId', type: 'string', default: '' },
		],
	},
];
