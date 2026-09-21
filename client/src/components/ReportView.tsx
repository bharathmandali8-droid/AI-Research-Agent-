import React from 'react';
import ReactMarkdown from 'react-markdown';
import { ResearchResponse } from '../types';
import SourceCard from './SourceCard';

interface Props {
  data: ResearchResponse;
}

export default function ReportView({ data }: Props) {
  return (
    <div className="w-full space-y-8">
      {/* Sub-questions used */}
      {data.subquestions.length > 0 && (
        <div className="glass rounded-2xl p-5 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Research Sub-questions
          </h2>
          <ul className="space-y-1.5">
            {data.subquestions.map((q, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-300">
                <span className="text-violet-400 font-semibold">{i + 1}.</span>
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* RAG context notice — only shown when prior research was injected */}
      {data.cachedContext && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl glass border border-cyan-500/20 text-xs text-cyan-400/80">
          <svg className="w-3.5 h-3.5 flex-shrink-0 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>
            <span className="font-semibold text-cyan-300">RAG context active —</span>{' '}
            {data.cachedContext}
          </span>
        </div>
      )}

      {/* Report */}
      <div className="glass rounded-2xl p-6 prose prose-invert prose-sm max-w-none
        prose-headings:font-semibold prose-headings:text-gray-100
        prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3
        prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2
        prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-3
        prose-li:text-gray-300 prose-li:leading-relaxed
        prose-strong:text-gray-100
        prose-a:text-violet-400 prose-a:no-underline hover:prose-a:text-violet-300
        prose-blockquote:border-l-violet-500 prose-blockquote:text-gray-400
        prose-code:text-fuchsia-300 prose-code:bg-white/5 prose-code:rounded prose-code:px-1">
        <ReactMarkdown
          components={{
            // Intercept paragraph and list-item text nodes to linkify [N] citations
            p: ({ children }) => <p>{linkifyCitations(children, data.sources.length)}</p>,
            li: ({ children }) => <li>{linkifyCitations(children, data.sources.length)}</li>,
          }}
        >
          {data.report}
        </ReactMarkdown>
      </div>

      {/* Sources */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Sources ({data.sources.length})
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.sources.map((source, i) => (
            <SourceCard key={source.url} source={source} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Walk React children and replace "[N]" patterns in string nodes
 * with clickable <a> elements that scroll to the matching source card.
 * Only valid citation numbers (1..sourceCount) are linked; others pass through.
 */
function linkifyCitations(
  children: React.ReactNode,
  sourceCount: number
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child !== 'string') return child;

    const parts = child.split(/(\[\d+\])/g);
    if (parts.length === 1) return child;

    return parts.map((part, i) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (!match) return part;
      const n = parseInt(match[1], 10);
      // Extra safety guard in addition to server-side sanitizer
      if (n < 1 || n > sourceCount) return part;
      return (
        <a
          key={i}
          href={`#source-${n}`}
          title={`Go to source ${n}`}
          className="inline-flex items-center justify-center mx-0.5 px-1.5 py-0.5 rounded
            text-xs font-bold leading-none no-underline
            bg-violet-600/25 text-violet-300 border border-violet-500/40
            hover:bg-violet-600/50 hover:text-white transition-colors duration-150"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(`source-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        >
          {n}
        </a>
      );
    });
  });
}
