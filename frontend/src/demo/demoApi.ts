import type { Page, Project, ProjectInput, ProjectPatch, ProjectSource } from '../projects/projectApi';

type DonationStatus = 'PENDIENTE_SIMULACION' | 'CONFIRMADA_SIMULADA' | 'RECHAZADA_SIMULADA';
export type SimulationStatus = Exclude<DonationStatus, 'PENDIENTE_SIMULACION'>;

export type Donation = {
  donationId: string;
  projectId: string;
  donorSub: string;
  amountCents: number;
  currency: 'PEN';
  status: DonationStatus;
  createdAt: string;
  updatedAt: string;
};

export type DonationInput = Pick<Donation, 'projectId' | 'amountCents'>;

const initialProjects: Project[] = [
  {
    projectId: '11111111-1111-4111-8111-111111111111',
    title: 'Aulas que abren caminos',
    description: 'Talleres de lectura y materiales escolares para niñas y niños de Arequipa. La meta financia cuadernos, libros y sesiones de acompañamiento durante un ciclo escolar.',
    goalAmountCents: 800000,
    confirmedAmountCents: 520000,
    currency: 'PEN',
    status: 'PUBLICADO',
    createdAt: '2026-11-09T12:00:00Z',
    updatedAt: '2026-11-09T12:00:00Z',
    revision: 1,
  },
  {
    projectId: '22222222-2222-4222-8222-222222222222',
    title: 'Una mesa para todos',
    description: 'Equipamiento y alimentos para una olla común. La meta cubre utensilios de cocina y compras semanales de insumos para las familias de la comunidad.',
    goalAmountCents: 650000,
    confirmedAmountCents: 273000,
    currency: 'PEN',
    status: 'PUBLICADO',
    createdAt: '2026-11-09T12:00:00Z',
    updatedAt: '2026-11-09T12:00:00Z',
    revision: 1,
  },
];

function page<T>(items: T[], nextToken?: string): Page<T> {
  const offset = nextToken ? Number(nextToken) : 0;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > items.length) {
    throw new Response(null, { status: 400 });
  }
  const nextOffset = offset + 50;
  return {
    items: items.slice(offset, nextOffset),
    ...(nextOffset < items.length && { nextToken: String(nextOffset) }),
  };
}

function getRecord<T>(records: Map<string, T>, id: string): T {
  const record = records.get(id);
  if (!record) throw new Response(null, { status: 404 });
  return record;
}

export function createDemoApi(seed = initialProjects) {
  const projects = new Map(seed.map((project) => [project.projectId, { ...project }]));
  const donations = new Map<string, Donation>();
  const attempts = new Map<string, { input: DonationInput; donation: Donation }>();

  function getDraft(projectId: string) {
    const project = getRecord(projects, projectId);
    if (project.status !== 'BORRADOR') throw new Response(null, { status: 409 });
    return project;
  }

  return {
    async listProjects(nextToken?: string) {
      return page([...projects.values()].filter(({ status }) => status === 'PUBLICADO'), nextToken);
    },
    async getProject(projectId) {
      const project = getRecord(projects, projectId);
      if (project.status !== 'PUBLICADO') throw new Response(null, { status: 404 });
      return project;
    },
    async listDrafts() {
      return [...projects.values()].filter(({ status }) => status === 'BORRADOR');
    },
    async getDraft(projectId: string) {
      return getDraft(projectId);
    },
    async createProject(input: ProjectInput) {
      const now = new Date().toISOString();
      const project: Project = {
        ...input, projectId: crypto.randomUUID(), currency: 'PEN', status: 'BORRADOR',
        confirmedAmountCents: 0, createdAt: now, updatedAt: now, revision: 0,
      };
      projects.set(project.projectId, project);
      return project;
    },
    async editProject(projectId: string, input: ProjectPatch) {
      const draft = getDraft(projectId);
      const project = { ...draft, ...input, updatedAt: new Date().toISOString(), revision: draft.revision + 1 };
      projects.set(projectId, project);
      return project;
    },
    async publishProject(projectId: string) {
      const draft = getDraft(projectId);
      const project: Project = {
        ...draft, status: 'PUBLICADO', updatedAt: new Date().toISOString(), revision: draft.revision + 1,
      };
      projects.set(projectId, project);
      return project;
    },
    async listDonations(nextToken?: string) {
      return page([...donations.values()].reverse(), nextToken);
    },
    async getDonation(donationId: string) {
      return getRecord(donations, donationId);
    },
    async createDonation(input: DonationInput, key: string) {
      const previous = attempts.get(key);
      if (previous) {
        if (previous.input.projectId !== input.projectId || previous.input.amountCents !== input.amountCents) {
          throw new Response(null, { status: 409 });
        }
        return previous.donation;
      }

      const project = getRecord(projects, input.projectId);
      if (project.status !== 'PUBLICADO') throw new Response(null, { status: 409 });
      const now = new Date().toISOString();
      const donation: Donation = {
        ...input, donationId: crypto.randomUUID(), donorSub: 'donante-de-prueba', currency: 'PEN',
        status: 'PENDIENTE_SIMULACION', createdAt: now, updatedAt: now,
      };
      donations.set(donation.donationId, donation);
      attempts.set(key, { input, donation });
      return donation;
    },
    async simulateDonation(donationId: string, status: SimulationStatus): Promise<Donation> {
      const pending = getRecord(donations, donationId);
      if (pending.status !== 'PENDIENTE_SIMULACION') throw new Response(null, { status: 409 });
      const updatedAt = new Date().toISOString();
      const donation = { ...pending, status, updatedAt };
      if (status === 'CONFIRMADA_SIMULADA') {
        const project = getRecord(projects, donation.projectId);
        projects.set(project.projectId, {
          ...project, confirmedAmountCents: project.confirmedAmountCents + donation.amountCents, updatedAt,
        });
      }
      donations.set(donationId, donation);
      return donation;
    },
  } satisfies ProjectSource & Record<string, unknown>;
}

export type DemoApi = ReturnType<typeof createDemoApi>;
export type PrivateApi = Omit<DemoApi, 'listProjects'>;
