import React, { useState, useEffect } from 'react';
import ResultCard from './ResultCard';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  // Focus search input on load
  useEffect(() => {
    const input = document.getElementById('search-input');
    if (input) input.focus();
  }, []);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      // Proxied to backend port 3000 via vite proxy
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      const data = await response.json();
      setResults(data);
    } catch (err) {
      console.error(err);
      setError('Could not connect to the search service. Please make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 flex flex-col gap-8 min-h-screen">
      {/* Header */}
      <header className="text-center flex flex-col gap-2">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
          Hacker News Search
        </h1>
        <p className="text-slate-400 text-sm md:text-base">
          C++ BM25 Ranker Engine on Algolia HN Data
        </p>
      </header>

      {/* Search Input Box */}
      <form onSubmit={handleSearch} className="flex gap-2.5 w-full md:max-w-2xl md:mx-auto">
        <div className="relative flex-1">
          <input
            id="search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stories, comment text, authors..."
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-5 py-3.5 pr-10 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-200"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white font-semibold px-6 py-3.5 rounded-xl shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 active:scale-95 transition-all duration-200"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl p-4 text-center">
          {error}
        </div>
      )}

      {/* Results Status */}
      {searched && !loading && !error && (
        <div className="text-slate-400 text-sm flex items-center justify-between border-b border-slate-800 pb-2">
          <span>
            Found <strong className="text-slate-200">{results.length}</strong> matches for &ldquo;{query}&rdquo;
          </span>
          <span className="text-xs">BM25 Ranker Sorted</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
          <span className="text-slate-400 text-sm animate-pulse">Running C++ BM25 ranker...</span>
        </div>
      )}

      {/* Results List */}
      {!loading && !error && (
        <div className="flex flex-col gap-4">
          {results.map((result) => (
            <ResultCard key={result.id} result={result} />
          ))}

          {searched && results.length === 0 && (
            <div className="text-center py-20 bg-slate-800/20 border border-slate-800/80 rounded-xl">
              <p className="text-slate-400 text-lg">No matches found.</p>
              <p className="text-slate-500 text-sm mt-1">Try different terms or run the crawler to index more docs.</p>
            </div>
          )}

          {!searched && (
            <div className="text-center py-20 border border-slate-800/40 rounded-xl flex flex-col gap-2">
              <p className="text-slate-400 text-lg">Search engine is ready.</p>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">
                Type in terms to rank documents by relevance score. Ensure you have run migrations, crawled data, and indexed the corpus.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
