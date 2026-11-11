import { Link, isRouteErrorResponse, useLoaderData, useRevalidator, useRouteError } from 'react-router';
import { formatSoles } from '../money';
import { Pagination } from '../Pagination';
import type { Page, Project } from './projectApi';

function ProjectProgress({ project }: { project: Project }) {
  const percentage = Math.round(project.confirmedAmountCents / project.goalAmountCents * 100);

  return (
    <div className="project-progress">
      <dl className="project-amounts">
        <div>
          <dt>Monto confirmado</dt>
          <dd>{formatSoles(project.confirmedAmountCents)}</dd>
        </div>
        <div>
          <dt>Meta</dt>
          <dd>{formatSoles(project.goalAmountCents)}</dd>
        </div>
      </dl>
      <div className="progress-track">
        <progress aria-label="Avance hacia la meta" value={Math.min(percentage, 100)} max={100} />
        <span>{percentage}%</span>
      </div>
    </div>
  );
}

export function Catalog() {
  const { items: projects, nextToken } = useLoaderData<Page<Project>>();

  return (
    <>
      <section className="hero" aria-labelledby="catalog-heading">
        <svg className="hero-lines" viewBox="0 0 480 270" fill="none" aria-hidden="true">
          <path d="M-20 287C71 237 140 166 196 133C238 110 254 39 290 33C314 29 332 78 360 99C391 123 430 137 495 203" />
          <path d="M10 288C97 254 155 190 213 154C253 128 272 66 290 65C308 64 321 101 351 125C388 155 434 171 495 239" />
          <path d="M55 288C135 257 180 215 235 178C267 157 282 106 295 101C309 99 324 134 352 155C389 185 433 208 489 269" />
          <path d="M111 286C178 254 215 226 256 195C277 179 290 142 301 138C313 136 326 161 355 185C388 211 426 232 467 270" />
        </svg>
        <div className="hero-copy">
          <h1 id="catalog-heading" tabIndex={-1}>Proyectos solidarios en Arequipa</h1>
          <p>Conoce las iniciativas de la fundación y sigue su avance hacia las metas de recaudación.</p>
        </div>
      </section>
      <section className="project-section" aria-labelledby="projects-heading">
        <h2 id="projects-heading">Proyectos publicados</h2>
        {projects.length === 0 ? (
          <p className="notice">Aún no hay proyectos publicados.</p>
        ) : (
          <ul className="project-grid">
            {projects.map((project) => (
              <li key={project.projectId} className="project-card">
                <h3>{project.title}</h3>
                <p className="card-description">{project.description}</p>
                <ProjectProgress project={project} />
                <Link
                  className="project-link"
                  to={`/proyectos/${encodeURIComponent(project.projectId)}`}
                  aria-label={`Ver proyecto: ${project.title}`}
                >
                  Ver proyecto
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pagination nextToken={nextToken} />
      </section>
    </>
  );
}

export function ProjectDetail() {
  const { project, donationLink } = useLoaderData<{ project: Project; donationLink: string | null }>();

  return (
    <article className="detail">
      <Link className="back-link" to="/">Volver al catálogo</Link>
      <p className="project-status">Publicado</p>
      <h1 tabIndex={-1}>{project.title}</h1>
      <p className="project-id">Identificador: {project.projectId}</p>
      <p className="detail-description">{project.description}</p>
      <section className="detail-progress" aria-labelledby="progress-heading">
        <h2 id="progress-heading">Progreso de la campaña</h2>
        <ProjectProgress project={project} />
      </section>
      {donationLink && <Link className="action-button detail-action" to={donationLink}>Donar</Link>}
    </article>
  );
}

export function CatalogError() {
  const error = useRouteError();
  const { revalidate, state } = useRevalidator();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <section className="notice">
      <h1 tabIndex={-1}>{notFound ? 'Proyecto no encontrado' : 'No se pudieron cargar los proyectos'}</h1>
      <p role="alert">
        {notFound
          ? 'El proyecto solicitado no está disponible en el catálogo.'
          : 'Intenta cargar la página de nuevo.'}
      </p>
      {!notFound && (
        <button type="button" onClick={() => void revalidate()} disabled={state === 'loading'}>
          {state === 'loading' ? 'Reintentando…' : 'Volver a intentar'}
        </button>
      )}
      <Link className="back-link" to="/">Volver al catálogo</Link>
    </section>
  );
}
