/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Veylentra Lecture Notes PDF Generator
 * Faithfully mirrors the Reader View formatting:
 * - Real tables: aligned multi-column cells, repeating headers on new pages, borders
 * - Inline formatting: bold (**text**), italic (*text*), math cleanup
 * - Typography: H1, H2, H3 with hierarchical sizing
 * - LaTeX handling: Converts LaTeX into readable plain text formulas
 * - Multi-page headers, footers with page numbers
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
 * Cleans up LaTeX commands and transliterates common symbols into readable text.
 * Ensures the PDF doesn't contain raw backslash commands.
 */
export function cleanLatexAndSymbols(text: string): string {
  if (!text) return '';

  let cleaned = text
    // Remove display math wrappers
    .replace(/\\\[|\\\]/g, ' ')
    // Remove inline math wrappers
    .replace(/\\\(|\\\)/g, ' ')
    // Remove dollar signs
    .replace(/\$/g, '')
    // Handle LaTeX commands
    .replace(/\\frac\{(.+?)\}\{(.+?)\}/g, '($1)/($2)')
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, ' × ')
    .replace(/\\div/g, ' / ')
    .replace(/\\pm/g, ' ± ')
    .replace(/\\tag\{(.+?)\}/g, '($1)')
    .replace(/\\text\{(.+?)\}/g, '$1')
    .replace(/\\mathrm\{(.+?)\}/g, '$1')
    .replace(/\\mathbf\{(.+?)\}/g, '$1')
    .replace(/\\vec\{(.+?)\}/g, '$1')
    .replace(/\\sqrt\{(.+?)\}/g, 'sqrt($1)')
    .replace(/_\{(.+?)\}/g, '_$1') // simpler subscripts
    .replace(/\^\{(.+?)\}/g, '^$1') // simpler superscripts
    .replace(/\\approx/g, ' ≈ ')
    .replace(/\\infty/g, '∞')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\pi/g, 'π')
    .replace(/\\theta/g, 'θ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\Omega/g, 'Ω')
    .replace(/\\omega/g, 'ω')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\phi/g, 'ϕ')
    .replace(/\\tau/g, 'τ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\epsilon/g, 'ε')
    .replace(/\\rho/g, 'ρ')
    .replace(/\\eta/g, 'η')
    .replace(/\\zeta/g, 'ζ')
    .replace(/\\xi/g, 'ξ')
    .replace(/\\psi/g, 'ψ')
    .replace(/\\sum/g, '∑')
    .replace(/\\int/g, '∫')
    .replace(/\\partial/g, '∂')
    .replace(/\\nabla/g, '∇')
    .replace(/\\degree/g, '°')
    .replace(/\\angle/g, '∠')
    .replace(/\\perp/g, '⊥')
    .replace(/\\parallel/g, '||')
    .replace(/\\le|\\leq/g, ' ≤ ')
    .replace(/\\ge|\\geq/g, ' ≥ ')
    .replace(/\\ne|\\neq/g, ' ≠ ')
    .replace(/\\rightarrow|\\to/g, ' → ')
    .replace(/\\leftarrow/g, ' ← ')
    .replace(/\\leftrightarrow/g, ' ↔ ')
    .replace(/\\Rightarrow/g, ' ⇒ ')
    .replace(/\\Leftarrow/g, ' ⇐ ')
    .replace(/\\Leftrightarrow/g, ' ⇔ ')
    .replace(/\\quad|\\qquad/g, '  ');

  // Handle common Unicode symbols often used in science/math
  cleaned = cleaned
    .replace(/⇄/g, ' ↔ ')
    .replace(/↔/g, ' ↔ ')
    .replace(/⇔/g, ' ⇔ ')
    .replace(/→/g, ' → ')
    .replace(/⇒/g, ' ⇒ ')
    .replace(/←/g, ' ← ')
    .replace(/⇐/g, ' ⇐ ')
    .replace(/≤/g, ' ≤ ')
    .replace(/≥/g, ' ≥ ')
    .replace(/≠/g, ' ≠ ')
    .replace(/≈/g, ' ≈ ')
    .replace(/±/g, ' ± ')
    .replace(/×/g, ' × ')
    .replace(/÷/g, ' / ')
    .replace(/√/g, 'sqrt')
    .replace(/∞/g, '∞')
    .replace(/∑/g, '∑')
    .replace(/∫/g, '∫')
    .replace(/°/g, '°')
    .replace(/•/g, '-')
    .replace(/…/g, '...')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/–/g, '-')
    .replace(/—/g, ' -- ');

  // Clean up any double spaces introduced
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Final sweep to remove any remaining backslashes that might be left from unknown commands
  cleaned = cleaned.replace(/\\/g, '');

  return cleaned.trim();
}

/**
 * Sanitizes text for PDF rendering.
 */
export function sanitizeTextForPdf(text: string): string {
  if (!text) return '';
  let cleaned = cleanLatexAndSymbols(text);
  
  // Strip emojis as they are often unrenderable in standard PDF fonts
  cleaned = cleaned.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{200D}\u{FE0F}]/gu, '');
  
  return cleaned;
}

/**
 * Parses a string with markdown formatting into structured inline runs.
 */
export function parseInlineRuns(rawText: string): InlineRun[] {
  // We keep the markdown symbols for parsing, then strip them during tokenization
  if (!rawText) return [];

  // Match links [text](url), bold **text** or __text__, inline code `code`, italic *text* or _text_
  const tokenRegex = /(\[([^\]]+)\]\([^\)]+\)|\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\*([^*]+)\*|_([^_]+)_)/g;
  const runs: InlineRun[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = rawText.slice(lastIndex, match.index);
      if (textBefore) {
        runs.push({ text: cleanLatexAndSymbols(textBefore), bold: false, italic: false, code: false });
      }
    }

    if (match[2]) {
      runs.push({ text: cleanLatexAndSymbols(match[2]), bold: false, italic: false, code: false });
    } else if (match[3] || match[4]) {
      runs.push({ text: cleanLatexAndSymbols(match[3] || match[4]), bold: true, italic: false, code: false });
    } else if (match[5]) {
      runs.push({ text: match[5], bold: false, italic: false, code: true }); // No math cleanup for code blocks
    } else if (match[6] || match[7]) {
      runs.push({ text: cleanLatexAndSymbols(match[6] || match[7]), bold: false, italic: true, code: false });
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < rawText.length) {
    const remaining = rawText.slice(lastIndex);
    if (remaining) {
      runs.push({ text: cleanLatexAndSymbols(remaining), bold: false, italic: false, code: false });
    }
  }

  return runs;
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
    return (trimmed.startsWith('|') && trimmed.endsWith('|')) || trimmed.split('|').length >= 2;
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

    if (!trimmed) {
      i++;
      continue;
    }

    // Divider
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      blocks.push({ type: 'divider' });
      i++;
      continue;
    }

    // Code Block
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) i++;
      blocks.push({ type: 'code', language: language || 'code', code: codeLines.join('\n') });
      continue;
    }

    // Table
    if (isTableRow(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && (isTableRow(lines[i]) || isTableSeparator(lines[i]))) {
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
          for (let r = 2; r < tableLines.length; r++) if (!isTableSeparator(tableLines[r])) rows.push(parseCells(tableLines[r]));
        } else {
          headers = parseCells(tableLines[0]);
          for (let r = 1; r < tableLines.length; r++) if (!isTableSeparator(tableLines[r])) rows.push(parseCells(tableLines[r]));
        }
        if (headers.length > 0) {
          blocks.push({ type: 'table', headers, rows });
          continue;
        }
      }
    }

    // Callout
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'callout', text: quoteLines.join(' ') });
      continue;
    }

    // Heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 3) as 1 | 2 | 3;
      blocks.push({ type: 'heading', level, text: headingMatch[2].trim() });
      i++;
      continue;
    }

    // Task
    if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
      blocks.push({ type: 'task', checked: trimmed.toLowerCase().startsWith('- [x] '), text: trimmed.slice(6).trim() });
      i++;
      continue;
    }

    // Unordered List
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({ type: 'list', ordered: false, text: trimmed.slice(2).trim() });
      i++;
      continue;
    }

    // Ordered List
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      blocks.push({ type: 'list', ordered: true, number: numberedMatch[1], text: numberedMatch[2].trim() });
      i++;
      continue;
    }

    // Paragraph
    blocks.push({ type: 'paragraph', text: trimmed });
    i++;
  }
  return blocks;
}

/**
 * Renders inline text runs with formatting and word-wrapping.
 * Returns the final Y position.
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
  onPageBreakNeeded?: (lh: number) => number
): number {
  if (runs.length === 0) return startY;

  interface Token {
    text: string;
    bold: boolean;
    italic: boolean;
    code: boolean;
    width: number;
  }

  const tokens: Token[] = [];
  for (const run of runs) {
    const textParts = run.text.split(/(\s+)/);
    for (const p of textParts) {
      if (!p) continue;
      if (run.code) { doc.setFont('courier', 'normal'); doc.setFontSize(baseFontSize * 0.9); }
      else if (run.bold && run.italic) { doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(baseFontSize); }
      else if (run.bold) { doc.setFont('helvetica', 'bold'); doc.setFontSize(baseFontSize); }
      else if (run.italic) { doc.setFont('helvetica', 'italic'); doc.setFontSize(baseFontSize); }
      else { doc.setFont('helvetica', 'normal'); doc.setFontSize(baseFontSize); }
      tokens.push({ text: p, bold: run.bold, italic: run.italic, code: run.code, width: doc.getTextWidth(p) });
    }
  }

  const lines: Token[][] = [];
  let currentLine: Token[] = [];
  let currentLineWidth = 0;

  for (const token of tokens) {
    if (token.text.trim() === '' && currentLine.length === 0) continue;
    if (currentLineWidth + token.width <= maxWidth || currentLine.length === 0) {
      currentLine.push(token);
      currentLineWidth += token.width;
    } else {
      lines.push(currentLine);
      currentLine = token.text.trim() === '' ? [] : [token];
      currentLineWidth = token.text.trim() === '' ? 0 : token.width;
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);

  let curY = startY;
  for (const line of lines) {
    if (onPageBreakNeeded) curY = onPageBreakNeeded(lineHeight);
    let curX = startX;
    for (const t of line) {
      if (t.code) { doc.setFont('courier', 'normal'); doc.setFontSize(baseFontSize * 0.9); doc.setTextColor(180, 83, 9); }
      else if (t.bold) { doc.setFont('helvetica', 'bold'); doc.setFontSize(baseFontSize); doc.setTextColor(15, 23, 42); }
      else if (t.italic) { doc.setFont('helvetica', 'italic'); doc.setFontSize(baseFontSize); doc.setTextColor(defaultColor[0], defaultColor[1], defaultColor[2]); }
      else { doc.setFont('helvetica', 'normal'); doc.setFontSize(baseFontSize); doc.setTextColor(defaultColor[0], defaultColor[1], defaultColor[2]); }
      doc.text(t.text, curX, curY);
      curX += t.width;
    }
    curY += lineHeight;
  }
  return curY;
}

/**
 * Main export function for Lecture Notes PDF generation.
 */
export async function generateFormattedPdf(title: string, subject: string, content: string): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const bottomMargin = 45;
  let y = margin;

  const checkPageBreak = (needed: number): void => {
    if (y + needed > pageHeight - bottomMargin) {
      doc.addPage();
      y = margin + 15;
    }
  };

  const handlePageBreakForRuns = (lh: number): number => {
    if (y + lh > pageHeight - bottomMargin) {
      doc.addPage();
      y = margin + 15;
    }
    return y;
  };

  // Header
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentWidth, 54, 'F');
  doc.setFillColor(99, 102, 241);
  doc.rect(margin, y, 6, 54, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(sanitizeTextForPdf(title).substring(0, 50) || 'Lecture Note', margin + 16, y + 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(199, 210, 254);
  doc.text(`SUBJECT: ${sanitizeTextForPdf(subject).toUpperCase()}  •  VEYLENTRA ACADEMIC OS`, margin + 16, y + 42);
  y += 68;

  const blocks = parseMarkdownToBlocks(content);

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        y += 10;
        checkPageBreak(30);
        const runs = parseInlineRuns(block.text);
        const size = block.level === 1 ? 16 : block.level === 2 ? 14 : 12;
        const color: [number, number, number] = block.level === 1 ? [15, 23, 42] : [67, 56, 202];
        y = renderFormattedRuns(doc, runs, margin, y, contentWidth, size + 4, size, color, handlePageBreakForRuns);
        y += 4;
        break;
      }
      case 'paragraph': {
        const runs = parseInlineRuns(block.text);
        if (runs.length === 0) break;
        checkPageBreak(20);
        y = renderFormattedRuns(doc, runs, margin, y, contentWidth, 14, 10, [51, 65, 85], handlePageBreakForRuns);
        y += 6;
        break;
      }
      case 'list': {
        const runs = parseInlineRuns(block.text);
        const prefix = block.ordered ? `${block.number}. ` : '• ';
        checkPageBreak(20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(99, 102, 241);
        doc.text(prefix, margin, y);
        y = renderFormattedRuns(doc, runs, margin + 15, y, contentWidth - 15, 14, 10, [51, 65, 85], handlePageBreakForRuns);
        y += 4;
        break;
      }
      case 'task': {
        const runs = parseInlineRuns(block.text);
        const prefix = block.checked ? '[X] ' : '[ ] ';
        checkPageBreak(20);
        doc.setFont('courier', 'bold');
        doc.setFontSize(10);
        if (block.checked) doc.setTextColor(16, 185, 129); else doc.setTextColor(100, 116, 139);
        doc.text(prefix, margin, y);
        y = renderFormattedRuns(doc, runs, margin + 25, y, contentWidth - 25, 14, 10, [51, 65, 85], handlePageBreakForRuns);
        y += 4;
        break;
      }
      case 'callout': {
        const runs = parseInlineRuns(block.text);
        checkPageBreak(40);
        const startY = y - 10;
        y = renderFormattedRuns(doc, runs, margin + 15, y, contentWidth - 20, 14, 10, [30, 41, 59], handlePageBreakForRuns);
        const endY = y + 5;
        doc.setDrawColor(203, 213, 225);
        doc.rect(margin, startY, contentWidth, endY - startY, 'S');
        doc.setFillColor(99, 102, 241);
        doc.rect(margin, startY, 4, endY - startY, 'F');
        y = endY + 10;
        break;
      }
      case 'code': {
        checkPageBreak(40);
        doc.setFillColor(15, 23, 42);
        const codeLines = block.code.split('\n');
        const boxH = codeLines.length * 12 + 20;
        doc.rect(margin, y - 5, contentWidth, boxH, 'F');
        doc.setFont('courier', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(226, 232, 240);
        let curCodeY = y + 10;
        const codeBaseY = y;
        for (let idx = 0; idx < codeLines.length; idx++) {
          const line = codeLines[idx];
          if (curCodeY > pageHeight - bottomMargin) { 
            doc.addPage(); 
            curCodeY = margin + 15; 
            doc.setFillColor(15, 23, 42); 
            // Draw background for remaining lines on new page
            const remainingH = (codeLines.length - idx) * 12 + 20;
            doc.rect(margin, curCodeY - 15, contentWidth, Math.min(remainingH, pageHeight - bottomMargin - curCodeY + 15), 'F'); 
            doc.setTextColor(226, 232, 240); 
            doc.setFont('courier', 'normal'); 
            doc.setFontSize(8.5); 
          }
          doc.text(sanitizeTextForPdf(line).substring(0, 90), margin + 10, curCodeY);
          curCodeY += 12;
        }
        y = curCodeY + 10;
        break;
      }
      case 'table': {
        const numCols = Math.max(block.headers.length, ...block.rows.map(r => r.length));
        const colWidth = contentWidth / numCols;
        const renderHeader = (curY: number) => {
          doc.setFillColor(30, 41, 59);
          doc.rect(margin, curY - 10, contentWidth, 20, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(255, 255, 255);
          block.headers.forEach((h, idx) => doc.text(sanitizeTextForPdf(h).substring(0, 30), margin + (idx * colWidth) + 5, curY + 3));
          return curY + 10;
        };
        checkPageBreak(40);
        y = renderHeader(y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        block.rows.forEach((row, rIdx) => {
          if (y > pageHeight - bottomMargin) { 
            doc.addPage(); 
            y = margin + 20; 
            y = renderHeader(y); 
            doc.setFont('helvetica', 'normal'); 
            doc.setFontSize(8.5); 
            doc.setTextColor(51, 65, 85); 
          }
          if (rIdx % 2 === 0) doc.setFillColor(248, 250, 252); else doc.setFillColor(255, 255, 255);
          doc.rect(margin, y - 10, contentWidth, 20, 'F');
          doc.setDrawColor(226, 232, 240);
          doc.rect(margin, y - 10, contentWidth, 20, 'S');
          row.forEach((cell, cIdx) => {
            const cellX = margin + (cIdx * colWidth);
            doc.line(cellX, y - 10, cellX, y + 10);
            doc.text(sanitizeTextForPdf(cell).substring(0, 35), cellX + 5, y + 3);
          });
          y += 20;
        });
        y += 10;
        break;
      }
      case 'divider': {
        checkPageBreak(20);
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y, margin + contentWidth, y);
        y += 20;
        break;
      }
    }
  }

  // Page Numbers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin - 50, pageHeight - 20);
    doc.text('VEYLENTRA ACADEMIC OS • VERIFIED LECTURE NOTE', margin, pageHeight - 20);
  }

  doc.save(`${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
}
