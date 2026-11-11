import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { createDemoApi } from './demo/demoApi';
import { createSession } from './auth';
import { createPrivateApi } from './privateApi';
import { createPublicProjectSource, type ProjectSource } from './projects/projectApi';
import { catalogRoutes } from './routes';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('No se encontró el elemento raíz de la aplicación.');
}

const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const issuer = import.meta.env.VITE_COGNITO_ISSUER?.trim();
const loginDomain = import.meta.env.VITE_COGNITO_LOGIN_DOMAIN?.trim();
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID?.trim();
const audience = import.meta.env.VITE_API_AUDIENCE?.trim();
const session = issuer && loginDomain && clientId && audience
  ? createSession(issuer, loginDomain, clientId, audience)
  : undefined;
const demo = import.meta.env.DEV && !baseUrl && !session ? createDemoApi() : undefined;
const unconfiguredSource: ProjectSource = {
  listProjects: async () => ({ items: [] }),
  getProject: async () => { throw new Response(null, { status: 404 }); },
};
const source = baseUrl ? createPublicProjectSource(baseUrl) : demo ?? unconfiguredSource;
const privateApi = baseUrl && session
  ? createPrivateApi(baseUrl, session.accessToken, source.getProject, import.meta.env.VITE_DRAFT_LIST_PATH?.trim())
  : demo;
const router = createBrowserRouter(catalogRoutes(source, privateApi, session));

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
