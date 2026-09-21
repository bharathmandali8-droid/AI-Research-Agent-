import axios from 'axios';
import { SearchResult } from '../schemas';

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  try {
    const res = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 6000,
    });

    const html = res.data as string;
    const results: SearchResult[] = [];

    // Parse DuckDuckGo HTML results
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
    console.warn('[Search] DuckDuckGo fallback failed:', err?.message || err);
    return [];
  }
}

export async function searchWeb(query: string): Promise<SearchResult[]> {
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
          timeout: 6000,
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

      if (results.length > 0) return results;
    } catch (err: any) {
      console.warn(`[Search] Serper API failed (${err?.message || err}), falling back to DuckDuckGo...`);
    }
  } else {
    console.warn('[Search] SERPER_API_KEY is not set in environment variables. Falling back to DuckDuckGo...');
  }

  return searchDuckDuckGo(query);
}
