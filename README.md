# Lexio · Control jurídico y gerencial

Aplicación de escritorio Tauri 2, React, TypeScript y Tailwind CSS, conectada por HTTP(S) a FastAPI. MySQL se usa exclusivamente desde el backend mediante SQLAlchemy y PyMySQL.

La primera versión implementa el flujo de `LEXCONTERRA_flujograma.txt`: clientes, casos, autorizaciones, bitácora, tareas procesales, servicios contratados, cuotas, eventos, abonos y aplicaciones, reversiones, centro de alertas y reportes. El documento se utiliza como especificación del producto, no como instrucciones para ejecutar acciones en cuentas externas.

## Iniciar con tu base de Railway

### 1. Crear las tablas en HeidiSQL

1. Abre la conexión MySQL de Railway y selecciona la base de datos que usarás con Lexio.
2. Revisa y ejecuta **`database/001_lexio_schema.sql`** una sola vez. Requiere MySQL 8.0.16 o posterior. Son 14 tablas con prefijo `lexio_`; todas incluyen `tenant_id`, incluso tablas puente, avisos y auditoría. `lexio_tenants.tenant_id` es la identidad del estudio.
3. La base está completamente vacía, según confirmó el usuario. El script crea **todo el esquema desde cero**, incluida la tabla de clientes `lexio_clients`; no necesita tablas ni datos previos. El prefijo `lexio_` coincide con los modelos del backend.
4. Las claves foráneas compuestas `(tenant_id, id)` impiden relaciones entre estudios. El documento del cliente es único dentro de cada estudio.
5. El SQL DDL hace commit implícito en MySQL; respalda la base antes de ejecutarlo. No ejecutes este archivo como mecanismo de actualización de tablas ya creadas.

No se ejecutó este SQL contra Railway durante el desarrollo. La API tampoco crea ni modifica tablas al iniciarse.

### 2. Configurar el backend

Desde PowerShell, en la raíz `C:\Users\david\Documents\Lexconterra_Group`:

```powershell
.\backend\venv\Scripts\python.exe -m pip install -r backend/requirements.txt
```

Conserva tu `DATABASE_URL` de `backend/.env`. Usa el formato `mysql+pymysql://USUARIO:CLAVE@HOST_PROXY:PUERTO/BASE`; `mysql://` se normaliza a PyMySQL. Si la contraseña tiene caracteres especiales, deben codificarse en la URL. No copies esta conexión al frontend.

Añade `JWT_SECRET` con un valor aleatorio de al menos 32 caracteres. Puedes generarlo localmente y pegarlo en tu `.env`:

```powershell
.\backend\venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
```

`backend/.env.example` contiene los nombres de las variables. El `.env` existente no fue sobrescrito. Valores adicionales:

```dotenv
JWT_MINUTES=60
CORS_ORIGINS=http://localhost:1420,http://tauri.localhost,tauri://localhost
```

### 3. Crear el estudio y la cuenta de David

**Después** de ejecutar el SQL y configurar `.env`, ejecuta, eligiendo el usuario de acceso:

```powershell
.\backend\venv\Scripts\python.exe backend/bootstrap.py --name "Lexconterra Group" --username "david" --admin-name "David"
```

El programa pide la contraseña dos veces, sin mostrarla ni guardarla en el historial. Crea el estudio, un administrador y el registro de auditoría en una transacción. No hay contraseñas predeterminadas de producción. No se ejecutó este programa contra tu base.

Los nombres de usuario de acceso son únicos globalmente para identificar el estudio durante el login sin aceptar `tenant_id` desde el cliente. Después de autenticar, todas las operaciones de negocio usan el tenant del JWT validado y vuelven a comprobar que el usuario siga activo.

### Actualizar una base existente al acceso por usuario

Para bases que ya tienen las tablas anteriores, usa **`database/002_usernames.sql`**, una sola vez y antes de desplegar este backend. No vuelvas a ejecutar el esquema inicial.

1. Respalda la base y detén la API durante la actualización. El DDL de MySQL hace commit implícito.
2. Ejecuta la migración en HeidiSQL. Cada cuenta existente recibe un usuario único `usuario.ID` (por ejemplo, `usuario.1`), conservando contraseña, permisos, estudio, ID y relaciones. El correo anterior queda como referencia solo en la base y admite NULL para las cuentas nuevas; la aplicación ya no lo usa.
3. Consulta la lista que devuelve el script. Puedes asignar al administrador `david` mediante el UPDATE comentado, reemplazando el ID y tenant por los valores reales. Para el resto del equipo, Administración permite cambiar el usuario. No ejecutes bootstrap para convertir una cuenta existente: ese programa crea otro estudio.
4. Despliega el backend actualizado y distribuye un instalador nuevo del frontend. El contrato de login ahora exige `username` y `password`; las versiones anteriores que envían `email` dejan de ser compatibles.

Las contraseñas nuevas y los cambios de contraseña admiten de 6 a 128 caracteres. Las contraseñas existentes se conservan.

Los usuarios tienen de 3 a 50 caracteres: letras sin tildes, números, punto, guion y guion bajo; comienzan con letra o número. Se guardan en minúsculas y se recortan los espacios exteriores. `David` y `david` identifican la misma cuenta. Los correos de contacto de los clientes siguen siendo correos.

La migración se preparó para revisión local; no se ejecutó contra Railway ni se verificó aún con MySQL. Si se interrumpe, revisa la estructura antes de continuar y no vuelvas a ejecutar el archivo completo.

Para cambiar el usuario de un administrador existente sin cambiar su contraseña ni crear otro estudio, usa el programa de mantenimiento (reemplazando el usuario actual):

```powershell
.\backend\venv\Scripts\python.exe backend/rename_admin.py --current-username "usuario.1" --username "Admin"
```

El cambio se registra en auditoría y se aplica únicamente a la cuenta administradora indicada. `Admin` se guarda como `admin` y ambas formas sirven para ingresar. El 8 de octubre de 2026 se cambió la cuenta administradora existente de `usuario.1` a `admin` en MySQL. No repitas ese comando con el nombre anterior.

### 4. Ejecutar API y frontend

Primera terminal, desde la raíz:

```powershell
.\backend\venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --reload --port 8000
```

Segunda terminal:

```powershell
Set-Location frontend
pnpm install
pnpm dev
```

Abre `http://localhost:1420`. La API ofrece documentación interactiva en `http://localhost:8000/docs` y salud del proceso en `/health`. Salud no prueba la conexión MySQL.

Para la aplicación de escritorio, con Rust y las herramientas C++ de compilación de Windows instaladas:

```powershell
pnpm tauri dev
pnpm tauri build
```

El instalador se genera bajo `frontend/src-tauri/target/release/bundle`. El 4 de octubre de 2026 se compiló el instalador Windows x64 `frontend/src-tauri/target/release/bundle/nsis/Lexio_0.1.0_x64-setup.exe` (aproximadamente 1,40 MiB), con la API de Railway configurada. Falta probar su instalación e inicio de sesión real. No está firmado digitalmente.

Para volver a generar únicamente el instalador `.exe`, desde `frontend`:

```powershell
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
pnpm tauri build --bundles nsis
```

Distribuye el archivo `Lexio_0.1.0_x64-setup.exe`. Cada usuario lo instala en Windows e ingresa con su propia cuenta; necesita internet, pero no Python, MySQL, Node ni el repositorio. El instalador puede descargar WebView2 si hace falta. Esta versión no tiene actualizaciones automáticas; para una nueva entrega aumenta la versión, compila y distribuye el nuevo instalador.

### 5. Railway y dirección de la API

Configura el directorio raíz del servicio API como `backend`, instala `requirements.txt` y usa como comando de inicio en Railway:

```sh
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Configura `DATABASE_URL`, `JWT_SECRET`, `JWT_MINUTES` y `CORS_ORIGINS` como variables del servicio. En Railway usa las credenciales y conectividad apropiadas de tu proyecto; en HeidiSQL se utiliza el host y puerto del TCP Proxy.

Antes de compilar la aplicación para tu papá, crea `frontend/.env`:

```dotenv
VITE_API_URL=https://lexio-production-bfce.up.railway.app
```

La URL se incorpora durante la compilación; si cambia, recompila. Si usas un dominio propio, añádelo también a `connect-src` en `frontend/src-tauri/tauri.conf.json`. Reinicia Vite al cambiar `.env`.

El 4 de octubre de 2026 se verificaron respuestas HTTP 200 de `/health` y `/openapi.json` en esa URL y CORS para `http://localhost:1420`. David confirmó que ejecutó el esquema de las 15 tablas; aún falta crear el administrador con `backend/bootstrap.py` y verificar un login real contra MySQL. La URL pública usa HTTPS sin añadir el puerto interno 8080.

## Flujo de uso

1. David entra con su usuario y contraseña. En Administración crea las cuentas de los abogados y concede permiso para registrar clientes o casos.
2. En Clientes busca por DNI, RUC o CE; los números son texto y conservan ceros iniciales. Crea el cliente y su caso sin repetir sus datos. El código visible es `CAS-000001` basado en el ID estable.
3. En Autorizaciones del caso asigna lectura o lectura y edición. El responsable debe tener acceso; antes de revocar, reasigna el caso y las tareas pendientes. David ve todos los casos de su estudio.
4. En Bitácora registra la fecha real del acto. El usuario, fecha y hora de registro se toman del servidor y se conservan al corregir. Una actuación puede originar varias tareas. Marca el posible evento de pago para que se cree un evento para revisión.
5. En Vencimientos registra responsable, fecha límite validada y estado. La aplicación no calcula plazos jurídicos. En Eventos distingue fecha programada y fecha efectiva de realización, emisión o notificación.
6. En Servicios y finanzas, David contrata cada alcance por separado. Las cuotas suman el honorario, con importes o porcentajes; el redondeo se ajusta en la última. Hay al menos una cuota por fecha para el cobro inicial.
7. Una cuota por evento necesita confirmación explícita de David. Reprogramar cambia la revisión del evento y devuelve las cuotas a revisión, conservando abonos. Una fecha programada genera avisos provisionales sin cumplir condiciones de realización, emisión o notificación.
8. Registra abonos anticipados o posteriores. Por defecto se aplican al saldo de la cuota 1 y luego a las siguientes por número; la distribución puede cambiarse activando Distribuir manualmente. El excedente de todas las cuotas queda como crédito sin aplicar. Reversar exige motivo y conserva el original. Concluir el caso no cancela deuda.
9. El panel y centro de alertas se actualizan al consultarse y cada minuto mientras están abiertos. Los avisos de −5, −3 y −1 usan lunes a viernes, sin feriados; el vencimiento original conserva sábado o domingo. Marcar leído descarta solo ese aviso. Marcar atendido completa la tarea procesal y retira todos sus avisos para el estudio; requiere permiso de edición. Las tareas pendientes después de la fecha límite reaparecen como urgentes, aunque el aviso de vencimiento haya sido leído, y no se pueden descartar con Leído. Los cobros solo se resuelven registrando pagos. Reprogramar o resolver cancela avisos anteriores; los nuevos se regeneran al consultar.
10. Los reportes operativos respetan los casos autorizados. Los económicos, la cartera, el estado de cuenta y los cobros son exclusivos de David. Se cuentan casos únicos y se suman cuotas y aplicaciones sin multiplicar totales por joins.

## Archivos y seguridad

- La gestión de enlaces a documentos externos está retirada del frontend y del backend.
- El token permanece en memoria del frontend; cerrar o recargar exige login. Contraseñas con Argon2, JWT HS256 con expiración, emisor y audiencia verificados; el rol se consulta desde la base.
- Las operaciones financieras bloquean el servicio durante su transacción, bajo aislamiento MySQL READ COMMITTED, antes de validar saldos y créditos. La concurrencia real de MySQL debe verificarse en un entorno de prueba antes de poner datos reales.
- No hay registro público ni selección libre de tenant. Otro estudio se provisiona mediante el programa de mantenimiento, no desde el frontend.

## Verificación

```powershell
.\backend\venv\Scripts\python.exe -m pytest backend/tests -q
Set-Location frontend
pnpm build
```

Se comprobaron 15 pruebas con SQLite temporal y claves foráneas activas: aislamiento tenant/caso, lectura y edición, exclusión financiera, conservación de ceros, validación de responsables, pagos parciales, reversiones, excedentes, aplicación de crédito, redondeo, reprogramación, avisos sin duplicados, casos concluidos con deuda y login. Se compiló React/TypeScript/Vite/Tailwind y se revisó la UI en navegador con una base temporal independiente de Railway.

El generador `backend/export_sql.py` produce el DDL MySQL sin abrir conexiones. David confirmó que ejecutó el esquema en HeidiSQL; falta validar su funcionamiento real con MySQL. Se generó el instalador Tauri, pero aún no se probó su instalación.

## Límites y próximos pasos

- Los cortes económicos usan contrataciones y abonos hasta la fecha seleccionada, con las **condiciones de evento y reversiones vigentes actualmente**. No reconstruyen una fotografía histórica de todas las revisiones; la pantalla lo indica. Para estados históricos completos se necesitan versiones efectivas de condiciones y aplicaciones.
- Reportes seleccionan cliente por documento y nombre, caso y servicio; pueden consolidar todos los casos del cliente. El reporte operativo distingue fecha de inicio, actuación o vencimiento. No incluye exportación de archivos en esta entrega.
- El panel muestra tareas pendientes y eventos programados para hoy. Los eventos registrados generan revisión para David, incluso antes de asociarlos a una cuota; marcar un evento revisado no confirma su efecto económico en cuotas.
- La primera entrega no incluye facturación tributaria, cálculo jurídico de plazos, WhatsApp, feriados ni módulo tributario especializado, conforme al alcance del documento.
- Antes del uso real: probar MySQL y Railway, configurar respaldos y protección de intentos de login, probar `.exe` y realizar aceptación con David y los abogados.
- Para comercializar SaaS: migraciones incrementales, pruebas de concurrencia MySQL, límites/paginación, bloqueo de intentos de login distribuido, recuperación de cuentas, almacenamiento privado y automatización de despliegues. El esquema inicial SQL no sustituye un sistema de migraciones.

Referencias técnicas utilizadas: [JWT y Argon2 en FastAPI](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/), [claves foráneas compuestas de SQLAlchemy](https://docs.sqlalchemy.org/en/20/core/constraints.html), [Tailwind con Vite](https://tailwindcss.com/docs/installation/using-vite).

## Actualización de alertas del 8 de octubre de 2026

- Tres anticipaciones configurables (por defecto 5, 3 y 1 días hábiles). La configuración del estudio tenant 1 se actualizó directamente en MySQL y quedó auditada.
- `POST /alerts/{id}/read` descarta el aviso del usuario actual; los siguientes avisos se mantienen. El vencimiento no cambia y el día posterior reaparece como urgente si continúa pendiente. Un aviso urgente requiere resolver la obligación.
- `POST /alerts/{id}/attend` completa únicamente tareas procesales, con estado `atendido`, y cancela sus avisos para todos los destinatarios del mismo estudio. Valida tenant, destinatario, permiso edit y fecha vigente; rechaza avisos de una tarea reprogramada. El formulario de tarea también permite elegir Atendido.
- Cobros: sin botón Atendido; se resuelven mediante pagos. Los avisos provisionales de eventos siguen siendo provisionales y no pasan a urgentes por una fecha programada sin confirmación financiera.
- Se acepta el estado anterior `atendida` en peticiones y registros existentes, mostrándolo como `atendido`; no se necesita alterar el esquema ni convertir datos anteriores.
- Para activar los botones, lectura y urgencia: subir el backend y actualizar el frontend. No se desplegó el backend ni se regeneró el instalador en esta revisión.
- Verificación local: 32 pruebas backend y 18 frontend aprobadas, además de compilación TypeScript/Vite.

## Datos de prueba hasta el 15 de octubre de 2026

El lote `DEMO-20261008` se cargó y verificó en MySQL para el estudio tenant 1 el 8 de octubre, a pedido de David. Busca `[PRUEBA OCTUBRE]` en Clientes y Casos. Incluye tareas vencidas, pendientes hasta el día 15, atendidas y canceladas; dos eventos programados; servicios con cuotas pagadas, parciales y pendientes. Los pagos y honorarios son ficticios, aunque se incluyen en los reportes junto con los registros del estudio.

`backend/seed_demo.py` muestra el plan sin conectar a la base cuando se omite `--apply`. La carga exige tenant y administrador explícitos, es atómica y auditada y rechaza repetir el mismo lote. El manifiesto `database/demo_20261008_manifest.json` conserva sus IDs para futuras gestiones. No volver a cargarlo ni ejecutar el esquema inicial.

## Retiro de enlaces a documentos externos al 8 de octubre de 2026

Se retiraron los botones, pestañas, formularios, servicios y rutas REST para registrar, listar y abrir enlaces de archivos de clientes y casos, junto con el modelo y contrato de esos enlaces. Se eliminó el complemento de apertura de enlaces del frontend y de Tauri, incluidos sus permisos y dependencias.

La tabla previa `lexio_files`, si existe en MySQL, queda sin uso por el programa; no se borraron registros históricos ni archivos externos. El esquema inicial nuevo tiene 14 tablas. No ejecutar el esquema inicial sobre la base existente. No hay cambio automático del esquema en el arranque. Para activar el retiro se necesita desplegar el backend y actualizar el frontend.

## Ramas jurídicas

Las ramas se seleccionan de un catálogo fijo de once valores en casos y reportes: Civil, Penal, Laboral, Tributario, Derecho corporativo, Constitucional, Familia, Familia – Civil, Administrativo, Conciliación extrajudicial y Fiscalía. La API aplica la misma validación en altas, ediciones y filtros. Las ramas anteriores fuera de catálogo requieren elegir una opción válida al editar la ficha; no se reclasifican registros existentes automáticamente.

## Aplicación automática de abonos

Registrar abono muestra la distribución al escribir el importe. Se cubre la primera cuota con saldo según su número, después la siguiente, sin depender de sus fechas ni de si corresponden a un evento futuro. Los saldos y condiciones de eventos siguen siendo independientes: pagar no confirma un evento.

La API aplica automáticamente cuando `applications` se omite o es null, recalculando los saldos dentro del bloqueo transaccional del servicio con Decimal. Una lista explícita representa la distribución manual; una lista vacía conserva todo como crédito por elección manual. El frontend calcula la vista previa con centavos enteros. Distribuir manualmente permite editar la propuesta sin que posteriores cambios del importe sobrescriban la distribución elegida.

El 8 de octubre de 2026, con autorización de David, se aplicó el abono existente ID 4 de S/ 400 a la cuota 1 (ID 6) de Revisión de documentos, servicio 4, tenant 1. Se verificó saldo S/ 100 y crédito sin aplicar S/ 0, sin crear otro pago. El cambio quedó auditado. La regla automática para pagos nuevos aún requiere desplegar el backend y actualizar el frontend.
