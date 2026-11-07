import { jsPDF } from 'jspdf';
import fs from 'fs';

interface TextSpan {
  text: string;
  bold: boolean;
  italic: boolean;
}

function parseSpans(line: string): TextSpan[] {
  const spans: TextSpan[] = [];
  const regex = /(\*\*[\s\S]+?\*\*|__[\s\S]+?__|(?<!\w)\*[^\*\n]+?\*(?!\w)|`[^`]+`|\$[^\$\n]+?\$|\\\(.+?\\\))/g;
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIdx) {
      spans.push({ text: line.substring(lastIdx, match.index), bold: false, italic: false });
    }
    const raw = match[0];
    if (raw.startsWith('**') || raw.startsWith('__')) {
      spans.push({ text: raw.slice(2, -2), bold: true, italic: false });
    } else if (raw.startsWith('*')) {
      spans.push({ text: raw.slice(1, -1), bold: false, italic: true });
    } else if (raw.startsWith('`')) {
      spans.push({ text: raw.slice(1, -1), bold: false, italic: false });
    } else if (raw.startsWith('$') || raw.startsWith('\\(')) {
      const formula = raw.replace(/^(\$|\\\()|(\$|\\\))$/g, '');
      spans.push({ text: formula, bold: false, italic: false });
    }
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < line.length) {
    spans.push({ text: line.substring(lastIdx), bold: false, italic: false });
  }
  return spans;
}

const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
const startX = 40;
let curY = 60;
const maxWidth = 515.28;
const contentBottom = 841.89 - 45;
const fontSize = 10;
const lineHeight = 15;

function drawFormattedParagraph(spans: TextSpan[]): void {
  let curX = startX;
  const words: { text: string; bold: boolean; italic: boolean }[] = [];

  for (const span of spans) {
    const parts = span.text.split(/(\s+)/);
    for (const p of parts) {
      if (!p) continue;
      words.push({ text: p, bold: span.bold, italic: span.italic });
    }
  }

  for (const w of words) {
    if (/^\s+$/.test(w.text)) {
      if (curX > startX) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSize);
        curX += doc.getTextWidth(' ');
      }
      continue;
    }

    const fontStyle = w.bold ? (w.italic ? 'bolditalic' : 'bold') : (w.italic ? 'italic' : 'normal');
    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSize);
    const wordWidth = doc.getTextWidth(w.text);

    if (curX + wordWidth > startX + maxWidth && curX > startX) {
      curX = startX;
      curY += lineHeight;
      if (curY > contentBottom) {
        doc.addPage();
        curY = 50;
      }
    }

    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(w.bold ? 15 : 51, w.bold ? 23 : 65, w.bold ? 42 : 85);
    doc.text(w.text, curX, curY);
    curX += wordWidth;
  }

  curY += lineHeight + 4; // paragraph spacing
}

const p1 = parseSpans("Centripetal force is **directed toward the center of curvature**. The magnitude is determined by mass, velocity, and orbital radius.");
const p2 = parseSpans("In non-uniform circular motion, tangential acceleration **a_t** co-exists with radial inward directed acceleration **a_r**.");

drawFormattedParagraph(p1);
drawFormattedParagraph(p2);

const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
fs.writeFileSync('/tmp/test_para.pdf', pdfBuffer);
console.log('Paragraph PDF generated successfully! Size:', pdfBuffer.length);
