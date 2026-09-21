import { SearchResult } from '../types';

interface Props {
  source: SearchResult;
  index: number;
}

export default function SourceCard({ source, index }: Props) {
  const domain = (() => {
    try {
      return new URL(source.url).hostname.replace('www.', '');
    } catch {
      return source.url;
    }
  })();

  return (
    <a
      id={`source-${index + 1}`}
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block glass rounded-xl p-4 hover:border-violet-500/40 hover:bg-white/8 transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-600/30 text-violet-300 text-xs flex items-center justify-center font-bold mt-0.5">
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-200 group-hover:text-violet-300 transition-colors line-clamp-2 leading-snug">
            {source.title}
          </p>
          <p className="text-xs text-violet-400/80 mt-1">{domain}</p>
          {source.snippet && (
            <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
              {source.snippet}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}
