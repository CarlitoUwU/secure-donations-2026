# Evidencias P3

No se incluyen resultados AWS inventados. Los tests de backend usan un doble en memoria y mocks del SDK. T08 local comprueba las reglas; T08 desplegada debe probar diez peticiones concurrentes sobre DynamoDB real.

Guardar aquí reportes sanitizados: fecha, revisión Git, ambiente, caso, esperado, observado y resultado. Nunca tokens, contraseñas, cuerpos de eventos completos ni datos personales reales.

Rendimiento: preparar 50 proyectos ficticios publicados. Desde un cliente cercano a la región configurar API_BASE_URL y MEASUREMENT_LOCATION y ejecutar `node scripts/performance.mjs`. Revisar y excluir cold starts usando CloudWatch antes de interpretar el resultado como cumplimiento RNF-HU-05. El archivo generado registra que esa revisión está pendiente.
