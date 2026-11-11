# Verificación de identidad y seguridad

Usar el entorno `academic`, cuentas ficticias y la colección de solicitudes del equipo. Probar directamente contra la API además de usar React. Registrar fecha, commit, etapa, resultado esperado y observado, código HTTP y request ID. Omitir cabeceras de autorización, tokens, contraseñas, identificadores de usuarios y códigos MFA en la evidencia. Los escenarios de integración están pendientes de un entorno desplegado.

| Caso | Preparación y acción | Resultado esperado |
|---|---|---|
| T02 | `POST /v1/donations` sin Authorization | 401 antes de consultar datos |
| T03 | Donante con `api/projects.write` llama `POST /v1/projects` con entrada de prueba | 403 por grupo y ningún proyecto creado |
| T09 | A crea D y la consulta. B, con scope de lectura, consulta D y un UUID inexistente | A recibe 200. B recibe 404 en ambos casos, con igual código y mensaje. En simulación ajena, el estado y acumulado permanecen iguales |
| T11 | Llamar una ruta privada con ID token, JWT con firma alterada, access token vencido y access token de otro cliente del mismo pool | Cada solicitud recibe 401. Registrar por separado el código real que devuelve Gateway para el ID token |
| T12 | Gestor con `api/donations.read` consulta `/v1/donations/me` | 403 por grupo, sin datos de donaciones |
| T13 | Con A consultar `/me`, cerrar sesión y tratar de renovar con el refresh token anterior. Repetir `/me` con el access token original antes y después de `exp` | Renovación rechazada. El JWT original puede dar 200 hasta `exp` y luego debe dar 401 |
| T14 | Gestor enrolado inicia sesión desde ventana privada, completa contraseña, omite TOTP y luego prueba con código incorrecto y correcto. Repetir con auditor | Sin código válido no hay canje por tokens. Con TOTP válido se completa el login |

Para PKCE, verificar `response_type=code` y `code_challenge_method=S256` en el inicio de sesión. En otra sesión de prueba intentar canjear un código con verifier incorrecto. Registrar el rechazo sin capturar el código ni verifier. Confirmar que los tokens no aparecen en almacenamiento persistente y que salir cierra también la sesión del proveedor.

Las pruebas unitarias del backend cubren cliente incorrecto, grupos malformados, grupo y scope, y 404 uniforme. Un evento simulado no prueba firmas, expiración, configuración de Gateway, persistencia o MFA. Una prueba de integración solo se marca aprobada con resultados del entorno desplegado.

En la demo, ejecutar `node scripts/verify-security.mjs` con `SECURITY_API_URL` (base HTTPS incluyendo stage si corresponde), `DONATION_ID` (una donación de A) y los tokens efímeros en las variables `DONOR_A_ACCESS_TOKEN`, `DONOR_B_ACCESS_TOKEN`, `MANAGER_ACCESS_TOKEN` y `DONOR_ID_TOKEN`. El token de A debe incluir lectura y `api/projects.write`, y el de B y el gestor deben incluir `api/donations.read`. La salida contiene solo códigos y request IDs. Usar cuentas ficticias y eliminar las variables después de la prueba. El script usa cuerpos vacíos en T02/T03 para que el caso compruebe que se deniega antes de validar la entrada sin crear recursos. Completar manualmente simulación ajena, cliente alterno, token expirado, T13 y T14.

## Mapeo de NIST SP 800-207

| Principio | Aplicación en el proyecto | Evidencia prevista |
|---|---|---|
| 1. Datos y servicios son recursos | Rutas, donaciones y tablas tienen permisos explícitos | Matriz, OpenAPI, IAM y T10 |
| 2. Comunicación segura independientemente de la red | HTTPS en API e interfaz | URLs y verificación TLS con P1 |
| 3. Acceso por sesión y recurso | JWT de corta duración y comprobación de propietario | T09, T11 y T13 |
| 4. Política dinámica | Decisión por solicitud a partir del grupo, scope, propietario y estado del recurso | T03, T09 y T12 |
| 5. Monitorear integridad y postura | Aplicación parcial mediante auditoría de infraestructura y revisión de dependencias. No se verifica postura del dispositivo | CI, CloudTrail y limitación declarada |
| 6. Autenticación y autorización antes del acceso | Cognito, TOTP para cuentas privilegiadas, JWT authorizer y controles en Lambda | T02, T11 y T14 |
| 7. Recopilar información para mejorar controles | Registros sanitizados y correlación por request ID | CloudWatch, CloudTrail y evidencia de rechazos |

El **Policy Engine (PE)** se aproxima con las decisiones de autorización de Lambda. **API Gateway y los handlers** actúan como puntos de aplicación (**PEP**) en sus respectivas capas. **Cognito** aporta funciones del **Policy Administrator (PA)** relacionadas con emisión y renovación de credenciales. El diseño no reproduce un PA independiente que pueda cerrar de inmediato cada acceso ya autorizado.

El authorizer valida el JWT localmente, así que revocar el refresh token no implica rechazo inmediato del access token. La exposición queda acotada por 15 minutos desde la emisión. El prototipo tampoco evalúa continuamente el riesgo de sesión ni la postura de dispositivos. El MFA opcional del pool depende del procedimiento de alta y mantenimiento de las cuentas privilegiadas.

Referencia: [NIST SP 800-207](https://csrc.nist.gov/pubs/sp/800/207/final).
