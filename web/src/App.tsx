// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.

import { useEffect, useState } from 'react';
import { loadBoot, type BootData } from './lib/data.ts';
import { useHashRoute, type Page } from './lib/useHashRoute.ts';
import { formatDay } from './lib/dates.ts';
import { ExplorePage } from './pages/ExplorePage.tsx';
import { MethodPage } from './pages/MethodPage.tsx';
import { DataPage } from './pages/DataPage.tsx';
import { Icon, Logo } from './components/Icon.tsx';

const NAV: { page: Page; label: string }[] = [
  { page: 'explore', label: 'Explore' },
  { page: 'method', label: 'Method' },
  { page: 'data', label: 'Data & credits' },
];

export default function App() {
  const { route, navigate, replaceParams } = useHashRoute();
  const [boot, setBoot] = useState<BootData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBoot().then(setBoot).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    const titles: Record<Page, string> = { explore: 'Explore', method: 'Method', data: 'Data & credits' };
    document.title = `${titles[route.page]} · Colombia Burn Calendar`;
  }, [route.page]);

  return (
    <div className={`app page-${route.page}`}>
      <header className="topbar">
        <a className="brand" href="#/explore" onClick={(e) => { e.preventDefault(); navigate('explore'); }}>
          <Logo />
          <div>
            <div className="brand-name">Colombia Burn Calendar</div>
            <div className="brand-sub">Harmonized MODIS + VIIRS hot spots</div>
          </div>
        </a>
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <a key={n.page} href={`#/${n.page}`} className={route.page === n.page ? 'on' : ''} aria-current={route.page === n.page ? 'page' : undefined}
              onClick={(e) => { e.preventDefault(); navigate(n.page); }}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="live">
          <span className="live-dot" />
          {boot ? <>Data through <b>{formatDay(boot.ctx.refEnd, false)}</b></> : 'Loading data…'}
        </div>
      </header>

      <div className="notice" role="note">
        <Icon name="info" size={14} />
        <span>
          <b>Hot spot</b> = thermal anomaly detected by satellite, not a confirmed fire. Cloud cover can hide fires: a zero does not
          guarantee absence of fire. Data from different satellites are not summed.
        </span>
      </div>

      <main>
        {error && (
          <div className="fatal">
            <Icon name="warning" size={22} />
            <div>
              <b>The data could not be loaded.</b>
              <p>{error}</p>
              <p className="muted">If you are running the site locally, run <code>npm run sync-data</code> in the web folder first.</p>
            </div>
          </div>
        )}
        {!error && !boot && route.page === 'explore' && (
          <div className="boot">
            <Logo size={56} />
            <div className="boot-bar"><i /></div>
            <p>Loading 15 years of satellite fire data…</p>
          </div>
        )}
        {boot && route.page === 'explore' && <ExplorePage boot={boot} params={route.params} onParams={replaceParams} />}
        {route.page === 'method' && <MethodPage />}
        {route.page === 'data' && <DataPage />}
      </main>

      {route.page !== 'explore' && (
        <footer className="footer">
          <div>
            <b>Colombia Burn Calendar</b> · Horum Labs · NASA Space Apps Challenge 2026
          </div>
          <div className="muted small">
            Independent project, not endorsed by NASA. Data: NASA FIRMS, NASA GIBS, DANE, IDEAM. Built with the help of AI (see Data & credits).
          </div>
        </footer>
      )}
    </div>
  );
}
