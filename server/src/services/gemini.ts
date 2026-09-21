import { GoogleGenAI } from '@google/genai';
import { SearchResult, FactCheckItem } from '../schemas';

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenAI({ apiKey });
}

const MODELS = [
  'gemini-3.6-flash',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
];

async function generateWithFallback(ai: GoogleGenAI, prompt: string): Promise<string> {
  let lastError: unknown = null;

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });
        if (response.text) return response.text;
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        console.warn(`[Gemini] Model "${model}" attempt ${attempt} failed: ${errMsg}`);

        // If 404 (model not found), don't retry this model — skip directly to next model
        if (err?.status === 404 || errMsg.includes('404') || errMsg.includes('NOT_FOUND')) {
          break;
        }

        // Wait before retrying on 503 or transient issues
        if (attempt < 3) {
          await new Promise((res) => setTimeout(res, 1500 * attempt));
        }
      }
    }
  }
  throw lastError;
}

export async function generateSubquestions(question: string): Promise<string[]> {
  const ai = getClient();

  const prompt = `You are a research planner. Given the following research question, generate exactly 4 focused sub-questions that would help gather comprehensive information to answer it. Return ONLY a JSON array of strings — no markdown, no explanation.

Research question: "${question}"`;

  const text = await generateWithFallback(ai, prompt);
  // Strip potential markdown code fences
  const cleaned = text.replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed.slice(0, 5);
  } catch {
    // Fallback: extract lines that look like questions
    const lines = cleaned
      .split('\n')
      .map((l) => l.replace(/^[-\d.)\s]+/, '').trim())
      .filter((l) => l.length > 5);
    return lines.slice(0, 5);
  }

  return [question];
}

export async function generateReport(
  question: string,
  sources: SearchResult[],
  ragContext?: string
): Promise<string> {
  const ai = getClient();

  const validRange = sources.length > 0
    ? `[1] through [${sources.length}]`
    : 'none';

  const sourcesText = sources
    .map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\nSnippet: ${s.snippet}`)
    .join('\n\n');

  // Prepend prior research context when RAG found similar past reports
  const ragSection = ragContext
    ? `PRIOR RESEARCH CONTEXT (from semantically similar past reports — use to add depth and continuity, do NOT cite these with [N] numbers):\n${ragContext}\n\n`
    : '';

  const prompt = `${ragSection}You are an expert research analyst. Using ONLY the provided sources, write a comprehensive research report answering the question below.

CITATION RULES (strictly enforced):
- You have exactly ${sources.length} sources, numbered ${validRange}.
- Every inline citation MUST be one of these numbers. Do NOT write [${sources.length + 1}] or higher.
- Place citations immediately after the claim they support, e.g. "Studies show X [1][3]."
- Every sentence that uses information from a source MUST include its citation number.
- Do NOT cite a source number that does not appear in the list below.

FORMAT:
- Markdown with clear headings (##, ###)
- Sections: Executive Summary, Key Findings, Detailed Analysis, Conclusion
- Be factual — only use information present in the sources

Research Question: "${question}"

Sources:
${sourcesText}

Write the report now:`;

  const rawReport = await generateWithFallback(ai, prompt);

  // Post-process: strip any [N] citations where N is out of range
  return sanitizeCitations(rawReport, sources.length);
}

/**
 * Remove citation markers like [N] where N > sourceCount or N < 1.
 * This prevents hallucinated citation numbers from reaching the frontend.
 */
function sanitizeCitations(report: string, sourceCount: number): string {
  return report.replace(/\[(\d+)\]/g, (_match, numStr) => {
    const n = parseInt(numStr, 10);
    if (n >= 1 && n <= sourceCount) return `[${n}]`;
    return ''; // strip invalid reference
  });
}

/**
 * Extract 4–5 important claims from the report and verify each one
 * against the collected source snippets.
 * Returns [] on any failure — never throws.
 */
export async function factCheckClaims(
  report: string,
  sources: SearchResult[]
): Promise<FactCheckItem[]> {
  if (sources.length === 0) return [];

  const ai = getClient();

  const sourcesText = sources
    .map((s, i) => `[${i + 1}] ${s.title}\nSnippet: ${s.snippet}`)
    .join('\n\n');

  const prompt = `You are a fact-checker. You are given a research report and the source snippets it was based on.

Your task:
1. Identify the 4-5 most important factual claims in the report.
2. For each claim, search the source snippets for evidence.
3. Classify each claim as:
   - "supported"    — at least one source snippet clearly backs the claim
   - "contradicted" — at least one source snippet says something different
   - "unverified"   — no source snippet contains enough info to confirm or deny

Return ONLY a JSON array — no markdown, no explanation. Each element must have:
  - "claim": the exact claim (one concise sentence, max 120 chars)
  - "status": "supported" | "contradicted" | "unverified"
  - "evidence": a short quote or paraphrase from the relevant source (empty string if unverified)
  - "sourceIndex": the 1-based source number that contains the evidence (0 if unverified)

Report:
${report.slice(0, 3000)}

Sources:
${sourcesText}`;

  try {
    const rawText = await generateWithFallback(ai, prompt);
    const text = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed)) return [];

    // Validate and clamp each item
    return parsed
      .filter((item): item is FactCheckItem =>
        typeof item.claim === 'string' &&
        ['supported', 'contradicted', 'unverified'].includes(item.status)
      )
      .slice(0, 5)
      .map((item) => ({
        claim: item.claim,
        status: item.status,
        evidence: typeof item.evidence === 'string' ? item.evidence : '',
        sourceIndex:
          typeof item.sourceIndex === 'number' &&
          item.sourceIndex >= 1 &&
          item.sourceIndex <= sources.length
            ? item.sourceIndex
            : undefined,
      }));
  } catch {
    console.warn('[FactCheck] Failed to parse fact-check response — skipping.');
    return [];
  }
}
