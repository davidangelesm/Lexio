# Lexio · Control jurídico y gerencial

Sistema de Control Gerencial tipo CRM para estudios de abogados, diseñado con arquitectura multi-tenant (`tenant_id`) desde el primer día.

- **Frontend de escritorio:** Windows (`.exe`) con Tauri, React, TypeScript, Vite, Tailwind CSS y pnpm.
- **Backend REST:** Python, FastAPI, Pydantic, JWT en memoria, Argon2 y SQLAlchemy ORM (despliegue en Railway).
- **Base de datos:** MySQL 8.0+ en Railway con driver `pymysql`. El frontend se comunica exclusivamente por HTTP(S) con FastAPI y nunca accede directamente a MySQL.

---

## Módulos y funcionalidades de la aplicación

La navegación principal se organiza en cinco módulos: **Inicio**, **Clientes**, **Casos**, **Reportes** y **Administración**.

### 1. Inicio (Panel del día y Calendario de alertas)
- **Métricas rápidas:** Resumen de casos totales, activos, concluidos y alertas legales pendientes. Para el administrador incluye además el resumen financiero global (*Honorarios pactados*, *Cobrado* y *Saldo pendiente*).
- **Tabla «Alertas procesales y otros»:** Muestra cliente(s) con tipo y número de documento, expediente, tipo de alerta (`Legal` / `Otro`), fecha y hora opcional de vencimiento, abogado responsable, asunto corto y acciones directas:
  - **Recordatorios anticipados:** Se activan exactamente a **5, 3 y 1 días hábiles** (lunes a viernes) antes de la fecha límite, mostrando únicamente el recordatorio más reciente de cada obligación.
  - **Estados y resolución:** *Marcar leído* descarta el aviso actual hasta el siguiente recordatorio; *Marcar atendido* resuelve la obligación procesal; todo vencimiento no atendido pasada su fecha pasa a estado **Urgente**.
- **Calendario visual de alertas (`AlertCalendar`):**
  - Ubicado debajo de la tabla de alertas procesales, inspirado en Google Calendar.
  - Muestra **todas las alertas programadas pendientes** (`GET /alerts?all_scheduled=true`), independientemente de la ventana de 5, 3 y 1 días hábiles, anclado por defecto a la semana o mes actual.
  - **Vista semanal:** Separa en un bloque fijo superior las alertas de **«Todo el día»** (sin hora) y ubica las alertas **con hora específica** (ej. audiencias) en su franja horaria correspondiente dentro de un lienzo unificado.
  - **Vista mensual:** Apila las alertas programadas dentro de cada día del mes.
- **Tabla «Alerta de cobros» (solo Administrador):** Lista todas las cuotas impagas vencidas o próximas a vencer dentro de 30 días, con acceso directo a la pestaña *Control financiero* del caso.

### 2. Clientes
- **Ficha personal vertical:** Registro de tipo de documento (`DNI` de 8 dígitos, `RUC` de 11 dígitos o `CE`), número de documento, nombre completo o razón social, celular, correo electrónico, dirección y **Origen de captación** (*Sin atribución* por defecto, *Instagram*, *Facebook*, *Tiktok*, *Web*, *Referido*, *Volantes*, *Otro*).
- **Identificación y trazabilidad:** Cada cliente recibe un código interno estable (`CL-000001`), mientras que en las tablas operativas se prioriza la visualización de su documento (`DNI / RUC / CE`).
- **Condición automática de «Moroso»:** Cuando un caso se da por terminado (`Concluido` o `Retirado`) manteniendo cuotas marcadas como **incobrables**, el sistema marca automáticamente a los clientes vinculados como **Moroso** (`is_delinquent`), mostrando la etiqueta roja **«Moroso»** debajo de su nombre en el listado de clientes. Si se reactiva la cobranza o el caso vuelve a activo sin otros casos incobrables concluidos, la condición se retira automáticamente con auditoría.
- **Acciones por cliente:** *Ver casos* (filtra el listado de casos del cliente), *Nuevo caso* (abre el formulario con el cliente preseleccionado) y *Corregir datos*.

### 3. Casos y Bitácora
- **Múltiples clientes por caso:** Un caso puede vincular a **uno o varios clientes** del mismo estudio (`lexio_case_clients`), mostrando todos los co-clientes y sus documentos tanto en el listado general como en el encabezado y ficha del expediente.
- **Datos del proceso:**
  - **Rama del Derecho:** Seleccionada desde el catálogo administrable del estudio (`/legal-areas`).
  - **Tipo de proceso** y **Expediente / Número de seguimiento** (`tracking_number`), ambos integrados en el buscador general de casos.
  - **Etapa de ingreso** y **Estado del proceso** (`Activo`, `Concluido`, `Retirado`).
  - **Abogado responsable:** Cualquier usuario activo del estudio (administrador o abogado/asistente) puede ser asignado como abogado responsable al crear o editar el caso; por defecto se preselecciona quien lo registra.
- **Vista de Casos activos y carpeta «Casos archivados»:**
  - La vista principal de **Casos** muestra exclusivamente los procesos **activos** (sin columna redundante de estado).
  - El botón **«Casos archivados»** (a la izquierda de *Nuevo caso*) abre la bandeja de expedientes **concluidos o retirados**, permitiendo alternar entre ambas vistas con un clic.
- **Pestaña «Bitácora»:**
  - Registro y edición de actuaciones con **fecha manual**, **asunto obligatorio** (hasta 150 caracteres), **tipo** (`Legal` / `Otro`), **descripción detallada**, **fecha de alerta opcional** y **hora de alerta opcional** (`HH:MM`, para audiencias o diligencias con hora fija).
  - Conserva siempre el autor original, la fecha/hora exacta de registro en horario de Perú (`America/Lima`) y el estado *Atendido*, auditando cualquier corrección posterior.
- **Pestaña «Control financiero» (solo Administrador):**
  - **Plan de pagos:** Cuotas por **fecha fija** o por **evento/hito** de nombre libre vinculable desde la bitácora. La suma de las cuotas equivale siempre al total de honorarios pactados.
  - **Edición parcial del plan:** Solo las cuotas que ya recibieron abonos o están marcadas como incobrables se bloquean; las demás pueden ajustarse, eliminarse o ampliarse con nuevas cuotas al final.
  - **Abonos automáticos:** Los pagos se aplican automáticamente en cascada desde la primera cuota pendiente (o desde la cuota inicial elegida) con precisión decimal exacta.
  - **Cuotas incobrables:** Permite seleccionar una o varias cuotas pendientes para marcarlas como incobrables indicando el motivo, o reactivar su cobranza posteriormente.

### 4. Reportes
- **Agrupación por Rama del Derecho:** Muestra por cada rama el total de casos, activos, concluidos y retirados, más una fila de totales generales.
- **Métricas financieras (solo Administrador):** Incluye *Total facturado*, *Efectivo cobrado*, *Saldo exigible* (`honorarios − abonos − incobrable`) y *Saldo incobrable*.
- **Filtros por Rama, Mes y Año (con selector tipo rueda):** Permite filtrar las métricas por rama del derecho, mes y año mediante un selector interactivo tipo rueda (`YearWheelPicker` de 1990 a 2100 con atajos a *Todos los años* y *Año actual*).

### 5. Acceso, Roles y Administración
- **Autonomía del Abogado responsable:** El usuario asignado como `responsible_id` de un caso cuenta automáticamente con acceso de lectura y edición (`edit`) de principio a fin sobre el proceso legal (editar caso, registrar/editar actuaciones, atender alertas, gestionar equipo de apoyo y concluir el caso), sin requerir intervención del administrador.
- **Aislamiento financiero estricto:** Los honorarios, cuotas, abonos, saldos e indicadores financieros están restringidos exclusivamente al rol **Administrador** tanto en la interfaz como en las respuestas de la API.
- **Equipo autorizado por caso:** El administrador y el abogado responsable tienen acceso permanente al expediente y pueden agregar asistentes de apoyo con permiso de *Consultar y editar* (`edit`) o *Solo consultar* (`read`), o retirarles el acceso.
- **Módulo de Administración (solo Administrador):**
  - Gestión de cuentas de usuarios del estudio (`Crear clientes`, `Crear casos`, estado `Activo`/`Inactivo` y cambio de contraseña).
  - Administración en vivo del catálogo de **Ramas de derecho** (`lexio_legal_areas`).
  - Historial legible de **Últimos cambios** (auditoría con fecha y hora en zona horaria de Perú).

---

## Migraciones de base de datos (`database/`)

La API **nunca ejecuta DDL al iniciar**. Los cambios de esquema en bases existentes se aplican mediante scripts SQL aditivos en `database/`:

- `database/001_lexio_schema.sql`: Esquema completo de 12 tablas para instalaciones limpias desde cero (`lexio_tenants`, `lexio_clients`, `lexio_users`, `lexio_audit`, `lexio_legal_areas`, `lexio_cases`, `lexio_case_clients`, `lexio_access`, `lexio_entries`, `lexio_installments`, `lexio_payments`, `lexio_payment_applications`, `lexio_notices`).
- `database/003_entry_subjects.sql`: Agrega `subject` y `subject_type` a `lexio_entries`.
- `database/004_legal_areas.sql`: Crea el catálogo `lexio_legal_areas` por estudio y vincula `area_id` en `lexio_cases`.
- `database/006_event_installments.sql`: Habilita cuotas por evento/hito y vínculo desde actuaciones.
- `database/007_uncollectible_installments.sql`: Agrega soporte para cuotas incobrables (`uncollectible_reason`, `uncollectible_at`).
- `database/008_entry_alert_time.sql`: Agrega hora opcional de alerta (`alert_time VARCHAR(5)`) en `lexio_entries`.
- `database/009_client_lead_source.sql`: Agrega origen de captación (`lead_source VARCHAR(30) DEFAULT 'Sin atribución'`) en `lexio_clients`.
- `database/010_case_clients.sql`: Crea la tabla relacional `lexio_case_clients` para soportar múltiples clientes por caso conservando los vínculos existentes.
- `database/011_case_tracking_number.sql`: Agrega expediente / número de seguimiento (`tracking_number VARCHAR(100)`) en `lexio_cases`.
- `database/012_client_delinquent.sql`: Agrega la condición de moroso (`is_delinquent TINYINT(1)`) en `lexio_clients` y actualiza los registros que cumplan la condición.

---

## Instalación desde cero

1. Configura `backend/.env` usando los nombres de `backend/.env.example`. Mantén `DATABASE_URL` solo en el backend; `mysql://` se normaliza a `mysql+pymysql://`. Elige un `JWT_SECRET` aleatorio de al menos 32 caracteres.
2. En una base vacía ejecuta `database/001_lexio_schema.sql` (requiere MySQL 8.0.16 o posterior).
3. Crea el primer estudio y administrador:

```powershell
.\backend\venv\Scripts\python.exe backend/bootstrap.py --name "Lexconterra Group" --username "admin" --admin-name "David"
```

---

## Ejecución local

Desde la raíz para iniciar el backend:

```powershell
.\backend\venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\backend\venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --reload --port 8000
```

Desde otra terminal en `frontend`:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Para apuntar al backend local, define `VITE_API_URL=http://localhost:8000` en `frontend/.env`.

---

## Despliegue en Railway e instalador Windows (`.exe`)

El servicio API en Railway usa `backend` como directorio raíz, instala `requirements.txt` y arranca con:

```sh
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Para generar el instalador de escritorio Windows desde `frontend`:

```powershell
pnpm tauri build --bundles nsis
```

El instalador se genera en `frontend/src-tauri/target/release/bundle/nsis`.

---

## Verificación y pruebas

Pruebas de backend (SQLite temporal en memoria/archivo con claves foráneas):

```powershell
.\backend\venv\Scripts\python.exe -m pytest backend/tests -q
```

Pruebas unitarias de regresión y compilación estricta de TypeScript en `frontend`:

```powershell
pnpm --dir frontend test
pnpm --dir frontend build
```
