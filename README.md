# Plataforma de Donaciones Seguras

Prototipo académico para la Fundación AQP-SOLIDARIA. Las donaciones serán simuladas y se usarán identidades y proyectos ficticios.

El proyecto parte del [enunciado](requirements.md) y del [diseño técnico](design.md). La primera versión local muestra el estado vacío del catálogo. El catálogo conectado, Cognito y el despliegue SAM se incorporarán en los siguientes cambios.

## Contrato de seguridad

La [propuesta de identidad y autorización de P2](docs/security-contract.md) contiene la matriz de rutas, el contrato de claims, el reparto con P1/P3/P4 y el diseño de T09. Está pendiente de confirmación del equipo; no representa controles desplegados.

## Desarrollo local

Requiere Node.js 24 y npm.

```sh
npm ci
npm run dev
```

Abre la dirección que indica Vite en la terminal. Ejecuta las mismas comprobaciones que GitHub Actions antes de abrir un PR.

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Se usa TypeScript 6 porque la versión de `typescript-eslint` fijada en este proyecto requiere TypeScript anterior a 6.1.

## API y datos — P3

El backend implementa proyectos, donaciones simuladas, idempotencia, historial privado y agregados. Consulta el [contrato OpenAPI](docs/api.yaml) y la [guía de integración P1/P2/P4](docs/p3-integracion.md). La infraestructura AWS y el módulo definitivo de identidad se integran con P1/P2.

```sh
npm run test:backend
npm run validate:api
npm run build:backend
```

`npm test`, `npm run typecheck` y `npm run build` incluyen frontend y backend. Los tests locales no requieren cuenta AWS. Los handlers se compilan para Lambda; no se ha añadido un login ficticio ni un servidor local que lo sustituya.

Cuando exista el stage académico, ejecutar `node scripts/acceptance-p3.mjs` con API_BASE_URL, GESTOR_ACCESS_TOKEN, DONOR_A_ACCESS_TOKEN y DONOR_B_ACCESS_TOKEN proporcionados mediante el entorno local (no en Git ni chat). Crea proyectos/donaciones ficticios y guarda únicamente resultados sanitizados. `--seed-performance` añade 49 proyectos para completar 50 en un dataset inicialmente vacío. P1 elimina los datos al limpiar la pila. Consultar [evidencias](evidence/README.md) para medir rendimiento.

### Desarrollo en Windows con Docker

Si el control de aplicaciones de Windows bloquea una dependencia nativa de Vite, abre Docker Desktop y ejecuta esto desde la raíz del repositorio en PowerShell.

```powershell
docker run --rm -it -p 127.0.0.1:5173:5173 `
  --mount "type=bind,source=$($PWD.Path),target=/app" `
  --mount "type=volume,target=/app/node_modules" `
  -w /app node:24-bookworm-slim sh -c 'npm ci && npm run dev -- --host 0.0.0.0 --strictPort'
```

Abre <http://127.0.0.1:5173>. Docker instala las dependencias de Linux en un volumen separado.
