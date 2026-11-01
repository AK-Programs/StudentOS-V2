/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Veylentra Lecture Notes PDF Generator
 * Faithfully mirrors the Reader View formatting:
 * - Full markdown table support (multi-column, aligned cells, headers, borders, pagination)
 * - Typography: H1, H2, H3 with hierarchical sizing and accent colors
 * - Code blocks with dark terminal containers and monospaced text
 * - Callout blocks and blockquotes with colored accent borders
 * - Task list checkboxes ([x], [ ]) and bullet lists
 * - Inline formatting cleanup (bold, italic, inline code)
 * - Unicode emoji & non-Latin1 character sanitization (eliminates encoding junk like "Ø=ÜÚ")
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

/**
 * Strips raw markdown tags (bold, italic, code, links, math) for clean text rendering
 */
function cleanInlineMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Markdown links [Label](url) -> Label
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold **text**
    .replace(/\*(.*?)\*/g, '$1')     // Italic *text*
    .replace(/__(.*?)__/g, '$1')     // Bold __text__
    .replace(/_(.*?)_/g, '$1')       // Italic _text_
    .replace(/~~(.*?)~~/g, '$1')     // Strikethrough ~~text~~
    .replace(/`(.*?)`/g, '$1')       // Inline code `text`
    .replace(/\$\$(.*?)\$\$/g, '$1') // Math block $$text$$
    .replace(/\$(.*?)\$/g, '$1');    // Math inline $text$
}

/**
 * Sanitizes string input for standard jsPDF fonts (Helvetica/Courier/Times).
 * Removes emojis and non-WinAnsi characters to prevent encoding artifacts like "Ø=ÜÚ".
 */
function sanitizeTextForPdf(text: string): string {
  if (!text) return '';

  // 1. Strip inline markdown markup
  let cleaned = cleanInlineMarkdown(text);

  // 2. Remove emojis, surrogate pairs, and non-printable unicode symbol ranges
  cleaned = cleaned.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{200D}\u{FE0F}]/gu, '');

  // 3. Filter characters outside printable ASCII (0x20-0x7E) and Latin-1 supplement (0xA0-0xFF)
  cleaned = cleaned.replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, '');

  // 4. Remove leftover markdown '#' symbols at start of text if any
  cleaned = cleaned.replace(/^#+\s*/, '');

  // 5. Clean up redundant whitespace
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');

  return cleaned.trim();
}

/**
 * Parses markdown text into structured semantic blocks.
 */
function parseMarkdownToBlocks(content: string): ParsedBlock[] {
  const lines = content.split('\n');
  const blocks: ParsedBlock[] = [];
  let i = 0;

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

    // Table Detection: Lines containing column separator '|'
    if (trimmed.includes('|') && (trimmed.startsWith('|') || trimmed.split('|').length >= 3)) {
      const tableLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim().includes('|') &&
        (lines[i].trim().startsWith('|') || lines[i].trim().split('|').length >= 3)
      ) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 1) {
        const parseRowCells = (rowStr: string): string[] => {
          const cells = rowStr.split('|').map(c => c.trim());
          if (cells.length > 0 && cells[0] === '') cells.shift();
          if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
          return cells;
        };

        const isSeparatorRow = (rowStr: string): boolean => {
          const cells = parseRowCells(rowStr);
          return cells.length > 0 && cells.every(c => /^[:\-\s]+$/.test(c));
        };

        let headers: string[] = [];
        const rows: string[][] = [];

        if (tableLines.length >= 2 && isSeparatorRow(tableLines[1])) {
          headers = parseRowCells(tableLines[0]);
          for (let r = 2; r < tableLines.length; r++) {
            if (!isSeparatorRow(tableLines[r])) {
              rows.push(parseRowCells(tableLines[r]));
            }
          }
        } else {
          headers = parseRowCells(tableLines[0]);
          for (let r = 1; r < tableLines.length; r++) {
            if (!isSeparatorRow(tableLines[r])) {
              rows.push(parseRowCells(tableLines[r]));
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
 * Main export function for Lecture Notes PDF generation.
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

  // Header Banner: Institutional Brand Accent
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

        if (block.level === 1) {
          y += 6;
          checkPageBreak(36);
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
          checkPageBreak(28);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.setTextColor(67, 56, 202); // Indigo-700
          const hLines = doc.splitTextToSize(headingText, contentWidth);
          doc.text(hLines, margin, y);
          y += hLines.length * 16 + 6;
        } else {
          y += 4;
          checkPageBreak(24);
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
        const cleanText = sanitizeTextForPdf(block.text);
        if (!cleanText) break;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85); // Slate-700
        const pLines = doc.splitTextToSize(cleanText, contentWidth);
        const pHeight = pLines.length * 14;
        checkPageBreak(pHeight + 4);
        doc.text(pLines, margin, y);
        y += pHeight + 6;
        break;
      }

      case 'list': {
        const cleanText = sanitizeTextForPdf(block.text);
        if (!cleanText) break;
        const prefix = block.ordered ? `${block.number || '1'}. ` : '- ';
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);

        const indent = 16;
        const listLines = doc.splitTextToSize(cleanText, contentWidth - indent);
        const listHeight = listLines.length * 14;
        checkPageBreak(listHeight + 4);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(79, 70, 229); // Indigo-600
        doc.text(prefix, margin, y);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85); // Slate-700
        doc.text(listLines, margin + indent, y);
        y += listHeight + 4;
        break;
      }

      case 'task': {
        const cleanText = sanitizeTextForPdf(block.text);
        if (!cleanText) break;
        const boxSize = 9;
        const textLines = doc.splitTextToSize(cleanText, contentWidth - 22);
        const taskHeight = Math.max(boxSize, textLines.length * 14);
        checkPageBreak(taskHeight + 4);

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

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        if (block.checked) {
          doc.setTextColor(148, 163, 184); // Slate-400
        } else {
          doc.setTextColor(51, 65, 85); // Slate-700
        }
        doc.text(textLines, margin + 18, y);
        y += taskHeight + 4;
        break;
      }

      case 'callout': {
        const cleanText = sanitizeTextForPdf(block.text);
        if (!cleanText) break;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        const calloutLines = doc.splitTextToSize(cleanText, contentWidth - 24);
        const boxHeight = calloutLines.length * 14 + 14;
        checkPageBreak(boxHeight + 6);

        // Background Tint Box
        doc.setFillColor(243, 244, 246); // Slate-100
        doc.roundedRect(margin, y - 4, contentWidth, boxHeight, 4, 4, 'F');

        // Left Border Bar
        doc.setFillColor(79, 70, 229); // Indigo-600
        doc.roundedRect(margin, y - 4, 4, boxHeight, 2, 2, 'F');

        // Callout text
        doc.setTextColor(30, 41, 59); // Slate-800
        doc.text(calloutLines, margin + 14, y + 8);
        y += boxHeight + 8;
        break;
      }

      case 'code': {
        const cleanLang = sanitizeTextForPdf(block.language).toUpperCase() || 'CODE';
        doc.setFont('courier', 'normal');
        doc.setFontSize(8.5);
        const rawCodeLines = block.code.split('\n');
        const codeLines = rawCodeLines.map(line => sanitizeTextForPdf(line));
        const codeBoxHeight = codeLines.length * 12 + 18;
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
            const hText = sanitizeTextForPdf(block.headers[c] || `Column ${c + 1}`);
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

          const cellWrappedLines: string[][] = [];
          let maxLinesInRow = 1;

          for (let c = 0; c < numCols; c++) {
            const rawCell = sanitizeTextForPdf(rowData[c] || '');
            const wrapped = doc.splitTextToSize(rawCell, Math.max(cellTextWidth, 20));
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

          // Render cell text
          doc.setTextColor(51, 65, 85); // Slate-700
          for (let c = 0; c < numCols; c++) {
            const linesToPrint = cellWrappedLines[c] || [];
            const cellX = margin + c * colWidth + cellPadding;
            let textY = y + 12;
            for (const line of linesToPrint) {
              doc.text(line, cellX, textY);
              textY += 12;
            }
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
  const rawTitle = sanitizeTextForPdf(title) || 'lecture_note';
  const safeFilename = rawTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_');
  doc.save(`${safeFilename}.pdf`);
}
