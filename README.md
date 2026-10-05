# Lexio · Control jurídico y gerencial

Aplicación de escritorio Tauri 2, React, TypeScript y Tailwind CSS, conectada por HTTP(S) a FastAPI. MySQL se usa exclusivamente desde el backend mediante SQLAlchemy y PyMySQL.

La primera versión implementa el flujo de `LEXCONTERRA_flujograma.txt`: clientes, casos, autorizaciones, bitácora, tareas procesales, enlaces de documentos, servicios contratados, cuotas, eventos, abonos y aplicaciones, reversiones, centro de alertas y reportes. El documento se utiliza como especificación del producto, no como instrucciones para ejecutar acciones en cuentas externas.

## Iniciar con tu base de Railway

### 1. Crear las tablas en HeidiSQL

1. Abre la conexión MySQL de Railway y selecciona la base de datos que usarás con Lexio.
2. Revisa y ejecuta **`database/001_lexio_schema.sql`** una sola vez. Requiere MySQL 8.0.16 o posterior. Son 15 tablas con prefijo `lexio_`; todas incluyen `tenant_id`, incluso tablas puente, avisos y auditoría. `lexio_tenants.tenant_id` es la identidad del estudio.
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

**Después** de ejecutar el SQL y configurar `.env`, ejecuta, reemplazando el correo de ejemplo:

```powershell
.\backend\venv\Scripts\python.exe backend/bootstrap.py --name "Lexconterra Group" --email "tu-correo@ejemplo.pe" --admin-name "David"
```

El programa pide la contraseña dos veces, sin mostrarla ni guardarla en el historial. Crea el estudio, un administrador y el registro de auditoría en una transacción. No hay contraseñas predeterminadas de producción. No se ejecutó este programa contra tu base.

Los correos de acceso son únicos globalmente para identificar el estudio durante el login sin aceptar `tenant_id` desde el cliente. Después de autenticar, todas las operaciones de negocio usan el tenant del JWT validado y vuelven a comprobar que el usuario siga activo.

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

1. David entra con su correo y contraseña. En Administración crea las cuentas de los abogados y concede permiso para registrar clientes o casos.
2. En Clientes busca por DNI, RUC o CE; los números son texto y conservan ceros iniciales. Crea el cliente y su caso sin repetir sus datos. El código visible es `CAS-000001` basado en el ID estable.
3. En Autorizaciones del caso asigna lectura o lectura y edición. El responsable debe tener acceso; antes de revocar, reasigna el caso y las tareas pendientes. David ve todos los casos de su estudio.
4. En Bitácora registra la fecha real del acto. El usuario, fecha y hora de registro se toman del servidor y se conservan al corregir. Una actuación puede originar varias tareas. Marca el posible evento de pago para que se cree un evento para revisión.
5. En Vencimientos registra responsable, fecha límite validada y estado. La aplicación no calcula plazos jurídicos. En Eventos distingue fecha programada y fecha efectiva de realización, emisión o notificación.
6. En Servicios y finanzas, David contrata cada alcance por separado. Las cuotas suman el honorario, con importes o porcentajes; el redondeo se ajusta en la última. Hay al menos una cuota por fecha para el cobro inicial.
7. Una cuota por evento necesita confirmación explícita de David. Reprogramar cambia la revisión del evento y devuelve las cuotas a revisión, conservando abonos. Una fecha programada genera avisos provisionales sin cumplir condiciones de realización, emisión o notificación.
8. Registra abonos anticipados o posteriores. Distribúyelos entre cuotas del mismo servicio; el resto queda como crédito sin aplicar. Reversar exige motivo y conserva el original. Concluir el caso no cancela deuda.
9. El panel y centro de alertas se actualizan al consultarse y cada minuto mientras están abiertos. Los avisos de −3 y −1 usan lunes a viernes, sin feriados; el vencimiento original conserva sábado o domingo. Leer no resuelve una obligación. Reprogramar o resolver cancela avisos anteriores; los nuevos se regeneran al consultar.
10. Los reportes operativos respetan los casos autorizados. Los económicos, la cartera, el estado de cuenta y los cobros son exclusivos de David. Se cuentan casos únicos y se suman cuotas y aplicaciones sin multiplicar totales por joins.

## Archivos y seguridad

- Se registran enlaces HTTPS a documentos del caso o generales del cliente. La API comprueba permisos antes de devolver el enlace. No hay carga ni descarga proxy de PDFs todavía.
- **Un enlace de Drive ya conocido se rige por los permisos de Drive.** Lexio no revoca ni configura el acceso externo: usa enlaces privados y comparte cada documento solo con sus usuarios autorizados. Para garantizar revocación desde Lexio hace falta integrar almacenamiento privado y descarga autenticada.
- El token permanece en memoria del frontend; cerrar o recargar exige login. Contraseñas con Argon2, JWT HS256 con expiración, emisor y audiencia verificados; el rol se consulta desde la base.
- Las operaciones financieras bloquean el servicio durante su transacción, bajo aislamiento MySQL READ COMMITTED, antes de validar saldos y créditos. La concurrencia real de MySQL debe verificarse en un entorno de prueba antes de poner datos reales.
- No hay registro público ni selección libre de tenant. Otro estudio se provisiona mediante el programa de mantenimiento, no desde el frontend.

## Verificación

```powershell
.\backend\venv\Scripts\python.exe -m pytest backend/tests -q
Set-Location frontend
pnpm build
```

Se comprobaron 15 pruebas con SQLite temporal y claves foráneas activas: aislamiento tenant/caso, lectura y edición, exclusión financiera, archivos restringidos, conservación de ceros, validación de responsables, pagos parciales, reversiones, excedentes, aplicación de crédito, redondeo, reprogramación, avisos sin duplicados, casos concluidos con deuda y login. Se compiló React/TypeScript/Vite/Tailwind y se revisó la UI en navegador con una base temporal independiente de Railway.

El generador `backend/export_sql.py` produce el DDL MySQL sin abrir conexiones. David confirmó que ejecutó el esquema en HeidiSQL; falta validar su funcionamiento real con MySQL. Se generó el instalador Tauri, pero aún no se probó su instalación.

## Límites y próximos pasos

- Los cortes económicos usan contrataciones y abonos hasta la fecha seleccionada, con las **condiciones de evento y reversiones vigentes actualmente**. No reconstruyen una fotografía histórica de todas las revisiones; la pantalla lo indica. Para estados históricos completos se necesitan versiones efectivas de condiciones y aplicaciones.
- Reportes seleccionan cliente por documento y nombre, caso y servicio; pueden consolidar todos los casos del cliente. El reporte operativo distingue fecha de inicio, actuación o vencimiento. No incluye exportación de archivos en esta entrega.
- El panel muestra tareas pendientes y eventos programados para hoy. Los eventos registrados generan revisión para David, incluso antes de asociarlos a una cuota; marcar un evento revisado no confirma su efecto económico en cuotas.
- La primera entrega no incluye facturación tributaria, cálculo jurídico de plazos, WhatsApp, feriados ni módulo tributario especializado, conforme al alcance del documento.
- Antes del uso real: probar MySQL y Railway, validar permisos de Drive, configurar respaldos y protección de intentos de login, probar `.exe` y realizar aceptación con David y los abogados.
- Para comercializar SaaS: migraciones incrementales, pruebas de concurrencia MySQL, límites/paginación, bloqueo de intentos de login distribuido, recuperación de cuentas, almacenamiento privado y automatización de despliegues. El esquema inicial SQL no sustituye un sistema de migraciones.

Referencias técnicas utilizadas: [JWT y Argon2 en FastAPI](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/), [claves foráneas compuestas de SQLAlchemy](https://docs.sqlalchemy.org/en/20/core/constraints.html), [Tailwind con Vite](https://tailwindcss.com/docs/installation/using-vite).
