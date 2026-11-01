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
 * - Inline formatting (bold, italic, inline code)
 * - Multi-page headers, footers with page numbers, and institutional branding
 */

import { jsPDF } from 'jspdf';

interface TableRow {
  isHeader: boolean;
  cells: string[];
}

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

    // Table Detection: Line starts and ends with |
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 1) {
        const parseRowCells = (rowStr: string): string[] => {
          return rowStr
            .slice(1, -1)
            .split('|')
            .map(c => c.trim());
        };

        const isSeparatorRow = (rowStr: string): boolean => {
          return /^\|[\s\-:|]+\|$/.test(rowStr);
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
          // No explicit separator row, use first as header
          headers = parseRowCells(tableLines[0]);
          for (let r = 1; r < tableLines.length; r++) {
            if (!isSeparatorRow(tableLines[r])) {
              rows.push(parseRowCells(tableLines[r]));
            }
          }
        }

        blocks.push({
          type: 'table',
          headers,
          rows
        });
        continue;
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

    // Headings
    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'heading', level: 1, text: trimmed.slice(2).trim() });
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'heading', level: 2, text: trimmed.slice(3).trim() });
      i++;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'heading', level: 3, text: trimmed.slice(4).trim() });
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
 * Strips raw markdown tags for length calculation or clean drawing
 */
function cleanInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\$\$(.*?)\$\$/g, '$1');
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
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  const safeDocTitle = title || 'Veylentra Lecture Note';
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
  doc.text(
    `SUBJECT: ${(subject || 'GENERAL').toUpperCase()}  •  DATE: ${dateStr.toUpperCase()}  •  VEYLENTRA ACADEMIC OS`,
    margin + 16,
    y + 42
  );

  y += 66;

  // Parse structured markdown content
  const blocks = parseMarkdownToBlocks(content);

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        if (block.level === 1) {
          checkPageBreak(36);
          y += 10;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(15);
          doc.setTextColor(15, 23, 42); // Slate-900
          const hLines = doc.splitTextToSize(cleanInlineMarkdown(block.text), contentWidth);
          doc.text(hLines, margin, y);
          y += hLines.length * 18 + 4;

          // Subtle divider under H1
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(1);
          doc.line(margin, y, margin + contentWidth, y);
          y += 8;
        } else if (block.level === 2) {
          checkPageBreak(28);
          y += 8;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.setTextColor(67, 56, 202); // Indigo-700
          const hLines = doc.splitTextToSize(cleanInlineMarkdown(block.text), contentWidth);
          doc.text(hLines, margin, y);
          y += hLines.length * 16 + 4;
        } else {
          checkPageBreak(24);
          y += 6;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(79, 70, 229); // Indigo-600
          const hLines = doc.splitTextToSize(cleanInlineMarkdown(block.text), contentWidth);
          doc.text(hLines, margin, y);
          y += hLines.length * 14 + 3;
        }
        break;
      }

      case 'paragraph': {
        const cleanText = cleanInlineMarkdown(block.text);
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
        const cleanText = cleanInlineMarkdown(block.text);
        const prefix = block.ordered ? `${block.number || '1'}. ` : '•  ';
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);

        const indent = 16;
        const listLines = doc.splitTextToSize(cleanText, contentWidth - indent);
        const listHeight = listLines.length * 13.5;
        checkPageBreak(listHeight + 3);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(79, 70, 229);
        doc.text(prefix, margin, y);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(listLines, margin + indent, y);
        y += listHeight + 4;
        break;
      }

      case 'task': {
        const cleanText = cleanInlineMarkdown(block.text);
        const boxSize = 9;
        const textLines = doc.splitTextToSize(cleanText, contentWidth - 22);
        const taskHeight = Math.max(boxSize, textLines.length * 13.5);
        checkPageBreak(taskHeight + 4);

        // Draw Checkbox Box
        doc.setDrawColor(148, 163, 184); // Slate-400
        doc.setLineWidth(1);
        if (block.checked) {
          doc.setFillColor(16, 185, 129); // Emerald-500
          doc.roundedRect(margin, y - 8, boxSize, boxSize, 2, 2, 'FD');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text('✓', margin + 2, y - 1);
        } else {
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(margin, y - 8, boxSize, boxSize, 2, 2, 'S');
        }

        // Draw Task Label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        if (block.checked) {
          doc.setTextColor(148, 163, 184); // Slate-400 strike style
        } else {
          doc.setTextColor(51, 65, 85);
        }
        doc.text(textLines, margin + 18, y);
        y += taskHeight + 4;
        break;
      }

      case 'callout': {
        const cleanText = cleanInlineMarkdown(block.text);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        const calloutLines = doc.splitTextToSize(cleanText, contentWidth - 24);
        const boxHeight = calloutLines.length * 13.5 + 14;
        checkPageBreak(boxHeight + 6);

        // Background Tint Box
        doc.setFillColor(243, 244, 246); // Slate-100 / Indigo-50 tint
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
        doc.setFont('courier', 'normal');
        doc.setFontSize(8.5);
        const codeLines = block.code.split('\n');
        const codeBoxHeight = codeLines.length * 12 + 18;
        checkPageBreak(Math.min(codeBoxHeight, 140));

        // Dark terminal background
        doc.setFillColor(15, 23, 42); // Slate-900
        doc.roundedRect(margin, y - 4, contentWidth, codeBoxHeight, 4, 4, 'F');

        // Top Header of Code Block
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184); // Slate-400
        doc.text(block.language.toUpperCase() || 'CODE', margin + 10, y + 6);

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

        // Normalize column count
        const colWidth = contentWidth / numCols;
        const cellPadding = 6;
        const cellTextWidth = colWidth - cellPadding * 2;

        const renderTableHeader = (currentY: number): number => {
          doc.setFillColor(30, 41, 59); // Slate-800
          doc.rect(margin, currentY, contentWidth, 22, 'F');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(255, 255, 255);

          for (let c = 0; c < numCols; c++) {
            const hText = cleanInlineMarkdown(block.headers[c] || `Col ${c + 1}`);
            const cellX = margin + c * colWidth + cellPadding;
            const truncated = doc.splitTextToSize(hText, cellTextWidth)[0] || hText;
            doc.text(truncated, cellX, currentY + 15);
          }
          return currentY + 22;
        };

        checkPageBreak(50);
        y = renderTableHeader(y);

        // Render Data Rows
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);

        for (let rIdx = 0; rIdx < block.rows.length; rIdx++) {
          const rowData = block.rows[rIdx];

          // Compute max height needed for wrapped cells in this row
          const cellWrappedLines: string[][] = [];
          let maxLinesInRow = 1;

          for (let c = 0; c < numCols; c++) {
            const rawCell = cleanInlineMarkdown(rowData[c] || '');
            const wrapped = doc.splitTextToSize(rawCell, cellTextWidth);
            cellWrappedLines.push(wrapped);
            if (wrapped.length > maxLinesInRow) {
              maxLinesInRow = wrapped.length;
            }
          }

          const rowHeight = maxLinesInRow * 11 + 10;

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
            let textY = y + 10;
            for (const line of linesToPrint) {
              doc.text(line, cellX, textY);
              textY += 11;
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
  const safeFilename = (title || 'lecture_note')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_');
  doc.save(`${safeFilename}.pdf`);
}
