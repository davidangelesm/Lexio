# Frontend de Lexio

Aplicación de escritorio en Tauri, React, TypeScript y Tailwind CSS estructurada en cinco módulos: **Inicio**, **Clientes**, **Casos**, **Reportes** y **Administración**.

## Funcionalidades principales en interfaz

- **Inicio (`src/features/dashboard`):**
  - Métricas operativas y financieras según el rol autenticado.
  - Tabla de **Alertas procesales y otros** (recordatorios de 5, 3 y 1 días hábiles y vencimientos urgentes) y tabla de **Alerta de cobros** (exclusiva para administrador).
  - **Calendario visual de alertas (`AlertCalendar.tsx`):** Vista semanal (con sección fija de *Todo el día* y grilla horaria unificada para audiencias/alertas con hora) y vista mensual apilada, mostrando todas las alertas programadas pendientes.
- **Clientes (`src/features/clients`):**
  - Formulario vertical unificado con documento (`DNI`, `RUC`, `CE`), datos de contacto y **Origen de captación** (*Sin atribución* por defecto).
  - Etiqueta automática **«Moroso»** debajo del nombre del cliente cuando tiene un caso concluido o retirado con cuotas incobrables.
- **Casos (`src/features/cases`):**
  - Vinculación de **uno o múltiples clientes** por caso.
  - Registro de Rama del Derecho, Tipo de proceso, **Expediente / Número de seguimiento**, Etapa de ingreso y selección de **Abogado responsable** entre los miembros activos del estudio.
  - Separación entre **Casos activos** (vista principal) y carpeta de **«Casos archivados»** (concluidos o retirados), sin columna redundante de estado.
  - **Bitácora:** Actuaciones con fecha manual, asunto, tipo (`Legal`/`Otro`), descripción detallada, fecha de alerta y **hora opcional de alerta**.
  - **Control financiero (solo Administrador):** Plan de cuotas por fecha fija o evento/hito, abonos automáticos en cascada y gestión de cuotas incobrables.
- **Reportes (`src/features/reports`):**
  - Métricas de casos y resultados financieros agrupados por Rama del Derecho.
  - Filtros por **Rama del Derecho**, **Mes** y **Año** mediante un selector interactivo tipo rueda (`YearWheelPicker`, 1990–2100).
- **Administración (`src/features/admin`):**
  - Cuentas y permisos del equipo, catálogo editable de Ramas de Derecho e historial legible de auditoría en hora de Lima (`America/Lima`).

## Estructura del directorio

- `src/app` y `src/hooks`: sesión, estado central (`useLexio.ts`), navegación y modales.
- `src/features`: páginas, componentes y formularios de cada módulo.
- `src/components`: controles compartidos y estructura de layout (`AppShell`).
- `src/services`: cliente HTTP (`fetch` con JWT en memoria) hacia FastAPI; sin conexión directa a MySQL.
- `src/types`: contratos TypeScript de entidades y peticiones.
- `src/utils` y `src/styles`: utilidades de formato (`America/Lima`, moneda) y hoja de estilos global (`global.css`).
- `tests`: suite de regresión (`tests/regression.test.mjs`) con API simulada.
- `src-tauri`: configuración nativa y empaquetado NSIS para Windows.

## Comandos

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
pnpm tauri build --bundles nsis
```
