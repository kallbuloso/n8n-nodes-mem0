import type { INodeProperties } from 'n8n-workflow';

export const configOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['config'] } },
		options: [
			{ name: 'Health Check', value: 'health', description: 'Check service status', action: 'Health check' },
			{ name: 'Get Config', value: 'getConfig', description: 'Get current mem0 configuration', action: 'Get config' },
			{ name: 'List Providers', value: 'getProviders', description: 'List bundled LLM and embedder providers', action: 'List providers' },
			{ name: 'Set Full Config', value: 'configure', description: 'Replace the full mem0 config (advanced)', action: 'Set full config' },
			{ name: 'Reset All Memories', value: 'reset', description: 'Delete all memories from the vector store', action: 'Reset all memories' },
		],
		default: 'health',
	},
];

export const configFields: INodeProperties[] = [
	{
		displayName: 'Config (JSON)',
		name: 'configJson',
		type: 'json',
		default: '{}',
		displayOptions: { show: { resource: ['config'], operation: ['configure'] } },
		description: 'Full mem0 configuration object. Replaces the entire server configuration.',
	},
];
