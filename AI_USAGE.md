# Registro de uso de IA

## Configuración de identidad Cognito

- **Continuación en [PR #4](https://github.com/CarlitoUwU/secure-donations-2026/pull/4):** comprobación de cliente, roles, scopes y propietario en el backend, con pruebas unitarias. Guías de integración SAM, alta TOTP, verificación NIST y script de pruebas contra la API. Pasaron lint, tipos, OpenAPI, 17 pruebas y compilación local. Validación de entorno AWS pendiente.

- **Herramienta:** OpenAI Codex.
- **Participante:** JorgeCY21 (P2).
- **Tareas asistidas:** plantilla local de Cognito y guía de integración, decisiones de tokens y propuesta de enrolamiento TOTP.
- **Aportes:** `infra/cognito.yaml`, `docs/cognito-setup.md` y enlace en README; rama `feature/cognito-identity`. PR pendiente.
- **Validación humana:** pendiente de revisión por otro integrante y coordinación con P1/P4.
- **Comprobaciones locales:** YAML analizado correctamente (7 recursos y 3 parámetros), `git diff --check` sin errores. SAM y cfn-lint no están instalados; no se validó el esquema CloudFormation ni se ejecutaron pruebas AWS.
- **Limitaciones:** no se accedió ni desplegó en AWS; PKCE, alta TOTP y pruebas de aceptación pendientes. OPTIONAL no impone MFA por grupo.

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

## Contrato de la API

- **Herramienta/modelo:** OpenAI Codex.
- **Participante:** Geraldine Umasi.
- **Tareas asistidas:** elaboración del contrato OpenAPI 3.1 para HU-01, HU-02 y HU-05–HU-09, a partir de requirements.md, design.md y la matriz de rutas y autorización propuesta por P2.
- **Motivo:** concretar los endpoints, cuerpos de solicitud, esquemas de respuesta, ejemplos, estados, errores, scopes y grupos para coordinar la API con P2 y la interfaz con P4.
- **Aportes:** docs/api.yaml, con los diez endpoints del MVP; incluye edición de proyectos, consulta de donación por ID, idempotencia, paginación y restricción de simulación al stage academic. Commit 354430f en la rama feat/p3-api-datos. 
- **Comprobaciones automatizadas:** el contrato pasó la validación local con Swagger Parser (OpenAPI 3.1). Esta comprobación valida el documento; no demuestra el comportamiento de endpoints desplegados.
- **Validación humana:** pendiente revisión por un compañero distinto del autor y confirmación de integración con P2/P4. Revisar especialmente los límites propuestos de campos, la edición exclusiva de borradores y los formatos de errores.
- **Limitaciones:** falta confirmar la URL del entorno, el dominio Cognito y las respuestas reales de API Gateway con P1/P2. La consulta de auditoría se declara extensión pendiente.

## Base del backend

- **Herramienta/modelo:** OpenAI Codex.
- **Participante:** Geraldine Umasi.
- **Tareas asistidas:** configuración TypeScript/Node.js, dependencias, esquemas Zod, tipos compartidos, errores y adaptador de identidad para el contexto JWT de API Gateway.
- **Motivo:** preparar componentes comunes para implementar proyectos y donaciones con entradas validadas e identidad tipada.
- **Aportes:** package.json, package-lock.json, eslint.config.js, backend/tsconfig.json, backend/vitest.config.ts, backend/src/shared/contracts.ts, backend/src/shared/identity.ts, backend/test/base.test.ts y scripts/validate-api.mjs. PR por completar.
- **Comprobaciones automatizadas:** TypeScript sin errores; 12 casos de pruebas de la base aprobados, incluidos límites de importes, campos no permitidos, estados e identidad.
- **Validación humana:** pendiente revisión por otro integrante y coordinación con P2 del adaptador de identidad definitivo.
- **Limitaciones:** el adaptador consume claims que API Gateway debe haber validado; no verifica firmas JWT ni configura Cognito. No demuestra autenticación real en AWS. Los formatos de grupos deben confirmarse con P2 en el entorno desplegado.
