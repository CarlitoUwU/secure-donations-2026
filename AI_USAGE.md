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

## P3 — API, datos y documentación

- **Herramienta:** OpenAI Codex.
- **Participante:** Geraldine Umasi.
- **Uso y motivo:** asistencia para traducir los requisitos y el acuerdo con P2 a un contrato API, una propuesta de implementación y pruebas de los controles de integridad y acceso.
- **Aportes de IA:** generación de la propuesta inicial de OpenAPI, configuración del backend, validaciones, adaptador de identidad, lógica de proyectos y donaciones, persistencia transaccional, pruebas y documentación de integración. También se prepararon scripts de aceptación y rendimiento para el entorno académico.
- **Participación del integrante:** coordinación con P2/P4, organización de entregas en la rama feat/p3-api-datos, ejecución local de lint, comprobación de tipos, pruebas y compilación, y gestión de commits e integración de cambios del equipo.
- **Archivos:** docs/api.yaml, backend/, configuración de dependencias y comprobaciones, scripts/validate-api.mjs, scripts/acceptance-p3.mjs, scripts/performance.mjs, docs/p3-integracion.md, evidence/ y la sección P3 del README.
- **Referencias:** commits 354430f (contrato), a3bdb79 (base) y 8163880 (proyectos y donaciones). Enlace al PR y commit de entrega por completar.
- **Comprobaciones:** el 11 de noviembre de 2026 la participante ejecutó lint, typecheck, npm test y build sin errores, según la salida compartida. OpenAPI válido; 40 pruebas backend y 1 frontend aprobadas. El detalle se registra en evidence/local-validation.md.
- **Revisión humana:** pendiente revisión del código por otro integrante, especialmente permisos, propiedad de recursos e idempotencia. La ejecución de pruebas no sustituye esa revisión ni la explicación del código en la sustentación.
- **Limitaciones:** los tests locales usan memoria y SDK simulado; no acreditan DynamoDB ni Cognito reales. Pendientes la integración del authz de P2, el despliegue SAM con P1, la aceptación en AWS y la medición p95 con exclusión comprobada de cold starts. Los scripts de aceptación/rendimiento están preparados, pero no ejecutados contra AWS en esta etapa.
