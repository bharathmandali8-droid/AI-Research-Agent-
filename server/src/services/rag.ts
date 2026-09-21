import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { SearchResult } from '../schemas';

// ── Supabase client (lazy singleton) ────────────────────────────────────────

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null; // RAG disabled — env vars not set
  _supabase = createClient(url, key);
  return _supabase;
}

// ── Embedding helper ─────────────────────────────────────────────────────────

async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const ai = new GoogleGenAI({ apiKey });

  const result = await ai.models.embedContent({
    model: 'text-embedding-004', // 768-dim model — matches vector(768) schema
    contents: text,
    config: { outputDimensionality: 768 },
  });

  const values = result.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error('Embedding returned empty vector');
  }
  return values;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface SimilarReport {
  question: string;
  report: string;
  similarity: number;
}

/**
 * Find the top-2 past reports whose question is semantically similar
 * to the new question (cosine similarity > 0.75).
 * Returns [] if RAG is disabled or nothing relevant is found.
 */
export async function findSimilar(question: string): Promise<SimilarReport[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const embedding = await embed(question);

    // pgvector cosine distance: <=> — lower = more similar
    // 1 - distance = similarity; we filter similarity >= 0.75 → distance <= 0.25
    const { data, error } = await supabase.rpc('match_research_reports', {
      query_embedding: embedding,
      match_threshold: 0.75,
      match_count: 2,
    });

    if (error) {
      console.warn('[RAG] findSimilar RPC error:', error.message);
      return [];
    }

    return (data ?? []).map(
      (row: { question: string; report: string; similarity: number }) => ({
        question: row.question,
        report: row.report,
        similarity: row.similarity,
      })
    );
  } catch (err) {
    console.warn('[RAG] findSimilar failed (non-fatal):', (err as Error).message);
    return [];
  }
}

/**
 * Embed and store a completed research report.
 * Fails silently — storage errors must not break the research flow.
 */
export async function saveReport(
  question: string,
  report: string,
  sources: SearchResult[]
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const embedding = await embed(question);

    const { error } = await supabase.from('research_reports').insert({
      question,
      report,
      sources,
      embedding,
    });

    if (error) {
      console.warn('[RAG] saveReport insert error:', error.message);
    } else {
      console.log('[RAG] Report saved to vector store.');
    }
  } catch (err) {
    console.warn('[RAG] saveReport failed (non-fatal):', (err as Error).message);
  }
}

/**
 * Fetch the N most recent stored reports (no vector search).
 */
export async function getRecentReports(limit = 10): Promise<
  Array<{ id: string; question: string; created_at: string; sources: SearchResult[] }>
> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('research_reports')
    .select('id, question, created_at, sources')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[RAG] getRecentReports error:', error.message);
    return [];
  }
  return data ?? [];
}
