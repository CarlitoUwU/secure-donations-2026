import { useRef } from 'react';
import { Form, Link, isRouteErrorResponse, useActionData, useLoaderData, useNavigation, useRouteError, useSubmit } from 'react-router';
import { formatSoles, parseSoles } from '../money';
import { Pagination } from '../Pagination';
import type { Page, Project } from '../projects/projectApi';
import type { Donation } from './demoApi';

const donationLabels = {
  PENDIENTE_SIMULACION: 'Pendiente de simulación',
  CONFIRMADA_SIMULADA: 'Confirmada simulada',
  RECHAZADA_SIMULADA: 'Rechazada simulada',
};
const dateFormat = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'America/Lima' });

export function DemoError() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const title = status === 401 ? 'Inicia sesión para continuar'
    : status === 403 ? 'Acceso restringido'
    : status === 404 ? 'No encontramos el registro' : 'No se pudo completar la operación';
  return (
    <section className="notice">
      <h1 tabIndex={-1}>{title}</h1>
      <p role="alert">Comprueba tu sesión o vuelve al catálogo.</p>
      {status === 401 && <p><Link to="/ingresar">Iniciar sesión</Link></p>}
      <Link className="back-link" to="/">Volver al catálogo</Link>
    </section>
  );
}

function FormFeedback() {
  const result = useActionData<{ error?: string; message?: string }>();
  if (result?.error) return <p role="alert" className="form-error">{result.error}</p>;
  if (result?.message) return <p role="status">{result.message}</p>;
  return null;
}

export function NewDonation() {
  const project = useLoaderData<Project>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const attempt = useRef<{ cents: number; key: string } | null>(null);
  const pending = navigation.state !== 'idle';

  return (
    <section className="demo-page">
      <Link className="back-link" to={`/proyectos/${project.projectId}`}>Volver al proyecto</Link>
      <h1 tabIndex={-1}>Simular una donación</h1>
      <p>{project.title}</p>
      <Form className="demo-form" method="post" onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const data = new FormData(event.currentTarget);
        const cents = parseSoles(String(data.get('amount') ?? ''));
        if (cents !== null && cents >= 100 && cents <= 100000) {
          if (attempt.current?.cents !== cents) attempt.current = { cents, key: crypto.randomUUID() };
          data.set('idempotencyKey', attempt.current.key);
        }
        void submit(data, { method: 'post' });
      }}>
        <label htmlFor="amount">Importe en soles</label>
        <input id="amount" name="amount" inputMode="decimal" required aria-describedby="amount-help" />
        <p id="amount-help">Ingresa de S/ 1.00 a S/ 1,000.00 con hasta dos decimales. Por ejemplo, 15.50.</p>
        <FormFeedback />
        <button className="action-button" disabled={pending}>Registrar intención</button>
      </Form>
    </section>
  );
}

type DonationWithProject = Donation & { projectTitle: string };

export function DonationHistory() {
  const { items, nextToken } = useLoaderData<Page<DonationWithProject>>();

  return (
    <section className="demo-page">
      <h1 tabIndex={-1}>Mis donaciones simuladas</h1>
      {items.length === 0 ? <p className="notice">Todavía no tienes intenciones registradas.</p> : (
        <ul className="record-list">
          {items.map((donation) => (
            <li key={donation.donationId}>
              <Link to={`/mis-donaciones/${donation.donationId}`}>{donation.projectTitle}</Link>
              <p>{formatSoles(donation.amountCents)} · {donationLabels[donation.status]}</p>
              <time dateTime={donation.createdAt}>{dateFormat.format(new Date(donation.createdAt))}</time>
            </li>
          ))}
        </ul>
      )}
      <Pagination nextToken={nextToken} />
      <Link className="back-link" to="/">Explorar proyectos</Link>
    </section>
  );
}

export function DonationDetail() {
  const donation = useLoaderData<DonationWithProject>();
  const pending = useNavigation().state !== 'idle';

  return (
    <section className="demo-page">
      <Link className="back-link" to="/mis-donaciones">Volver a mis donaciones</Link>
      <h1 tabIndex={-1}>Detalle de donación</h1>
      <p>{donation.projectTitle} · {formatSoles(donation.amountCents)}</p>
      <p role="status" className="donation-status">{donationLabels[donation.status]}</p>
      <p>Simulación académica: no se ha realizado ningún cobro</p>
      <FormFeedback />
      {donation.status === 'PENDIENTE_SIMULACION' && (
        <Form method="post" className="form-actions">
          <button className="action-button" name="status" value="CONFIRMADA_SIMULADA" disabled={pending}>
            Simular confirmación
          </button>
          <button className="action-button secondary" name="status" value="RECHAZADA_SIMULADA" disabled={pending}>
            Simular rechazo
          </button>
        </Form>
      )}
    </section>
  );
}

export function DraftList() {
  const drafts = useLoaderData<Project[]>();

  return (
    <section className="demo-page">
      <h1 tabIndex={-1}>Gestión de proyectos</h1>
      <Link className="action-button detail-action" to="nuevo">Crear borrador</Link>
      {drafts.length === 0 ? <p className="notice">No hay borradores disponibles.</p> : (
        <ul className="record-list">
          {drafts.map((draft) => (
            <li key={draft.projectId}>
              <Link to={draft.projectId}>{draft.title}</Link>
              <p>Meta de {formatSoles(draft.goalAmountCents)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DraftForm() {
  const draft = useLoaderData<Project | null>();
  const pending = useNavigation().state !== 'idle';

  return (
    <section className="demo-page">
      <Link className="back-link" to="/gestion/proyectos">Volver a gestión</Link>
      <h1 tabIndex={-1}>{draft ? 'Editar borrador' : 'Crear borrador'}</h1>
      <Form className="demo-form" method="post">
        <label htmlFor="title">Título</label>
        <input id="title" name="title" defaultValue={draft?.title} maxLength={160} required />
        <label htmlFor="description">Descripción</label>
        <textarea id="description" name="description" defaultValue={draft?.description} maxLength={5000} rows={5} required />
        <label htmlFor="goal">Meta en soles</label>
        <input id="goal" name="goal" defaultValue={draft ? (draft.goalAmountCents / 100).toFixed(2) : ''} inputMode="decimal" required />
        <FormFeedback />
        <button className="action-button" name="intent" value="save" disabled={pending}>
          {draft ? 'Guardar cambios' : 'Crear borrador'}
        </button>
      </Form>
      {draft && (
        <Form className="form-actions" method="post">
          <p>Se publicará la versión guardada del borrador.</p>
          <button className="action-button secondary" name="intent" value="publish" disabled={pending}>Publicar proyecto</button>
        </Form>
      )}
    </section>
  );
}
