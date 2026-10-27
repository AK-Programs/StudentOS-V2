import { jsPDF } from 'jspdf';

export async function generateFormattedPdf(title: string, subject: string, content: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(title, margin, y);
  y += 10;

  // Subject
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Subject: ${subject}`, margin, y);
  y += 15;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);

  const lines = content.split('\n');

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      y += 5;
      return;
    }

    if (y > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }

    if (trimmed.startsWith('# ')) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      y += 5;
      doc.text(trimmed.slice(2), margin, y);
      y += 10;
      doc.setFontSize(11);
    } else if (trimmed.startsWith('## ')) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      y += 5;
      doc.text(trimmed.slice(3), margin, y);
      y += 8;
      doc.setFontSize(11);
    } else if (trimmed.startsWith('### ')) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      y += 5;
      doc.text(trimmed.slice(4), margin, y);
      y += 7;
      doc.setFontSize(11);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      doc.setFont('helvetica', 'normal');
      const text = `• ${trimmed.slice(2)}`;
      const wrappedText = doc.splitTextToSize(text, contentWidth - 5);
      doc.text(wrappedText, margin + 5, y);
      y += wrappedText.length * 6;
    } else {
      doc.setFont('helvetica', 'normal');
      const wrappedText = doc.splitTextToSize(trimmed, contentWidth);
      doc.text(wrappedText, margin, y);
      y += wrappedText.length * 6;
    }
  });

  const filename = `${title.replace(/\s+/g, '_').toLowerCase()}.pdf`;
  doc.save(filename);
}
