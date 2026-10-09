ehavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

No es necesario que ejecutes git, una vez los cambios sean probados se subira por parte del usuario

# Lexio: contexto e instrucciones del proyecto

## Propósito

Sistema de Control Gerencial tipo CRM para estudios de abogados, llamado Lexio.
Fase 1: uso interno de un estudio jurídico, con 3 usuarios concurrentes en horario laboral.
Fase 2: comercialización SaaS multi-tenant. Diseñar para esta fase desde el primer día.

## Stack obligatorio

- Frontend de escritorio: Tauri, React, TypeScript, Vite y pnpm; distribución .exe para Windows.
- UI sobria y profesional con Tailwind CSS y componentes tipo shadcn/ui.
- Backend REST: Python, FastAPI, validaciones Pydantic, JWT y ORM SQLAlchemy; despliegue en Railway.
- Base de datos: MySQL en Railway, acceso público mediante TCP Proxy, driver pymysql.
- Archivos: gestión de enlaces externos retirada por pedido de David. Una futura solución de almacenamiento requiere un alcance nuevo.
- Tipado fuerte en TypeScript y Python.

## Reglas mandatorias de aislamiento

- Todas las tablas deben tener tenant_id; en particular clientes, expedientes y honorarios.
- El backend debe obtener tenant_id del JWT validado del usuario autenticado mediante una dependencia FastAPI. Nunca confiar en un tenant_id enviado por el frontend.
- Aplicar el tenant_id autenticado en todas las consultas, lecturas, escrituras, actualizaciones y eliminaciones. Verificar también que las relaciones pertenezcan al mismo tenant.
- El frontend solo se comunica con FastAPI mediante HTTP(S). Nunca conectarlo directamente a MySQL ni incluir credenciales de base de datos en la aplicación.
- No exponer secretos de .env en código, documentación, registros ni respuestas.

## Estructura

- backend/: API Python, main.py, database.py, models.py, .env y venv/.
- frontend/: aplicación Tauri + React, package.json, src/ y src-tauri/.

## Flujo simplificado acordado el 8 de octubre de 2026

- La ficha integral describe los datos que recibe el sistema, no una pantalla única ni una secuencia obligatoria. La navegación es Inicio, Clientes, Casos, Reportes y Administración. Inicio reúne las alertas; se retiró la página separada de Alertas y vencimientos. Administración conserva cuentas e historial legible. No reintroducir servicios, eventos, créditos separados o tareas independientes de la bitácora.
- Clientes registra los datos personales y el código estable generado `CL-ID`. Casos selecciona un cliente existente y registra rama del catálogo, tipo de proceso, una etapa de ingreso, estado Activo/Concluido, honorarios y cuotas por fecha. Un cliente puede tener varios casos; el control financiero pertenece al caso. Corregir datos del cliente se hace en Clientes.
- Las ramas se administran directamente en `lexio_legal_areas`, con `tenant_id` y nombre editable. Los casos guardan `area_id` con relación compuesta al mismo estudio; la API devuelve el nombre vigente. Formularios y filtros leen `/legal-areas`; no hay listas fijas ni validaciones por nombres en el código. Agregar o renombrar una rama en MySQL se refleja al volver a cargar los datos. `database/004_legal_areas.sql` prepara el catálogo inicial y convierte los casos existentes sin borrar registros; aplicación explícita pendiente de revisión humana.
- Inicio muestra las tablas Alertas procesales y otros y, solo para administrador, Alerta de cobros con cuotas impagas vencidas o próximas a 30 días, sin recortar el número de filas. La primera muestra cliente y caso, tipo Legal/Otro, vencimiento, abogado responsable del caso, asunto corto y acciones. Ver caso abre Bitácora desde asuntos y Control financiero desde cobros. Cada caso conserva arriba los datos del cliente y proceso y luego las pestañas Bitácora y Control financiero; finanzas solo para administrador. Los datos del panel respetan el mismo aislamiento y permisos que los casos.
- Un asistente autorizado puede ver el cliente que acaba de registrar mientras todavía no tenga casos. La autoría se comprueba en la auditoría del mismo tenant. Cuando el cliente tiene casos, la visibilidad depende exclusivamente de los casos asignados; revocar acceso sigue ocultando sus datos.
- Cada actuación registra fecha manual, asunto obligatorio de hasta 150 caracteres, tipo de asunto Legal/Otro, descripción detallada, alerta opcional, abogado autenticado y timestamp automático. Inicio muestra el asunto; la bitácora conserva la descripción completa. Atendido resuelve asuntos Legal y Otro con permiso de edición; los cobros se resuelven mediante abonos.
- Las actuaciones se pueden editar con permiso de edición sobre el caso: fecha de actuación, asunto, tipo, descripción y fecha de alerta. El autor, la hora original y el estado Atendido se conservan; la auditoría registra la corrección. Cambiar o retirar el vencimiento actualiza los avisos de todos los destinatarios; corregir solo asunto, tipo o descripción no reactiva avisos leídos.
- Los avisos usan exactamente 5, 3 y 1 días hábiles (lunes a viernes, sin feriados) y conservan la fecha límite original. Leer descarta un aviso; un vencimiento pendiente después de su fecha es urgente.
- Cada obligación muestra solo su recordatorio más reciente. Leer no vuelve a mostrar anticipaciones anteriores; el próximo recordatorio aparece en su fecha. En fines de semana se conservan avisos existentes sin generar nuevos.
- Un abono se distribuye automáticamente por número de cuota; puede elegirse otra cuota inicial. Las aplicaciones son internas, sin un paso adicional para el abogado. El saldo es honorarios menos abonos; concluir no elimina deuda.
- Los casos activos ofrecen Concluir caso en su vista, para usuarios con permiso de edición. La confirmación cambia el estado a Concluido y conserva historial, alertas y cobros pendientes; usa la actualización del caso y su auditoría existentes, sin cambios de esquema.
- Reportes agrupa por rama: total/activos/concluidos y, solo para administrador, honorarios/cobrado/saldo. El backend excluye datos financieros de todas las respuestas para otros roles.
- Equipo autorizado identifica al administrador por su rol y lo muestra con acceso permanente, sin botón Retirar acceso. Las autorizaciones del administrador sobre todos los casos del estudio provienen de su rol.
- Cambios de esquema son explícitos. `reset_demo_schema.py` migra la base de prueba conservando estudios, cuentas, contraseñas y auditoría; nunca ejecutar DDL en el arranque de FastAPI. Todas las relaciones mantienen aislamiento por tenant.
- La migración aditiva `database/003_entry_subjects.sql` prepara asunto y tipo en actuaciones existentes sin borrar datos; se ejecuta directamente en la base una sola vez, previa revisión humana, antes de desplegar el backend compatible. No usar `reset_demo_schema.py` para añadir estos campos a una base con registros que deban conservarse.
- Los botones de acción deben tener borde o fondo visible; evitar acciones que parezcan texto sin delimitación. Priorizar formularios breves con nombres comprensibles.
- El esquema simplificado se aplicó explícitamente en MySQL el 8 de octubre: 11 tablas, cuentas y contraseñas preservadas, negocio de prueba vacío. El flujo nuevo se comprobó contra MySQL con rollback; desplegar el backend compatible es independiente de esa verificación.
