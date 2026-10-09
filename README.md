# Lexio · Control jurídico y gerencial

Aplicación Windows con Tauri, React, TypeScript y Tailwind. El frontend se comunica únicamente por HTTP(S) con FastAPI; SQLAlchemy y PyMySQL acceden a MySQL desde el servidor.

## Vistas y flujo de trabajo

La ficha integral define los datos del sistema. Se registran en vistas separadas, sin numeración ni una secuencia obligatoria:

- **Inicio:** tabla **Alertas procesales y otros** con cliente y caso, tipo Legal/Otro, vencimiento, abogado responsable del caso, asunto corto y acciones. El administrador también ve **Alerta de cobros** con saldo de cada cuota impaga, estado y acceso al caso, para cuotas vencidas o próximas a treinta días. Ambas tablas muestran todas las filas disponibles.
- **Clientes:** datos personales y código generado estable. Cada cliente puede tener varios casos. Los botones Ver casos, Nuevo caso y Corregir datos están separados; Ver casos limpia los filtros anteriores y selecciona al cliente.
- **Casos:** selecciona un cliente existente y registra rama jurídica, tipo de proceso, etapa de ingreso, estado Activo/Concluido y control financiero. El detalle mantiene arriba los datos del cliente y proceso y debajo las pestañas **Bitácora** y **Control financiero**; esta última solo para administrador. Ver caso desde las alertas procesales abre Bitácora; desde cobros abre Control financiero. Cada actuación registra fecha manual, asunto de hasta 150 caracteres, tipo Legal/Otro, descripción detallada y alerta opcional. El servidor incorpora al abogado autenticado y la fecha y hora de registro. Con permiso de edición se pueden corregir esos campos mediante Editar; el autor, la hora original y el estado Atendido se conservan. La auditoría guarda la corrección y cambiar el vencimiento actualiza los avisos correspondientes.
- **Reportes:** agrupa por rama jurídica el total de casos, activos y concluidos. El administrador también ve honorarios pactados, efectivo cobrado y saldo pendiente.

Las alertas se consultan en Inicio; se retiró la página separada de Alertas y vencimientos. Los avisos se anticipan 5, 3 y 1 días hábiles (lunes a viernes, sin feriados) y cada asunto muestra solo su aviso más reciente, conservando la fecha límite original. Leer descarta ese recordatorio hasta el siguiente; Atendido completa asuntos Legal y Otro con permiso de edición. Un vencimiento pendiente pasa a urgente después de su fecha. Los cobros se resuelven al pagar la cuota. Corregir asunto, tipo o descripción conserva los avisos leídos.

Cada caso tiene un único total de honorarios y cuotas por fecha. Las cuotas suman el total pactado. Registrar un abono lo aplica automáticamente a la primera cuota pendiente y después a las siguientes por número; opcionalmente se puede elegir otra cuota inicial. No hay créditos separados, servicios, eventos de pago ni confirmaciones adicionales. El saldo es honorarios menos abonos; concluir un caso conserva la deuda.

En la vista de un caso activo, **Concluir caso** permite cerrar su atención con una confirmación breve. Está disponible para quienes tienen permiso de edición; conserva el historial y los avisos y cobros pendientes. El cierre usa el estado y la auditoría existentes, sin una migración adicional.

El código del cliente tiene formato `CL-000001`, depende de su ID y se conserva al corregir nombre o documento. Las ramas se leen del catálogo `lexio_legal_areas` de cada estudio mediante la API. Los casos guardan `area_id`; corregir el nombre de una rama en MySQL actualiza el nombre mostrado en sus casos y reportes al cargar datos de nuevo. Para agregar o corregir ramas, seguir los [ejemplos SQL del catálogo](database/LEGAL_AREAS.md). La aplicación no contiene un listado fijo ni inserta ramas al arrancar.

## Acceso y permisos

El ingreso usa usuario y contraseña. Los usuarios se normalizan a minúsculas, por lo que `Admin` y `admin` identifican la misma cuenta. Las contraseñas nuevas admiten de 6 a 128 caracteres; se guardan con Argon2.

El administrador financiero ve todos los casos del estudio, administra las cuentas y registra honorarios y abonos. Los demás usuarios acceden únicamente a casos asignados con lectura o edición. Los importes, cuotas y abonos se excluyen en el servidor para esos usuarios, incluidos reportes y alertas. Sus permisos de alta se administran por separado.

Un asistente con permiso de alta puede consultar su cliente recién registrado para crear su primer caso. Esta autorización se limita a clientes sin casos aún y se verifica con la auditoría del mismo estudio. Después, la visibilidad depende de los casos asignados, también al revocar un acceso.

Todas las tablas tienen `tenant_id`. El servidor obtiene el estudio del JWT validado y verifica usuario activo y relaciones del mismo estudio. El frontend nunca envía el estudio para establecer identidad ni recibe credenciales de MySQL. El JWT permanece en memoria; cerrar o recargar exige iniciar sesión.

## Actualización desde el modelo anterior

Para añadir asunto y tipo a la bitácora del esquema actual, usar la [migración aditiva](backend/MIGRATION_ENTRY_SUBJECTS.md). Está preparada y pendiente de revisión humana; no se aplicó a MySQL. Conserva los registros y debe aplicarse explícitamente antes del backend compatible. El procedimiento de reemplazo de datos de prueba que sigue corresponde a la transición anterior.

Para convertir las ramas guardadas como texto en un catálogo por estudio, ejecutar una sola vez, previa revisión, [004_legal_areas.sql](database/004_legal_areas.sql) directamente en la base existente. Conserva los casos, prepara las once ramas iniciales y cualquier otro nombre existente, y establece su relación por ID. Este SQL tampoco se aplicó a MySQL. No usar `reset_demo_schema.py` para añadir el catálogo a una base cuyos registros deban conservarse.

`backend/reset_demo_schema.py` reemplaza explícitamente las tablas de negocio anteriores por el modelo de cuatro módulos. Conserva estudios, usuarios, contraseñas y auditoría. **Elimina los datos de prueba y las asignaciones a sus casos.** Solo se debe usar en la base de prueba que David autorizó reiniciar; rechaza registros de otro estudio.

Primero revisa el plan:

```powershell
.\backend\venv\Scripts\python.exe backend/reset_demo_schema.py --tenant-id 1 --admin-id 1
```

Para aplicar ese plan, añade `--apply`. El programa no vuelve a borrar datos cuando detecta que el esquema nuevo ya está aplicado. MySQL hace commit implícito del DDL: no es una operación reversible mediante rollback. Actualiza el backend y el frontend como una misma entrega; la API anterior no es compatible con el esquema nuevo. No ejecutes la migración de usuarios ni el esquema inicial para actualizar una base existente.

La API **nunca crea ni modifica tablas al importar o iniciar**.

El 8 de octubre de 2026 se aplicó el reemplazo autorizado en MySQL para el estudio 1. Quedaron 11 tablas y se verificó que las dos cuentas, sus contraseñas y la auditoría se conservaron. Se comprobó el flujo completo contra MySQL en una transacción temporal revertida: no quedaron clientes, casos ni abonos de esa verificación. El despliegue del backend en Railway es un paso separado.

## Instalación desde cero

1. Configura `backend/.env` usando los nombres de `backend/.env.example`. Mantén `DATABASE_URL` solo en el backend; `mysql://` se normaliza a `mysql+pymysql://`. Elige un `JWT_SECRET` aleatorio de al menos 32 caracteres.
2. En una base vacía ejecuta `database/001_lexio_schema.sql`, generado por `backend/export_sql.py`. Requiere MySQL 8.0.16 o posterior. No es una migración para bases existentes.
3. Crea el primer estudio y administrador:

```powershell
.\backend\venv\Scripts\python.exe backend/bootstrap.py --name "Lexconterra Group" --username "admin" --admin-name "David"
```

El programa solicita la contraseña sin mostrarla. No hay contraseñas de producción predeterminadas. No ejecutes bootstrap para actualizar la cuenta existente.

## Ejecución local

Desde la raíz:

```powershell
.\backend\venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\backend\venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --reload --port 8000
```

Desde otra terminal en `frontend`:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Para usar la API local, configura `VITE_API_URL=http://localhost:8000` al iniciar Vite. La aplicación usa normalmente la API HTTPS de Railway indicada en `frontend/.env`; esa dirección se incorpora durante la compilación.

## Railway e instalador Windows

El servicio API usa `backend` como directorio raíz, instala `requirements.txt` y arranca con:

```sh
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Configura `DATABASE_URL`, `JWT_SECRET`, `JWT_MINUTES` y `CORS_ORIGINS` en el servicio. La API del estudio es `https://lexio-production-bfce.up.railway.app`. `/health` verifica el proceso, no el funcionamiento de MySQL. Una compilación local no despliega Railway.

Para generar el instalador, desde `frontend`, con Rust y las herramientas C++ de Windows:

```powershell
pnpm tauri build --bundles nsis
```

El archivo se genera en `frontend/src-tauri/target/release/bundle/nsis`. Se necesita internet para usar la aplicación, pero el equipo del abogado no necesita Python, Node ni MySQL. El instalador no está firmado digitalmente y puede descargar WebView2 si falta.

El 8 de octubre se generó `Lexio_0.2.1_x64-setup.exe` apuntando a Railway, con vistas separadas de Clientes y Casos, Inicio restaurado y bitácora interna. Se verificaron 33 pruebas backend, 30 frontend, la compilación estricta de TypeScript y el flujo visual en SQLite temporal, incluido un cliente con dos casos y el borrado de filtros al abrir sus casos. La entrega anterior también comprobó el recorrido financiero y los permisos en MySQL con rollback. Esta corrección no requiere migración adicional de tablas. No se probó la instalación del `.exe` ni se desplegó la API de Railway desde esta revisión.

La versión `Lexio_0.2.2_x64-setup.exe`, generada el mismo día, incorpora Editar en las actuaciones de la bitácora para quienes tienen permiso de edición sobre el caso. Se verificaron 44 pruebas backend y 33 frontend, la compilación y una corrección visual de fecha, descripción y alerta desde otra cuenta, conservando autora y registro originales. Los cambios de vencimiento actualizan los avisos; corregir el texto mantiene los avisos leídos y editar una actuación atendida conserva su estado. No requiere cambios de tablas. El instalador apunta a Railway; también se debe desplegar el backend actualizado. La instalación del `.exe` aún no se probó.

## Verificación

```powershell
.\backend\venv\Scripts\python.exe -m pytest backend/tests -q
```

Desde `frontend`:

```powershell
pnpm test
pnpm build
```

Las pruebas backend usan SQLite temporal con claves foráneas y no acceden a Railway. Las pruebas frontend simulan HTTP; la compilación comprueba TypeScript estricto. `backend/tests/preview_server.py` ofrece una base temporal independiente para revisar pantallas; nunca debe desplegarse.

Las transacciones financieras bloquean el caso antes de validar saldos, usando Decimal y MySQL READ COMMITTED. La auditoría conserva detalles técnicos en la base, mientras Administración presenta un historial legible. No hay integración con Google Drive ni enlaces externos de documentos.

Esta entrega no incluye cálculo automático de plazos jurídicos, feriados, facturación tributaria ni reconstrucción histórica de reportes. Los reportes describen los datos vigentes.
