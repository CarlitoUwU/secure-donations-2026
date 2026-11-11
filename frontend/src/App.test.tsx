import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, expect, test, vi } from 'vitest';
import type { Project } from './projects/projectApi';
import { catalogRoutes } from './routes';

const published: Project = {
  projectId: 'lectura',
  title: 'Talleres de lectura',
  description: 'Libros y talleres para niñas y niños.',
  goalAmountCents: 800000,
  confirmedAmountCents: 520000,
  currency: 'PEN',
  status: 'PUBLICADO',
  createdAt: '2026-11-09T12:00:00Z',
  updatedAt: '2026-11-09T12:00:00Z',
  revision: 1,
};
const draft: Project = { ...published, projectId: 'borrador', title: 'Campaña en borrador', status: 'BORRADOR' };

function renderCatalog(loadProjects: () => Promise<Project[]>, path = '/') {
  const router = createMemoryRouter(catalogRoutes({
    listProjects: async () => ({ items: await loadProjects() }),
    getProject: async (id) => {
      const project = (await loadProjects()).find(({ projectId }) => id === projectId);
      if (!project) throw new Response(null, { status: 404 });
      return project;
    },
  }), { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('CA-01.1 CA-01.2 CA-09.1 muestra proyectos publicados y sus importes en soles', async () => {
  renderCatalog(async () => [published, draft]);

  const catalog = await screen.findByRole('region', { name: 'Proyectos publicados' });
  expect(within(catalog).getByRole('heading', { name: published.title })).toBeTruthy();
  expect(within(catalog).queryByText(draft.title)).toBeNull();
  expect(within(catalog).getByText(/S\/\s*5,200\.00/)).toBeTruthy();
  expect(within(catalog).getByText(/S\/\s*8,000\.00/)).toBeTruthy();
  expect(within(catalog).getByRole('progressbar').getAttribute('value')).toBe('65');
});

test('CA-01.3 presenta el estado vacío en una sección accesible', async () => {
  renderCatalog(async () => [draft]);

  const catalog = await screen.findByRole('region', { name: 'Proyectos publicados' });
  expect(within(catalog).getByText('Aún no hay proyectos publicados.')).toBeTruthy();
});

test('CA-02.1 abre el detalle, enfoca su encabezado y vuelve al catálogo', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  renderCatalog(async () => [published]);

  fireEvent.click(await screen.findByRole('link', { name: `Ver proyecto: ${published.title}` }));
  const detailHeading = await screen.findByRole('heading', { level: 1, name: published.title });
  expect(screen.getByText('Identificador: lectura')).toBeTruthy();
  expect(screen.getByText(published.description)).toBeTruthy();
  expect(screen.getByText('Publicado')).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(detailHeading));

  fireEvent.click(screen.getByRole('link', { name: 'Volver al catálogo' }));
  expect(await screen.findByRole('region', { name: 'Proyectos publicados' })).toBeTruthy();
});

test.each(['/proyectos/borrador', '/proyectos/desconocido'])(
  'CA-02.2 muestra el estado de proyecto no encontrado en %s',
  async (path) => {
    renderCatalog(async () => [published, draft], path);

    expect(await screen.findByRole('heading', { name: 'Proyecto no encontrado' })).toBeTruthy();
    expect(screen.queryByText(draft.title)).toBeNull();
  },
);

test('anuncia la carga y permite reintentar tras un error', async () => {
  const loadProjects = vi.fn<() => Promise<Project[]>>()
    .mockRejectedValueOnce(new Error('Fallo de prueba'))
    .mockResolvedValueOnce([published]);
  renderCatalog(loadProjects);

  expect(screen.getByRole('status').textContent).toBe('Cargando proyectos…');
  expect((await screen.findByRole('alert')).textContent).toBe('Intenta cargar la página de nuevo.');
  fireEvent.click(screen.getByRole('button', { name: 'Volver a intentar' }));

  expect(await screen.findByRole('heading', { name: published.title })).toBeTruthy();
  expect(loadProjects).toHaveBeenCalledTimes(2);
});
