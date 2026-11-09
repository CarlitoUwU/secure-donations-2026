# Plataforma de Donaciones Seguras

Prototipo académico para la Fundación AQP-SOLIDARIA. Las donaciones serán simuladas y se usarán identidades y proyectos ficticios.

El proyecto parte del [enunciado](requirements.md) y del [diseño técnico](design.md). La primera versión local muestra el estado vacío del catálogo. El catálogo conectado, Cognito y el despliegue SAM se incorporarán en los siguientes cambios.

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

### Desarrollo en Windows con Docker

Si el control de aplicaciones de Windows bloquea una dependencia nativa de Vite, abre Docker Desktop y ejecuta esto desde la raíz del repositorio en PowerShell.

```powershell
docker run --rm -it -p 127.0.0.1:5173:5173 `
  --mount "type=bind,source=$($PWD.Path),target=/app" `
  --mount "type=volume,target=/app/node_modules" `
  -w /app node:24-bookworm-slim sh -c 'npm ci && npm run dev -- --host 0.0.0.0 --strictPort'
```

Abre <http://127.0.0.1:5173>. Docker instala las dependencias de Linux en un volumen separado.
