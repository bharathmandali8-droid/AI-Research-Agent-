export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface FactCheckItem {
  claim: string;
  status: 'supported' | 'contradicted' | 'unverified';
  evidence: string;
  sourceIndex?: number;
}

export interface ResearchResponse {
  report: string;
  sources: SearchResult[];
  subquestions: string[];
  cachedContext?: string; // set when RAG injected prior research context
  factCheck?: FactCheckItem[];
}
