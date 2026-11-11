import { redirect, type RouteObject } from 'react-router';
import { parseSoles } from '../money';
import type { ProjectInput } from '../projects/projectApi';
import type { Role } from '../auth';
import type { PrivateApi, Donation } from './demoApi';
import { DemoError, DonationDetail, DonationHistory, DraftForm, DraftList, NewDonation } from './DemoPages';

function draftInput(data: FormData): ProjectInput | null {
  const title = String(data.get('title') ?? '').trim();
  const description = String(data.get('description') ?? '').trim();
  const goalAmountCents = parseSoles(String(data.get('goal') ?? ''));
  if (!title || title.length > 160 || !description || description.length > 5000 ||
    goalAmountCents === null || goalAmountCents < 1 || goalAmountCents > 1000000000) {
    return null;
  }
  return { title, description, goalAmountCents };
}

const invalidDraft = { error: 'Revisa el título, la descripción y la meta. La meta debe estar entre S/ 0.01 y S/ 10,000,000.00.' };

export function demoRoutes(api: PrivateApi, requireRole: (role: Role) => void): RouteObject[] {
  async function withProject(donation: Donation) {
    try {
      const project = await api.getProject(donation.projectId);
      return { ...donation, projectTitle: project.title };
    } catch {
      return { ...donation, projectTitle: 'Proyecto no disponible' };
    }
  }

  const routes: RouteObject[] = [
      {
        path: 'proyectos/:projectId/donar',
        loader: ({ params }) => api.getProject(params.projectId ?? ''),
        Component: NewDonation,
        async action({ params, request }) {
          const data = await request.formData();
          const amountCents = parseSoles(String(data.get('amount') ?? ''));
          const key = String(data.get('idempotencyKey') ?? '');
          if (amountCents === null || amountCents < 100 || amountCents > 100000 || !key) {
            return { error: 'Ingresa un importe de S/ 1.00 a S/ 1,000.00 con hasta dos decimales.' };
          }
          try {
            const donation = await api.createDonation({ projectId: params.projectId ?? '', amountCents }, key);
            return redirect(`/mis-donaciones/${donation.donationId}`);
          } catch (error) {
            if (error instanceof Response && (error.status === 401 || error.status === 403)) throw error;
            return { error: 'No se pudo registrar la intención. Verifica que el proyecto siga disponible e inténtalo de nuevo.' };
          }
        },
      },
      {
        path: 'mis-donaciones',
        async loader({ request }) {
          const cursor = new URL(request.url).searchParams.get('nextToken') ?? undefined;
          const page = await api.listDonations(cursor);
          return { ...page, items: await Promise.all(page.items.map(withProject)) };
        },
        Component: DonationHistory,
      },
      {
        path: 'mis-donaciones/:donationId',
        loader: async ({ params }) => withProject(await api.getDonation(params.donationId ?? '')),
        Component: DonationDetail,
        async action({ params, request }) {
          const status = (await request.formData()).get('status');
          if (status !== 'CONFIRMADA_SIMULADA' && status !== 'RECHAZADA_SIMULADA') {
            return { error: 'Selecciona confirmación o rechazo.' };
          }
          try {
            await api.simulateDonation(params.donationId ?? '', status);
            return null;
          } catch (error) {
            if (error instanceof Response && (error.status === 401 || error.status === 403)) throw error;
            return { error: 'No se pudo simular la donación. Revisa su estado actual.' };
          }
        },
      },
      {
        path: 'gestion/proyectos',
        loader: () => api.listDrafts(),
        Component: DraftList,
      },
      {
        path: 'gestion/proyectos/nuevo',
        loader: () => null,
        Component: DraftForm,
        async action({ request }) {
          const input = draftInput(await request.formData());
          if (!input) return invalidDraft;
          const draft = await api.createProject(input);
          return redirect(`/gestion/proyectos/${draft.projectId}`);
        },
      },
      {
        path: 'gestion/proyectos/:projectId',
        loader: ({ params }) => api.getDraft(params.projectId ?? ''),
        Component: DraftForm,
        async action({ params, request }) {
          const id = params.projectId ?? '';
          const data = await request.formData();
          if (data.get('intent') === 'publish') {
            const project = await api.publishProject(id);
            return redirect(`/proyectos/${project.projectId}`);
          }
          const input = draftInput(data);
          if (!input) return invalidDraft;
          await api.editProject(id, input);
          return { message: 'Cambios guardados.' };
        },
      },
  ];
  return [{
    ErrorBoundary: DemoError,
    children: routes.map((route) => {
      const role = route.path?.startsWith('gestion/') ? 'GESTOR' : 'DONANTE';
      const { loader, action } = route;
      return {
        ...route,
        loader(args) {
          requireRole(role);
          if (typeof loader === 'function') return loader(args);
          return null;
        },
        action: typeof action === 'function' ? (args) => {
          requireRole(role);
          return action(args);
        } : undefined,
      };
    }),
  }];
}
