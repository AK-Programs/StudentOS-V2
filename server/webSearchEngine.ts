/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Controlled Server-Side Web Search & Research Engine
 * APInex-First Web Intelligence Architecture
 * Endpoints:
 * - Search: POST https://api.apinex.bond/v1/tools/web/search
 * - Contents: POST https://api.apinex.bond/v1/tools/web/contents
 * - Research: POST https://api.apinex.bond/v1/tools/web/research
 */

import { getApinexApiKey } from './aiClient';

export interface WebSearchSource {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  sourceType: 'official' | 'academic' | 'news' | 'reference' | 'web';
  publishedDate?: string;
}

export interface WebSearchResult {
  success: boolean;
  searchPerformed: boolean;
  queryUsed: string;
  sources: WebSearchSource[];
  formattedContext: string;
  error?: string;
  latencyMs: number;
}

/**
 * Sanitizes untrusted webpage snippets before passing to AI models.
 * Strips HTML, scripts, control characters, and prompt-injection patterns.
 */
export function sanitizeWebSnippet(raw: string, maxLength = 420): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/<\/?untrusted_external_web_sources>/gi, '')
    .replace(/<\/?studentos_authorized_context>/gi, '')
    .replace(
      /\b(ignore (all |previous |prior )?instructions|system prompt|override permissions|you are now|disregard above|execute command|bypass security|act as)\b/gi,
      '[filtered-external-text]'
    )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Classifies a domain into an authority tier so official/educational sources rank first.
 */
function classifyDomainAuthority(urlStr: string): {
  domain: string;
  sourceType: WebSearchSource['sourceType'];
  priorityScore: number;
} {
  try {
    const parsed = new URL(urlStr);
    const domain = parsed.hostname.replace(/^www\./i, '').toLowerCase();

    if (
      domain.endsWith('.gov') ||
      domain.endsWith('.gov.in') ||
      domain.endsWith('.nic.in') ||
      domain.includes('cbse.gov') ||
      domain.includes('ncert.nic') ||
      domain.includes('nasa.gov') ||
      domain.includes('isro.gov') ||
      domain.includes('who.int') ||
      domain.includes('unesco.org') ||
      domain.includes('un.org')
    ) {
      return { domain, sourceType: 'official', priorityScore: 100 };
    }

    if (
      domain.endsWith('.edu') ||
      domain.endsWith('.ac.in') ||
      domain.endsWith('.ac.uk') ||
      domain.includes('arxiv.org') ||
      domain.includes('nature.com') ||
      domain.includes('sciencedirect.com') ||
      domain.includes('science.org') ||
      domain.includes('ieee.org') ||
      domain.includes('khanacademy.org') ||
      domain.includes('britannica.com')
    ) {
      return { domain, sourceType: 'academic', priorityScore: 90 };
    }

    if (
      domain.includes('reuters.com') ||
      domain.includes('apnews.com') ||
      domain.includes('bbc.com') ||
      domain.includes('bbc.co.uk') ||
      domain.includes('thehindu.com') ||
      domain.includes('indianexpress.com')
    ) {
      return { domain, sourceType: 'news', priorityScore: 80 };
    }

    if (domain.includes('wikipedia.org') || domain.includes('wikimedia.org')) {
      return { domain, sourceType: 'reference', priorityScore: 75 };
    }

    return { domain, sourceType: 'web', priorityScore: 50 };
  } catch {
    return { domain: 'web-source', sourceType: 'web', priorityScore: 30 };
  }
}

/**
 * Determines whether a prompt requires fresh external web search.
 */
export function detectWebSearchIntent(
  prompt: string,
  persona = 'study_buddy',
  explicitMode: 'auto' | 'always' | 'off' = 'auto'
): { shouldSearch: boolean; cleanQuery: string; reason: string } {
  if (explicitMode === 'off') {
    return { shouldSearch: false, cleanQuery: '', reason: 'Web search explicitly disabled' };
  }

  const raw = String(prompt || '').trim();
  if (!raw || raw.length < 3) {
    return { shouldSearch: false, cleanQuery: '', reason: 'Empty prompt' };
  }

  const textOnly = raw
    .replace(/Image Data: data:image\/[^\s]+/gi, '')
    .replace(/\[Attached Diagram\/Image\]/gi, '')
    .trim();

  if (explicitMode === 'always') {
    return {
      shouldSearch: true,
      cleanQuery: extractPrivacySafeSearchQuery(textOnly),
      reason: 'Explicit search mode requested'
    };
  }

  const temporalTriggers = [
    /\b(latest|current|recent|today|yesterday|this week|this month|now|news|update|developments?|version|release|2025|2026)\b/i,
    /\b(who is currently|what happened in|recent study|breaking|status of|live score|market|election|weather)\b/i
  ];

  const researchTriggers = [
    /\b(research|investigate|compare|deep dive|comprehensive report|survey|overview of current)\b/i
  ];

  const isTemporal = temporalTriggers.some(rgx => rgx.test(textOnly));
  const isResearch = researchTriggers.some(rgx => rgx.test(textOnly));

  if (isTemporal || isResearch || persona === 'orion') {
    return {
      shouldSearch: true,
      cleanQuery: extractPrivacySafeSearchQuery(textOnly),
      reason: persona === 'orion' ? 'Orion external research' : 'Fresh temporal web query'
    };
  }

  return {
    shouldSearch: false,
    cleanQuery: extractPrivacySafeSearchQuery(textOnly),
    reason: 'Internal curriculum Q&A'
  };
}

export function extractPrivacySafeSearchQuery(prompt: string): string {
  let q = String(prompt || '')
    .replace(/\b(my|our)\s+(class\s+\d+|grade\s+\d+|section\s+\w+|school|students?|teachers?)\b/gi, '')
    .replace(/\b(explain|in simple terms|for class \d+|for grade \d+|step by step|find the|what is the|what are the|tell me about)\b/gi, ' ')
    .replace(/[^\w\s\-.,?']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (q.length < 4) {
    q = String(prompt || '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  if (/\b(latest|current|recent|new)\b/i.test(q) && !/\b(2024|2025|2026)\b/.test(q)) {
    q = `${q} 2026`;
  }

  return q.slice(0, 140).trim();
}

/**
 * Provider 1: Primary APInex Web Search API
 * Endpoint: POST https://api.apinex.bond/v1/tools/web/search
 */
async function searchViaApinex(query: string, apiKey: string, signal: AbortSignal): Promise<WebSearchSource[]> {
  try {
    const resp = await fetch('https://api.apinex.bond/v1/tools/web/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ query, num: 5, limit: 5 }),
      signal
    });

    if (!resp.ok) {
      console.warn(`[APInex Web Search Notice] HTTP ${resp.status}`);
      return [];
    }

    const data = await resp.json();
    const items = data.results || data.data || (Array.isArray(data) ? data : []);
    const sources: WebSearchSource[] = [];

    if (Array.isArray(items)) {
      for (const item of items) {
        if (!item || (!item.url && !item.link)) continue;
        const urlStr = item.url || item.link;
        const auth = classifyDomainAuthority(urlStr);
        sources.push({
          title: sanitizeWebSnippet(item.title || 'Web Search Result', 130),
          url: urlStr,
          domain: auth.domain,
          snippet: sanitizeWebSnippet(item.snippet || item.content || item.description || '', 420),
          sourceType: auth.sourceType,
          publishedDate: item.published_date || item.date
        });
      }
    }

    if (sources.length > 0) {
      console.log(`[APInex Web Search] Retrieved ${sources.length} live sources for: "${query}"`);
    }

    return sources;
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      console.warn('[APInex Search Notice]:', err?.message || err);
    }
    return [];
  }
}

/**
 * Provider 1.1: APInex Web Research API
 * Endpoint: POST https://api.apinex.bond/v1/tools/web/research
 */
export async function performApinexWebResearch(query: string, apiKey: string, signal?: AbortSignal): Promise<WebSearchSource[]> {
  try {
    const resp = await fetch('https://api.apinex.bond/v1/tools/web/research', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ query, depth: 'detailed' }),
      signal
    });

    if (!resp.ok) return [];

    const data = await resp.json();
    const items = data.results || data.sources || data.data || [];
    const sources: WebSearchSource[] = [];

    if (Array.isArray(items)) {
      for (const item of items) {
        if (!item || (!item.url && !item.link)) continue;
        const urlStr = item.url || item.link;
        const auth = classifyDomainAuthority(urlStr);
        sources.push({
          title: sanitizeWebSnippet(item.title || 'Web Research Source', 130),
          url: urlStr,
          domain: auth.domain,
          snippet: sanitizeWebSnippet(item.content || item.snippet || item.summary || '', 500),
          sourceType: auth.sourceType
        });
      }
    }

    return sources;
  } catch {
    return [];
  }
}

/**
 * Fallback Web Search via DuckDuckGo & Wikipedia
 */
async function searchViaFallbackHtml(query: string, signal: AbortSignal): Promise<WebSearchSource[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html'
      },
      signal
    });

    if (!resp.ok) return [];
    const html = await resp.text();
    const results: WebSearchSource[] = [];

    const resultBlocks = html.split(/class="result\s+results_links/i).slice(1, 8);
    for (const block of resultBlocks) {
      const titleMatch = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>|class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);

      if (titleMatch) {
        let rawHref = titleMatch[1] || '';
        const rawTitle = titleMatch[2] || '';
        const rawSnippet = snippetMatch ? (snippetMatch[1] || snippetMatch[2] || '') : '';

        if (rawHref.includes('uddg=')) {
          const uddgMatch = rawHref.match(/[?&]uddg=([^&]+)/);
          if (uddgMatch && uddgMatch[1]) {
            rawHref = decodeURIComponent(uddgMatch[1]);
          }
        }
        if (!rawHref.startsWith('http') || rawHref.includes('duckduckgo.com')) continue;

        const auth = classifyDomainAuthority(rawHref);
        const cleanTitle = sanitizeWebSnippet(rawTitle, 130);
        const cleanSnippet = sanitizeWebSnippet(rawSnippet, 420);

        if (cleanTitle && cleanSnippet) {
          results.push({
            title: cleanTitle,
            url: rawHref,
            domain: auth.domain,
            snippet: cleanSnippet,
            sourceType: auth.sourceType
          });
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Executes controlled server-side web search with APInex Primary.
 */
export async function performControlledWebSearch(rawQuery: string): Promise<WebSearchResult> {
  const startTime = Date.now();
  const queryUsed = extractPrivacySafeSearchQuery(rawQuery);

  if (!queryUsed) {
    return {
      success: false,
      searchPerformed: false,
      queryUsed: '',
      sources: [],
      formattedContext: '',
      error: 'Empty search query',
      latencyMs: 0
    };
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 6000);

  try {
    const apinexKey = getApinexApiKey();
    let sources: WebSearchSource[] = [];

    if (apinexKey) {
      sources = await searchViaApinex(queryUsed, apinexKey, abortController.signal);
      if (sources.length === 0) {
        // Try APInex Web Research endpoint
        sources = await performApinexWebResearch(queryUsed, apinexKey, abortController.signal);
      }
    }

    if (sources.length === 0) {
      sources = await searchViaFallbackHtml(queryUsed, abortController.signal);
    }

    const seenUrls = new Set<string>();
    const uniqueSources: WebSearchSource[] = [];

    for (const src of sources) {
      const normUrl = src.url.toLowerCase().replace(/\/$/, '');
      if (!seenUrls.has(normUrl) && src.snippet.length >= 15) {
        seenUrls.add(normUrl);
        uniqueSources.push(src);
      }
    }

    uniqueSources.sort((a, b) => {
      const scoreA = classifyDomainAuthority(a.url).priorityScore;
      const scoreB = classifyDomainAuthority(b.url).priorityScore;
      return scoreB - scoreA;
    });

    const topSources = uniqueSources.slice(0, 6);

    if (topSources.length === 0) {
      return {
        success: false,
        searchPerformed: true,
        queryUsed,
        sources: [],
        formattedContext: '',
        error: "I couldn't retrieve fresh web information right now.",
        latencyMs: Date.now() - startTime
      };
    }

    const formattedLines = topSources.map(
      (s, i) =>
        `[Web Source ${i + 1}] Title: "${s.title}" | Domain: ${s.domain} (${s.sourceType.toUpperCase()})${
          s.publishedDate ? ` | Date: ${s.publishedDate}` : ''
        }\nURL: ${s.url}\nExcerpt: ${s.snippet}`
    );

    const formattedContext = `<untrusted_external_web_sources>
Search Query Executed: "${queryUsed}"
Retrieved Timestamp: ${new Date().toISOString()}

${formattedLines.join('\n\n')}
</untrusted_external_web_sources>`;

    return {
      success: true,
      searchPerformed: true,
      queryUsed,
      sources: topSources,
      formattedContext,
      latencyMs: Date.now() - startTime
    };
  } catch (err: any) {
    return {
      success: false,
      searchPerformed: true,
      queryUsed,
      sources: [],
      formattedContext: '',
      error: "I couldn't retrieve fresh web information right now.",
      latencyMs: Date.now() - startTime
    };
  } finally {
    clearTimeout(timeout);
  }
}
