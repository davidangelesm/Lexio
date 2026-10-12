# Cuotas por evento vinculadas a la bitácora

El administrador registra cada cuota por **Fecha** o **Evento / hito**. Una
cuota por evento tiene un nombre libre de hasta 150 caracteres y permanece
**Esperando evento**, sin fecha exigible ni alertas de cobranza. Su importe forma
parte de los honorarios y el saldo del caso desde el inicio.

Al registrar o editar una actuación pendiente, el administrador puede elegir
la cláusula que activará. Cada actuación puede activar una cuota y cada cuota
se vincula a una sola actuación del mismo caso y estudio. No se vincula por
coincidencias de texto ni se crean eventos independientes de la bitácora.

**Marcar atendido** activa la cuota el mismo día (fecha de Lima), registra la
activación en auditoría y muestra el saldo impago en Inicio → Alerta de cobros.
Funciona aunque la actuación no tenga alerta procesal. Un asistente con permiso
de edición puede atenderla; solo el administrador crea o modifica el vínculo
y recibe información financiera. Repetir la acción conserva la fecha y no
duplica el cobro. Corregir el texto de una actuación atendida no reactiva pagos.

La activación manual genera el aviso inmediato, incluso en fin de semana.
Las cuotas por evento no generan anticipaciones ficticias de 5, 3 o 1 días.
Las cuotas por fecha conservan sus recordatorios existentes y la regla de no
generar nuevas anticipaciones durante fines de semana.

Los abonos siguen distribuyéndose por número de cuota; se permiten anticipos
sobre cuotas por evento. Activar una cuota ya pagada no genera cobranza. Leer un
aviso no paga la cuota: el cobro se resuelve con abonos.

Cada cuota se bloquea solo cuando tiene un abono aplicado, incluso parcial:
no se cambia su importe, modalidad, evento o fecha ni se retira del plan.
Las otras cuotas pueden cambiar de importe o modalidad y retirarse, aunque
el caso tenga otros abonos o actuaciones vinculadas. También se agregan cuotas
al final. Los honorarios deben coincidir con la suma del plan actualizado.
Se conservan los ID y el orden de las cuotas restantes y las aplicaciones de
abonos; no se redistribuyen pagos anteriores.

Cambiar el evento o pasar una cuota sin abonos a fecha retira su vínculo con
la actuación anterior y reinicia su activación. La actuación conserva texto,
autor, fecha y estado Atendido; la desvinculación queda auditada. Una cuota que
pasa a evento espera una nueva actuación para activar el cobro. Cambiar solo
su importe conserva el vínculo y la activación. La fecha de un evento vigente
se establece al atender la actuación, no editando directamente el vencimiento.

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
