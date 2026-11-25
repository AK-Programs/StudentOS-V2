/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Streaming-safe Markdown + LaTeX/Chemistry parser for Veylentra
 * - Supports inline ($...$, \(...\)) and display ($$...$$, \[...\], standalone \begin{...}...\end{...}) math
 * - Expands chemistry notation (\ce{...}) safely without requiring mhchem runtime bundle
 * - Prevents partial-delimiter flickering during real-time token streaming
 * - Excludes ordinary currency tokens ($5, $12.99) from math parsing
 */

export interface StabilizedStreamResult {
  stableText: string;
  pendingKind: 'code' | 'display_math' | 'inline_math' | null;
  pendingLabel?: string;
  pendingRaw?: string;
}

export type MarkdownBlock =
  | { type: 'code'; language: string; code: string }
  | { type: 'math_display'; formula: string; rawFormula: string }
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'hr' }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'list'; ordered: boolean; start: number; items: string[] }
  | { type: 'paragraph'; text: string }
  | { type: 'spacer' };

export type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'code'; value: string }
  | { type: 'math'; formula: string; rawFormula: string }
  | { type: 'link'; label: string; url: string };

const SUPPORTED_ENVS = [
  'aligned',
  'align\\*',
  'align',
  'pmatrix',
  'bmatrix',
  'vmatrix',
  'Bmatrix',
  'cases',
  'gather',
  'gathered',
  'equation',
  'equation\\*',
  'array'
];

/**
 * Expands lightweight chemistry notation inside \ce{...} into valid KaTeX commands
 * and normalizes common LaTeX shorthands.
 */
export function expandChemistryMacros(input: string): string {
  if (!input || !input.includes('\\ce{')) return input;

  let out = '';
  let i = 0;
  while (i < input.length) {
    if (input.startsWith('\\ce{', i)) {
      i += 4;
      let depth = 1;
      let inner = '';
      while (i < input.length && depth > 0) {
        const ch = input[i];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        if (depth > 0) inner += ch;
        i++;
      }
      out += convertCeInner(inner);
    } else {
      out += input[i];
      i++;
    }
  }
  return out;
}

function convertCeInner(rawInner: string): string {
  let s = rawInner.trim();
  // Reaction arrows
  s = s.replace(/<=>/g, ' \\rightleftharpoons ');
  s = s.replace(/<->/g, ' \\leftrightarrow ');
  s = s.replace(/->/g, ' \\rightarrow ');
  s = s.replace(/<-/g, ' \\leftarrow ');

  // Process tokens separated by whitespace
  const tokens = s.split(/(\s+)/);
  return tokens
    .map((tok) => {
      if (!tok || /^\s+$/.test(tok)) return tok;
      if (tok.startsWith('\\')) return tok;
      if (tok === '+' || tok === '=') return tok;

      // Preserve leading stoichiometric coefficient (e.g., 2H2O -> 2\text{H}_{2}\text{O})
      const leadMatch = tok.match(/^(\d+)([A-Za-z(].*)$/);
      const coeff = leadMatch ? leadMatch[1] : '';
      const formulaPart = leadMatch ? leadMatch[2] : tok;

      // Convert trailing charge like SO4^2- or Fe^3+ or OH-
      let transformed = formulaPart.replace(
        /\^([0-9]*[+-]|[+-])/g,
        (_m, chg) => `^{${chg}}`
      );

      // Subscripts for element counts e.g. H2O, CO2, (OH)2
      transformed = transformed.replace(
        /([A-Za-z)\]])(\d+)/g,
        (_m, sym, num) => `${sym}_{${num}}`
      );

      // Wrap bare element letters in \mathrm{...} while preserving _{...} and ^{...}
      transformed = transformed.replace(/([A-Za-z]+)/g, (letters) => `\\mathrm{${letters}}`);
      return `${coeff}${transformed}`;
    })
    .join('');
}

export function preprocessLatex(rawFormula: string): string {
  if (!rawFormula) return '';
  let f = rawFormula.trim();
  f = expandChemistryMacros(f);
  f = f
    .replace(/\\implies\b/g, '\\Rightarrow')
    .replace(/\\iff\b/g, '\\Leftrightarrow');
  return f;
}

/**
 * Buffers unclosed code blocks or math delimiters at the end of an active stream
 * so partial expressions never render broken/red KaTeX error text while typing.
 */
export function stabilizeStreamingMarkdown(raw: string, isStreaming: boolean): StabilizedStreamResult {
  if (!raw) return { stableText: '', pendingKind: null };
  if (!isStreaming) return { stableText: raw, pendingKind: null };

  // 1. Check unclosed fenced code blocks (odd count of ```)
  const fenceMatches = [...raw.matchAll(/```/g)];
  if (fenceMatches.length % 2 === 1) {
    const lastFenceIdx = fenceMatches[fenceMatches.length - 1].index ?? raw.length;
    const tail = raw.slice(lastFenceIdx + 3);
    const firstNewline = tail.indexOf('\n');
    const lang = firstNewline === -1 ? tail.trim() : tail.slice(0, firstNewline).trim();
    return {
      stableText: raw.slice(0, lastFenceIdx).trimEnd(),
      pendingKind: 'code',
      pendingLabel: lang ? `Writing ${lang} code…` : 'Writing code block…',
      pendingRaw: raw.slice(lastFenceIdx)
    };
  }

  // Strip complete fenced code blocks temporarily to inspect open math delimiters safely
  const withoutCode = raw.replace(/```[\s\S]*?```/g, (m) => ' '.repeat(m.length));

  // 2. Check unclosed $$...$$
  const doubleDollarIndices: number[] = [];
  for (let i = 0; i < withoutCode.length - 1; i++) {
    if (withoutCode[i] === '$' && withoutCode[i + 1] === '$' && (i === 0 || withoutCode[i - 1] !== '\\')) {
      doubleDollarIndices.push(i);
      i++;
    }
  }
  if (doubleDollarIndices.length % 2 === 1) {
    const cutIdx = doubleDollarIndices[doubleDollarIndices.length - 1];
    return {
      stableText: raw.slice(0, cutIdx).trimEnd(),
      pendingKind: 'display_math',
      pendingLabel: 'Formatting equation…',
      pendingRaw: raw.slice(cutIdx)
    };
  }

  // 3. Check unclosed \[ ... \]
  const lastOpenBracket = withoutCode.lastIndexOf('\\[');
  const lastCloseBracket = withoutCode.lastIndexOf('\\]');
  if (lastOpenBracket > lastCloseBracket) {
    return {
      stableText: raw.slice(0, lastOpenBracket).trimEnd(),
      pendingKind: 'display_math',
      pendingLabel: 'Formatting equation…',
      pendingRaw: raw.slice(lastOpenBracket)
    };
  }

  // 4. Check unclosed \begin{...}...\end{...}
  const beginMatches = [...withoutCode.matchAll(/\\begin\{([a-zA-Z*]+)\}/g)];
  const endMatches = [...withoutCode.matchAll(/\\end\{([a-zA-Z*]+)\}/g)];
  if (beginMatches.length > endMatches.length) {
    const openBegin = beginMatches[beginMatches.length - 1];
    const cutIdx = openBegin.index ?? raw.length;
    return {
      stableText: raw.slice(0, cutIdx).trimEnd(),
      pendingKind: 'display_math',
      pendingLabel: `Formatting ${openBegin[1].replace('*', '')} math block…`,
      pendingRaw: raw.slice(cutIdx)
    };
  }

  // 5. Check unclosed \( ... \)
  const lastOpenParen = withoutCode.lastIndexOf('\\(');
  const lastCloseParen = withoutCode.lastIndexOf('\\)');
  if (lastOpenParen > lastCloseParen) {
    return {
      stableText: raw.slice(0, lastOpenParen).trimEnd(),
      pendingKind: 'inline_math',
      pendingLabel: 'Formatting expression…',
      pendingRaw: raw.slice(lastOpenParen)
    };
  }

  // 6. Check trailing unclosed inline $ on the last line (ignore currency like $5 or $12.50)
  const lastNewline = withoutCode.lastIndexOf('\n');
  const lastLine = withoutCode.slice(lastNewline + 1);
  // Remove paired $$ and paired $...$ on the last line
  const strippedLastLine = lastLine
    .replace(/\$\$[\s\S]*?\$\$/g, '')
    .replace(/(^|[^\\])\$([^$\n]+?)\$/g, '$1');

  const unclosedSingleMatch = strippedLastLine.match(/(?:^|[^\\])\$([^\s$][^$\n]*)$/);
  if (unclosedSingleMatch) {
    const afterDollar = unclosedSingleMatch[1];
    // Treat `$5`, `$12.50`, `$1,000` as currency unless followed by math symbols (=, +, -, ^, _, /, \, {)
    const looksLikeCurrencyOnly = /^\d[\d,.]*(?:\s|$)/.test(afterDollar) && !/[=+\-^_\\/{}()]/.test(afterDollar);
    if (!looksLikeCurrencyOnly) {
      const dollarPosInLine = lastLine.lastIndexOf('$' + afterDollar);
      if (dollarPosInLine >= 0) {
        const cutIdx = lastNewline + 1 + dollarPosInLine;
        return {
          stableText: raw.slice(0, cutIdx).trimEnd(),
          pendingKind: 'inline_math',
          pendingLabel: 'Formatting inline math…',
          pendingRaw: raw.slice(cutIdx)
        };
      }
    }
  }

  return { stableText: raw, pendingKind: null };
}

/**
 * Splits a single line of text into inline markdown + math tokens.
 * Protects currency numbers like $5 or $19.99 from being mistaken for LaTeX.
 */
export function splitInlineTextWithMath(line: string): InlineToken[] {
  if (!line) return [];
  const tokens: InlineToken[] = [];
  let cursor = 0;

  // Combined matcher for inline tokens in priority order:
  // 1. Inline code `...`
  // 2. Inline paren math \(...\)
  // 3. Inline dollar math $...$ (non-greedy, same line, must not start with space or end with space unless math)
  // 4. Bold **...**
  // 5. Italic *...* (single asterisk)
  // 6. Markdown link [text](url)
  // 7. Bare URL https://... or http://...
  const pattern = /(`[^`\n]+`)|(\\\([\s\S]*?\\\))|(\$(?!\s)(?:\\.|[^$\n\\])+(?<!\s)\$)|(\*\*[^*\n]+?\*\*)|(\*[^*\n]+?\*)|(\[[^\]]+\]\([^)\s]+\))|(https?:\/\/[^\s<)\]]+)/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    const matchIndex = match.index;

    // Check currency false positive on $...$ (e.g., "$5 to $10")
    if (match[3]) {
      const inner = match[3].slice(1, -1);
      const isCurrencyPair = /^\d[\d,.]*(\s+(to|and|or|-)\s+\$?\d[\d,.]*)?$/i.test(inner.trim()) ||
        /^\d[\d,.]*\s+[a-zA-Z]/.test(inner);
      if (isCurrencyPair) {
        // Rewind pattern cursor past the opening $ so the second $ can still pair later if needed
        if (matchIndex > cursor) {
          tokens.push({ type: 'text', value: line.slice(cursor, matchIndex) });
        }
        tokens.push({ type: 'text', value: '$' });
        pattern.lastIndex = matchIndex + 1;
        cursor = matchIndex + 1;
        continue;
      }
    }

    if (matchIndex > cursor) {
      tokens.push({ type: 'text', value: line.slice(cursor, matchIndex) });
    }

    if (match[1]) {
      tokens.push({ type: 'code', value: match[1].slice(1, -1) });
    } else if (match[2]) {
      const rawFormula = match[2].slice(2, -2).trim();
      tokens.push({ type: 'math', rawFormula, formula: preprocessLatex(rawFormula) });
    } else if (match[3]) {
      const rawFormula = match[3].slice(1, -1).trim();
      tokens.push({ type: 'math', rawFormula, formula: preprocessLatex(rawFormula) });
    } else if (match[4]) {
      tokens.push({ type: 'bold', value: match[4].slice(2, -2) });
    } else if (match[5]) {
      tokens.push({ type: 'italic', value: match[5].slice(1, -1) });
    } else if (match[6]) {
      const lm = match[6].match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (lm) {
        tokens.push({ type: 'link', label: lm[1], url: lm[2] });
      } else {
        tokens.push({ type: 'text', value: match[6] });
      }
    } else if (match[7]) {
      const cleanUrl = match[7].replace(/[.,;!?]+$/, '');
      const trailing = match[7].slice(cleanUrl.length);
      tokens.push({ type: 'link', label: cleanUrl, url: cleanUrl });
      if (trailing) {
        tokens.push({ type: 'text', value: trailing });
      }
    }

    cursor = pattern.lastIndex;
  }

  if (cursor < line.length) {
    tokens.push({ type: 'text', value: line.slice(cursor) });
  }

  return tokens;
}

/**
 * Segments stabilized markdown + display math into typed rendering blocks.
 */
export function segmentMarkdownAndMath(rawText: string): MarkdownBlock[] {
  if (!rawText) return [];

  const envAlternation = SUPPORTED_ENVS.join('|');
  const displayRegex = new RegExp(
    '(```[\\s\\S]*?```|\\$\\$[\\s\\S]*?\\$\\$|\\\\\\[[\\s\\S]*?\\\\\\]|\\\\begin\\{(?:' +
      envAlternation +
      ')\\}[\\s\\S]*?\\\\end\\{(?:' +
      envAlternation +
      ')\\})',
    'g'
  );

  const rawChunks = rawText.split(displayRegex);
  const blocks: MarkdownBlock[] = [];

  for (const chunk of rawChunks) {
    if (!chunk) continue;

    // 1. Fenced code block
    if (chunk.startsWith('```') && chunk.endsWith('```') && chunk.length >= 6) {
      const m = chunk.match(/^```([a-zA-Z0-9_-]*)\r?\n?([\s\S]*?)```$/);
      const language = (m?.[1] || '').trim();
      const code = (m?.[2] ?? chunk.slice(3, -3)).replace(/\n$/, '');
      blocks.push({ type: 'code', language, code });
      continue;
    }

    // 2. Display math $$...$$ or \[...\]
    if (
      (chunk.startsWith('$$') && chunk.endsWith('$$')) ||
      (chunk.startsWith('\\[') && chunk.endsWith('\\]'))
    ) {
      const rawFormula = chunk.replace(/^\$\$|\$\$$|^\\\[|\\\]$/g, '').trim();
      if (rawFormula) {
        blocks.push({
          type: 'math_display',
          rawFormula,
          formula: preprocessLatex(rawFormula)
        });
      }
      continue;
    }

    // 3. Standalone \begin{...}...\end{...} block
    if (/^\\begin\{/.test(chunk.trim()) && /\\end\{[^}]+\}$/.test(chunk.trim())) {
      const rawFormula = chunk.trim();
      blocks.push({
        type: 'math_display',
        rawFormula,
        formula: preprocessLatex(rawFormula)
      });
      continue;
    }

    // 4. Parse line-based Markdown structures cleanly (grouping tables, lists, blockquotes)
    const lines = chunk.split(/\r?\n/);
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        // Collapse consecutive spacers
        if (blocks.length > 0 && blocks[blocks.length - 1].type !== 'spacer') {
          blocks.push({ type: 'spacer' });
        }
        i++;
        continue;
      }

      if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
        blocks.push({ type: 'hr' });
        i++;
        continue;
      }

      if (trimmed.startsWith('### ')) {
        blocks.push({ type: 'heading', level: 3, text: trimmed.slice(4) });
        i++;
        continue;
      }
      if (trimmed.startsWith('## ')) {
        blocks.push({ type: 'heading', level: 2, text: trimmed.slice(3) });
        i++;
        continue;
      }
      if (trimmed.startsWith('# ')) {
        blocks.push({ type: 'heading', level: 1, text: trimmed.slice(2) });
        i++;
        continue;
      }

      // Markdown table grouping
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }
        const parsedRows = tableLines
          .filter((tl) => !/^\|[\s\-:|]+\|$/.test(tl))
          .map((tl) =>
            tl
              .slice(1, -1)
              .split('|')
              .map((c) => c.trim())
          );

        if (parsedRows.length > 0) {
          blocks.push({
            type: 'table',
            headers: parsedRows[0],
            rows: parsedRows.slice(1)
          });
        }
        continue;
      }

      // Blockquote grouping
      if (trimmed.startsWith('>')) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        blocks.push({ type: 'blockquote', lines: quoteLines });
        continue;
      }

      // Unordered list grouping
      if (/^[-*•]\s+/.test(trimmed)) {
        const items: string[] = [];
        while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
          i++;
        }
        blocks.push({ type: 'list', ordered: false, start: 1, items });
        continue;
      }

      // Ordered list grouping
      if (/^\d+[.)]\s+/.test(trimmed)) {
        const firstNumMatch = trimmed.match(/^(\d+)[.)]\s+/);
        const start = firstNumMatch ? parseInt(firstNumMatch[1], 10) || 1 : 1;
        const items: string[] = [];
        while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
          i++;
        }
        blocks.push({ type: 'list', ordered: true, start, items });
        continue;
      }

      blocks.push({ type: 'paragraph', text: line });
      i++;
    }
  }

  // Trim leading/trailing spacer
  while (blocks.length > 0 && blocks[blocks.length - 1].type === 'spacer') {
    blocks.pop();
  }

  return blocks;
}
