// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Tiny hash router: "#/explore?area=m:52001&from=2024-01-01&to=2024-12-31&day=2024-02-10".
// Hash routing keeps the static build working on any host without server rewrites, and makes
// every query shareable as a link.

import { useCallback, useEffect, useState } from 'react';

export type Page = 'explore' | 'method' | 'data';

export interface Route {
  page: Page;
  params: URLSearchParams;
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const page: Page = path === 'method' || path === 'data' ? path : 'explore';
  return { page, params: new URLSearchParams(query) };
}

function build(page: Page, params?: URLSearchParams): string {
  const q = params?.toString();
  return `#/${page}${q ? `?${q}` : ''}`;
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(parse);

  useEffect(() => {
    const onHash = () => setRoute(parse());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((page: Page) => {
    const current = parse();
    // Keep the explore query when moving between pages so "back to explore" restores it.
    const params = page === 'explore' ? current.params : undefined;
    window.location.hash = build(page, params);
    window.scrollTo({ top: 0 });
  }, []);

  /** Updates the explore query without adding a history entry for every click. */
  const replaceParams = useCallback((params: URLSearchParams) => {
    const url = `${window.location.pathname}${window.location.search}${build('explore', params)}`;
    window.history.replaceState(null, '', url);
  }, []);

  return { route, navigate, replaceParams };
}
