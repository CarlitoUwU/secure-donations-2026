import { afterEach, expect, test, vi } from 'vitest';
import { createPublicProjectSource } from './projectApi';

afterEach(() => vi.unstubAllGlobals());

test('la API pública conserva el cursor y consulta el detalle por su propia ruta', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ items: [], nextToken: 'siguiente' }))
    .mockResolvedValueOnce(new Response(null, { status: 404 }));
  vi.stubGlobal('fetch', fetchMock);
  const projects = createPublicProjectSource('https://api.example.test/academic/');
  const signal = new AbortController().signal;

  await expect(projects.listProjects('cursor+/=', signal)).resolves.toEqual({ items: [], nextToken: 'siguiente' });
  expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/academic/v1/projects?nextToken=cursor%2B%2F%3D', { signal });

  const projectId = '11111111-1111-4111-8111-111111111111';
  await expect(projects.getProject(projectId, signal)).rejects.toMatchObject({ status: 404 });
  expect(fetchMock).toHaveBeenNthCalledWith(2, `https://api.example.test/academic/v1/projects/${projectId}`, { signal });
});
