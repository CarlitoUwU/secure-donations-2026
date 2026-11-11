# Configuración de Cognito e integración

Estado: configuración local para revisión. No desplegada ni probada con usuarios reales de Cognito. La región, dominio y URLs finales quedan pendientes de P1/P4.

## Entrega para P1

`infra/cognito.yaml` es una plantilla CloudFormation independiente con recursos nativos compatibles con SAM. Integrar sus Parameters, Resources y Outputs en la plantilla principal, o usar una pila separada con los valores de salida. Elegir una sola alternativa para evitar duplicar pools. No reemplazar el trabajo de infraestructura existente.

Parámetros obligatorios sin valores inventados: `DomainPrefix`, `CallbackURLs` y `LogoutURLs`. La región se elige al desplegar con P1. Acordar callback local con P4; Cognito admite HTTP para localhost, pero no asumir equivalencia con 127.0.0.1. Usar HTTPS para la demo y registrar URLs exactas, sin comodines.

Decisiones locales:

- Cliente público sin secreto, code grant, sin implicit ni password/SRP como flujos de este cliente.
- Access e ID tokens de 15 minutos, refresh token de un día y revocación habilitada.
- Hosted UI clásica (`ManagedLoginVersion: 1`) y tier Lite como propuesta académica; verificar disponibilidad y condiciones de la cuenta antes de desplegar.
- Alta solo administrativa, nombres de usuario ficticios; sin correo ni teléfono obligatorios. Recuperación administrativa para no introducir SMS o datos personales.
- Scopes MVP `api/projects.write`, `api/donations.write`, `api/donations.read`. El scope de auditoría se añadirá si se implementa la extensión, no existe aún en esta plantilla.
- Los grupos no conceden scopes automáticamente. El cliente permite los scopes MVP; backend comprueba siempre el grupo y propietario.

## PKCE y sesión con P4

Configurar la biblioteca OIDC para code + PKCE S256, state y nonce; conservar tokens en memoria. La plantilla habilita code grant, pero no ofrece una propiedad que imponga PKCE por sí sola. No declarar PKCE verificado hasta inspeccionar el flujo real y comprobar que la aplicación envía challenge S256 y canjea con el verifier correspondiente. Comprobar también rechazo de un verifier incorrecto.

P4 recibirá los outputs públicos `Issuer`, `ClientId` y `LoginDomain`, más callbacks, logout, scopes y la URL HTTPS que P1 elija como audiencia de la API. En la solicitud a `/oauth2/authorize`, incluir esa URL como `resource` además de PKCE y los scopes `api/*`. El valor debe coincidir exactamente con `ApiAudience` en Gateway. La biblioteca puede necesitar estado transitorio del redirect, separado de los tokens en memoria.

Al salir: revocar refresh token, limpiar memoria y finalizar sesión de Hosted UI. Registrar fallos de revocación sin guardar el token. Un JWT ya emitido puede seguir aceptándose en Gateway hasta expirar; T13 debe demostrar esta ventana y que el refresh token no permite renovar tras revocación.

## MFA por alta controlada

Se propone MFA OPTIONAL en el pool para conservar MFA opcional en donantes. Esto NO impone MFA a GESTOR/AUDITOR por pertenecer a grupos. La seguridad depende del siguiente proceso administrativo, que debe validar el equipo antes de habilitar cuentas privilegiadas:

1. Crear dos donantes, un futuro gestor y un futuro auditor con nombres ficticios y sin grupos privilegiados. No crear contraseñas ni usuarios mediante esta plantilla.
2. En una sesión supervisada, crear un cliente temporal de enrolamiento en el mismo pool con code + PKCE y solo `openid` y `aws.cognito.signin.user.admin`, sin scopes `api/*`. Usar un callback controlado, completar el cambio de contraseña temporal y usar el access token temporal con `AssociateSoftwareToken` y `VerifySoftwareToken`. Mostrar la semilla al titular únicamente en el momento de registrarla en su autenticador. El cliente público de la aplicación no concede el scope de administración de usuario.
3. Confirmar administrativamente que SOFTWARE_TOKEN_MFA está habilitado y preferido para la cuenta, y hacer un nuevo login que exija TOTP antes de asignar el grupo privilegiado.
4. Ejecutar `AdminUserGlobalSignOut`, borrar el cliente de enrolamiento y cerrar la sesión de Hosted UI. Esperar la expiración de los access tokens del cliente temporal antes de habilitar privilegios: ese scope permite cambiar preferencias MFA. Asignar GESTOR/AUDITOR solo tras estas comprobaciones y repetir T14 con una ventana privada y el cliente de la aplicación.
5. No permitir desactivar MFA de una cuenta privilegiada: retirar primero el grupo, revocar sesiones y esperar la expiración de tokens anteriores. El cambio de grupo tampoco invalida JWT ya emitidos inmediatamente.

No hay una prueba de segundo factor por solicitud derivable simplemente de `cognito:groups`, ni se inventará un claim `mfa`. Si el equipo no puede garantizar el enrolamiento y mantenimiento administrativo, esta propuesta NO está cerrada: evaluar MFA obligatorio para todos con P4 y registrar que cambia la experiencia opcional del donante, o un diseño adicional de enforcement. No considerar T14 cumplida por configurar OPTIONAL.

## Integración de Gateway

P1 configurará HTTP API, payload 2.0, issuer desde Cognito, una audiencia HTTPS exclusiva de la API, scopes de cada ruta privada y permisos de invocación restringidos. El `resource` de Cognito coloca esa URL en `aud` del access token. El ID token tiene el ID del cliente como audiencia y se rechaza antes de revisar scopes. Esto evita depender de que un rechazo por scope produzca 401, ya que puede producir 403. Los nombres de scope `api/*` del OpenAPI permanecen iguales. Esta plantilla no crea rutas, authorizer ni permisos IAM de las Lambdas.

Incorporar este bloque bajo `Properties` de la HTTP API. `CognitoIssuer` y `ApiAudience` son parámetros de la pila principal:

```yaml
Auth:
  DefaultAuthorizer: CognitoJwt
  Authorizers:
    CognitoJwt:
      IdentitySource: $request.header.Authorization
      JwtConfiguration:
        issuer: !Ref CognitoIssuer
        audience:
          - !Ref ApiAudience
```

En cada evento Lambda `HttpApi`, fijar `PayloadFormatVersion: '2.0'` y `Auth.AuthorizationScopes` con el scope de la matriz. Para las tres rutas públicas, fijar `Auth.Authorizer: NONE`. Pasar `COGNITO_CLIENT_ID: !Ref CognitoClientId` a las funciones privadas. Si falta la variable, el módulo rechaza la solicitud.

En los handlers privados, llamar `verifiedIdentity(event)` y `requirePermission(identity, grupo, scope)` antes de consultar recursos o escribir. Para detalle y simulación, llamar `requireOwnDonation(identity, donation)` después de cargar el registro. Para historial, consultar únicamente por `identity.sub`. P3 conserva la condición de propietario en la escritura transaccional. El módulo está en `backend/src/shared/identity.ts`.

## Validaciones pendientes antes de desplegar

- Validación CloudFormation/SAM con herramientas disponibles y revisión humana de propiedades.
- Región, dominio único, URLs y servicios permitidos en la cuenta confirmados con P1.
- Flujo PKCE real, rechazo de ID token y tokens de otro cliente (T02/T11).
- Representación real de grupos en evento 2.0.
- Enrolamiento TOTP reproducible sin habilitar privilegios antes de tiempo y T14.
- Revocación y expiración (T13), sesiones y URLs de salida.
- No capturar QR, semillas, contraseñas, tokens ni credenciales de AWS.

## Fuentes oficiales

- [Propiedades del cliente](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-cognito-userpoolclient.html).
- [Propiedades del pool](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-cognito-userpool.html).
- [TOTP](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa-totp.html).
- [MFA y diferencias de enrolamiento](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa.html).
- [Revocación](https://docs.aws.amazon.com/cognito/latest/developerguide/token-revocation.html).
- [Vinculación del access token a una audiencia de API](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-define-resource-servers.html#cognito-user-pools-resource-binding).
- [JWT authorizer en SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-controlling-access-to-apis-oauth2-authorizer.html).

## Resumen para coordinar con P1

Se preparó una plantilla independiente de identidad, sin despliegue. Proponemos cliente público con code/PKCE desde React, tokens de 15 minutos, scopes MVP y tres grupos. Región, dominio y callbacks son parámetros pendientes. MFA por grupo requiere alta administrativa controlada; OPTIONAL por sí solo no satisface el requisito. Revisar integración en SAM y estrategia de enrolamiento antes de desplegar.
