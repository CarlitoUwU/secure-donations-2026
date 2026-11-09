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
