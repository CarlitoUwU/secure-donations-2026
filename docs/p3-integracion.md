# P3 — API y datos

## Estado y tecnologías

La API usa TypeScript, Node.js 24, Zod y AWS SDK v3. `backend/src/handler.ts` exporta un handler por operación. `service.ts` contiene las reglas y `shared/dynamo-store.ts` las transacciones. `docs/api.yaml` es el contrato para P4 (OpenAPI 3.1).

Las pruebas con MemoryStore son unitarias: no acreditan DynamoDB, Cognito ni IAM reales. No se ha desplegado en AWS. La extensión de consulta de auditoría HU-10 y Cedar HU-12 no se implementan en este MVP; sí se persisten eventos de auditoría.

## Para P4

- Respuestas individuales: objeto directo. Listados: `{ items: [...], nextToken?: string }`, 50 por página. Reenviar nextToken para continuar.
- Dinero: enteros en céntimos PEN; S/ 5.00 se envía como `500`.
- Crear proyecto: `{ "title": "Alimentos", "description": "Proyecto ficticio", "goalAmountCents": 100000 }`.
- Crear donación: `{ "projectId": "UUID del proyecto", "amountCents": 500 }` y cabecera `Idempotency-Key` UUID. Mantener la misma clave y datos ante fallo de red. Nunca enviar donorSub/rol.
- Simular: `{ "status": "CONFIRMADA_SIMULADA" }` o `{ "status": "RECHAZADA_SIMULADA" }`.
- Estados: BORRADOR/PUBLICADO y PENDIENTE_SIMULACION/CONFIRMADA_SIMULADA/RECHAZADA_SIMULADA.
- Editar: PATCH parcial con al menos título, descripción o meta. Solo borradores; esto es una decisión propuesta de P3 que debe revisar el equipo.
- Límites propuestos: título 160 caracteres, descripción 5000, meta entre 1 y 1 000 000 000 céntimos. No están impuestos por el enunciado; se documentan para coordinar UI y servidor.
- Los índices de catálogo/historial son eventualmente consistentes. Tras escribir, usar el objeto devuelto o GET por ID; repetir el listado si todavía no aparece.
- Un reintento de creación devuelve exactamente el objeto pendiente original y 201 aunque luego haya sido confirmado. Consultar GET por ID para el estado actual.
- Errores Lambda: `{ code, message, requestId }`. Gateway puede devolver `{ message }`; P1/P2 deben verificarlo. Mostrar también mensaje genérico para fallos de red/429/500.
- La consulta ajena e inexistente devuelve 404 idéntico salvo el requestId propio de cada solicitud.

## Para P2

Interfaz propuesta: `ResolveIdentity = (event: APIGatewayProxyEventV2WithJWTAuthorizer) => Identity`, donde `Identity = { sub: string; groups: readonly string[]; scopes: readonly string[] }`. Se inyecta en `makeHandler`. El adaptador provisional `verifiedIdentity`, definido en `backend/src/shared/identity.ts`, solo lee `requestContext.authorizer.jwt.claims`; no acepta JWT desde body/header ni verifica firmas por sí mismo. P2 debe integrar/revisar su módulo authz definitivo y confirmar la representación de grupos en AWS.

El Service comprueba scope y grupo antes de consultar datos, y propiedad del registro persistido antes de retornarlo/simularlo. Esta comprobación defensiva puede delegarse al módulo final de P2 manteniendo las pruebas. El authorizer debe validar firma, emisor, cliente, expiración y scope. El chequeo `token_use=access` en Lambda complementa al authorizer, no lo reemplaza. No habilitar Function URL ni invocación pública directa.

T09: A crea, A obtiene 200; B obtiene el mismo 404 para el ID de A y un UUID inexistente; B no puede simular el ID de A y el total no cambia. Usar dos identidades Cognito reales de prueba y verificar también la persistencia con P1.

## Para P1

Variables obligatorias para las funciones: `PROJECTS_TABLE`, `DONATIONS_TABLE`, `IDEMPOTENCY_TABLE`, `AUDIT_TABLE`. Usar una sola región. No hay credenciales en configuración.

Compilar con `npm run build:backend`. Salida: `backend/dist/handler.js`; ejemplo de handler Lambda: `backend/dist/handler.listProjects` si CodeUri es la raíz del repositorio e incluye dependencias de producción. Alternativa SAM/esbuild: entrypoint `backend/src/handler.ts` y handler `handler.listProjects`. Elegir y verificar una estrategia en SAM; el contrato no asume un empaquetado ya existente.

Cada exportación debe ir a una función/rol distinto. Asociar ruta exacta de OpenAPI, payload 2.0 y scope según matriz P2. La función de simulación y su evento deben tener condición SAM para que solo existan en `academic`. El chequeo de stage en código es defensa adicional. Configurar CORS (Authorization, Content-Type, Idempotency-Key), throttling, retención ≤14 días y access logs sanitizados de API Gateway para 401/403 que nunca llegan a Lambda.

### Tablas e índices

| Tabla | Clave | Índice / configuración |
|---|---|---|
| Projects | projectId (String) | GSI status-createdAt: status HASH, createdAt RANGE, ALL |
| Donations | donationId (String) | GSI donorSub-createdAt: donorSub HASH, createdAt RANGE, ALL |
| Idempotency | pk (String) | TTL expiresAt (Number, epoch segundos) |
| AuditEvents | eventType (String), sortKey (String) | sortKey = timestamp#eventId |

Usar PAY_PER_REQUEST. El campo `revision` de Projects evita sobrescribir ediciones concurrentes. No permitir editar proyectos publicados; los incrementos de totales solo ocurren en simulación. El snapshot `response` en Idempotency conserva la respuesta original. TTL es asíncrono: no reutilizar una clave aunque pasen 24 h; seguirá protegida hasta su borrado efectivo.

### Acciones IAM mínimas por función

Aplicar sobre ARN de tabla exacto; Query necesita además ARN de su índice. Las acciones dentro de TransactWriteItems se autorizan por operación de elemento (PutItem/UpdateItem/ConditionCheckItem), no añadiendo un comodín de escritura.

| Export | Acciones y recursos |
|---|---|
| listProjects | Query Projects + índice status-createdAt |
| getProject, projectStats | GetItem Projects |
| createProject | PutItem Projects y AuditEvents |
| editProject, publishProject | GetItem, PutItem Projects; PutItem AuditEvents |
| createDonation | GetItem Projects e Idempotency; ConditionCheckItem Projects; PutItem Donations, Idempotency y AuditEvents |
| simulateDonation | GetItem, UpdateItem Donations; UpdateItem Projects; PutItem AuditEvents |
| myDonations | Query Donations + índice donorSub-createdAt |
| getDonation | GetItem Donations |

Agregar permisos de logs para el grupo de cada función. La Lambda de listado nunca tiene permisos de escritura (T10). P1 debe revisar políticas y comprobarlas en AWS. Ver [documentación AWS de transacciones](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html) y [JWT authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html).

## Decisiones de integridad

Crear una donación transacciona cuatro acciones: comprobar proyecto publicado, reservar clave con attribute_not_exists, insertar donación y auditar. Un fallo no deja escrituras parciales. Una colisión se relee consistentemente para devolver el snapshot original si coincide el hash; otro payload devuelve 409.

Confirmar transacciona el cambio condicionado (pendiente y mismo dueño), incremento del proyecto y evento de auditoría. Rechazar solo cambia estado y audita. Los fallos de capacidad/permisos/configuración no se convierten artificialmente en 409; devuelven 500 sanitizado. Una transacción en conflicto puede requerir reintentar la petición.

## Evidencia pendiente de AWS

- Ejecutar T01 y T04–T09 contra el stage y guardar resultados sanitizados; los tests locales no sustituyen esta evidencia.
- P1/P2: T02/T03/T10–T14, IAM, authorizer, MFA, errores de Gateway, logs y exclusión de simulación fuera de academic.
- Rendimiento: 50 proyectos publicados, cliente cercano a la región, excluir cold starts con evidencia de CloudWatch y registrar p95 ≤1500 ms. El script de medición realiza calentamiento pero ese paso por sí solo no garantiza que todas las muestras estén libres de cold starts.
- Completar PR, revisión humana y AI_USAGE antes de entregar. Cada integrante debe explicar lo que implementa.
