import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import { SearchResult } from '../schemas';

/**
 * Perform web search using Gemini Google Search Grounding.
 */
async function searchGeminiGrounding(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Perform a web search to gather key authoritative information, articles, and documents for research query: "${query}".`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const results: SearchResult[] = [];
    const seenUrls = new Set<string>();

    for (const chunk of chunks) {
      if (chunk.web?.uri && !seenUrls.has(chunk.web.uri)) {
        seenUrls.add(chunk.web.uri);
        results.push({
          title: chunk.web.title || 'Web Search Result',
          url: chunk.web.uri,
          snippet: `Found via Google Search regarding: ${query}`,
        });
      }
    }
    return results;
  } catch (err: any) {
    console.warn(`[Search] Gemini Search Grounding fallback failed: ${err?.message || err}`);
    return [];
  }
}

/**
 * Search Wikipedia API for factual reference documents.
 */
async function searchWikipedia(query: string): Promise<SearchResult[]> {
  try {
    const res = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json',
        srlimit: 5,
      },
      headers: {
        'User-Agent': 'AI-Research-Agent/1.0 (contact@researchagent.com)',
      },
      timeout: 5000,
    });

    const items: Array<{ title: string; snippet: string }> = res.data?.query?.search || [];
    return items.map((item) => ({
      title: item.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
      snippet: item.snippet.replace(/<[^>]+>/g, '').trim(),
    }));
  } catch (err: any) {
    console.warn(`[Search] Wikipedia search fallback failed: ${err?.message || err}`);
    return [];
  }
}

/**
 * Fallback search via DuckDuckGo HTML.
 */
async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  try {
    const res = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 5000,
    });

    const html = res.data as string;
    const results: SearchResult[] = [];

    const regex = /<a class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>(.*?)<\/a>/g;
    let match;
    while ((match = regex.exec(html)) !== null && results.length < 5) {
      let url = match[1];
      if (url.includes('uddg=')) {
        const urlParam = new URLSearchParams(url.split('?')[1] || '').get('uddg');
        if (urlParam) url = decodeURIComponent(urlParam);
      }
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      const snippet = match[3].replace(/<[^>]+>/g, '').trim();
      if (title && url.startsWith('http')) {
        results.push({ title, url, snippet });
      }
    }

    return results;
  } catch (err: any) {
    console.warn(`[Search] DuckDuckGo fallback failed: ${err?.message || err}`);
    return [];
  }
}

export async function searchWeb(query: string): Promise<SearchResult[]> {
  // 1. Try Serper API if key is present
  const apiKey = process.env.SERPER_API_KEY;
  if (apiKey) {
    try {
      const response = await axios.post(
        'https://google.serper.dev/search',
        { q: query, num: 5 },
        {
          headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );

      const organic: Array<{ title?: string; link?: string; snippet?: string }> =
        response.data?.organic ?? [];

      const results = organic
        .filter((r) => r.link)
        .map((r) => ({
          title: r.title ?? 'Untitled',
          url: r.link!,
          snippet: r.snippet ?? '',
        }));

      if (results.length > 0) {
        console.log(`[Search] Serper provided ${results.length} results for: "${query}"`);
        return results;
      }
    } catch (err: any) {
      console.warn(`[Search] Serper API error (${err?.response?.status || err?.message}), proceeding to fallbacks...`);
    }
  }

  // 2. Try Gemini Google Search Grounding
  console.log(`[Search] Fetching sources via Gemini Google Search Grounding for: "${query}"`);
  const groundingResults = await searchGeminiGrounding(query);
  if (groundingResults.length > 0) {
    console.log(`[Search] Gemini Grounding provided ${groundingResults.length} sources for: "${query}"`);
    return groundingResults;
  }

  // 3. Fallback to Wikipedia Search API
  console.log(`[Search] Fetching sources via Wikipedia API for: "${query}"`);
  const wikiResults = await searchWikipedia(query);
  if (wikiResults.length > 0) {
    console.log(`[Search] Wikipedia provided ${wikiResults.length} sources for: "${query}"`);
    return wikiResults;
  }

  // 4. Final fallback to DuckDuckGo
  console.log(`[Search] Fetching sources via DuckDuckGo fallback for: "${query}"`);
  return searchDuckDuckGo(query);
}

