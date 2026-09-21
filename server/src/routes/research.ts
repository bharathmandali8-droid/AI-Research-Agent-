import { Router, Request, Response } from 'express';
import { ResearchRequestSchema, SearchResult } from '../schemas';
import { generateSubquestions, generateReport, factCheckClaims } from '../services/gemini';
import { searchWeb } from '../services/search';
import { findSimilar, saveReport } from '../services/rag';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  // Validate input
  const parsed = ResearchRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const { question } = parsed.data;

  try {
    // Step 1: Generate sub-questions
    console.log('[Research] Generating sub-questions...');
    const subquestions = await generateSubquestions(question);
    console.log('[Research] Sub-questions:', subquestions);

    // Step 2: Search for each sub-question in parallel
    console.log('[Research] Searching the web...');
    const searchResultArrays = await Promise.all(
      subquestions.map((sq) => searchWeb(sq).catch(() => [] as SearchResult[]))
    );

    // Step 3: Flatten and deduplicate by URL
    const allResults = searchResultArrays.flat();
    const seen = new Set<string>();
    const sources: SearchResult[] = [];
    for (const result of allResults) {
      if (!seen.has(result.url)) {
        seen.add(result.url);
        sources.push(result);
      }
    }
    console.log(`[Research] Collected ${sources.length} unique sources.`);

    // Step 3b: RAG — retrieve semantically similar past reports (non-fatal)
    console.log('[RAG] Looking up similar past reports...');
    const similarReports = await findSimilar(question);
    const ragContext = similarReports.length > 0
      ? similarReports
          .map((r, i) => `--- Prior Report ${i + 1} (similarity: ${r.similarity.toFixed(2)}) ---\nQuestion: ${r.question}\n${r.report}`)
          .join('\n\n')
      : undefined;
    if (ragContext) {
      console.log(`[RAG] Found ${similarReports.length} similar report(s) to inject.`);
    } else {
      console.log('[RAG] No similar reports found or RAG disabled.');
    }

    // Step 4: Generate report (with optional RAG context)
    console.log('[Research] Generating report...');
    const report = await generateReport(question, sources, ragContext);

    // Step 5a: Store report in vector DB (fire-and-forget)
    saveReport(question, report, sources).catch(() => {});

    // Step 5b: Fact-check key claims against sources (non-fatal)
    console.log('[FactCheck] Checking key claims...');
    const factCheck = await factCheckClaims(report, sources).catch(() => []);
    console.log(`[FactCheck] ${factCheck.length} claims checked.`);

    return res.json({
      report,
      sources,
      subquestions,
      cachedContext: ragContext ? `${similarReports.length} similar past report(s) used as context` : undefined,
      factCheck,
    });
  } catch (err: unknown) {
    console.error('[Research] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
});

export default router;
