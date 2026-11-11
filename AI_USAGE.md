# Registro de uso de IA

## Desarrollo del frontend

- **Herramienta:** OpenAI Codex.
- **Participante:** Carlo Valdivia.
- **Tareas asistidas:** implementación del catálogo, el inicio de sesión con Cognito y los flujos de donante y gestor.
- **Aportes:** cambios del frontend en la rama `feat/p4-project-catalog`.
- **Validación humana:** Carlo Valdivia revisó el alcance del frontend. La revisión del PR por otro integrante está pendiente.
- **Comprobaciones:** pruebas automatizadas, compilación y recorridos en navegador.
- **Limitaciones:** queda pendiente validar la integración con la API y Cognito desplegados.

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

## API y datos

- **Herramienta:** OpenAI Codex.
- **Participante:** Geraldine Umasi.
- **Tareas asistidas:** preparación del contrato OpenAPI, generación de código para proyectos y donaciones, validaciones, persistencia transaccional y pruebas.
- **Aportes:** `docs/api.yaml`, `backend/`, scripts de aceptación y rendimiento, guía de integración y documentación; rama `feat/p3-api-datos`. Enlace al PR por completar.
- **Comprobaciones locales:** Se ejecutó lint, tipos, validación OpenAPI, 40 pruebas backend, 1 prueba frontend y compilación, sin errores.
- **Validación humana:** pendiente revisión por otro integrante y coordinación de la integración con P1/P2/P4.
- **Limitaciones:** pruebas locales con almacenamiento y SDK simulados. Integración de identidad, despliegue AWS, pruebas de aceptación y medición de rendimiento pendientes.