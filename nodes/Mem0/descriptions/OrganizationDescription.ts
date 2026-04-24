import type { INodeProperties } from 'n8n-workflow';

export const organizationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['organization'] } },
		options: [
			{ name: 'Create', value: 'create', description: 'Create organization', action: 'Create organization' },
			{ name: 'Delete', value: 'delete', description: 'Delete organization', action: 'Delete organization' },
			{ name: 'Get', value: 'get', description: 'Get organization by ID', action: 'Get organization' },
			{ name: 'List Multiple', value: 'getAll', description: 'List organizations', action: 'List organizations' },
			{ name: 'Update', value: 'update', description: 'Update organization', action: 'Update organization' },
		],
		default: 'getAll',
	},
];

export const organizationFields: INodeProperties[] = [
	{
		displayName: 'Organization ID',
		name: 'organizationId',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['organization'], operation: ['get', 'update', 'delete'] } },
		required: true,
		description: 'Unique identifier of the organization',
	},
	{
		displayName: 'Organization Name',
		name: 'organizationName',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['organization'], operation: ['create'] } },
		required: true,
		description: 'Display name of the organization',
	},
	{
		displayName: 'Additional Fields',
		name: 'organizationAdditionalFields',
		type: 'collection',
		default: {},
		displayOptions: { show: { resource: ['organization'], operation: ['create'] } },
		options: [
			{ displayName: 'Slug', name: 'slug', type: 'string', default: '' },
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
		name: 'organizationUpdateFields',
		type: 'collection',
		default: {},
		displayOptions: { show: { resource: ['organization'], operation: ['update'] } },
		options: [
			{ displayName: 'New Name', name: 'name', type: 'string', default: '' },
			{ displayName: 'Slug', name: 'slug', type: 'string', default: '' },
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
];
