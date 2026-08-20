import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { CompanySearchResult } from '../types';

// Recherche d'entreprise (nom, SIREN, SIRET, TVA) via l'Annuaire des Entreprises,
// utilisé pour pré-remplir automatiquement un formulaire société/client.
export function CompanySearch({ onSelect }: { onSelect: (result: CompanySearchResult) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CompanySearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const { data } = await api.get<CompanySearchResult[]>('/company/search', {
          params: { q: trimmed },
        });
        setResults(data);
        setSearchError(data.length === 0 ? 'Aucun résultat' : null);
        setOpen(true);
      } catch {
        setSearchError('Erreur lors de la recherche');
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(result: CompanySearchResult) {
    onSelect(result);
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative mb-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Rechercher par nom, SIREN, SIRET ou numéro de TVA..."
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
      />
      {searching && <p className="mt-1 text-xs text-slate-400">Recherche en cours...</p>}
      {open && (results.length > 0 || searchError) && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          {searchError && results.length === 0 && (
            <p className="px-3 py-2 text-sm text-slate-400">{searchError}</p>
          )}
          {results.map((result) => (
            <button
              key={result.siren}
              type="button"
              onClick={() => handleSelect(result)}
              className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50"
            >
              <span className="font-medium text-slate-900">{result.name}</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {[result.siret ? `SIRET ${result.siret}` : `SIREN ${result.siren}`, result.address]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}