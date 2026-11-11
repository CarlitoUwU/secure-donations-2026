export type Project = {
  projectId: string;
  title: string;
  description: string;
  goalAmountCents: number;
  confirmedAmountCents: number;
  currency: 'PEN';
  status: 'BORRADOR' | 'PUBLICADO';
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type Page<T> = { items: T[]; nextToken?: string };
export type ProjectInput = Pick<Project, 'title' | 'description' | 'goalAmountCents'>;
export type ProjectPatch = Partial<ProjectInput>;

export type ProjectSource = {
  listProjects: (nextToken?: string, signal?: AbortSignal) => Promise<Page<Project>>;
  getProject: (projectId: string, signal?: AbortSignal) => Promise<Project>;
};

export function createPublicProjectSource(baseUrl: string): ProjectSource {
  const api = baseUrl.replace(/\/+$/, '');

  async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(`${api}${path}`, { signal });
    if (!response.ok) {
      throw new Response(null, { status: response.status });
    }
    return response.json();
  }

  return {
    listProjects(nextToken, signal) {
      const query = nextToken ? `?${new URLSearchParams({ nextToken })}` : '';
      return request<Page<Project>>(`/v1/projects${query}`, signal);
    },
    getProject(projectId, signal) {
      return request<Project>(`/v1/projects/${encodeURIComponent(projectId)}`, signal);
    },
  };
}
