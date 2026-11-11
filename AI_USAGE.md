# Registro de uso de IA

## Contrato de identidad y autorización

- **Herramienta:** OpenAI Codex.
- **Participante:** responsable P2; nombre por completar por el equipo.
- **Tareas asistidas:** análisis de requisitos y propuesta de matriz de rutas, claims, autorización y T09.
- **Aportes:** `docs/security-contract.md`, enlace en README y esta entrada; rama `docs/authorization-contract`. PR pendiente de publicación.
- **Validación humana:** pendiente de revisión por P3 y confirmación de integración por P1/P4.
- **Comprobaciones:** revisión documental y `git diff --check` sin errores. Se intentaron lint, tipos, pruebas y build; no pudieron ejecutarse porque las dependencias locales no están instaladas (eslint, tsc, vitest y vite no disponibles). Cambio solo documental. T02/T03/T09/T11–T14 no ejecutadas en AWS.
- **Limitaciones:** propuesta sin implementar; formato real de grupos, errores de Gateway y mecanismo de MFA pendientes de verificación. No se accedió a AWS ni se incorporó el Word al repositorio.

## Base del proyecto

- **Herramienta:** OpenAI Codex.
- **Participante:** Carlo Valdivia.
- **Tareas asistidas:** análisis inicial y preparación de la aplicación React, comprobaciones de GitHub Actions y documentación de arranque.
- **Aportes:** archivos del [PR #1](https://github.com/CarlitoUwU/secure-donations-2026/pull/1).
- **Validación humana:** revisión por otro integrante pendiente.
- **Limitaciones:** esta base solo cubre el estado vacío del catálogo. Las pruebas del sistema desplegado corresponden a etapas posteriores.

## API y datos

- **Herramienta:** OpenAI Codex.
- **Participante:** Geraldine Umasi.
- **Tareas asistidas:** preparación del contrato OpenAPI, generación de código para proyectos y donaciones, validaciones, persistencia transaccional y pruebas.
- **Aportes:** `docs/api.yaml`, `backend/`, scripts de aceptación y rendimiento, guía de integración y documentación; rama `feat/p3-api-datos`. Enlace al PR por completar.
- **Comprobaciones locales:** Se ejecutó lint, tipos, validación OpenAPI, 40 pruebas backend, 1 prueba frontend y compilación, sin errores.
- **Validación humana:** pendiente revisión por otro integrante y coordinación de la integración con P1/P2/P4.
- **Limitaciones:** pruebas locales con almacenamiento y SDK simulados. Integración de identidad, despliegue AWS, pruebas de aceptación y medición de rendimiento pendientes.