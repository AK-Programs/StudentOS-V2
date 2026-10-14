/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Structured Content Renderer
 * Type-safe content renderer that eliminates React Error #31:
 * "Objects are not valid as a React child (found: object with keys {text, analogy})"
 * 
 * Explicitly and gracefully handles:
 * - Plain text strings
 * - Structured explanation objects with { text, analogy }
 * - Nested objects { explanation, analogy }, { content, analogy }, { problem, steps }
 * - Arrays of content blocks or mixed types
 * - Null, undefined, numbers, booleans, and malformed objects
 * - Speech synthesis & plain-text extraction for robot voice and bubbles
 */

import React from 'react';
import { Sparkles, Lightbulb, Compass } from 'lucide-react';

export interface StructuredExplanation {
  text: string;
  analogy?: string;
}

export type TutorContent =
  | string
  | number
  | boolean
  | null
  | undefined
  | StructuredExplanation
  | { [key: string]: any }
  | TutorContent[];

/**
 * Normalizes any arbitrary AI response or tutor content into a safe, type-safe { text, analogy } shape.
 * Guaranteed to never return a nested unhandled object.
 */
export function normalizeTutorContent(content: TutorContent): { text: string; analogy?: string } {
  if (content === null || content === undefined) {
    return { text: '' };
  }

  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (!trimmed) return { text: '' };

    // Handle full or partial JSON strings (e.g. from streaming chunks or JSON responses)
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          return normalizeTutorContent(parsed);
        }
      } catch (_) {
        // Fall through to regex extraction
      }
    }

    if (trimmed.startsWith('{') && (trimmed.includes('"text"') || trimmed.includes('"coreExplanation"'))) {
      const textMatch = trimmed.match(/"(?:text|coreExplanation|explanation)"\s*:\s*"((?:\\.|[^"\\])*)/);
      const analogyMatch = trimmed.match(/"analogy"\s*:\s*"((?:\\.|[^"\\])*)/);
      if (textMatch) {
        return {
          text: textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim(),
          analogy: analogyMatch ? analogyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim() : undefined
        };
      }
    }

    return { text: trimmed };
  }

  if (typeof content === 'number' || typeof content === 'boolean') {
    return { text: String(content) };
  }

  if (Array.isArray(content)) {
    const texts: string[] = [];
    const analogies: string[] = [];

    content.forEach(item => {
      const normalized = normalizeTutorContent(item);
      if (normalized.text) texts.push(normalized.text);
      if (normalized.analogy) analogies.push(normalized.analogy);
    });

    return {
      text: texts.join('\n\n'),
      analogy: analogies.length > 0 ? analogies.join('\n\n') : undefined
    };
  }

  if (typeof content === 'object') {
    const rawObj = content as Record<string, any>;
    let extractedText = '';
    let extractedAnalogy: string | undefined = undefined;

    // First check analogy if explicitly present
    if (typeof rawObj.analogy === 'string' && rawObj.analogy.trim()) {
      extractedAnalogy = rawObj.analogy.trim();
    } else if (rawObj.analogy && typeof rawObj.analogy === 'object') {
      const nestedAnalogy = normalizeTutorContent(rawObj.analogy);
      if (nestedAnalogy.text) {
        extractedAnalogy = nestedAnalogy.text;
      }
    }

    // Candidate keys for primary text content
    const candidateKeys = [
      'text',
      'explanation',
      'coreExplanation',
      'fullExplanation',
      'problem',
      'detail',
      'content',
      'message',
      'summary',
      'speechSummary',
      'question',
      'hint'
    ];

    for (const key of candidateKeys) {
      const val = rawObj[key];
      if (typeof val === 'string' && val.trim()) {
        extractedText = val.trim();
        break;
      } else if (val && typeof val === 'object') {
        const nested = normalizeTutorContent(val);
        if (nested.text) {
          extractedText = nested.text;
          if (!extractedAnalogy && nested.analogy) {
            extractedAnalogy = nested.analogy;
          }
          break;
        }
      }
    }

    // Fallback: inspect any remaining properties (excluding analogy)
    if (!extractedText) {
      for (const [key, val] of Object.entries(rawObj)) {
        if (key === 'analogy') continue;
        if (typeof val === 'string' && val.trim()) {
          extractedText = val.trim();
          break;
        } else if (val && typeof val === 'object') {
          const nested = normalizeTutorContent(val);
          if (nested.text) {
            extractedText = nested.text;
            if (!extractedAnalogy && nested.analogy) {
              extractedAnalogy = nested.analogy;
            }
            break;
          }
        } else if (typeof val === 'number' || typeof val === 'boolean') {
          extractedText = String(val);
          break;
        }
      }
    }

    return {
      text: extractedText.trim(),
      analogy: extractedAnalogy
    };
  }

  // Never return raw "[object Object]"
  return { text: '' };
}

/**
 * Normalizes an entire raw AI lesson object into a type-safe, complete structure.
 * Guards against undefined arrays or missing fields across all supported formats.
 */
export function normalizeTopicLesson(
  raw: any,
  defaultTopic: string = 'Concept',
  defaultSubject: string = 'General',
  defaultGrade: string = 'Grade 10'
): any {
  if (!raw || typeof raw !== 'object') {
    return {
      topic: defaultTopic,
      subject: defaultSubject,
      grade: defaultGrade,
      hook: `Let's explore key mechanisms in ${defaultTopic}.`,
      prerequisites: 'Foundational curriculum concepts',
      coreExplanation: {
        text: `In ${defaultTopic}, focus on foundational principles and observable rules.`,
        analogy: `Think of ${defaultTopic} as a coordinated system with clear inputs and outputs.`
      },
      keyPoints: [
        'Identify the governing principle',
        'Follow step-by-step reasoning',
        'Verify units and edge cases'
      ],
      workedExample: {
        problem: `Apply the principles of ${defaultTopic} to solve a standard scenario.`,
        steps: [
          { title: 'Step 1: Identify Given Information', detail: 'Isolate parameters and core relationships.' },
          { title: 'Step 2: Apply the Relationship', detail: 'Substitute values and verify reasoning.' }
        ],
        examTip: 'State explicit units and explain your intermediate reasoning to secure full marks.'
      },
      practiceQuestions: [
        {
          id: 'q1',
          question: `What is the primary governing factor in ${defaultTopic}?`,
          options: [
            'Direct interaction of foundational components',
            'Unrelated external interference',
            'Arbitrary spontaneous behavior',
            'Static unchanged parameters'
          ],
          correctIndex: 0,
          explanation: 'Core concepts operate through direct relationships between fundamental principles.',
          hint: 'Consider what triggers the primary reaction.'
        }
      ]
    };
  }

  // Normalize hook and prerequisites
  const hook = raw.hook || `Let's master the core mechanisms of ${raw.topic || defaultTopic}.`;
  const prerequisites = raw.prerequisites || '';

  // Normalize coreExplanation: support both string, { text, analogy }, or nested
  const coreExplanation = raw.coreExplanation || raw.explanation || raw.text || `In ${raw.topic || defaultTopic}, connect definitions to physical rules.`;

  // Normalize keyPoints: ensure array of TutorContent
  let keyPoints: any[] = [];
  if (Array.isArray(raw.keyPoints) && raw.keyPoints.length > 0) {
    keyPoints = raw.keyPoints;
  } else if (typeof raw.keyPoints === 'string') {
    keyPoints = raw.keyPoints.split(/\n+/).filter(Boolean);
  } else {
    keyPoints = [
      `Master the core definition of ${raw.topic || defaultTopic}`,
      'Relate causes to measurable effects',
      'Check assumptions before concluding'
    ];
  }

  // Normalize workedExample
  const rawEx = raw.workedExample || {};
  const problem = rawEx.problem || `Demonstrate the core mechanism of ${raw.topic || defaultTopic}.`;
  let steps: any[] = [];
  if (Array.isArray(rawEx.steps) && rawEx.steps.length > 0) {
    steps = rawEx.steps.map((s: any, idx: number) => {
      if (typeof s === 'string') {
        return { title: `Step ${idx + 1}`, detail: s };
      }
      return {
        title: s?.title || `Step ${idx + 1}`,
        detail: s?.detail || s?.description || s?.explanation || s?.text || 'Apply core logic'
      };
    });
  } else {
    steps = [
      { title: 'Step 1: Formulate the Model', detail: 'Identify key variables and foundational laws.' },
      { title: 'Step 2: Solve and Verify', detail: 'Work through the calculation or logical progression step by step.' }
    ];
  }
  const examTip = rawEx.examTip || 'Check units, show all intermediate steps, and state your final conclusion clearly.';

  // Normalize practiceQuestions
  let practiceQuestions: any[] = [];
  if (Array.isArray(raw.practiceQuestions) && raw.practiceQuestions.length > 0) {
    practiceQuestions = raw.practiceQuestions.map((q: any, qIdx: number) => {
      const qOptions = Array.isArray(q?.options) && q.options.length >= 2
        ? q.options
        : ['Option A', 'Option B', 'Option C', 'Option D'];

      const correctIndex = typeof q?.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < qOptions.length
        ? q.correctIndex
        : 0;

      return {
        id: q?.id || `q_${qIdx + 1}`,
        question: q?.question || `What is the principal takeaway from ${raw.topic || defaultTopic}?`,
        options: qOptions,
        correctIndex,
        explanation: q?.explanation || 'This option represents the precise scientific or mathematical principle.',
        hint: q?.hint || 'Think about the core rule demonstrated in the worked example.'
      };
    });
  } else {
    practiceQuestions = [
      {
        id: 'q1',
        question: `Which statement accurately describes ${raw.topic || defaultTopic}?`,
        options: [
          'It follows deterministic principles with verifiable evidence',
          'It is completely unpredictable and cannot be measured',
          'It contradicts foundational conservation laws',
          'It is identical in every scenario without variation'
        ],
        correctIndex: 0,
        explanation: 'Core curriculum principles always rely on verifiable evidence and logical deduction.',
        hint: 'Eliminate statements that propose arbitrary or unmeasurable phenomena.'
      }
    ];
  }

  return {
    topic: raw.topic || defaultTopic,
    subject: raw.subject || defaultSubject,
    grade: raw.grade || defaultGrade,
    hook,
    prerequisites,
    coreExplanation,
    keyPoints,
    workedExample: {
      problem,
      steps,
      examTip
    },
    practiceQuestions
  };
}

/**
 * Extracts pure, speech-synthesis friendly plain text from any tutor content shape.
 * Eliminates markdown tokens, formatting, and extracts core words.
 */
export function extractTutorText(content: TutorContent): string {
  const normalized = normalizeTutorContent(content);
  let combined = normalized.text;
  if (normalized.analogy) {
    combined += ` Real-world analogy: ${normalized.analogy}`;
  }

  return combined
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`.*?`/g, ' ')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[#*_~>[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface StructuredContentRendererProps {
  content: TutorContent;
  className?: string;
  inline?: boolean;
  showAnalogy?: boolean;
  analogyClassName?: string;
  analogyTitle?: string;
}

/**
 * Helper to render simple inline formatting (bold, italic, code) safely without external dependencies
 */
function renderFormattedInlineText(text: any): React.ReactNode {
  if (text === null || text === undefined) return null;
  const str = typeof text === 'string' ? text : String(text);
  if (!str) return null;

  // Split by bold (**term**) first
  const boldParts = str.split(/(\*\*.*?\*\*)/g);
  return boldParts.map((bPart, bIdx) => {
    if (bPart.startsWith('**') && bPart.endsWith('**') && bPart.length > 4) {
      const boldContent = bPart.slice(2, -2);
      return (
        <strong key={bIdx} className="font-bold text-white">
          {boldContent}
        </strong>
      );
    }

    // Split by code (`term`)
    const codeParts = bPart.split(/(`.*?`)/g);
    return codeParts.map((cPart, cIdx) => {
      if (cPart.startsWith('`') && cPart.endsWith('`') && cPart.length > 2) {
        const codeContent = cPart.slice(1, -1);
        return (
          <code
            key={`${bIdx}-${cIdx}`}
            className="px-1.5 py-0.5 rounded-md bg-slate-800 text-cyan-300 font-mono text-[0.9em] border border-cyan-500/20"
          >
            {codeContent}
          </code>
        );
      }

      return cPart;
    });
  });
}

/**
 * Type-safe JSX renderer for structured AI content.
 * Prevents React Error #31 by never rendering raw objects, and elevates analogies into distinct callout cards.
 */
export const StructuredContentRenderer: React.FC<StructuredContentRendererProps> = ({
  content,
  className = '',
  inline = false,
  showAnalogy = true,
  analogyClassName = '',
  analogyTitle = 'Real-World Analogy'
}) => {
  // If content is an array of items, render sequentially
  if (Array.isArray(content)) {
    return (
      <div className={`space-y-3 ${className}`}>
        {content.map((item, idx) => (
          <StructuredContentRenderer
            key={idx}
            content={item}
            inline={inline}
            showAnalogy={showAnalogy}
            analogyClassName={analogyClassName}
            analogyTitle={analogyTitle}
          />
        ))}
      </div>
    );
  }

  const { text, analogy } = normalizeTutorContent(content);

  // If text is empty and no analogy, render empty fragment safely
  if (!text && !analogy) {
    return null;
  }

  // If inline rendering is requested (e.g. for list items or titles)
  if (inline) {
    return (
      <span className={className}>
        {renderFormattedInlineText(text)}
        {showAnalogy && analogy && (
          <span className="block mt-1 text-xs text-purple-300 italic">
            ({analogyTitle}: {analogy})
          </span>
        )}
      </span>
    );
  }

  // Standard block rendering with paragraph splitting and styled analogy card
  const paragraphs = text ? text.split(/\n\n+/) : [];

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 1. Main Explanation Text Paragraphs */}
      {paragraphs.map((p, pIdx) => {
        const trimmed = p.trim();
        if (!trimmed) return null;
        return (
          <p key={pIdx} className="leading-relaxed">
            {renderFormattedInlineText(trimmed)}
          </p>
        );
      })}

      {/* 2. Structured Real-World Analogy Callout Card */}
      {showAnalogy && analogy && (
        <div
          className={`mt-3.5 p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-500/30 text-purple-200 shadow-md ${analogyClassName}`}
        >
          <div className="flex items-center gap-1.5 font-bold text-xs text-purple-300 mb-1.5 uppercase tracking-wide font-mono">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>{analogyTitle}</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
            {renderFormattedInlineText(analogy)}
          </p>
        </div>
      )}
    </div>
  );
};
