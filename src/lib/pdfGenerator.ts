import { jsPDF } from 'jspdf';

export async function generateFormattedPdf(title: string, subject: string, content: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Title Banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59); // Slate-800
  const titleLines = doc.splitTextToSize(title || 'Untitled Note', contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8;

  // Subject Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(79, 70, 229); // Indigo-600
  doc.text(`SUBJECT: ${(subject || 'GENERAL').toUpperCase()}`, margin, y);
  y += 6;

  // Divider Line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Reset Text Color for Body
  doc.setTextColor(30, 41, 59);

  const cleanInlineMarkdown = (raw: string) => {
    return raw.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`(.*?)`/g, '$1');
  };

  const lines = content.split('\n');

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      y += 4;
      return;
    }

    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    const cleanLine = cleanInlineMarkdown(trimmed);

    if (trimmed.startsWith('# ')) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      y += 4;
      const hLines = doc.splitTextToSize(cleanLine.slice(2), contentWidth);
      doc.text(hLines, margin, y);
      y += hLines.length * 7 + 2;
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
    } else if (trimmed.startsWith('## ')) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(67, 56, 202);
      y += 3;
      const hLines = doc.splitTextToSize(cleanLine.slice(3), contentWidth);
      doc.text(hLines, margin, y);
      y += hLines.length * 6 + 2;
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
    } else if (trimmed.startsWith('### ')) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(79, 70, 229);
      y += 2;
      const hLines = doc.splitTextToSize(cleanLine.slice(4), contentWidth);
      doc.text(hLines, margin, y);
      y += hLines.length * 5.5 + 2;
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      doc.setFont('helvetica', 'normal');
      const text = `•  ${cleanLine.slice(2)}`;
      const wrappedText = doc.splitTextToSize(text, contentWidth - 5);
      doc.text(wrappedText, margin + 4, y);
      y += wrappedText.length * 5.5;
    } else if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ')) {
      doc.setFont('helvetica', 'normal');
      const isChecked = trimmed.startsWith('- [x] ');
      const text = `[${isChecked ? 'x' : ' '}]  ${cleanLine.slice(6)}`;
      const wrappedText = doc.splitTextToSize(text, contentWidth - 5);
      doc.text(wrappedText, margin + 4, y);
      y += wrappedText.length * 5.5;
    } else {
      doc.setFont('helvetica', 'normal');
      const wrappedText = doc.splitTextToSize(cleanLine, contentWidth);
      doc.text(wrappedText, margin, y);
      y += wrappedText.length * 5.5;
    }
  });

  const safeTitle = (title || 'lecture_note').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const filename = `${safeTitle}.pdf`;
  doc.save(filename);
}

