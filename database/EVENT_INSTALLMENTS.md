# Cuotas por evento vinculadas a la bitácora

El administrador registra cada cuota por **Fecha** o **Evento / hito**. Cada cuota
por evento se vincula a una sola actuación del mismo caso y estudio. Su vencimiento
es la **fecha de alerta** de esa actuación; la fecha de actuación registra cuándo
se realizó o registró la gestión y no determina el cobro.

Desde que se vincula a una actuación con fecha de alerta, el saldo impago aparece
en Inicio → Alerta de cobros si vence en los próximos 30 días o ya está vencido.
Los avisos de actuación y cobro usan los mismos plazos: 5, 3, 2 y 1 días hábiles,
además del vencimiento. En fines de semana se conservan avisos existentes sin
crear nuevos. Solo el administrador recibe información financiera.

El plazo de 2 días hábiles se agregó para prueba por pedido de David el 20 de
octubre de 2026; los demás plazos se conservan.

Reprogramar o retirar la fecha de alerta actualiza el vencimiento de la cuota y
cancela los avisos anteriores para todos los destinatarios, con auditoría.
Sin fecha de alerta, la cuota queda esperando fecha, incluso si se atiende la
actuación. Corregir solo el texto conserva los avisos leídos. Marcar **Atendido**
resuelve la actuación, pero conserva el vencimiento y la cobranza pendiente.
El cobro se resuelve mediante abonos; una cuota pagada no genera cobranza.

Los abonos se distribuyen por número de cuota y admiten anticipos. Las cuotas con
abonos no permiten editar importe, modalidad, evento, fecha ni eliminación desde
el plan; su vencimiento por evento sigue los cambios de fecha de la actuación.
Las cuotas sin abonos pueden modificarse o retirarse. Los honorarios deben sumar
el plan; se conservan ID, orden y aplicaciones de pagos anteriores.

Cambiar el evento o pasar una cuota sin abonos a fecha retira su vínculo anterior.
Cambiar solo el importe conserva el vínculo y la fecha. El administrador gestiona
los vínculos; un asistente con permiso de edición puede corregir la fecha de alerta
sin recibir montos ni vínculos financieros. Se conserva la prohibición de cambiar
el vínculo de una actuación atendida.

## Despliegue

Revisar y ejecutar una sola vez
[`006_event_installments.sql`](006_event_installments.sql) en MySQL 8.0.16 o
posterior, con las escrituras pausadas, antes de desplegar este backend. Agrega
campos y restricciones sin borrar cuotas, actuaciones ni abonos. Las cuotas
existentes mantienen su fecha; los campos nuevos quedan nulos. No ejecutar
`reset_demo_schema.py` ni migrar al arrancar FastAPI.

MySQL confirma cada ALTER automáticamente. Ante un error, revisar el esquema
real antes de continuar; no repetir el archivo completo. Una base nueva usa
`001_lexio_schema.sql`, que ya incorpora estos campos.

Si la API devuelve que `due_date` debe ser una fecha y que `event_name` es un
campo no permitido, todavía está ejecutando el backend anterior. Comprobar en
`/openapi.json` que `InstallmentIn` incluya `event_name` y permita `due_date`
nulo. Si la migración ya fue aplicada, desplegar el código actualizado de
`backend/`; volver a compilar el frontend no actualiza la API de Railway.

## Actualizar vínculos existentes al nuevo vencimiento compartido

No hay cambios de esquema adicionales. Con las escrituras pausadas, ejecutar
`backend/venv/Scripts/python.exe backend/sync_event_due_dates.py --admin-id ID`
para simular la actualización del estudio del administrador indicado. Revisar el
resultado y repetir con `--apply` para confirmar. Repetir por estudio.

El script usa la conexión configurada del backend y actualiza únicamente cuotas
por evento vinculadas: copia la fecha de alerta, incluso si la actuación ya está
atendida o la cuota tiene abonos; sin alerta retira el vencimiento anterior.
Conserva abonos, cuotas, actuaciones y usuarios, audita cada cambio y cancela los
avisos del vencimiento anterior. Es idempotente y no se ejecuta al arrancar la API.
`activated_at` conserva compatibilidad con el esquema existente: indica cuándo
la cuota recibió una fecha, ya no cuándo se atendió la actuación.

La actualización de datos queda pendiente de revisión y aplicación humana antes
de desplegar el backend compatible. No ejecutar `reset_demo_schema.py`.
