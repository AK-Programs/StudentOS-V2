/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Veylentra Lecture Notes PDF Generator
 * Faithfully mirrors the Reader View formatting:
 * - Real tables: aligned multi-column cells, alternating rows, borders, header styling, and pagination
 * - Inline formatting: bold (**text**), italic (*text*), inline code (`code`) rendered with proper fonts
 * - Typography: H1, H2, H3 with hierarchical sizing, clean spacing, and orphan prevention
 * - Code blocks: dark terminal containers with monospaced text and language badge
 * - Math & symbol transliteration: math symbols (arrows, operators, Greek letters, powers) preserved
 * - Task list checkboxes ([x], [ ]) and bullet lists
 * - Blockquotes and callouts with colored accent borders
 * - Multi-page headers, footers with page numbers, and institutional branding
 */

import { jsPDF } from 'jspdf';

interface ParsedTable {
  type: 'table';
  headers: string[];
  rows: string[][];
}

interface ParsedCodeBlock {
  type: 'code';
  language: string;
  code: string;
}

interface ParsedCallout {
  type: 'callout';
  text: string;
}

interface ParsedHeading {
  type: 'heading';
  level: 1 | 2 | 3;
  text: string;
}

interface ParsedListItem {
  type: 'list';
  ordered: boolean;
  number?: string;
  text: string;
}

interface ParsedTaskItem {
  type: 'task';
  checked: boolean;
  text: string;
}

interface ParsedParagraph {
  type: 'paragraph';
  text: string;
}

interface ParsedDivider {
  type: 'divider';
}

type ParsedBlock =
  | ParsedTable
  | ParsedCodeBlock
  | ParsedCallout
  | ParsedHeading
  | ParsedListItem
  | ParsedTaskItem
  | ParsedParagraph
  | ParsedDivider;

export interface InlineRun {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
}

/**
 * Transliterates common Unicode symbols, Greek letters, and math notations into
 * clean, readable WinAnsi / Latin-1 characters so jsPDF never drops them or renders "Ø=ÜÚ".
 */
export function transliterateMathAndSymbols(text: string): string {
  if (!text) return '';

  return text
    // Arrows
    .replace(/⇄/g, '<->')
    .replace(/↔/g, '<->')
    .replace(/⇔/g, '<=>')
    .replace(/→/g, '->')
    .replace(/⇒/g, '=>')
    .replace(/←/g, '<-')
    .replace(/⇐/g, '<=')
    .replace(/↑/g, '^')
    .replace(/↓/g, 'v')
    // Comparison & Arithmetic
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≠/g, '!=')
    .replace(/≈/g, '~=')
    .replace(/±/g, '+/-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/√/g, 'sqrt')
    .replace(/∞/g, 'infinity')
    .replace(/∑/g, 'SUM')
    .replace(/∫/g, 'INT')
    .replace(/∂/g, 'd')
    .replace(/∇/g, 'grad')
    // Greek letters
    .replace(/α/g, 'alpha')
    .replace(/β/g, 'beta')
    .replace(/γ/g, 'gamma')
    .replace(/Γ/g, 'Gamma')
    .replace(/δ/g, 'delta')
    .replace(/Δ/g, 'Delta')
    .replace(/ε/g, 'epsilon')
    .replace(/θ/g, 'theta')
    .replace(/Θ/g, 'Theta')
    .replace(/λ/g, 'lambda')
    .replace(/Λ/g, 'Lambda')
    .replace(/μ/g, 'mu')
    .replace(/π/g, 'pi')
    .replace(/Π/g, 'Pi')
    .replace(/σ/g, 'sigma')
    .replace(/Σ/g, 'Sigma')
    .replace(/τ/g, 'tau')
    .replace(/φ/g, 'phi')
    .replace(/Φ/g, 'Phi')
    .replace(/ω/g, 'omega')
    .replace(/Ω/g, 'Omega')
    // Superscripts & Subscripts
    .replace(/⁰/g, '^0')
    .replace(/¹/g, '^1')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4')
    .replace(/⁵/g, '^5')
    .replace(/⁶/g, '^6')
    .replace(/⁷/g, '^7')
    .replace(/⁸/g, '^8')
    .replace(/⁹/g, '^9')
    .replace(/⁺/g, '^+')
    .replace(/⁻/g, '^-')
    // Common symbols
    .replace(/✓/g, '[x]')
    .replace(/✗/g, '[ ]')
    .replace(/•/g, '-')
    .replace(/★/g, '*')
    .replace(/☆/g, '*')
    .replace(/℃/g, ' deg C')
    .replace(/℉/g, ' deg F')
    .replace(/°/g, ' deg')
    .replace(/…/g, '...')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/–/g, '-')
    .replace(/—/g, ' -- ');
}

/**
 * Sanitizes text for PDF rendering:
 * 1. Transliterates math and symbols to preserve their meaning
 * 2. Strips raw emojis and unrenderable control characters
 * 3. Keeps printable ASCII and valid Latin-1 supplement
 */
export function sanitizeTextForPdf(text: string): string {
  if (!text) return '';

  let cleaned = transliterateMathAndSymbols(text);

  // Remove emojis and multi-byte surrogate pairs
  cleaned = cleaned.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{200D}\u{FE0F}]/gu, '');

  // Keep printable ASCII (0x20-0x7E) and Latin-1 supplement (0xA0-0xFF), plus newlines & tabs
  cleaned = cleaned.replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, '');

  // Normalize spaces
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');

  return cleaned.trim();
}

/**
 * Parses a string with markdown formatting into structured inline runs
 */
export function parseInlineRuns(rawText: string): InlineRun[] {
  const sanitized = transliterateMathAndSymbols(rawText);
  if (!sanitized) return [];

  // Match links [text](url), bold **text** or __text__, inline code `code`, italic *text* or _text_
  const tokenRegex = /(\[([^\]]+)\]\([^\)]+\)|\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\*([^*]+)\*|_([^_]+)_)/g;
  const runs: InlineRun[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(sanitized)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = sanitized.slice(lastIndex, match.index);
      if (textBefore) {
        runs.push({ text: textBefore, bold: false, italic: false, code: false });
      }
    }

    if (match[2]) {
      // Link: [text](url) -> render as text
      runs.push({ text: match[2], bold: false, italic: false, code: false });
    } else if (match[3] || match[4]) {
      // Bold: **text** or __text__
      runs.push({ text: match[3] || match[4], bold: true, italic: false, code: false });
    } else if (match[5]) {
      // Code: `code`
      runs.push({ text: match[5], bold: false, italic: false, code: true });
    } else if (match[6] || match[7]) {
      // Italic: *text* or _text_
      runs.push({ text: match[6] || match[7], bold: false, italic: true, code: false });
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < sanitized.length) {
    const remaining = sanitized.slice(lastIndex);
    if (remaining) {
      runs.push({ text: remaining, bold: false, italic: false, code: false });
    }
  }

  return runs;
}

/**
 * Strips raw markdown tags for plain measurement
 */
export function cleanInlineMarkdown(text: string): string {
  if (!text) return '';
  const transliterated = transliterateMathAndSymbols(text);
  return transliterated
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\$\$(.*?)\$\$/g, '$1')
    .replace(/\$(.*?)\$/g, '$1')
    .replace(/^[ \t]*#+\s*/, '')
    .trim();
}

/**
 * Parses markdown text into structured semantic blocks.
 */
function parseMarkdownToBlocks(content: string): ParsedBlock[] {
  const lines = content.split('\n');
  const blocks: ParsedBlock[] = [];
  let i = 0;

  const isTableRow = (lineStr: string): boolean => {
    const trimmed = lineStr.trim();
    if (!trimmed.includes('|')) return false;
    // Starts with | or has at least 2 pipes
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) return true;
    const parts = trimmed.split('|');
    return parts.length >= 2;
  };

  const isTableSeparator = (lineStr: string): boolean => {
    const trimmed = lineStr.trim();
    if (!trimmed.includes('|')) return false;
    const parts = trimmed.replace(/^\||\|$/g, '').split('|');
    return parts.length >= 1 && parts.every(p => /^[\s\-:|]+$/.test(p));
  };

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Horizontal Divider
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      blocks.push({ type: 'divider' });
      i++;
      continue;
    }

    // Code Block ```lang
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++; // skip closing ```
      }
      blocks.push({
        type: 'code',
        language: language || 'code',
        code: codeLines.join('\n')
      });
      continue;
    }

    // Table Detection
    if (isTableRow(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 1) {
        const parseCells = (rowStr: string): string[] => {
          let s = rowStr.trim();
          if (s.startsWith('|')) s = s.slice(1);
          if (s.endsWith('|')) s = s.slice(0, -1);
          return s.split('|').map(c => c.trim());
        };

        let headers: string[] = [];
        const rows: string[][] = [];

        if (tableLines.length >= 2 && isTableSeparator(tableLines[1])) {
          headers = parseCells(tableLines[0]);
          for (let r = 2; r < tableLines.length; r++) {
            if (!isTableSeparator(tableLines[r])) {
              rows.push(parseCells(tableLines[r]));
            }
          }
        } else {
          headers = parseCells(tableLines[0]);
          for (let r = 1; r < tableLines.length; r++) {
            if (!isTableSeparator(tableLines[r])) {
              rows.push(parseCells(tableLines[r]));
            }
          }
        }

        if (headers.length > 0) {
          blocks.push({
            type: 'table',
            headers,
            rows
          });
          continue;
        }
      }
    }

    // Blockquote or Callout (> text)
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({
        type: 'callout',
        text: quoteLines.join(' ')
      });
      continue;
    }

    // Headings: #, ##, ###, ####, #####, ######
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 3) as 1 | 2 | 3;
      blocks.push({
        type: 'heading',
        level,
        text: headingMatch[2].trim()
      });
      i++;
      continue;
    }

    // Task Items (- [ ] or - [x])
    if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
      const checked = trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ');
      blocks.push({
        type: 'task',
        checked,
        text: trimmed.slice(6).trim()
      });
      i++;
      continue;
    }

    // Unordered List Items (- or *)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({
        type: 'list',
        ordered: false,
        text: trimmed.slice(2).trim()
      });
      i++;
      continue;
    }

    // Numbered List Items (1. , 2. )
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      blocks.push({
        type: 'list',
        ordered: true,
        number: numberedMatch[1],
        text: numberedMatch[2].trim()
      });
      i++;
      continue;
    }

    // Standard Paragraph
    blocks.push({
      type: 'paragraph',
      text: trimmed
    });
    i++;
  }

  return blocks;
}

/**
 * Renders inline text runs with bold, italic, code styling and word-wrapping.
 * Returns the height taken by the rendered text.
 */
function renderFormattedRuns(
  doc: jsPDF,
  runs: InlineRun[],
  startX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  baseFontSize: number = 10,
  defaultColor: [number, number, number] = [51, 65, 85],
  onPageBreakNeeded?: (neededH: number) => number
): number {
  if (runs.length === 0) return 0;

  // Flatten runs into tokens (words and spaces)
  interface Token {
    text: string;
    bold: boolean;
    italic: boolean;
    code: boolean;
    isSpace: boolean;
    width: number;
  }

  const tokens: Token[] = [];
  for (const run of runs) {
    const words = run.text.split(/(\s+)/);
    for (const w of words) {
      if (!w) continue;
      const isSpace = /^\s+$/.test(w);

      // Measure token with its font
      if (run.code) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(baseFontSize * 0.9);
      } else if (run.bold && run.italic) {
        doc.setFont('helvetica', 'bolditalic');
        doc.setFontSize(baseFontSize);
      } else if (run.bold) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(baseFontSize);
      } else if (run.italic) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(baseFontSize);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(baseFontSize);
      }

      const width = isSpace ? doc.getTextWidth(' ') : doc.getTextWidth(w);
      tokens.push({
        text: isSpace ? ' ' : w,
        bold: run.bold,
        italic: run.italic,
        code: run.code,
        isSpace,
        width
      });
    }
  }

  // Pack tokens into wrapped lines
  interface LineToken {
    text: string;
    bold: boolean;
    italic: boolean;
    code: boolean;
    width: number;
  }
  const lines: LineToken[][] = [];
  let currentLine: LineToken[] = [];
  let currentLineWidth = 0;

  for (const token of tokens) {
    if (token.isSpace) {
      if (currentLine.length > 0) {
        currentLine.push(token);
        currentLineWidth += token.width;
      }
      continue;
    }

    if (currentLineWidth + token.width <= maxWidth || currentLine.length === 0) {
      currentLine.push(token);
      currentLineWidth += token.width;
    } else {
      // Line break
      // Remove trailing space from current line
      while (currentLine.length > 0 && currentLine[currentLine.length - 1].text === ' ') {
        currentLine.pop();
      }
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      currentLine = [token];
      currentLineWidth = token.width;
    }
  }

  while (currentLine.length > 0 && currentLine[currentLine.length - 1].text === ' ') {
    currentLine.pop();
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  // Draw lines
  let curY = startY;
  for (let l = 0; l < lines.length; l++) {
    if (onPageBreakNeeded) {
      curY = onPageBreakNeeded(lineHeight);
    }

    let curX = startX;
    const lineTokens = lines[l];

    for (const t of lineTokens) {
      if (t.code) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(baseFontSize * 0.9);
        doc.setTextColor(180, 83, 9); // Amber-700
      } else if (t.bold && t.italic) {
        doc.setFont('helvetica', 'bolditalic');
        doc.setFontSize(baseFontSize);
        doc.setTextColor(15, 23, 42); // Slate-900
      } else if (t.bold) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(baseFontSize);
        doc.setTextColor(15, 23, 42); // Slate-900 (Bold is prominent)
      } else if (t.italic) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(baseFontSize);
        doc.setTextColor(defaultColor[0], defaultColor[1], defaultColor[2]);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(baseFontSize);
        doc.setTextColor(defaultColor[0], defaultColor[1], defaultColor[2]);
      }

      doc.text(t.text, curX, curY);
      curX += t.width;
    }

    curY += lineHeight;
  }

  return lines.length * lineHeight;
}

/**
 * Main export function for Lecture Notes PDF generation.
 * Faithfully mirrors the Reader View formatting.
 */
export async function generateFormattedPdf(title: string, subject: string, content: string): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const bottomMargin = 45;

  let y = margin;

  const checkPageBreak = (neededHeight: number): void => {
    if (y + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      y = margin + 15;
    }
  };

  const handlePageBreakForRuns = (lineHeight: number): number => {
    if (y + lineHeight > pageHeight - bottomMargin) {
      doc.addPage();
      y = margin + 15;
    }
    return y;
  };

  // 1. Header Banner: Institutional Brand Accent
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(margin, y, contentWidth, 54, 'F');

  // Accent vertical stripe
  doc.setFillColor(99, 102, 241); // Indigo-500
  doc.rect(margin, y, 6, 54, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  const safeDocTitle = sanitizeTextForPdf(title) || 'Veylentra Lecture Note';
  const truncatedTitle = doc.splitTextToSize(safeDocTitle, contentWidth - 30)[0] || safeDocTitle;
  doc.text(truncatedTitle, margin + 16, y + 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(199, 210, 254); // Indigo-200
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const safeSubj = sanitizeTextForPdf(subject) || 'GENERAL';
  doc.text(
    `SUBJECT: ${safeSubj.toUpperCase()}  •  DATE: ${dateStr.toUpperCase()}  •  VEYLENTRA ACADEMIC OS`,
    margin + 16,
    y + 42
  );

  y += 68;

  // Parse structured markdown content
  const blocks = parseMarkdownToBlocks(content);

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const headingText = sanitizeTextForPdf(block.text);
        if (!headingText) break;

        // Prevent heading orphan: ensure at least 50pt available before heading
        if (block.level === 1) {
          y += 6;
          checkPageBreak(50);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(15);
          doc.setTextColor(15, 23, 42); // Slate-900
          const hLines = doc.splitTextToSize(headingText, contentWidth);
          doc.text(hLines, margin, y);
          y += hLines.length * 18 + 4;

          // Subtle divider under H1
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(1);
          doc.line(margin, y, margin + contentWidth, y);
          y += 10;
        } else if (block.level === 2) {
          y += 6;
          checkPageBreak(40);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.setTextColor(67, 56, 202); // Indigo-700
          const hLines = doc.splitTextToSize(headingText, contentWidth);
          doc.text(hLines, margin, y);
          y += hLines.length * 16 + 6;
        } else {
          y += 4;
          checkPageBreak(32);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(79, 70, 229); // Indigo-600
          const hLines = doc.splitTextToSize(headingText, contentWidth);
          doc.text(hLines, margin, y);
          y += hLines.length * 14 + 5;
        }
        break;
      }

      case 'paragraph': {
        const runs = parseInlineRuns(block.text);
        if (runs.length === 0) break;
        checkPageBreak(20);
        const drawnHeight = renderFormattedRuns(
          doc,
          runs,
          margin,
          y,
          contentWidth,
          14,
          10,
          [51, 65, 85],
          (lh) => {
            if (y + lh > pageHeight - bottomMargin) {
              doc.addPage();
              y = margin + 15;
            } else {
              y += lh;
            }
            return y;
          }
        );
        y += 8;
        break;
      }

      case 'list': {
        const runs = parseInlineRuns(block.text);
        if (runs.length === 0) break;
        const prefix = block.ordered ? `${block.number || '1'}. ` : '- ';
        checkPageBreak(20);

        const indent = 18;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(79, 70, 229); // Indigo-600
        doc.text(prefix, margin, y);

        const drawnH = renderFormattedRuns(
          doc,
          runs,
          margin + indent,
          y,
          contentWidth - indent,
          14,
          10,
          [51, 65, 85],
          (lh) => {
            if (y + lh > pageHeight - bottomMargin) {
              doc.addPage();
              y = margin + 15;
            } else {
              y += lh;
            }
            return y;
          }
        );
        y += 6;
        break;
      }

      case 'task': {
        const runs = parseInlineRuns(block.text);
        if (runs.length === 0) break;
        const boxSize = 9;
        checkPageBreak(20);

        doc.setDrawColor(148, 163, 184); // Slate-400
        doc.setLineWidth(1);
        if (block.checked) {
          doc.setFillColor(16, 185, 129); // Emerald-500
          doc.roundedRect(margin, y - 8, boxSize, boxSize, 2, 2, 'FD');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text('X', margin + 2, y - 1);
        } else {
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(margin, y - 8, boxSize, boxSize, 2, 2, 'S');
        }

        const textColor: [number, number, number] = block.checked ? [148, 163, 184] : [51, 65, 85];
        renderFormattedRuns(
          doc,
          runs,
          margin + 18,
          y,
          contentWidth - 22,
          14,
          10,
          textColor,
          (lh) => {
            if (y + lh > pageHeight - bottomMargin) {
              doc.addPage();
              y = margin + 15;
            } else {
              y += lh;
            }
            return y;
          }
        );
        y += 6;
        break;
      }

      case 'callout': {
        const runs = parseInlineRuns(block.text);
        if (runs.length === 0) break;
        const plainText = cleanInlineMarkdown(block.text);
        const estimatedLines = doc.splitTextToSize(plainText, contentWidth - 26);
        const boxHeight = estimatedLines.length * 14 + 16;
        checkPageBreak(boxHeight + 6);

        // Background Tint Box
        doc.setFillColor(243, 244, 246); // Slate-100
        doc.roundedRect(margin, y - 4, contentWidth, boxHeight, 4, 4, 'F');

        // Left Border Bar
        doc.setFillColor(79, 70, 229); // Indigo-600
        doc.roundedRect(margin, y - 4, 4, boxHeight, 2, 2, 'F');

        // Callout text with formatting
        renderFormattedRuns(
          doc,
          runs,
          margin + 14,
          y + 8,
          contentWidth - 24,
          14,
          9.5,
          [30, 41, 59]
        );
        y += boxHeight + 8;
        break;
      }

      case 'code': {
        const cleanLang = sanitizeTextForPdf(block.language).toUpperCase() || 'CODE';
        doc.setFont('courier', 'normal');
        doc.setFontSize(8.5);
        const rawCodeLines = block.code.split('\n');
        const codeLines = rawCodeLines.map(line => sanitizeTextForPdf(line));
        const codeBoxHeight = codeLines.length * 12 + 20;
        checkPageBreak(Math.min(codeBoxHeight, 140));

        // Dark terminal background
        doc.setFillColor(15, 23, 42); // Slate-900
        doc.roundedRect(margin, y - 4, contentWidth, codeBoxHeight, 4, 4, 'F');

        // Top Header of Code Block
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184); // Slate-400
        doc.text(cleanLang, margin + 10, y + 6);

        // Code Content
        doc.setFont('courier', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(248, 250, 252); // Slate-50
        let codeY = y + 18;
        for (const cLine of codeLines) {
          if (codeY > pageHeight - bottomMargin) {
            doc.addPage();
            codeY = margin + 15;
            doc.setFillColor(15, 23, 42);
            doc.roundedRect(margin, codeY - 4, contentWidth, codeBoxHeight, 4, 4, 'F');
          }
          doc.text(cLine.substring(0, 85), margin + 10, codeY);
          codeY += 12;
        }
        y = codeY + 6;
        break;
      }

      case 'table': {
        const numCols = Math.max(
          block.headers.length,
          ...block.rows.map(r => r.length),
          1
        );

        const colWidth = contentWidth / numCols;
        const cellPadding = 6;
        const cellTextWidth = colWidth - cellPadding * 2;

        const renderTableHeader = (currentY: number): number => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);

          const headerWrappedLines: string[][] = [];
          let maxHeaderLines = 1;
          for (let c = 0; c < numCols; c++) {
            const hText = cleanInlineMarkdown(block.headers[c] || `Column ${c + 1}`);
            const wrapped = doc.splitTextToSize(hText, Math.max(cellTextWidth, 20));
            headerWrappedLines.push(wrapped);
            if (wrapped.length > maxHeaderLines) {
              maxHeaderLines = wrapped.length;
            }
          }
          const headerHeight = maxHeaderLines * 12 + 10;

          // Header background
          doc.setFillColor(30, 41, 59); // Slate-800
          doc.rect(margin, currentY, contentWidth, headerHeight, 'F');

          // Header outer border & column dividers
          doc.setDrawColor(71, 85, 105); // Slate-600
          doc.setLineWidth(0.5);
          doc.rect(margin, currentY, contentWidth, headerHeight, 'S');

          for (let c = 1; c < numCols; c++) {
            const divX = margin + c * colWidth;
            doc.line(divX, currentY, divX, currentY + headerHeight);
          }

          // Header text
          doc.setTextColor(255, 255, 255);
          for (let c = 0; c < numCols; c++) {
            const linesToPrint = headerWrappedLines[c] || [];
            const cellX = margin + c * colWidth + cellPadding;
            let textY = currentY + 13;
            for (const line of linesToPrint) {
              doc.text(line, cellX, textY);
              textY += 12;
            }
          }

          return currentY + headerHeight;
        };

        checkPageBreak(50);
        y = renderTableHeader(y);

        // Render Data Rows
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);

        for (let rIdx = 0; rIdx < block.rows.length; rIdx++) {
          const rowData = block.rows[rIdx];

          const cellRuns: InlineRun[][] = [];
          const cellWrappedLines: string[][] = [];
          let maxLinesInRow = 1;

          for (let c = 0; c < numCols; c++) {
            const rawCell = rowData[c] || '';
            const runs = parseInlineRuns(rawCell);
            cellRuns.push(runs);

            const plainCell = cleanInlineMarkdown(rawCell);
            const wrapped = doc.splitTextToSize(plainCell, Math.max(cellTextWidth, 20));
            cellWrappedLines.push(wrapped);
            if (wrapped.length > maxLinesInRow) {
              maxLinesInRow = wrapped.length;
            }
          }

          const rowHeight = maxLinesInRow * 12 + 10;

          if (y + rowHeight > pageHeight - bottomMargin) {
            doc.addPage();
            y = margin + 15;
            y = renderTableHeader(y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
          }

          // Alternating row background
          if (rIdx % 2 === 1) {
            doc.setFillColor(248, 250, 252); // Slate-50
            doc.rect(margin, y, contentWidth, rowHeight, 'F');
          } else {
            doc.setFillColor(255, 255, 255);
            doc.rect(margin, y, contentWidth, rowHeight, 'F');
          }

          // Row borders
          doc.setDrawColor(226, 232, 240); // Slate-200
          doc.setLineWidth(0.5);
          doc.rect(margin, y, contentWidth, rowHeight, 'S');

          // Column divider lines
          for (let c = 1; c < numCols; c++) {
            const divX = margin + c * colWidth;
            doc.line(divX, y, divX, y + rowHeight);
          }

          // Render cell text with inline formatting
          for (let c = 0; c < numCols; c++) {
            const runs = cellRuns[c] || [];
            const cellX = margin + c * colWidth + cellPadding;
            const textY = y + 12;

            renderFormattedRuns(
              doc,
              runs,
              cellX,
              textY,
              Math.max(cellTextWidth, 20),
              12,
              8.5,
              [51, 65, 85]
            );
          }

          y += rowHeight;
        }

        y += 8;
        break;
      }

      case 'divider': {
        checkPageBreak(16);
        y += 4;
        doc.setDrawColor(203, 213, 225); // Slate-300
        doc.setLineWidth(0.75);
        doc.line(margin, y, margin + contentWidth, y);
        y += 10;
        break;
      }
    }
  }

  // Multi-page Footers with page numbers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Footer divider line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 28, margin + contentWidth, pageHeight - 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text('Veylentra Academic OS — Verified Lecture Note Document', margin, pageHeight - 16);
    doc.text(`Page ${p} of ${totalPages}`, margin + contentWidth - 45, pageHeight - 16);
  }

  // Save the PDF
  const rawTitle = cleanInlineMarkdown(title) || 'lecture_note';
  const safeFilename = rawTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_');
  doc.save(`${safeFilename}.pdf`);
}
