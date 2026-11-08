/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Bi-directional converter between EducationalDocument blocks and clean Markdown.
 * Ensures:
 * 1. Existing notes in the database load seamlessly into structured blocks.
 * 2. Any visual edit serializes to clean Markdown with LaTeX math & Markdown tables.
 * 3. `pdfGenerator.ts` exports 100% vector-sharp PDFs without any degradation.
 */

import { EducationalBlock, EducationalDocument, FormulaVariable } from './types';

function generateBlockId(): string {
  return 'blk_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
}

/**
 * Parses a markdown string into an array of EducationalBlock elements.
 */
export function markdownToBlocks(markdown: string): EducationalBlock[] {
  if (!markdown || !markdown.trim()) {
    return [
      {
        id: generateBlockId(),
        type: 'paragraph',
        text: ''
      }
    ];
  }

  const blocks: EducationalBlock[] = [];
  const lines = markdown.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Horizontal Divider
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({
        id: generateBlockId(),
        type: 'divider'
      });
      i++;
      continue;
    }

    // 2. Code Block
    if (trimmed.startsWith('```')) {
      const lang = trimmed.replace(/^```/, '').trim() || 'typescript';
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip ending ```
      blocks.push({
        id: generateBlockId(),
        type: 'code',
        language: lang,
        code: codeLines.join('\n')
      });
      continue;
    }

    // 3. Display Math Block ($$ ... $$ or \[ ... \])
    if (trimmed.startsWith('$$') || trimmed.startsWith('\\[')) {
      let mathLines: string[] = [];
      if (trimmed === '$$' || trimmed === '\\[') {
        i++;
        while (i < lines.length && !lines[i].trim().endsWith('$$') && !lines[i].trim().endsWith('\\]')) {
          mathLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          const last = lines[i].trim().replace(/\$\$|\\\]$/, '').trim();
          if (last) mathLines.push(last);
          i++;
        }
      } else if (trimmed.endsWith('$$') && trimmed.length > 2) {
        mathLines.push(trimmed.slice(2, -2).trim());
        i++;
      } else if (trimmed.endsWith('\\]') && trimmed.length > 2) {
        mathLines.push(trimmed.slice(2, -2).trim());
        i++;
      } else {
        mathLines.push(trimmed.replace(/^(\$\$|\\\[)/, '').trim());
        i++;
        while (i < lines.length && !lines[i].trim().endsWith('$$') && !lines[i].trim().endsWith('\\]')) {
          mathLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          const last = lines[i].trim().replace(/(\$\$|\\\])$/, '').trim();
          if (last) mathLines.push(last);
          i++;
        }
      }

      const latex = mathLines.join('\n').trim();
      blocks.push({
        id: generateBlockId(),
        type: 'formula',
        name: 'Equation',
        latex,
        variables: []
      });
      continue;
    }

    // 4. Headings (# H1, ## H2, ### H3)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = Math.min(3, headingMatch[1].length) as 1 | 2 | 3;
      const text = headingMatch[2].trim();

      // Check for specialized educational blocks introduced by headings
      if (text.toLowerCase().startsWith('worked example')) {
        const title = text.replace(/^worked example:?\s*/i, '').trim();
        i++;
        // Gather problem, given, steps, final answer
        let problem = title;
        let given = '';
        let required = '';
        const steps: string[] = [];
        let finalAnswer = '';

        while (i < lines.length && !lines[i].trim().startsWith('#')) {
          const l = lines[i].trim();
          if (l.toLowerCase().startsWith('**problem**:') || l.toLowerCase().startsWith('problem:')) {
            problem = l.replace(/^(\*\*problem\*\*:?|problem:?)\s*/i, '').trim();
          } else if (l.toLowerCase().startsWith('**given**:') || l.toLowerCase().startsWith('given:')) {
            given = l.replace(/^(\*\*given\*\*:?|given:?)\s*/i, '').trim();
          } else if (l.toLowerCase().startsWith('**required**:') || l.toLowerCase().startsWith('required:')) {
            required = l.replace(/^(\*\*required\*\*:?|required:?)\s*/i, '').trim();
          } else if (l.toLowerCase().startsWith('**final answer**:') || l.toLowerCase().startsWith('final answer:') || l.toLowerCase().startsWith('**answer**:')) {
            finalAnswer = l.replace(/^(\*\*final answer\*\*:?|final answer:?|\*\*answer\*\*:?|answer:?)\s*/i, '').trim();
          } else if (/^\d+\.\s+/.test(l) || l.startsWith('- Step') || l.startsWith('Step ')) {
            steps.push(l.replace(/^\d+\.\s+|^-\s+/, '').trim());
          } else if (l && !problem) {
            problem = l;
          }
          i++;
        }

        blocks.push({
          id: generateBlockId(),
          type: 'worked_example',
          problem: problem || 'Example Problem',
          given,
          required,
          steps: steps.length > 0 ? steps : ['Apply governing equation and solve for target variable.'],
          finalAnswer
        });
        continue;
      }

      blocks.push({
        id: generateBlockId(),
        type: 'heading',
        level,
        text
      });
      i++;
      continue;
    }

    // 5. Table Block
    const isTableRow = (s: string) => s.includes('|') && (s.startsWith('|') || s.split('|').length >= 3);
    const isTableSep = (s: string) => {
      const t = s.trim();
      if (!t.includes('|')) return false;
      const ps = t.replace(/^\||\|$/g, '').split('|');
      return ps.length >= 1 && ps.every(p => /^[\s\-:|]+$/.test(p));
    };

    if (isTableRow(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && (isTableRow(lines[i].trim()) || isTableSep(lines[i].trim()))) {
        tableLines.push(lines[i].trim());
        i++;
      }

      const parseCells = (rowStr: string): string[] => {
        let s = rowStr.trim();
        if (s.startsWith('|')) s = s.slice(1);
        if (s.endsWith('|')) s = s.slice(0, -1);
        return s.split('|').map(c => c.trim());
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

      blocks.push({
        id: generateBlockId(),
        type: 'table',
        headers,
        rows
      });
      continue;
    }

    // 6. Blockquote or Educational Callouts (> ...)
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      const quoteText = quoteLines.join('\n');

      // Check if it's a Definition Block
      const defMatch = quoteText.match(/^(?:📖\s*)?\*\*Definition(?:\s*\(([^)]+)\))?\*\*:\s*([\s\S]+)/i);
      if (defMatch) {
        const term = defMatch[1] || 'Key Term';
        const definition = defMatch[2].trim();
        blocks.push({
          id: generateBlockId(),
          type: 'definition',
          term,
          definition
        });
        continue;
      }

      // Check if it's a Recall Question Block
      const recallMatch = quoteText.match(/^(?:❓\s*)?\*\*Recall Question\*\*:\s*([\s\S]*?)(?:(?:\n|>)\s*(?:💡\s*)?\*\*Answer\*\*:\s*([\s\S]+))?$/i);
      if (recallMatch) {
        blocks.push({
          id: generateBlockId(),
          type: 'recall_question',
          question: (recallMatch[1] || '').trim(),
          answer: (recallMatch[2] || 'Answer hidden. Click to reveal.').trim(),
          isRevealed: false
        });
        continue;
      }

      // Check if it's a Concept Block
      const conceptMatch = quoteText.match(/^(?:💡\s*)?\*\*Concept(?::\s*([^*\n]+))?\*\*:\s*([\s\S]+)/i);
      if (conceptMatch) {
        const title = conceptMatch[1] || 'Core Concept';
        const body = conceptMatch[2].trim();
        const takeawaySplit = body.split(/\*\*Key Takeaway\*\*:\s*/i);
        blocks.push({
          id: generateBlockId(),
          type: 'concept',
          title: title.trim(),
          explanation: takeawaySplit[0].trim(),
          keyTakeaway: takeawaySplit[1]?.trim() || ''
        });
        continue;
      }

      // Check Callout Types (warning, exam tip, note, mistake)
      let variant: 'info' | 'warning' | 'exam_tip' | 'mistake' | 'teacher_note' = 'info';
      let calloutTitle = 'Note';
      let calloutContent = quoteText;

      if (/warning|danger|caution/i.test(quoteText)) {
        variant = 'warning';
        calloutTitle = 'Warning';
      } else if (/exam\s*tip|exam\s*point/i.test(quoteText)) {
        variant = 'exam_tip';
        calloutTitle = 'Exam Tip';
      } else if (/common\s*mistake|pitfall/i.test(quoteText)) {
        variant = 'mistake';
        calloutTitle = 'Common Mistake';
      } else if (/teacher\s*note|faculty/i.test(quoteText)) {
        variant = 'teacher_note';
        calloutTitle = 'Teacher Note';
      }

      blocks.push({
        id: generateBlockId(),
        type: 'callout',
        variant,
        title: calloutTitle,
        text: calloutContent
      });
      continue;
    }

    // 7. Lists (Bullet, Numbered, Checklist)
    const isChecklist = trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ');
    const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
    const isNumber = /^\d+\.\s+/.test(trimmed);

    if (isChecklist || isBullet || isNumber) {
      const listType = isChecklist ? 'checklist' : isNumber ? 'number' : 'bullet';
      const items = [];

      while (i < lines.length) {
        const l = lines[i].trim();
        if (listType === 'checklist' && (l.startsWith('- [ ] ') || l.startsWith('- [x] '))) {
          const checked = l.startsWith('- [x] ');
          const text = l.substring(6).trim();
          items.push({ id: generateBlockId(), text, checked });
          i++;
        } else if (listType === 'bullet' && (l.startsWith('- ') || l.startsWith('* '))) {
          items.push({ id: generateBlockId(), text: l.substring(2).trim() });
          i++;
        } else if (listType === 'number' && /^\d+\.\s+/.test(l)) {
          items.push({ id: generateBlockId(), text: l.replace(/^\d+\.\s+/, '').trim() });
          i++;
        } else {
          break;
        }
      }

      blocks.push({
        id: generateBlockId(),
        type: 'list',
        listType,
        items
      });
      continue;
    }

    // 8. Default Paragraph
    blocks.push({
      id: generateBlockId(),
      type: 'paragraph',
      text: rawLine
    });
    i++;
  }

  if (blocks.length === 0) {
    blocks.push({
      id: generateBlockId(),
      type: 'paragraph',
      text: ''
    });
  }

  return blocks;
}

/**
 * Converts an array of EducationalBlock elements back into clean Markdown.
 */
export function blocksToMarkdown(blocks: EducationalBlock[]): string {
  if (!blocks || blocks.length === 0) return '';

  const chunks: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const prefix = '#'.repeat(block.level || 1);
        chunks.push(`${prefix} ${block.text || ''}`);
        break;
      }
      case 'paragraph': {
        chunks.push(block.text || '');
        break;
      }
      case 'concept': {
        let content = `> 💡 **Concept: ${block.title || 'Core Principle'}**\n> ${block.explanation || ''}`;
        if (block.keyTakeaway) {
          content += `\n>\n> **Key Takeaway**: ${block.keyTakeaway}`;
        }
        if (block.example) {
          content += `\n>\n> *Example*: ${block.example}`;
        }
        chunks.push(content);
        break;
      }
      case 'formula': {
        let formulaMd = `$$ \n${block.latex || 'E = mc^2'} \n$$`;
        if (block.name && block.name !== 'Equation') {
          formulaMd = `**${block.name}**\n` + formulaMd;
        }
        if (block.variables && block.variables.length > 0) {
          const varRows = block.variables
            .filter((v: FormulaVariable) => v.symbol || v.meaning)
            .map((v: FormulaVariable) => `| $${v.symbol}$ | ${v.meaning} | ${v.unit || '-'} |`)
            .join('\n');
          if (varRows) {
            formulaMd += `\n\n| Variable | Meaning | Unit |\n|---|---|---|\n${varRows}`;
          }
        }
        if (block.explanation) {
          formulaMd += `\n\n${block.explanation}`;
        }
        chunks.push(formulaMd);
        break;
      }
      case 'worked_example': {
        let exampleMd = `### Worked Example: ${block.problem || 'Sample Problem'}\n`;
        if (block.given) exampleMd += `**Given**: ${block.given}\n\n`;
        if (block.required) exampleMd += `**Required**: ${block.required}\n\n`;
        if (block.steps && block.steps.length > 0) {
          exampleMd += `**Solution Steps**:\n` + block.steps.map((st, idx) => `${idx + 1}. ${st}`).join('\n') + `\n\n`;
        }
        if (block.finalAnswer) {
          exampleMd += `**Final Answer**: ${block.finalAnswer}`;
        }
        chunks.push(exampleMd.trim());
        break;
      }
      case 'definition': {
        const term = block.term || 'Term';
        const pron = block.pronunciation ? ` *(${block.pronunciation})*` : '';
        chunks.push(`> 📖 **Definition (${term})**${pron}: ${block.definition || ''}${block.context ? `\n> *Context*: ${block.context}` : ''}`);
        break;
      }
      case 'callout': {
        let icon = '💡';
        if (block.variant === 'warning') icon = '⚠️';
        if (block.variant === 'exam_tip') icon = '🎯';
        if (block.variant === 'mistake') icon = '❌';
        if (block.variant === 'teacher_note') icon = '👨‍🏫';
        chunks.push(`> ${icon} **${block.title || 'Note'}**: ${block.text || ''}`);
        break;
      }
      case 'recall_question': {
        chunks.push(`> ❓ **Recall Question**: ${block.question || ''}\n>\n> 💡 **Answer**: ${block.answer || ''}`);
        break;
      }
      case 'table': {
        if (!block.headers || block.headers.length === 0) break;
        const headerRow = `| ${block.headers.join(' | ')} |`;
        const sepRow = `| ${block.headers.map(() => '---').join(' | ')} |`;
        const bodyRows = (block.rows || []).map(r => `| ${r.join(' | ')} |`).join('\n');
        chunks.push([headerRow, sepRow, bodyRows].filter(Boolean).join('\n'));
        break;
      }
      case 'list': {
        if (!block.items || block.items.length === 0) break;
        if (block.listType === 'checklist') {
          chunks.push(block.items.map(it => `- [${it.checked ? 'x' : ' '}] ${it.text}`).join('\n'));
        } else if (block.listType === 'number') {
          chunks.push(block.items.map((it, idx) => `${idx + 1}. ${it.text}`).join('\n'));
        } else {
          chunks.push(block.items.map(it => `- ${it.text}`).join('\n'));
        }
        break;
      }
      case 'diagram': {
        chunks.push(`> 📊 **Diagram: ${block.title || 'Flowchart'}**\n> *Type*: ${block.diagramType}\n${(block.nodes || []).map(n => `> - [${n.label}] ${n.details || ''}`).join('\n')}`);
        break;
      }
      case 'sketch': {
        chunks.push(`![Sketch Note](${block.dataUrl})\n*${block.caption || 'Handwritten Diagram'}*`);
        break;
      }
      case 'code': {
        chunks.push(`\`\`\`${block.language || 'typescript'}\n${block.code || ''}\n\`\`\``);
        break;
      }
      case 'divider': {
        chunks.push('---');
        break;
      }
      default:
        break;
    }
  }

  return chunks.join('\n\n');
}

/**
 * Creates an empty EducationalDocument.
 */
export function createEmptyDocument(title = 'Untitled Note', subject = 'General'): EducationalDocument {
  return {
    schemaVersion: 1,
    id: 'note-' + Date.now().toString(36),
    title,
    subject,
    icon: '📝',
    coverBg: 'bg-gradient-to-r from-violet-600 to-indigo-900',
    blocks: [
      {
        id: generateBlockId(),
        type: 'heading',
        level: 1,
        text: title
      },
      {
        id: generateBlockId(),
        type: 'paragraph',
        text: 'Click here and start typing your lecture note...'
      }
    ],
    tags: [],
    createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  };
}
