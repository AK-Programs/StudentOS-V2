/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra Academic Rich Renderer
 * - Renders Markdown, tables, code blocks, inline math, display LaTeX equations,
 *   matrices/aligned derivations, and expanded chemistry notation (\ce{...})
 * - Streaming-safe: buffers incomplete LaTeX/code tails without red error flicker
 * - Includes Copy LaTeX button, mobile horizontal scroll containers, and KaTeX trust: false
 */

import React, { useMemo, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import {
  segmentMarkdownAndMath,
  splitInlineTextWithMath,
  stabilizeStreamingMarkdown,
  InlineToken,
  MarkdownBlock
} from '../../lib/mathMarkdownParser';

interface AcademicRichRendererProps {
  content: string;
  isStreaming?: boolean;
  compact?: boolean;
  className?: string;
}

const KatexSpan: React.FC<{ formula: string; display?: boolean; className?: string }> = ({
  formula,
  display = false,
  className = ''
}) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(formula, {
        displayMode: display,
        throwOnError: false,
        strict: false,
        trust: false
      });
    } catch {
      return '';
    }
  }, [formula, display]);

  if (!html) {
    return <span className={`font-mono text-indigo-200 ${className}`}>{formula}</span>;
  }

  return (
    <span
      className={`${display ? 'katex-display-wrap block' : 'inline-block align-middle'} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

const CodeSnippetCard: React.FC<{ code: string; language: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(code.trim()).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-white/10 bg-slate-950 font-mono text-xs shadow-sm">
      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900/90 border-b border-white/5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
        <span>{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className={`px-2 py-1 rounded-lg transition-colors text-[10px] font-semibold flex items-center gap-1 cursor-pointer ${
            copied
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
          }`}
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-slate-100 whitespace-pre select-text leading-relaxed text-[11.5px]">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const DisplayMathCard: React.FC<{ formula: string; rawFormula: string }> = ({ formula, rawFormula }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLatex = () => {
    navigator.clipboard?.writeText(rawFormula || formula).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="group relative my-3.5 rounded-2xl bg-slate-950/85 border border-indigo-500/25 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-indigo-950/25">
        <span className="text-[9px] font-mono uppercase tracking-wider text-indigo-300/80 font-semibold">
          Equation
        </span>
        <button
          type="button"
          onClick={handleCopyLatex}
          className={`px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
            copied
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
          }`}
          title="Copy LaTeX source"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied LaTeX' : 'Copy LaTeX'}</span>
        </button>
      </div>
      <div className="px-4 py-3.5 overflow-x-auto max-w-full text-indigo-50 flex justify-center select-text">
        <KatexSpan formula={formula} display={true} />
      </div>
    </div>
  );
};

function renderInlineTokens(tokens: InlineToken[]): React.ReactNode[] {
  return tokens.map((tok, i) => {
    switch (tok.type) {
      case 'bold':
        return (
          <strong key={i} className="font-bold text-white">
            {renderInlineTokens(splitInlineTextWithMath(tok.value))}
          </strong>
        );
      case 'italic':
        return (
          <em key={i} className="italic text-slate-200">
            {tok.value}
          </em>
        );
      case 'code':
        return (
          <code
            key={i}
            className="mx-0.5 px-1.5 py-0.5 rounded-md bg-slate-950/90 border border-white/10 font-mono text-[11px] text-amber-300"
          >
            {tok.value}
          </code>
        );
      case 'math':
        return <KatexSpan key={i} formula={tok.formula} display={false} className="mx-0.5 text-indigo-100" />;
      case 'link':
        return (
          <a
            key={i}
            href={tok.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:text-sky-300 underline decoration-sky-500/40 underline-offset-2 font-medium inline-flex items-center gap-1 break-all"
          >
            <span>{tok.label.length > 64 && tok.label === tok.url ? `${tok.label.slice(0, 56)}…` : tok.label}</span>
            <ExternalLink className="w-3 h-3 inline shrink-0 opacity-75" />
          </a>
        );
      case 'text':
      default:
        return <React.Fragment key={i}>{tok.value}</React.Fragment>;
    }
  });
}

const InlineRichText: React.FC<{ text: string }> = ({ text }) => {
  const tokens = useMemo(() => splitInlineTextWithMath(text), [text]);
  return <>{renderInlineTokens(tokens)}</>;
};

export const AcademicRichRenderer: React.FC<AcademicRichRendererProps> = ({
  content,
  isStreaming = false,
  compact = false,
  className = ''
}) => {
  const stabilized = useMemo(
    () => stabilizeStreamingMarkdown(content || '', isStreaming),
    [content, isStreaming]
  );

  const blocks: MarkdownBlock[] = useMemo(
    () => segmentMarkdownAndMath(stabilized.stableText),
    [stabilized.stableText]
  );

  if (!content) return null;

  const textSizeClass = compact ? 'text-xs' : 'text-[13px] sm:text-sm';

  return (
    <div className={`space-y-2 select-text text-slate-200 break-words ${className}`}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'code':
            return <CodeSnippetCard key={idx} code={block.code} language={block.language} />;

          case 'math_display':
            return <DisplayMathCard key={idx} formula={block.formula} rawFormula={block.rawFormula} />;

          case 'hr':
            return <hr key={idx} className="my-3 border-t border-white/10" />;

          case 'heading': {
            if (block.level === 1) {
              return (
                <h2 key={idx} className="text-base sm:text-lg font-extrabold text-white mt-4 mb-1.5 tracking-tight">
                  <InlineRichText text={block.text} />
                </h2>
              );
            }
            if (block.level === 2) {
              return (
                <h3 key={idx} className="text-sm sm:text-base font-bold text-indigo-300 mt-3 mb-1 tracking-tight">
                  <InlineRichText text={block.text} />
                </h3>
              );
            }
            return (
              <h4 key={idx} className="text-xs sm:text-sm font-bold text-sky-300 mt-2.5 mb-1 tracking-tight">
                <InlineRichText text={block.text} />
              </h4>
            );
          }

          case 'table':
            return (
              <div key={idx} className="my-2.5 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/75">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-slate-900/80 text-slate-200">
                      {block.headers.map((h, hIdx) => (
                        <th key={hIdx} className="px-3 py-2 font-bold whitespace-nowrap">
                          <InlineRichText text={h} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {block.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-white/[0.02]">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3 py-2 text-slate-300 align-top">
                            <InlineRichText text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'blockquote':
            return (
              <blockquote
                key={idx}
                className="my-2 px-3.5 py-2.5 rounded-xl bg-indigo-500/[0.07] border border-indigo-500/20 text-slate-200 italic space-y-1 text-xs sm:text-[13px]"
              >
                {block.lines.map((ql, qIdx) => (
                  <p key={qIdx} className="leading-relaxed">
                    <InlineRichText text={ql} />
                  </p>
                ))}
              </blockquote>
            );

          case 'list':
            if (block.ordered) {
              return (
                <ol
                  key={idx}
                  start={block.start}
                  className={`list-decimal pl-5 my-1.5 space-y-1 text-slate-200 ${textSizeClass}`}
                >
                  {block.items.map((item, itIdx) => (
                    <li key={itIdx} className="leading-relaxed pl-0.5">
                      <InlineRichText text={item} />
                    </li>
                  ))}
                </ol>
              );
            }
            return (
              <ul key={idx} className={`list-disc pl-5 my-1.5 space-y-1 text-slate-200 ${textSizeClass}`}>
                {block.items.map((item, itIdx) => (
                  <li key={itIdx} className="leading-relaxed pl-0.5">
                    <InlineRichText text={item} />
                  </li>
                ))}
              </ul>
            );

          case 'spacer':
            return <div key={idx} className="h-1" />;

          case 'paragraph':
          default:
            return (
              <p key={idx} className={`leading-relaxed text-slate-200 ${textSizeClass}`}>
                <InlineRichText text={block.text} />
              </p>
            );
        }
      })}

      {stabilized.pendingKind && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-[11px] text-indigo-200 font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
          <span>{stabilized.pendingLabel || 'Formatting…'}</span>
        </div>
      )}
    </div>
  );
};
