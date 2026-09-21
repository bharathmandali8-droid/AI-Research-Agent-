import { z } from 'zod';

export const ResearchRequestSchema = z.object({
  question: z
    .string()
    .min(10, 'Question must be at least 10 characters')
    .max(500, 'Question must be under 500 characters'),
});

export type ResearchRequest = z.infer<typeof ResearchRequestSchema>;

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface ResearchReport {
  report: string;
  sources: SearchResult[];
  cachedContext?: string;
}

export interface FactCheckItem {
  claim: string;
  status: 'supported' | 'contradicted' | 'unverified';
  evidence: string; // relevant snippet from the sources
  sourceIndex?: number; // 1-based index of the supporting/contradicting source
}
