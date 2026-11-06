/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Veylentra Lecture Notes PDF Generator
 * High-fidelity DOM-based export for 1:1 mirroring of Reader View.
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generates a professional PDF from a DOM element.
 * This ensures math (KaTeX), tables, and rich formatting are perfectly preserved.
 */
export async function generateFormattedPdf(
  title: string, 
  subject: string, 
  contentElement: HTMLElement
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - (margin * 2);

  // Prepare a clone for rendering to avoid modifying the UI
  const printContainer = document.createElement('div');
  printContainer.style.width = `${contentWidth}pt`;
  printContainer.style.padding = '0';
  printContainer.style.margin = '0';
  printContainer.style.color = '#1e293b'; // slate-800
  printContainer.style.fontSize = '12pt';
  printContainer.style.lineHeight = '1.6';
  printContainer.style.fontFamily = 'serif';
  printContainer.style.backgroundColor = '#ffffff';

  // Add professional header to the print container
  const headerHtml = `
    <div style="margin-bottom: 30pt; border-bottom: 2pt solid #6366f1; padding-bottom: 10pt;">
      <div style="display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="margin: 0; padding: 0; font-size: 24pt; font-weight: 900; color: #0f172a; font-family: sans-serif;">${title}</h1>
          <p style="margin: 4pt 0 0 0; padding: 0; font-size: 10pt; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 0.05em; font-family: sans-serif;">
            Subject: ${subject.toUpperCase()} &bull; Veylentra Academic OS
          </p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 8pt; color: #64748b; font-family: sans-serif;">Generated on ${new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  `;
  
  // Clone the content into the container
  const contentClone = contentElement.cloneNode(true) as HTMLElement;
  
  // Apply "print styles" to the clone to ensure visibility and contrast
  contentClone.style.color = '#334155'; // slate-700
  contentClone.querySelectorAll('*').forEach((el: any) => {
    el.style.color = '#334155';
    el.style.borderColor = '#e2e8f0';
    if (el.tagName === 'H2' || el.tagName === 'H3' || el.tagName === 'H4') {
      el.style.color = '#1e293b';
      el.style.fontFamily = 'sans-serif';
    }
    // Fix tables
    if (el.tagName === 'TABLE' || el.classList.contains('grid')) {
      el.style.borderCollapse = 'collapse';
      el.style.width = '100%';
      el.style.margin = '10pt 0';
    }
  });

  printContainer.innerHTML = headerHtml;
  printContainer.appendChild(contentClone);

  // Use jspdf.html method for high-fidelity rendering
  // It uses html2canvas internally but handles multi-page better
  await doc.html(printContainer, {
    callback: function (doc) {
      // Add footers with page numbers to all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${i} of ${totalPages}  |  VEYLENTRA ACADEMIC OS • VERIFIED LECTURE NOTE`,
          margin,
          pageHeight - 20
        );
      }
      doc.save(`${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    },
    x: margin,
    y: margin,
    width: contentWidth,
    windowWidth: contentWidth,
    autoPaging: 'text', // Better for academic notes
    margin: [margin, margin, margin + 20, margin], // [top, left, bottom, right]
    html2canvas: {
      scale: 0.75, // Higher quality
      useCORS: true,
      logging: false,
      letterRendering: true
    }
  });
}
