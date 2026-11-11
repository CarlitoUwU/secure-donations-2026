import { Link, useSearchParams } from 'react-router';

export function Pagination({ nextToken }: { nextToken?: string }) {
  const [query] = useSearchParams();
  const hasCursor = query.has('nextToken');
  if (!hasCursor && !nextToken) return null;

  return (
    <nav className="pagination" aria-label="Páginas de resultados">
      {hasCursor && <Link to="?">Primera página</Link>}
      {nextToken && <Link to={`?${new URLSearchParams({ nextToken })}`}>Página siguiente</Link>}
    </nav>
  );
}
