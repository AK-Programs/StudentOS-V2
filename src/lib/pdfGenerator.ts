/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Veylentra Lecture Notes PDF Generator
 * High-performance, pure vector PDF generation engine for Lecture Notes.
 * Directly renders text, headings, formulas, and bordered tables using native jsPDF commands.
 * Completely replaces the rasterized html2canvas pipeline to ensure:
 * - Ultra-crisp vector typography without image rasterization or fuzzy text
 * - Normal word spacing and intact hyphens (no split words or collapsed letters)
 * - Complete titles (including long subtitles like "Orbits") and full dates
 * - Human-readable mathematical notation (e.g. F_c = m v^2 / r, centered; F_c inline)
 * - True bordered tables with alternating fills and repeating headers on page breaks
 * - Clean stripping of emojis and corrupted character sequences
 * - Lean PDF output (< 50 KB instead of 1.5 MB image bundles)
 */

import { jsPDF } from 'jspdf';

/**
 * Strips emoji characters, non-printable symbols, and corrupted character sequences.
 * Transliterates typographic quotes and dashes into clean printable standard ASCII.
 */
export function stripEmojiAndUnprintable(str: string): string {
  if (!str) return '';
  return str
    // Remove emojis, pictographs, and variation selectors
    .replace(/[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
    // Remove specific corrupted sequence artifacts like Ø>Ý
    .replace(/Ø>Ý/g, '')
    // Transliterate typographic characters to safe standard equivalents
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/\u2022/g, '-')
    .trim();
}

/**
 * Converts mathematical LaTeX markup into clean, readable, publication-standard plaintext representation.
 * Guarantees zero raw backslash commands in the final document.
 * Example: \[ F_c = \frac{m v^{2}}{r} \] -> F_c = m v^2 / r
 * Example: \( F_c \) -> F_c
 */
export function cleanMathToReadableText(expr: string): string {
  if (!expr) return '';
  let s = expr.trim();

  // Strip math delimiters if present: \[...\], $$...$$, \(...\), $...$
  s = s.replace(/^(\\\[|\$\$|\\\(|\$)/, '').replace(/(\\\]|\$\$|\\\)|\$)$/, '').trim();

  // Strip equation tags e.g. \tag{1} -> (1)
  let tag = '';
  s = s.replace(/\\tag\{([^}]+)\}/g, (_, t) => {
    tag = ` (${t.trim()})`;
    return '';
  });

  // Common math symbols
  s = s.replace(/\\cdot/g, ' * ');
  s = s.replace(/\\times/g, ' x ');
  s = s.replace(/\\approx/g, ' ~= ');
  s = s.replace(/\\neq/g, ' != ');
  s = s.replace(/\\le(q)?\b/g, ' <= ');
  s = s.replace(/\\ge(q)?\b/g, ' >= ');
  s = s.replace(/\\pm/g, ' +/- ');
  s = s.replace(/\\infty/g, 'inf');
  s = s.replace(/\\Delta/g, 'Delta');
  s = s.replace(/\\int/g, 'integral');
  s = s.replace(/\\sum/g, 'sum');

  // Greek letters (transliterated to prevent font encoding glitches in Helvetica)
  s = s.replace(/\\omega/g, 'omega');
  s = s.replace(/\\Omega/g, 'Omega');
  s = s.replace(/\\theta/g, 'theta');
  s = s.replace(/\\alpha/g, 'alpha');
  s = s.replace(/\\beta/g, 'beta');
  s = s.replace(/\\gamma/g, 'gamma');
  s = s.replace(/\\pi/g, 'pi');
  s = s.replace(/\\lambda/g, 'lambda');
  s = s.replace(/\\mu/g, 'mu');
  s = s.replace(/\\rho/g, 'rho');
  s = s.replace(/\\sigma/g, 'sigma');
  s = s.replace(/\\tau/g, 'tau');
  s = s.replace(/\\phi/g, 'phi');

  // Superscripts and Subscripts: ^{...} -> ^... and _{...} -> _... (processed before frac)
  s = s.replace(/\^\{([^{}]+)\}/g, '^$1');
  s = s.replace(/_\{([^{}]+)\}/g, '_$1');

  // Fractions: \frac{A}{B} -> A / B
  for (let iter = 0; iter < 5; iter++) {
    const prev = s;
    s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, num, den) => {
      const cleanNum = num.trim();
      const cleanDen = den.trim();
      return `${cleanNum} / ${cleanDen}`;
    });
    if (prev === s) break;
  }

  // Styles & brackets: \text{...}, \mathrm{...}, \mathbf{...}, \vec{...}
  s = s.replace(/\\(text|mathrm|mathbf|mathit|vec|boldsymbol)\{([^{}]+)\}/g, '$2');
  s = s.replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)');

  // Delimiters
  s = s.replace(/\\left\(/g, '(').replace(/\\right\)/g, ')');
  s = s.replace(/\\left\[/g, '[').replace(/\\right\]/g, ']');
  s = s.replace(/\\left\\\{/g, '{').replace(/\\right\\\}/g, '}');
  s = s.replace(/\\left\|/g, '|').replace(/\\right\|/g, '|');

  // Spacing commands
  s = s.replace(/\\[,;!]/g, ' ');
  s = s.replace(/\\(quad|qquad)/g, ' ');
  s = s.replace(/\\\\/g, ' ');

  // Strip any remaining backslash command
  s = s.replace(/\\[a-zA-Z]+/g, '');
  s = s.replace(/[{}]/g, '');

  // Normalize multiple spaces
  s = s.replace(/\s+/g, ' ').trim();

  return s + tag;
}

export interface TextSpan {
  text: string;
  bold: boolean;
  italic: boolean;
}

/**
 * Parses a single line into formatted spans (handling bold, italic, code, and inline math).
 */
export function parseLineToSpans(line: string): TextSpan[] {
  const spans: TextSpan[] = [];
  const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^\$\n]+?\$|\\\(.+?\\\)|(\*\*|__)(.*?)\2|(?<!\w)(\*|_)(.*?)\4(?!\w)|`([^`]+)`)/g;
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIdx) {
      spans.push({
        text: stripEmojiAndUnprintable(line.substring(lastIdx, match.index)),
        bold: false,
        italic: false
      });
    }

    const matched = match[0];
    if (matched.startsWith('$$') || matched.startsWith('\\[') || matched.startsWith('$') || matched.startsWith('\\(')) {
      // Inline or display math expression
      const cleanMath = cleanMathToReadableText(matched);
      spans.push({ text: cleanMath, bold: false, italic: false });
    } else if (matched.startsWith('**') || matched.startsWith('__')) {
      const inner = match[3] || '';
      spans.push({ text: stripEmojiAndUnprintable(inner), bold: true, italic: false });
    } else if (matched.startsWith('*') || matched.startsWith('_')) {
      const inner = match[5] || '';
      spans.push({ text: stripEmojiAndUnprintable(inner), bold: false, italic: true });
    } else if (matched.startsWith('`')) {
      const inner = match[6] || '';
      spans.push({ text: inner, bold: false, italic: false });
    }

    lastIdx = regex.lastIndex;
  }

  if (lastIdx < line.length) {
    spans.push({
      text: stripEmojiAndUnprintable(line.substring(lastIdx)),
      bold: false,
      italic: false
    });
  }

  return spans.filter(s => s.text.length > 0);
}

/**
 * Main PDF export function for Lecture Notes.
 * Renders cleanly with native jsPDF vector text commands.
 */
export async function generateFormattedPdf(
  title: string,
  subject: string,
  rawContent: string
): Promise<void> {
  if (!rawContent || !rawContent.trim()) {
    throw new Error('Lecture note content is empty.');
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 841.89 pt
  const margin = 40;
  const contentWidth = pageWidth - margin * 2; // 515.28 pt
  const contentBottom = pageHeight - 45;

  let curY = margin;

  const checkPageBreak = (neededHeight: number): void => {
    if (curY + neededHeight > contentBottom) {
      doc.addPage();
      curY = margin;
    }
  };

  // 1. Header: Subject, Date, Full Title (wrapped with no clipping), Divider
  const formattedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const cleanSubject = stripEmojiAndUnprintable(subject || 'General').toUpperCase();
  const cleanTitle = stripEmojiAndUnprintable(title || 'Lecture Note');

  // Subject line
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(67, 56, 202); // indigo-600
  doc.text(`SUBJECT: ${cleanSubject}  •  VEYLENTRA ACADEMIC OS`, margin, curY);

  // Date on right side
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(formattedDate, margin + contentWidth, curY, { align: 'right' });
  curY += 16;

  // Title: wrapped across contentWidth so it never clips "Orbits"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42); // slate-900
  const titleLines = doc.splitTextToSize(cleanTitle, contentWidth);
  for (const tLine of titleLines) {
    doc.text(tLine, margin, curY);
    curY += 22;
  }

  // Accent divider line
  curY += 2;
  doc.setDrawColor(67, 56, 202);
  doc.setLineWidth(1.5);
  doc.line(margin, curY, margin + contentWidth, curY);
  curY += 18;

  // 2. Body: Sequential Line-by-Line Document Rendering
  const lines = rawContent.split('\n');
  let i = 0;

  // Helper to flow formatted paragraph with bold/italic tokens and natural word spacing
  const drawParagraph = (spans: TextSpan[], indent = 0, fontSize = 10, lineHeight = 15): void => {
    let curX = margin + indent;
    const effMaxWidth = contentWidth - indent;

    const words: { text: string; bold: boolean; italic: boolean }[] = [];
    for (const span of spans) {
      const parts = span.text.split(/(\s+)/);
      for (const p of parts) {
        if (!p) continue;
        words.push({ text: p, bold: span.bold, italic: span.italic });
      }
    }

    checkPageBreak(lineHeight);

    for (const w of words) {
      if (/^\s+$/.test(w.text)) {
        if (curX > margin + indent) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(fontSize);
          curX += doc.getTextWidth(' ');
        }
        continue;
      }

      const style = w.bold ? (w.italic ? 'bolditalic' : 'bold') : (w.italic ? 'italic' : 'normal');
      doc.setFont('helvetica', style);
      doc.setFontSize(fontSize);
      const wordW = doc.getTextWidth(w.text);

      if (curX + wordW > margin + indent + effMaxWidth && curX > margin + indent) {
        curX = margin + indent;
        curY += lineHeight;
        checkPageBreak(lineHeight);
      }

      doc.setFont('helvetica', style);
      doc.setFontSize(fontSize);
      doc.setTextColor(w.bold ? 15 : 51, w.bold ? 23 : 65, w.bold ? 42 : 85);
      doc.text(w.text, curX, curY);
      curX += wordW;
    }

    curY += lineHeight + 4;
  };

  // Helper to render bordered tables with alternating fills and repeating headers on page break
  const drawTable = (headers: string[], rows: string[][]): void => {
    if (headers.length === 0) return;

    // Calculate column widths proportionally with minimum width guarantees
    const weights = headers.map((h, colIdx) => {
      let maxLen = h.length;
      for (const r of rows) {
        if (r[colIdx] && r[colIdx].length > maxLen) {
          maxLen = r[colIdx].length;
        }
      }
      return Math.max(maxLen, 8);
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const colWidths = weights.map(w => Math.floor((w / totalWeight) * contentWidth));
    const currentSum = colWidths.reduce((a, b) => a + b, 0);
    colWidths[colWidths.length - 1] += (contentWidth - currentSum);

    const drawHeader = (): number => {
      const hHeight = 22;
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(margin, curY, contentWidth, hHeight, 'F');
      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.5);

      let colX = margin;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);

      for (let c = 0; c < headers.length; c++) {
        doc.rect(colX, curY, colWidths[c], hHeight, 'S');
        doc.text(headers[c], colX + 6, curY + 15);
        colX += colWidths[c];
      }
      return hHeight;
    };

    checkPageBreak(30);
    const hHeight = drawHeader();
    curY += hHeight;

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);

      const cellLinesList = row.map((cell, idx) => {
        return doc.splitTextToSize(cell, colWidths[idx] - 12);
      });
      const maxLines = Math.max(...cellLinesList.map(l => l.length), 1);
      const rowHeight = maxLines * 12 + 8;

      if (curY + rowHeight > contentBottom) {
        doc.addPage();
        curY = margin;
        const hh = drawHeader(); // Repeat header if table crosses page
        curY += hh;
      }

      // Alternating row background
      if (r % 2 === 0) {
        doc.setFillColor(255, 255, 255);
      } else {
        doc.setFillColor(248, 250, 252);
      }
      doc.rect(margin, curY, contentWidth, rowHeight, 'F');

      // Borders and text
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.setTextColor(51, 65, 85);

      let colX = margin;
      for (let c = 0; c < row.length; c++) {
        doc.rect(colX, curY, colWidths[c], rowHeight, 'S');
        const lines = cellLinesList[c];
        for (let l = 0; l < lines.length; l++) {
          doc.text(lines[l], colX + 6, curY + 14 + (l * 12));
        }
        colX += colWidths[c];
      }

      curY += rowHeight;
    }
    curY += 8;
  };

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Horizontal Divider
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      checkPageBreak(16);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.75);
      doc.line(margin, curY + 6, margin + contentWidth, curY + 6);
      curY += 16;
      i++;
      continue;
    }

    // 2. Code Block
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) i++;

      const blockHeight = codeLines.length * 13 + 14;
      checkPageBreak(Math.min(blockHeight, 100));

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, curY, contentWidth, blockHeight, 4, 4, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, curY, contentWidth, blockHeight, 4, 4, 'S');

      doc.setFont('courier', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);

      let codeY = curY + 13;
      for (const cLine of codeLines) {
        doc.text(cLine.substring(0, 85), margin + 8, codeY);
        codeY += 13;
      }
      curY += blockHeight + 10;
      continue;
    }

    // 3. Display Math Block: \[ ... \] or $$ ... $$ (single or multi-line)
    if (trimmed.startsWith('$$') || trimmed.startsWith('\\[')) {
      const opener = trimmed.startsWith('$$') ? '$$' : '\\[';
      const closer = opener === '$$' ? '$$' : '\\]';
      const mathLines: string[] = [];

      if (trimmed.endsWith(closer) && trimmed.length > opener.length + closer.length) {
        // Single-line display math
        const formula = trimmed.slice(opener.length, -closer.length).trim();
        if (formula) mathLines.push(formula);
        i++;
      } else {
        // Multi-line display math
        let firstContent = trimmed.slice(opener.length).trim();
        if (firstContent) mathLines.push(firstContent);
        i++;
        while (i < lines.length && !lines[i].trim().includes(closer)) {
          mathLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          const lastLine = lines[i].trim();
          const closeIdx = lastLine.indexOf(closer);
          if (closeIdx > 0) mathLines.push(lastLine.slice(0, closeIdx).trim());
          i++;
        }
      }

      const rawFormula = mathLines.join(' ');
      const cleanFormula = cleanMathToReadableText(rawFormula);

      checkPageBreak(36);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, curY, contentWidth, 28, 4, 4, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, curY, contentWidth, 28, 4, 4, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(49, 46, 129); // indigo-900
      doc.text(cleanFormula, margin + contentWidth / 2, curY + 18, { align: 'center' });

      curY += 36;
      continue;
    }

    // 4. Headings: Levels 1 through 6
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      let headingText = headingMatch[2].trim();
      // Strip outer **bold** if present
      if (headingText.startsWith('**') && headingText.endsWith('**') && headingText.length > 4) {
        headingText = headingText.slice(2, -2).trim();
      }
      headingText = stripEmojiAndUnprintable(headingText);

      let fontSize = 11;
      let textColor = [15, 23, 42]; // slate-900
      let topSpacing = 12;
      let bottomSpacing = 5;

      if (level === 1) {
        fontSize = 16;
        textColor = [15, 23, 42];
        topSpacing = 16;
        bottomSpacing = 8;
      } else if (level === 2) {
        fontSize = 13;
        textColor = [49, 46, 129]; // indigo-900
        topSpacing = 14;
        bottomSpacing = 6;
      } else if (level === 3) {
        fontSize = 11.5;
        textColor = [30, 41, 59]; // slate-800
        topSpacing = 11;
        bottomSpacing = 5;
      } else {
        fontSize = 10.5;
        textColor = [51, 65, 85];
        topSpacing = 9;
        bottomSpacing = 4;
      }

      checkPageBreak(topSpacing + fontSize + bottomSpacing + 20); // avoid orphaned headings
      curY += topSpacing;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);

      const hLines = doc.splitTextToSize(headingText, contentWidth);
      for (const hl of hLines) {
        doc.text(hl, margin, curY);
        curY += fontSize + 3;
      }

      if (level === 2) {
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(margin, curY + 1, margin + contentWidth, curY + 1);
        curY += 4;
      }

      curY += bottomSpacing;
      i++;
      continue;
    }

    // 5. Tables
    const isTableRow = (str: string): boolean => {
      const t = str.trim();
      return t.includes('|') && (t.startsWith('|') || t.split('|').length >= 3);
    };
    const isTableSep = (str: string): boolean => {
      const t = str.trim();
      if (!t.includes('|')) return false;
      const parts = t.replace(/^\||\|$/g, '').split('|');
      return parts.length >= 1 && parts.every(p => /^[\s\-:|]+$/.test(p));
    };

    if (isTableRow(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && (isTableRow(lines[i]) || isTableSep(lines[i]))) {
        tableLines.push(lines[i].trim());
        i++;
      }

      const parseCells = (rowStr: string): string[] => {
        let s = rowStr.trim();
        if (s.startsWith('|')) s = s.slice(1);
        if (s.endsWith('|')) s = s.slice(0, -1);
        return s.split('|').map(c => {
          let cell = c.trim();
          // Clean math in cell if any
          cell = cell.replace(/(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^\$\n]+?\$|\\\(.+?\\\))/g, m => cleanMathToReadableText(m));
          return stripEmojiAndUnprintable(cell);
        });
      };

      let headers: string[] = [];
      const rows: string[][] = [];

      if (tableLines.length >= 2 && isTableSep(tableLines[1])) {
        headers = parseCells(tableLines[0]);
        for (let r = 2; r < tableLines.length; r++) {
          if (!isTableSep(tableLines[r])) rows.push(parseCells(tableLines[r]));
        }
      } else {
        headers = parseCells(tableLines[0]);
        for (let r = 1; r < tableLines.length; r++) {
          if (!isTableSep(tableLines[r])) rows.push(parseCells(tableLines[r]));
        }
      }

      drawTable(headers, rows);
      continue;
    }

    // 6. Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      const quoteText = quoteLines.join(' ');
      const spans = parseLineToSpans(quoteText);
      for (const sp of spans) sp.italic = true;

      const beforeY = curY;
      drawParagraph(spans, 18, 9.5, 14);

      // Draw vertical accent bar
      doc.setFillColor(67, 56, 202); // indigo-600
      doc.rect(margin + 4, beforeY - 10, 3, Math.max(curY - beforeY + 2, 16), 'F');
      continue;
    }

    // 7. Unordered or Ordered List Item
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s+/.test(trimmed)) {
      const isOrdered = /^\d+\.\s+/.test(trimmed);
      let bullet = '-';
      let content = '';

      if (isOrdered) {
        const m = trimmed.match(/^(\d+\.)\s+(.*)/);
        bullet = m ? m[1] : '1.';
        content = m ? m[2] : trimmed;
      } else {
        bullet = '•';
        content = trimmed.substring(2);
      }

      const spans = parseLineToSpans(content);
      const indent = 18;

      checkPageBreak(15);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(67, 56, 202);
      doc.text(bullet, margin + 4, curY);

      drawParagraph(spans, indent, 9.5, 14);
      i++;
      continue;
    }

    // 8. Regular Paragraph
    const spans = parseLineToSpans(trimmed);
    drawParagraph(spans, 0, 10, 15);
    i++;
  }

  // 3. Page Numbers & Footers across all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400

    // Footer divider line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 26, margin + contentWidth, pageHeight - 26);

    // Footer left text
    doc.text('VEYLENTRA ACADEMIC OS • VERIFIED LECTURE NOTE', margin, pageHeight - 15);

    // Footer right text (Page X of Y)
    const pageStr = `Page ${p} of ${totalPages}`;
    doc.text(pageStr, margin + contentWidth, pageHeight - 15, { align: 'right' });
  }

  // Save the PDF directly to download in browser
  const safeFilename = `${(title || 'lecture_note').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
  doc.save(safeFilename);
}
