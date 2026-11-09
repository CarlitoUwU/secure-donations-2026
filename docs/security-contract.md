# Contrato de identidad y autorización

Estado: propuesta de P2 para revisión de P1, P3 y P4. No acredita controles implementados ni pruebas ejecutadas en AWS. P3 mantiene `docs/api.yaml`; este documento especifica las reglas de seguridad que debe reflejar ese contrato.

## Matriz propuesta

Cada fila privada requiere el scope indicado Y el grupo autorizado. Los scopes no representan pertenencia a grupos. Las rutas públicas no requieren token y nunca muestran borradores ni datos individuales de donantes.

| Método | Ruta | Scope | Grupo / propietario | Respuestas de aplicación y autenticación |
|---|---|---|---|---|
| GET | `/v1/projects` | — | Público | 200 |
| GET | `/v1/projects/{projectId}` | — | Público, solo publicado | 200, 404 |
| GET | `/v1/projects/{projectId}/stats` | — | Público, solo publicado | 200, 404 |
| POST | `/v1/projects` | `api/projects.write` | GESTOR | 201, 400, 401, 403 |
| PATCH | `/v1/projects/{projectId}` | `api/projects.write` | GESTOR | 200, 400, 401, 403, 404, 409 |
| PATCH | `/v1/projects/{projectId}/publish` | `api/projects.write` | GESTOR | 200, 401, 403, 404, 409 |
| POST | `/v1/donations` | `api/donations.write` | DONANTE | 201, 400, 401, 403, 404, 409 |
| POST | `/v1/donations/{donationId}/simulate` | `api/donations.write` | DONANTE y propietario | 200, 400, 401, 403, 404, 409 |
| GET | `/v1/donations/me` | `api/donations.read` | DONANTE, filtro por sub | 200, 401, 403 |
| GET | `/v1/donations/{donationId}` | `api/donations.read` | DONANTE y propietario | 200, 401, 403, 404 |
| GET | `/v1/audit` | `api/audit.read` | AUDITOR con MFA; extensión | 200, 400, 401, 403 |

La simulación solo se declara en SAM para `academic`; en otro entorno la ruta no existe. Edición de proyectos y consulta de donación por ID son incorporaciones propuestas respecto a la tabla inicial de `design.md`. P3 define los campos editables y conflictos de edición antes de cerrar OpenAPI. Las respuestas operativas 429/5xx se documentan aparte; esta matriz no garantiza disponibilidad.

## Contrato entre API Gateway y Lambda

Propuesta a confirmar con P1: HTTP API, JWT authorizer e integración Lambda con payload 2.0. El módulo `authz` lee únicamente `event.requestContext.authorizer.jwt.claims`; los handlers no decodifican un Bearer para confiar en él.

| Claim | Uso |
|---|---|
| `sub` | Identidad estable y propietario de donaciones; obligatorio en rutas privadas |
| `cognito:groups` | Pertenencia a DONANTE, GESTOR o AUDITOR; denegar si no hay grupo permitido |
| `scope` | Permisos OAuth concedidos; no sustituye la comprobación de grupo |
| `token_use` | Exigir `access` en el adaptador de identidad; no asumir que Gateway comprueba este claim |
| `client_id` | Exigir el cliente público configurado en el adaptador |
| `iss`, `exp` | Emisor y expiración validados por Gateway; no registrar el token |

Gateway valida firma, emisor y tiempos del JWT, y compara audience con `aud` o, si este falta, con `client_id`. Como `aud` tiene precedencia, el adaptador comprobará también el `client_id` esperado. Cada ruta privada exige su scope para impedir el uso de ID tokens. No se agregarán scopes alternativos a una ruta suponiendo que Gateway exige todos: acepta al menos uno de los declarados.

P2 normalizará grupos y scopes a colecciones internas y entregará una identidad equivalente a `{ sub, groups, scopes }`. Antes de implementar el parser se comprobará la representación real de `cognito:groups` en payload 2.0 con una muestra sanitizada, sin guardar el JWT. Formatos ambiguos se rechazan; no se utilizan coincidencias parciales de texto para autorizar.

Este límite de confianza requiere invocación por la integración autorizada de Gateway. P1 debe restringir permisos de invocación y evitar una Function URL pública que permita eludir el authorizer. No se aceptarán claims proporcionados por el navegador como sustituto del contexto.

## Autorización en backend

1. Gateway autentica y comprueba el scope de la ruta.
2. El adaptador P2 exige identidad válida, access token y cliente esperado.
3. `authz` comprueba el grupo antes de consultar recursos privados.
4. P3 carga la donación persistida; `authz` compara `donation.donorSub === identity.sub`.
5. Solo después se devuelven datos o se aplican reglas de negocio. En simulación P3 mantiene además la condición de propietario y estado en la escritura transaccional.

Al crear una donación, P3 asigna `donorSub` desde la identidad, nunca desde el body. `/me` consulta por el `sub` autenticado; no admite elegir otro donante. Un campo de identidad enviado por el cliente nunca cambia el actor. Los guards de React solo mejoran la experiencia y no conceden acceso.

## Respuestas y privacidad

- 401: sin token, token inválido, expirado, alterado, ID token o cliente no autorizado.
- 403: identidad autenticada sin grupo o scope suficiente.
- 404: donación inexistente o ajena, con el mismo cuerpo genérico y sin datos del propietario. Un gestor recibe 403 por grupo antes de consultar el recurso.
- 400: entrada inválida; 409: conflicto de estado o idempotencia.

Lambda utiliza `{ code, message, requestId }`. Para donación inexistente y ajena se propone `code: NOT_FOUND` y `message: Recurso no encontrado`; solo varía el identificador de solicitud. No se promete igualdad de tiempos de respuesta.

Los errores nativos de Gateway pueden tener otro cuerpo. P1/P2 verificarán formato, códigos y cabeceras CORS, y P3 los reflejará en OpenAPI. El frontend debe manejar el estado HTTP sin depender de que todo rechazo pase por Lambda.

Los scopes del cliente público no estarán restringidos por grupo de manera implícita. Para T03/T12, el token debe disponer del scope de la ruta para comprobar específicamente el rechazo del grupo en backend.

## T09 y comprobación adicional de escritura

Responsables: P2 prepara identidades y solicitudes; P3 prepara datos y verifica persistencia. Dependencias: dos donantes ficticios A/B, proyecto publicado, API protegida y una donación D de A.

| Paso | Resultado esperado |
|---|---|
| A consulta D | 200 y datos propios |
| B consulta D con scope de lectura válido | 404, sin datos de A |
| B consulta un ID válido inexistente | 404, mismo code y message |
| B consulta `/me` | 200 sin D |
| B intenta simular D con scope de escritura válido | 404; estado y acumulado sin cambios |
| A vuelve a consultar D | 200; estado sin cambios por el intento de B |

El primer acceso ajeno cubre T09/CA-07.2. La simulación ajena amplía la comprobación al control de escritura de CA-06.1. Guardar método, ruta, rol de prueba, estado HTTP, cuerpo sanitizado, requestId y comprobación de datos antes/después. No guardar tokens, contraseñas, semillas, QR ni códigos MFA. Estos casos están diseñados, todavía no ejecutados.

## Decisiones pendientes y responsables

| Responsable | Confirmación necesaria | Bloquea |
|---|---|---|
| P3 | Matriz, PATCH de edición, GET por ID, campos editables y conflictos | Cierre de OpenAPI |
| P3 | 404 uniforme y reparto: P2 implementa authz, P3 integra y carga recursos | Integración y T09 |
| P1 | HTTP API + payload 2.0, authorizer, invocación y scopes | Primera ruta protegida |
| P1 | Región, acceso a Cognito, URLs y valores públicos de configuración | Configuración desplegada |
| P1/P2 | Códigos reales, CORS y formato de rechazos de Gateway | Pruebas de integración |
| P2 | Mecanismo exigible de TOTP para GESTOR/AUDITOR, sin asumir MFA por grupo ni un claim de MFA inexistente | Etapas de Cognito/MFA |
| P4 | URLs de retorno/salida y contrato de sesión en memoria | Integración de sesión; no bloquea esta matriz |

El contrato queda preparado para revisión, no acordado por otras personas. Se cierra al registrar sus confirmaciones y trasladar las decisiones al OpenAPI mantenido por P3. P2 no modifica ese archivo en este cambio para evitar trabajo concurrente sobre el contrato.

## Trazabilidad y siguientes etapas

| Requisito | Control / verificación posterior |
|---|---|
| HU-03, CA-NF02.1 | Gateway, access tokens y cliente: T02, T11, T13 |
| HU-04, CA-NF02.2 | Grupo y claims verificados: T03, T12 |
| CA-05.3, CA-07.1, CA-07.2 | Identidad y propiedad: T09 y consulta propia |
| HU-11 | TOTP exigible: T14, pendiente de configuración |
| CA-NF11.1 | Sesión en memoria, etapa de integración con P4 |
| CA-NF02.3 | Mapeo NIST completo en informe posterior |

Esta fase entrega diseño de controles. No implementa Cognito, handlers, sesión, despliegues ni el informe NIST completo.

## Referencias

- [Requisitos del proyecto](../requirements.md), HU-03, HU-04, HU-11 y pruebas T02/T03/T09/T11–T14.
- [Diseño del proyecto](../design.md), secciones 4 y 6.
- [AWS: JWT authorizers en HTTP API](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html), consultado el 9 de noviembre de 2026: validación, scopes y ubicación de claims. El comportamiento real se verificará en integración.
