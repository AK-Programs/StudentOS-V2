/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Veylentra Lecture Notes PDF Generator
 * High-fidelity, print-ready PDF export engine for 1:1 mirroring of Reader View.
 */

import { jsPDF } from 'jspdf';
import katex from 'katex';

/**
 * Escapes HTML characters to prevent XSS or broken tags.
 */
function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders mathematical expressions in text using KaTeX.
 */
export function renderMathInText(text: string): string {
  if (!text) return '';

  // 1. Display math: $$...$$ or \[...\]
  let result = text.replace(/(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])/g, (match) => {
    const formula = match.replace(/^(\$\$|\\\[)|(\$\$|\\\])$/g, '').trim();
    try {
      const rendered = katex.renderToString(formula, { displayMode: true, throwOnError: false, strict: false });
      return `<div style="margin: 14pt 0; text-align: center; color: #312e81; page-break-inside: avoid; break-inside: avoid;" class="pdf-math-display">${rendered}</div>`;
    } catch (e) {
      return `<div style="margin: 12pt 0; text-align: center; font-family: monospace; color: #4338ca;">${escapeHtml(formula)}</div>`;
    }
  });

  // 2. Inline math: $...$ or \(...\)
  result = result.replace(/(\$[^\$\n]+?\$|\\\([^\n]+?\\\))/g, (match) => {
    const formula = match.replace(/^(\$|\\\()|(\$|\\\))$/g, '').trim();
    try {
      const rendered = katex.renderToString(formula, { displayMode: false, throwOnError: false, strict: false });
      return `<span class="pdf-math-inline" style="display: inline-block; vertical-align: middle; margin: 0 2px;">${rendered}</span>`;
    } catch (e) {
      return `<code style="font-family: monospace; color: #4338ca;">${escapeHtml(formula)}</code>`;
    }
  });

  return result;
}

/**
 * Parses inline markdown (bold, italic, code, math) to clean HTML.
 */
export function formatInlineMarkdownToHtml(text: string): string {
  if (!text) return '';

  // First render math expressions so math symbols inside $...$ are preserved
  let html = renderMathInText(text);

  // Bold: **text** or __text__
  html = html.replace(/(\*\*|__)(.*?)\1/g, '<strong style="font-weight: 800; color: #0f172a;">$2</strong>');

  // Italic: *text* or _text_ (when not inside HTML tags)
  html = html.replace(/(?<!\w|\/|\=)(\*|_)(.*?)\1(?!\w)/g, '<em style="font-style: italic; color: #334155;">$2</em>');

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code style="background-color: #f1f5f9; color: #0284c7; padding: 2px 5px; border-radius: 4px; font-family: monospace; font-size: 9.5pt; border: 1px solid #e2e8f0;">$1</code>');

  return html;
}

/**
 * Parses complete markdown document into print-ready HTML structure.
 */
export function parseMarkdownToPrintHtml(content: string): string {
  if (!content) return '';

  const lines = content.split('\n');
  const htmlParts: string[] = [];
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

    // 1. Horizontal Divider
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      htmlParts.push('<hr style="border: none; border-top: 1pt solid #e2e8f0; margin: 16pt 0;" />');
      i++;
      continue;
    }

    // 2. Code Block
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) i++;
      const codeText = codeLines.join('\n');
      htmlParts.push(`
        <pre style="margin: 12pt 0; padding: 10pt 14pt; background-color: #0f172a; color: #f8fafc; border-radius: 6pt; font-family: monospace; font-size: 9.5pt; line-height: 1.5; overflow-x: auto; page-break-inside: avoid; break-inside: avoid;"><code>${escapeHtml(codeText)}</code></pre>
      `);
      continue;
    }

    // 3. Single-line Display Math: $$ ... $$ or \[ ... \]
    if ((trimmed.startsWith('$$') && trimmed.endsWith('$$')) || (trimmed.startsWith('\\\[') && trimmed.endsWith('\\\]'))) {
      const formula = trimmed.replace(/^(\$\$|\\\[)|(\$\$|\\\])$/g, '').trim();
      try {
        const mathHtml = katex.renderToString(formula, { displayMode: true, throwOnError: false, strict: false });
        htmlParts.push(`
          <div style="margin: 14pt 0; padding: 8pt 0; text-align: center; color: #312e81; page-break-inside: avoid; break-inside: avoid;" class="pdf-math-display">
            ${mathHtml}
          </div>
        `);
      } catch (e) {
        htmlParts.push(`
          <div style="margin: 12pt 0; text-align: center; font-family: monospace; color: #4338ca; page-break-inside: avoid; break-inside: avoid;">
            ${escapeHtml(formula)}
          </div>
        `);
      }
      i++;
      continue;
    }

    // Multi-line Display Math Block starting with $$ or \[
    if (trimmed.startsWith('$$') || trimmed.startsWith('\\\[')) {
      const mathLines: string[] = [];
      const opener = trimmed.startsWith('$$') ? '$$' : '\\\[';
      const closer = opener === '$$' ? '$$' : '\\\]';
      
      let firstContent = trimmed.slice(opener.length);
      if (firstContent.endsWith(closer)) {
        firstContent = firstContent.slice(0, -closer.length);
      }
      if (firstContent) mathLines.push(firstContent);
      
      i++;
      while (i < lines.length && !lines[i].trim().includes(closer)) {
        mathLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        const lastLine = lines[i].trim();
        const closeIdx = lastLine.indexOf(closer);
        if (closeIdx > 0) mathLines.push(lastLine.slice(0, closeIdx));
        i++;
      }
      
      const formula = mathLines.join('\n').trim();
      try {
        const mathHtml = katex.renderToString(formula, { displayMode: true, throwOnError: false, strict: false });
        htmlParts.push(`
          <div style="margin: 14pt 0; padding: 8pt 0; text-align: center; color: #312e81; page-break-inside: avoid; break-inside: avoid;" class="pdf-math-display">
            ${mathHtml}
          </div>
        `);
      } catch (e) {
        htmlParts.push(`
          <div style="margin: 12pt 0; text-align: center; font-family: monospace; color: #4338ca; page-break-inside: avoid; break-inside: avoid;">
            ${escapeHtml(formula)}
          </div>
        `);
      }
      continue;
    }

    // 4. Tables
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
          for (let r = 2; r < tableLines.length; r++) {
            if (!isTableSeparator(tableLines[r])) rows.push(parseCells(tableLines[r]));
          }
        } else {
          headers = parseCells(tableLines[0]);
          for (let r = 1; r < tableLines.length; r++) {
            if (!isTableSeparator(tableLines[r])) rows.push(parseCells(tableLines[r]));
          }
        }

        if (headers.length > 0) {
          let tableHtml = `
            <table style="width: 100%; border-collapse: collapse; margin: 14pt 0; font-size: 9.5pt; font-family: sans-serif; page-break-inside: avoid; break-inside: avoid;">
              <thead>
                <tr style="background-color: #1e293b; color: #ffffff;">
          `;
          headers.forEach(h => {
            tableHtml += `<th style="padding: 8pt 10pt; text-align: left; font-weight: 700; border: 1pt solid #334155; color: #ffffff;">${formatInlineMarkdownToHtml(h)}</th>`;
          });
          tableHtml += `</tr></thead><tbody>`;

          rows.forEach((row, rIdx) => {
            const bg = rIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
            tableHtml += `<tr style="background-color: ${bg}; page-break-inside: avoid; break-inside: avoid;">`;
            row.forEach(cell => {
              tableHtml += `<td style="padding: 6pt 10pt; border: 1pt solid #cbd5e1; color: #334155; vertical-align: top;">${formatInlineMarkdownToHtml(cell)}</td>`;
            });
            tableHtml += `</tr>`;
          });

          tableHtml += `</tbody></table>`;
          htmlParts.push(tableHtml);
          continue;
        }
      }
    }

    // 5. Callouts / Blockquotes
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      const quoteContent = quoteLines.join(' ');
      htmlParts.push(`
        <blockquote style="margin: 10pt 0; padding: 10pt 14pt; background-color: #f8fafc; border-left: 4pt solid #4338ca; border-radius: 0 6pt 6pt 0; font-style: italic; color: #334155; font-size: 10.5pt; line-height: 1.5; page-break-inside: avoid; break-inside: avoid;">
          ${formatInlineMarkdownToHtml(quoteContent)}
        </blockquote>
      `);
      continue;
    }

    // 6. Headings
    if (trimmed.startsWith('# ')) {
      htmlParts.push(`
        <h1 style="font-size: 18pt; font-weight: 900; color: #0f172a; margin-top: 22pt; margin-bottom: 8pt; border-bottom: 1.5pt solid #cbd5e1; padding-bottom: 4pt; font-family: sans-serif; page-break-after: avoid; break-after: avoid;">
          ${formatInlineMarkdownToHtml(trimmed.slice(2))}
        </h1>
      `);
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      htmlParts.push(`
        <h2 style="font-size: 14pt; font-weight: 800; color: #4338ca; margin-top: 18pt; margin-bottom: 6pt; font-family: sans-serif; page-break-after: avoid; break-after: avoid;">
          ${formatInlineMarkdownToHtml(trimmed.slice(3))}
        </h2>
      `);
      i++;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      htmlParts.push(`
        <h3 style="font-size: 12pt; font-weight: 700; color: #1e1b4b; margin-top: 14pt; margin-bottom: 4pt; font-family: sans-serif; page-break-after: avoid; break-after: avoid;">
          ${formatInlineMarkdownToHtml(trimmed.slice(4))}
        </h3>
      `);
      i++;
      continue;
    }

    // 7. Task Items
    if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
      const isChecked = trimmed.toLowerCase().startsWith('- [x] ');
      const taskText = trimmed.slice(6);
      htmlParts.push(`
        <div style="margin: 4pt 0; font-family: sans-serif; font-size: 10.5pt; color: #334155; page-break-inside: avoid; break-inside: avoid;">
          <span style="color: ${isChecked ? '#059669' : '#64748b'}; font-weight: bold; font-family: monospace;">[${isChecked ? '✓' : ' '}]</span> ${formatInlineMarkdownToHtml(taskText)}
        </div>
      `);
      i++;
      continue;
    }

    // 8. Unordered List Items
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* ')) && !lines[i].trim().startsWith('- [')) {
        listItems.push(lines[i].trim().substring(2));
        i++;
      }
      let listHtml = `<ul style="margin: 6pt 0; padding-left: 20pt; color: #334155; font-size: 10.5pt; page-break-inside: avoid; break-inside: avoid;">`;
      listItems.forEach(item => {
        listHtml += `<li style="margin-bottom: 4pt; line-height: 1.5;">${formatInlineMarkdownToHtml(item)}</li>`;
      });
      listHtml += `</ul>`;
      htmlParts.push(listHtml);
      continue;
    }

    // 9. Ordered List Items
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      const listItems: { num: string; text: string }[] = [];
      while (i < lines.length) {
        const lineMatch = lines[i].trim().match(/^(\d+)\.\s+(.*)/);
        if (lineMatch) {
          listItems.push({ num: lineMatch[1], text: lineMatch[2] });
          i++;
        } else {
          break;
        }
      }
      let listHtml = `<ol style="margin: 6pt 0; padding-left: 20pt; color: #334155; font-size: 10.5pt; page-break-inside: avoid; break-inside: avoid;" start="${listItems[0]?.num || 1}">`;
      listItems.forEach(item => {
        listHtml += `<li style="margin-bottom: 4pt; line-height: 1.5;">${formatInlineMarkdownToHtml(item.text)}</li>`;
      });
      listHtml += `</ol>`;
      htmlParts.push(listHtml);
      continue;
    }

    // 10. Paragraph
    htmlParts.push(`
      <p style="margin: 0 0 8pt 0; line-height: 1.6; color: #334155; font-size: 11pt; word-wrap: break-word;">
        ${formatInlineMarkdownToHtml(trimmed)}
      </p>
    `);
    i++;
  }

  return htmlParts.join('\n');
}

/**
 * Main PDF export function for Lecture Notes.
 * Receives the title, subject, and full note content markdown string.
 */
export async function generateFormattedPdf(
  title: string, 
  subject: string, 
  rawContent: string
): Promise<void> {
  if (!rawContent || !rawContent.trim()) {
    throw new Error('Lecture note content is empty.');
  }

  // 1. Create temporary print container attached to document.body
  const container = document.createElement('div');
  container.id = 'veylentra-pdf-export-stage';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 680px;
    z-index: -9999;
    opacity: 1;
    visibility: visible;
    pointer-events: none;
    background-color: #ffffff;
    color: #0f172a;
    padding: 32px;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;

  // 2. Build Document Header HTML
  const formattedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const headerHtml = `
    <div style="margin-bottom: 24pt; border-bottom: 2.5pt solid #4338ca; padding-bottom: 12pt; page-break-after: avoid; break-after: avoid;">
      <div style="display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="margin: 0; font-size: 22pt; font-weight: 900; color: #0f172a; font-family: sans-serif; line-height: 1.2;">${escapeHtml(title || 'Lecture Note')}</h1>
          <p style="margin: 6pt 0 0 0; font-size: 10pt; font-weight: 800; color: #4338ca; text-transform: uppercase; letter-spacing: 0.08em; font-family: sans-serif;">
            SUBJECT: ${escapeHtml((subject || 'General').toUpperCase())} &bull; VEYLENTRA ACADEMIC OS
          </p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 8.5pt; font-weight: 600; color: #64748b; font-family: sans-serif;">${formattedDate}</p>
          <p style="margin: 2pt 0 0 0; font-size: 7.5pt; color: #94a3b8; font-family: sans-serif;">VERIFIED LECTURE NOTE</p>
        </div>
      </div>
    </div>
  `;

  // 3. Build Note Body HTML with KaTeX Math and Markdown structure
  const bodyHtml = parseMarkdownToPrintHtml(rawContent);
  container.innerHTML = headerHtml + bodyHtml;

  // 4. Attach container to document.body so html2canvas computes full layout & KaTeX styles
  document.body.appendChild(container);

  try {
    // 5. Wait for fonts (KaTeX, System fonts) to settle
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));

    // 6. Initialize jsPDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
    const pageHeight = doc.internal.pageSize.getHeight(); // 841.89 pt
    const margin = 36; // 0.5 inch margins
    const contentWidth = pageWidth - (margin * 2); // 523.28 pt

    // 7. Render HTML to PDF via doc.html
    await doc.html(container, {
      x: margin,
      y: margin,
      width: contentWidth,
      windowWidth: 680, // matches container width
      autoPaging: 'text',
      margin: [margin, margin, 45, margin],
      html2canvas: {
        scale: 0.77, // 523.28 / 680 = 0.7695
        useCORS: true,
        logging: false,
        windowWidth: 680
      },
      callback: function (doc) {
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184); // slate-400

          // Footer rule line
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.setLineWidth(0.5);
          doc.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28);

          // Footer left text
          doc.text('VEYLENTRA ACADEMIC OS • VERIFIED LECTURE NOTE', margin, pageHeight - 16);

          // Footer right text (Page X of Y)
          const pageStr = `Page ${i} of ${totalPages}`;
          const pageStrWidth = doc.getTextWidth(pageStr);
          doc.text(pageStr, pageWidth - margin - pageStrWidth, pageHeight - 16);
        }

        const safeFilename = `${(title || 'lecture_note').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
        doc.save(safeFilename);
      }
    });
  } finally {
    // 8. Clean up DOM stage
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}
