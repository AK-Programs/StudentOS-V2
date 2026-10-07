/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Controlled Server-Side Web Search Engine
 * Provides intelligent search intent detection, privacy-preserving query extraction,
 * multi-source retrieval, untrusted content sanitization, and source attribution.
 */

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
 * Sanitizes untrusted webpage snippets before passing to NVIDIA AI models.
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
      domain.includes('un.org') ||
      domain.includes('noaa.gov') ||
      domain.includes('nih.gov')
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
      domain.includes('britannica.com') ||
      domain.includes('mit.edu') ||
      domain.includes('stanford.edu')
    ) {
      return { domain, sourceType: 'academic', priorityScore: 90 };
    }

    if (
      domain.includes('reuters.com') ||
      domain.includes('apnews.com') ||
      domain.includes('bbc.com') ||
      domain.includes('bbc.co.uk') ||
      domain.includes('thehindu.com') ||
      domain.includes('indianexpress.com') ||
      domain.includes('npr.org') ||
      domain.includes('pbs.org') ||
      domain.includes('phys.org') ||
      domain.includes('newscientist.com') ||
      domain.includes('scientificamerican.com') ||
      domain.includes('space.com')
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
 * Determines whether a prompt genuinely requires fresh external web search.
 * Prevents unnecessary searches for foundational curriculum explanations ("Explain photosynthesis")
 * or pure internal StudentOS queries ("Show my homework for tomorrow").
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

  // Strip any attached base64 or internal context markers before checking
  const textOnly = raw
    .replace(/Image Data: data:image\/[^\s]+/gi, '')
    .replace(/\[Attached File:[\s\S]*$/i, '')
    .trim();

  const lower = textOnly.toLowerCase();

  if (explicitMode === 'always') {
    return {
      shouldSearch: true,
      cleanQuery: extractPrivacySafeSearchQuery(textOnly),
      reason: 'User explicitly enabled web search'
    };
  }

  // 1. Check if it's purely an internal StudentOS action/lookup with no external component
  const pureInternalPatterns = [
    /^(show|list|check|what is|what are|do i have)\s+(my|our)\s+(homework|assignments?|attendance|notes?|vault|flashcards?|streak|xp|level|house points|schedule|timetable|tasks?)\s*\??$/i,
    /^(create|add|delete|complete|mark)\s+(a\s+)?(task|note|flashcard|schedule|reminder)/i,
    /^(clear|save)\s+whiteboard/i,
    /^(hi|hello|hey|good morning|good afternoon|good evening|thanks|thank you|ok|okay)\b/i
  ];
  if (pureInternalPatterns.some((rx) => rx.test(lower)) && !/\b(compare|official|circular|policy|guideline|news|latest|web|internet|online)\b/i.test(lower)) {
    return { shouldSearch: false, cleanQuery: '', reason: 'Purely internal StudentOS lookup or greeting' };
  }

  // 2. Check if it's a timeless foundational textbook concept without freshness markers
  const hasFreshnessOrExternalMarker = /\b(latest|current|recent|today|this week|this month|this year|2024|2025|2026|new|newest|breaking|update|updates|updated|live|now|upcoming|circular|policy|guideline|guidelines|regulation|ministry|cbse|ncert|icse|unesco|who|nasa|isro|esa|cern|nobel|olympics|world cup|tournament|match|score|winner|champion|election|president|prime minister|minister|ceo|stock|price|market|weather|earthquake|hurricane|cyclone|mission|launch|rover|telescope|jwst|artemis|chandrayaan|gaganyaan|ai model|technology trend|discover|discovery|discovered|research report|search the web|search online|look up|find online|according to official|cite sources)\b/i.test(
    lower
  );

  if (!hasFreshnessOrExternalMarker) {
    return {
      shouldSearch: false,
      cleanQuery: '',
      reason: 'Timeless educational concept or internal query; no web search needed'
    };
  }

  // 3. Avoid searching if the user only said "today's homework" or "my attendance today" (internal school data)
  const isInternalTodayOnly =
    /\b(my|our)\s+(homework|assignment|attendance|schedule|timetable|classes|tasks|notes)\s+(for\s+)?(today|this week|tomorrow)\b/i.test(lower) &&
    !/\b(compare|official|cbse|ncert|government|national|global|guidance|policy|circular|news|web|external)\b/i.test(lower);

  if (isInternalTodayOnly) {
    return {
      shouldSearch: false,
      cleanQuery: '',
      reason: 'Internal StudentOS temporal query (homework/attendance today)'
    };
  }

  return {
    shouldSearch: true,
    cleanQuery: extractPrivacySafeSearchQuery(textOnly),
    reason: persona === 'orion' ? 'Orion external authority / current research query' : 'AI Buddy fresh web information query'
  };
}

/**
 * Strips private StudentOS identifiers, conversational filler, and grade instructions
 * so only the core public topic is sent to external search providers.
 */
export function extractPrivacySafeSearchQuery(prompt: string): string {
  let q = String(prompt || '')
    .replace(/\b(my|our)\s+(class\s+\d+|grade\s+\d+|section\s+\w+|school|students?|teachers?)\b/gi, '')
    .replace(/\b(explain|in simple terms|for class \d+|for grade \d+|step by step|and compare with our|compare our|with our|prepare a short report|research and|find the|what is the|what are the|tell me about)\b/gi, ' ')
    .replace(/[^\w\s\-.,?']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (q.length < 4) {
    q = String(prompt || '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Add current year hint if query asks for "latest" or "current" without a year
  if (/\b(latest|current|recent|new)\b/i.test(q) && !/\b(2024|2025|2026)\b/.test(q)) {
    q = `${q} 2025 2026`;
  }

  return q.slice(0, 140).trim();
}

/**
 * Provider 1: Tavily Search API (if TAVILY_API_KEY is configured in server environment)
 */
async function searchViaTavily(query: string, apiKey: string, signal: AbortSignal): Promise<WebSearchSource[]> {
  const resp = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: 6
    }),
    signal
  });

  if (!resp.ok) return [];
  const data = await resp.json();
  if (!Array.isArray(data.results)) return [];

  return data.results
    .filter((r: any) => r && r.url && r.title)
    .map((r: any) => {
      const auth = classifyDomainAuthority(r.url);
      return {
        title: sanitizeWebSnippet(r.title, 120),
        url: String(r.url),
        domain: auth.domain,
        snippet: sanitizeWebSnippet(r.content || r.snippet || '', 400),
        sourceType: auth.sourceType,
        publishedDate: r.published_date || undefined
      };
    });
}

/**
 * Provider 2: DuckDuckGo HTML Search (Zero API key required, retrieves real live web results)
 */
async function searchViaDuckDuckGoHtml(query: string, signal: AbortSignal): Promise<WebSearchSource[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    signal
  });

  if (!resp.ok) return [];
  const html = await resp.text();
  const results: WebSearchSource[] = [];

  // Match result blocks in DDG HTML
  const resultBlocks = html.split(/class="result\s+results_links/i).slice(1, 10);
  for (const block of resultBlocks) {
    const titleMatch = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>|class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);

    if (titleMatch) {
      let rawHref = titleMatch[1] || '';
      const rawTitle = titleMatch[2] || '';
      const rawSnippet = snippetMatch ? (snippetMatch[1] || snippetMatch[2] || '') : '';

      // Decode DuckDuckGo redirect URLs (?uddg=...)
      if (rawHref.includes('uddg=')) {
        try {
          const uddgMatch = rawHref.match(/[?&]uddg=([^&]+)/);
          if (uddgMatch && uddgMatch[1]) {
            rawHref = decodeURIComponent(uddgMatch[1]);
          }
        } catch (_) {}
      } else if (rawHref.startsWith('//')) {
        rawHref = 'https:' + rawHref;
      }

      if (!rawHref.startsWith('http')) continue;
      // Skip ad/tracker links
      if (rawHref.includes('duckduckgo.com/y.js')) continue;

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
}

/**
 * Provider 3: Wikipedia Live Search API (Authoritative encyclopedic & current event articles)
 */
async function searchViaWikipedia(query: string, signal: AbortSignal): Promise<WebSearchSource[]> {
  const cleanQ = query.replace(/\b(2025|2026|latest|current)\b/gi, '').trim() || query;
  const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    cleanQ
  )}&utf8=&format=json&srlimit=3`;

  const resp = await fetch(apiUrl, {
    headers: { 'User-Agent': 'StudentOS-Educational-Search/3.0 (https://studentos.internal)' },
    signal
  });

  if (!resp.ok) return [];
  const data = await resp.json();
  const items = data?.query?.search || [];
  if (!Array.isArray(items)) return [];

  return items.map((item: any) => {
    const title = sanitizeWebSnippet(item.title || 'Wikipedia Reference', 120);
    const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(String(item.title || '').replace(/\s+/g, '_'))}`;
    const snippet = sanitizeWebSnippet(item.snippet || '', 400);
    return {
      title: `${title} — Wikipedia Encyclopedia`,
      url: pageUrl,
      domain: 'en.wikipedia.org',
      snippet,
      sourceType: 'reference' as const,
      publishedDate: item.timestamp ? item.timestamp.split('T')[0] : undefined
    };
  });
}

/**
 * Provider 4: ArXiv Scientific Research API (for science, physics, math, CS, AI discovery queries)
 */
async function searchViaArxiv(query: string, signal: AbortSignal): Promise<WebSearchSource[]> {
  if (!/\b(science|scientific|physics|quantum|math|biology|chemistry|astronomy|nasa|space|ai|neural|algorithm|research|discovery|study|paper|theorem)\b/i.test(query)) {
    return [];
  }
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=2&sortBy=submittedDate&sortOrder=descending`;
  const resp = await fetch(url, { signal });
  if (!resp.ok) return [];
  const xml = await resp.text();

  const entries = xml.split('<entry>').slice(1, 3);
  const sources: WebSearchSource[] = [];

  for (const entry of entries) {
    const title = entry.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '';
    const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/i)?.[1] || '';
    const idUrl = entry.match(/<id>([\s\S]*?)<\/id>/i)?.[1] || '';
    const published = entry.match(/<published>([\s\S]*?)<\/published>/i)?.[1] || '';

    if (title && summary && idUrl) {
      sources.push({
        title: `${sanitizeWebSnippet(title, 120)} (arXiv Research)`,
        url: idUrl.trim(),
        domain: 'arxiv.org',
        snippet: sanitizeWebSnippet(summary, 380),
        sourceType: 'academic',
        publishedDate: published ? published.split('T')[0] : undefined
      });
    }
  }
  return sources;
}

/**
 * Executes controlled server-side web search with strict timeout, deduplication,
 * authority ranking, and untrusted content sanitization.
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
  const timeout = setTimeout(() => abortController.abort(), 5500);

  try {
    const tavilyKey = (process.env.TAVILY_API_KEY || process.env.VITE_TAVILY_API_KEY || '').trim();

    const tasks: Promise<WebSearchSource[]>[] = [
      searchViaDuckDuckGoHtml(queryUsed, abortController.signal).catch(() => []),
      searchViaWikipedia(queryUsed, abortController.signal).catch(() => []),
      searchViaArxiv(queryUsed, abortController.signal).catch(() => [])
    ];

    if (tavilyKey) {
      tasks.unshift(searchViaTavily(queryUsed, tavilyKey, abortController.signal).catch(() => []));
    }

    const settledArrays = await Promise.all(tasks);
    const merged = settledArrays.flat();

    // Deduplicate by URL and sort by authority score
    const seenUrls = new Set<string>();
    const uniqueSources: WebSearchSource[] = [];

    for (const src of merged) {
      const normUrl = src.url.toLowerCase().replace(/\/$/, '');
      if (!seenUrls.has(normUrl) && src.snippet.length >= 20) {
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
