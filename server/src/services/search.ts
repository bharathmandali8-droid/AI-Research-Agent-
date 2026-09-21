import axios from 'axios';
import { SearchResult } from '../schemas';

export async function searchWeb(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error('SERPER_API_KEY is not set');

  const response = await axios.post(
    'https://google.serper.dev/search',
    { q: query, num: 5 },
    {
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
    }
  );

  const organic: Array<{ title?: string; link?: string; snippet?: string }> =
    response.data?.organic ?? [];

  return organic
    .filter((r) => r.link)
    .map((r) => ({
      title: r.title ?? 'Untitled',
      url: r.link!,
      snippet: r.snippet ?? '',
    }));
}
