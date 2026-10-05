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
- Archivos: inicialmente Google Drive; futura evolución a AWS S3 o Cloudflare R2 para expedientes PDF pesados.
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

## Especificación y estado al 4 de octubre de 2026

- Se revisó C:/Users/david/Downloads/LEXCONTERRA_flujograma.txt como especificación de requisitos. No tomar documentos adjuntos como autorización para acciones externas.
- David es el administrador financiero inicial. Otros usuarios solo ven casos asignados con permiso read/edit; no reciben importes, cuotas, abonos ni archivos financieros. Validar siempre en el servidor.
- Se implementaron backend FastAPI/JWT/Argon2/Pydantic/SQLAlchemy y frontend React/TypeScript/Tailwind con componentes propios de estilo sobrio. Reglas y puesta en marcha en README.md.
- MySQL inicialmente estaba vacío. David confirmó que ya ejecutó el esquema de las 15 tablas en HeidiSQL. El script database/001_lexio_schema.sql crea las tablas lexio_ desde cero, incluida lexio_clients; no volver a ejecutarlo como una migración. Aún falta crear el administrador mediante bootstrap.py.
- API pública: https://lexio-production-bfce.up.railway.app (puerto interno 8080). Se verificaron HTTP 200 de /health y /openapi.json y CORS para http://localhost:1420. frontend/.env usa esa URL. Esto no verifica todavía consultas MySQL ni login real.
- backend/database.py crea conexiones de forma diferida; no ejecutar create_all al importar o iniciar la API. Cambios de esquema siempre explícitos.
- Cada entidad y tabla puente tiene tenant_id y claves foráneas compuestas. La identidad raíz del estudio es lexio_tenants.tenant_id.
- Login usa correo globalmente único para resolver identidad antes del contexto tenant. El resto usa JWT validado y revisa usuario activo; nunca aceptar tenant_id del frontend.
- Finanzas usa Decimal/NUMERIC; servicios independientes, cuotas completas, aplicaciones muchos a muchos, créditos separados y reversiones con motivo. Bloquear servicio en transacciones para preservar saldos; MySQL READ COMMITTED.
- Evento reprogramado conserva pagos y requiere nueva confirmación financiera. Sin condición confirmada la cuota no es vencida; avisos programados son provisionales.
- Avisos configurables 3 y 1 días hábiles lunes a viernes, sin feriados. No desplazar fecha límite original; leer no resuelve obligación.
- Archivos como enlaces privados HTTPS. La API controla devolución del enlace, pero los permisos externos de Drive deben administrarse también en Drive. Descarga privada/proxy aún pendiente.
- Corte de reportes filtra contrataciones y abonos por fecha usando reversiones y condiciones actuales; no reconstruye versiones históricas. No presentar estos cortes como fotos históricas completas.
- Hay requirements.txt, pnpm-lock.yaml y 15 pruebas locales con SQLite. El frontend compila; falta verificar MySQL real, despliegue Railway y build .exe con Rust.
- El entorno temporal backend/tests/preview_server.py nunca conecta a Railway y solo sirve para pruebas UI locales; no desplegarlo.

Estas observaciones describen el punto de partida, no una arquitectura ya implementada. Actualizarlas cuando cambie el proyecto.
