import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, Outlet, useLocation, useNavigation } from 'react-router';
import type { Session } from './auth';

const subscribeAsVisitor = () => () => {};
const visitorSnapshot = () => null;

export function LoadingProjects() {
  return <p className="notice" role="status">Cargando proyectos…</p>;
}

export function App({ localFlows, session }: { localFlows: boolean; session?: Session }) {
  const user = useSyncExternalStore(session?.subscribe ?? subscribeAsVisitor, session?.snapshot ?? visitorSnapshot);
  const [signingOut, setSigningOut] = useState(false);
  const { pathname } = useLocation();
  const navigation = useNavigation();
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);

  useEffect(() => {
    if (pathname !== previousPath.current) {
      previousPath.current = pathname;
      main.current?.querySelector('h1')?.focus();
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return (
    <>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className="site-header">
        <div className="container header-content">
          <Link className="brand" to="/">Fundación AQP-SOLIDARIA</Link>
          {user || signingOut ? (
            <button type="button" className="action-button secondary" disabled={signingOut} onClick={() => {
              setSigningOut(true);
              void session?.signOut().catch(() => setSigningOut(false));
            }}>
              {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </button>
          ) : <Link className="action-button secondary" to="/ingresar">Iniciar sesión</Link>}
        </div>
        {(localFlows || user) && (
          <nav className="container demo-nav" aria-label="Navegación principal">
            <Link to="/">Catálogo</Link>
            {(localFlows || session?.hasRole('DONANTE')) && <Link to="/mis-donaciones">Mis donaciones</Link>}
            {(localFlows || session?.hasRole('GESTOR')) && <Link to="/gestion/proyectos">Gestión de proyectos</Link>}
          </nav>
        )}
      </header>
      <main id="contenido" ref={main} tabIndex={-1} className="container main-content">
        {navigation.state === 'loading' && <LoadingProjects />}
        <Outlet />
      </main>
    </>
  );
}
