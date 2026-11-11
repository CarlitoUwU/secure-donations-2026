# Plataforma de Donaciones Seguras

Prototipo académico para la Fundación AQP-SOLIDARIA. Las donaciones serán simuladas y se usarán identidades y proyectos ficticios.

El proyecto parte del [enunciado](requirements.md) y del [diseño técnico](design.md). El frontend incluye catálogo, sesión con Cognito y los recorridos de donante y gestor.

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

### Probar el frontend

En desarrollo, sin configuración de API ni de Cognito, el catálogo, **Mis donaciones** y **Gestión de proyectos** usan datos en memoria. Los cambios se reinician al recargar. La compilación de producción desactiva este modo.

Para conectarlo al despliegue, copia `frontend/.env.example` a `frontend/.env.local`, completa las variables públicas y reinicia Vite. Para publicar, configura las mismas variables antes de ejecutar la compilación.

- `VITE_API_BASE_URL` contiene la URL de la API con el stage, cuando aplique, y sin `/v1`.
- `VITE_COGNITO_ISSUER`, `VITE_COGNITO_LOGIN_DOMAIN` y `VITE_COGNITO_CLIENT_ID` corresponden a las salidas `Issuer`, `LoginDomain` y `ClientId` de Cognito.
- `VITE_API_AUDIENCE` es el valor exacto de `ApiAudience` en API Gateway. Cognito lo recibe como `resource` en el inicio de sesión.
- `VITE_DRAFT_LIST_PATH` es opcional. Debe apuntar a la ruta protegida y paginada de borradores cuando se incorpore al OpenAPI. Hasta entonces, Gestión muestra los borradores creados en la sesión actual.

Registra en Cognito el retorno `<origen>/auth/callback` y la salida `<origen>/` para cada entorno. Para la integración local usa el origen de localhost acordado con el equipo, con su puerto exacto. Configura CloudFront para servir la SPA en sus rutas directas, incluida `/auth/callback`.

### Desarrollo en Windows con Docker

Si el control de aplicaciones de Windows bloquea una dependencia nativa de Vite, abre Docker Desktop y ejecuta esto desde la raíz del repositorio en PowerShell.

```powershell
docker run --rm -it -p 127.0.0.1:5173:5173 `
  -e CHOKIDAR_USEPOLLING=true `
  --mount "type=bind,source=$($PWD.Path),target=/app" `
  --mount "type=volume,target=/app/node_modules" `
  -w /app node:24-bookworm-slim sh -c 'npm ci && npm run dev -- --host 0.0.0.0 --strictPort'
```

Abre <http://127.0.0.1:5173>. Docker instala las dependencias de Linux en un volumen separado.
