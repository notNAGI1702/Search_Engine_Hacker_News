import React from 'react';

export default function ResultCard({ result }) {
  const isComment = result.title.startsWith('Comment by');
  const dateStr = result.created_at
    ? new Date(result.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <article
      className="bg-slate-800/60 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-300 transform hover:-translate-y-0.5 flex flex-col justify-between gap-4"
    >
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start gap-4">
          <h2 className="text-lg font-bold text-slate-100 hover:text-orange-400 transition-colors duration-200">
            <a href={result.url} target="_blank" rel="noopener noreferrer">
              {result.title || 'Untitled'}
            </a>
          </h2>
          <span className="shrink-0 bg-slate-900 border border-slate-700/60 text-orange-400 text-xs font-semibold px-2.5 py-1 rounded-full">
            Score: {result.score.toFixed(3)}
          </span>
        </div>

        {result.text && (
          <p className="text-slate-300 text-sm leading-relaxed line-clamp-3">
            {result.text}
          </p>
        )}
      </div>

      <div className="flex justify-between items-center text-xs text-slate-400 border-t border-slate-700/30 pt-3">
        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-0.5 rounded font-medium text-[10px] ${
              isComment
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}
          >
            {isComment ? 'Comment' : 'Story'}
          </span>
          {dateStr && <span>{dateStr}</span>}
        </div>
        <a
          href={`https://news.ycombinator.com/item?id=${result.hn_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-orange-300 hover:underline transition-all duration-150"
        >
          HN #{result.hn_id}
        </a>
      </div>
    </article>
  );
}
