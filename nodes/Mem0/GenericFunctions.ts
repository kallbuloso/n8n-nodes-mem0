import type {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	ISupplyDataFunctions,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

type Ctx = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions | ISupplyDataFunctions;

/**
 * Translates API endpoints for self-hosted instances.
 * Self-hosted mem0 exposes routes without the /v1 or /v2 version prefix,
 * and uses /search instead of /memories/search/.
 * Trailing slashes are always removed to avoid 301 redirects.
 *
 * Examples:
 *   /v1/memories        -> /memories
 *   /v1/memories/search -> /search   (self-hosted root-level endpoint)
 *   /v2/memories/search -> /search
 *   /v1/memories/{id}   -> /memories/{id}
 *   /v1/config          -> /configure
 */
export function translateEndpoint(endpoint: string): string {
	let ep = endpoint.replace(/\/$/, '');
	ep = ep.replace(/^\/v[0-9]+\//, '/');
	// Self-hosted exposes /search at root, not as a sub-route of /memories
	ep = ep.replace(/^\/memories\/search(\/.*)?$/, '/search');
	ep = ep.replace(/^\/config$/, '/configure');
	ep = ep.replace(/^\/config\/providers$/, '/configure/providers');
	ep = ep.replace(/^\/health$/, '/');
	return ep;
}

/**
 * Extracts the memories array from an API response.
 * Self-hosted responses may wrap results in { results: [...], relations: [...] }.
 */
export function extractResults(res: any): any[] {
	if (Array.isArray(res)) return res;
	if (res?.results && Array.isArray(res.results)) return res.results;
	if (res) return [res];
	return [];
}

/**
 * Shared API request helper used by all Mem0 nodes.
 * Uses self-hosted credentials, translates endpoints, and sends the HTTP request
 * via n8n's modern httpRequest helper.
 */
export async function mem0ApiRequest(
	this: Ctx,
	method: string,
	endpoint: string,
	body: Record<string, any> = {},
	qs: Record<string, any> = {},
): Promise<any> {
	const credentials = await this.getCredentials('mem0SelfHostedApi') as any;
	const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');
	const resolvedEndpoint = translateEndpoint(endpoint);

	const options: IHttpRequestOptions = {
		method: method as IHttpRequestOptions['method'],
		body,
		qs,
		url: `${baseUrl}${resolvedEndpoint}`,
	};

	if (credentials.apiKey) {
		options.headers = { 'X-API-Key': credentials.apiKey as string };
	}

	try {
		return await (this as IExecuteFunctions).helpers.httpRequest(options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as any);
	}
}

/**
 * Converts an n8n fixedCollection of { key, value } entries into a flat object.
 */
export function buildKeyValueFromCollection(
	collection: any,
): Record<string, string> | undefined {
	if (!collection || typeof collection !== 'object') return undefined;
	const entries = collection.entries || collection.items;
	if (!Array.isArray(entries)) return undefined;
	const result: Record<string, string> = {};
	for (const entry of entries) {
		const key = entry?.key?.trim?.() || entry?.name?.trim?.();
		if (!key) continue;
		result[key] = entry?.value ?? '';
	}
	return Object.keys(result).length ? result : undefined;
}

/**
 * Smart value normalization for search filter values.
 * Attempts to parse numbers, booleans, and JSON from string inputs.
 */
export function normalizeFilterValue(input: string): string | number | boolean | object {
	const trimmed = (input ?? '').trim();
	if (trimmed === '') return trimmed;

	if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
		const num = Number(trimmed);
		if (!Number.isNaN(num)) return num;
	}

	if (/^(true|false)$/i.test(trimmed)) {
		return trimmed.toLowerCase() === 'true';
	}

	if (
		(trimmed.startsWith('{') && trimmed.endsWith('}')) ||
		(trimmed.startsWith('[') && trimmed.endsWith(']'))
	) {
		try {
			return JSON.parse(trimmed);
		} catch {
			// fall through
		}
	}

	return input;
}
