import type { Donation, PrivateApi } from './demo/demoApi';
import type { Page, Project } from './projects/projectApi';

export function createPrivateApi(
  baseUrl: string,
  accessToken: () => Promise<string>,
  getProject: PrivateApi['getProject'],
  draftListPath?: string,
): PrivateApi {
  const base = baseUrl.replace(/\/+$/, '');
  const drafts = new Map<string, Project>();

  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${await accessToken()}`);
    if (options.body) headers.set('Content-Type', 'application/json');
    const response = await fetch(base + path, { ...options, headers });
    if (!response.ok) throw new Response(null, { status: response.status });
    return response.json();
  }

  function remember(project: Project) {
    drafts.set(project.projectId, project);
    return project;
  }

  return {
    getProject,
    async listDrafts() {
      if (draftListPath) {
        let nextToken: string | undefined;
        const items: Project[] = [];
        do {
          const query = nextToken ? `?${new URLSearchParams({ nextToken })}` : '';
          const page: Page<Project> = await request(draftListPath + query);
          items.push(...page.items);
          nextToken = page.nextToken;
        } while (nextToken);
        return items.filter((project) => project.status === 'BORRADOR').map(remember);
      }
      return [...drafts.values()];
    },
    async getDraft(id) {
      if (draftListPath && !drafts.has(id)) await this.listDrafts();
      const draft = drafts.get(id);
      if (!draft) throw new Response(null, { status: 404 });
      return draft;
    },
    async createProject(input) {
      return remember(await request<Project>('/v1/projects', { method: 'POST', body: JSON.stringify(input) }));
    },
    async editProject(id, input) {
      return remember(await request<Project>(`/v1/projects/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify(input),
      }));
    },
    async publishProject(id) {
      const project = await request<Project>(`/v1/projects/${encodeURIComponent(id)}/publish`, { method: 'PATCH' });
      drafts.delete(id);
      return project;
    },
    listDonations(nextToken) {
      const query = nextToken ? `?${new URLSearchParams({ nextToken })}` : '';
      return request<Page<Donation>>('/v1/donations/me' + query);
    },
    getDonation: (id) => request<Donation>(`/v1/donations/${encodeURIComponent(id)}`),
    createDonation: (input, key) => request<Donation>('/v1/donations', {
      method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key },
    }),
    simulateDonation: (id, status) => request<Donation>(`/v1/donations/${encodeURIComponent(id)}/simulate`, {
      method: 'POST', body: JSON.stringify({ status }),
    }),
  };
}
