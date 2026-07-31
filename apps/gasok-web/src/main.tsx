import React, {
  Suspense,
  lazy,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import ReactDOM from 'react-dom/client';
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import { Footer } from './components/Footer';
import { ACTIVE_NETWORK } from './data/network';
import { WalletProvider, useWallet } from './lib/wallet';
import './styles.css';

const HomeRoute = lazy(() => import('./routes/HomeRoute'));
const SystemRoute = lazy(() => import('./routes/SystemRoute'));
const NetworkRoute = lazy(() => import('./routes/NetworkRoute'));
const BuildRoute = lazy(() => import('./routes/BuildRoute'));
const DocsRoute = lazy(() => import('./routes/DocsRoute'));

function RouteReset() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const reset = () => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'auto',
      });

      document
        .querySelectorAll<HTMLElement>('[data-route-scroll]')
        .forEach((element) => {
          element.scrollTop = 0;
        });
    };

    reset();

    let secondFrame = 0;

    const firstFrame = window.requestAnimationFrame(() => {
      reset();

      secondFrame = window.requestAnimationFrame(() => {
        reset();

        document
          .getElementById('route-content')
          ?.focus({ preventScroll: true });
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);

      if (secondFrame) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [pathname]);

  return null;
}

function Shell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [compact, setCompact] = useState(false);
  const { pathname } = useLocation();
  const docsMode = pathname.startsWith('/docs');
  const { address, connecting, connect } = useWallet();

  useEffect(() => {
    const onScroll = () => {
      setCompact(window.scrollY > 90);
    };

    onScroll();

    window.addEventListener('scroll', onScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div className={`app-shell ${docsMode ? 'docs-mode' : ''}`}>
      <RouteReset />

      <header
        className={`control-strip ${
          compact ? 'is-compact' : ''
        }`}
      >
        <Link
          className="brand"
          to="/"
          aria-label="Return to the OpenRails homepage"
          title="Return to homepage"
        >
          <span className="brand-mark">OR</span>
          <span>OPENRAILS</span>
        </Link>

        <nav aria-label="Primary navigation">
          <NavLink to="/system">SYSTEM</NavLink>
          <NavLink to="/network">NETWORK</NavLink>
          <NavLink to="/build">BUILD</NavLink>
          <NavLink to="/docs">DOCS</NavLink>
        </nav>

        <div className="network-control">
          <span>
            <i /> {ACTIVE_NETWORK.displayLabel}
          </span>

          <button
            type="button"
            onClick={() => void connect()}
          >
            {connecting
              ? 'CONNECTING'
              : address
                ? `${address.slice(0, 6)}…${address.slice(-4)}`
                : 'CONNECT'}
          </button>
        </div>
      </header>

      {children}

      {!docsMode && <Footer />}
    </div>
  );
}

function RoutePending() {
  return (
    <main className="editorial-page">
      <section className="page-hero">
        <span className="tech-label">OPENRAILS</span>
        <h1>Loading canonical surface.</h1>
      </section>
    </main>
  );
}

function AppRoutes() {
  const location = useLocation();

  return (
    <div
      id="route-content"
      className="route-surface"
      tabIndex={-1}
    >
      <Suspense fallback={<RoutePending />}>
        <Routes location={location}>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/system" element={<SystemRoute />} />
          <Route path="/network" element={<NetworkRoute />} />
          <Route path="/build" element={<BuildRoute />} />
          <Route path="/docs" element={<DocsRoute />} />
          <Route path="/docs/:slug" element={<DocsRoute />} />
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </Suspense>
    </div>
  );
}

function App() {
  return (
    <Shell>
      <AppRoutes />
    </Shell>
  );
}

ReactDOM
  .createRoot(document.getElementById('root')!)
  .render(
    <React.StrictMode>
      <WalletProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </WalletProvider>
    </React.StrictMode>,
  );
