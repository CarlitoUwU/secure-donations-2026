import { Outlet, redirect, type RouteObject } from 'react-router';
import { App, LoadingProjects } from './App';
import type { Role, Session } from './auth';
import type { PrivateApi } from './demo/demoApi';
import { demoRoutes } from './demo/demoRoutes';
import { LoginPage } from './LoginPage';
import { Catalog, CatalogError, ProjectDetail } from './projects/ProjectPages';
import type { ProjectSource } from './projects/projectApi';

export function catalogRoutes(source: ProjectSource, privateApi?: PrivateApi, session?: Session): RouteObject[] {
  const localFlows = Boolean(privateApi && !session);
  function requireRole(role: Role) {
    if (localFlows) return;
    if (!session?.snapshot()) throw new Response(null, { status: 401 });
    if (!session.hasRole(role)) throw new Response(null, { status: 403 });
  }

  return [
    {
      Component: () => <App localFlows={localFlows} session={session} />,
      HydrateFallback: () => <main className="container main-content"><LoadingProjects /></main>,
      children: [
        {
          Component: Outlet,
          ErrorBoundary: CatalogError,
          children: [
            {
              index: true,
              async loader({ request }) {
                const cursor = new URL(request.url).searchParams.get('nextToken') ?? undefined;
                const page = await source.listProjects(cursor, request.signal);
                return { ...page, items: page.items.filter(({ status }) => status === 'PUBLICADO') };
              },
              Component: Catalog,
            },
            {
              path: 'proyectos/:projectId',
              async loader({ params, request }) {
                const project = await source.getProject(params.projectId ?? '', request.signal);
                if (project.status !== 'PUBLICADO') {
                  throw new Response(null, { status: 404 });
                }
                const canDonate = localFlows || session?.hasRole('DONANTE');
                const donationLink = canDonate && privateApi ? 'donar' : session && !session.snapshot() ? '/ingresar' : null;
                return { project, donationLink };
              },
              Component: ProjectDetail,
            },
            { path: 'ingresar', Component: () => <LoginPage session={session} /> },
            {
              path: 'auth/callback',
              async loader() {
                try {
                  if (!session) throw new Error('Inicio de sesión sin configurar.');
                  await session.completeSignIn();
                  return redirect('/');
                } catch {
                  return redirect('/ingresar?error=1');
                }
              },
            },
            ...(privateApi ? demoRoutes(privateApi, requireRole) : []),
            { path: '*', loader: () => { throw new Response(null, { status: 404 }); } },
          ],
        },
      ],
    },
  ];
}
