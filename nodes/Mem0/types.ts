export interface IMem0Memory {
	id?: string;
	memory?: string;
	text?: string;
	content?: string;
	metadata?: Record<string, any>;
	created_at?: string;
	updated_at?: string;
	score?: number;
	similarity?: number;
	relevance?: number;
	rank?: number;
	user_id?: string;
	agent_id?: string;
	run_id?: string;
	[key: string]: any;
}

export interface IMem0MemoryParams {
	user_id?: string;
	agent_id?: string;
	run_id?: string;
}

export interface IMem0SearchBody extends IMem0MemoryParams {
	query: string;
	top_k?: number;
	rerank?: boolean;
	fields?: string[];
	filters?: Record<string, any>;
	metadata?: Record<string, any>;
}
