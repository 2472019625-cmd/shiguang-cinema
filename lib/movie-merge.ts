import type { Movie } from './catalog';

/** Merge additional search pages without losing playback variants found earlier. */
export function mergeMovies(movies: Movie[]) {
  const merged = new Map<string, Movie>();
  for (const movie of movies) {
    const old = merged.get(movie.key);
    if (!old) { merged.set(movie.key, { ...movie, variants: [...movie.variants] }); continue; }
    const versions = new Map([...old.variants, ...movie.variants].map(v => [v.source + ':' + v.id, v]));
    old.variants = [...versions.values()];
  }
  return [...merged.values()];
}
