# Frontend de Lexio

Aplicación Tauri, React y TypeScript con Inicio, Clientes, Casos, Alertas y Reportes. La ficha integral define los datos de entrada: Clientes registra los datos personales; Casos selecciona un cliente existente y registra proceso y finanzas. Cada cliente puede tener varios casos y la bitácora está dentro del caso. Inicio reúne alertas y cobros próximos, sin imponer una secuencia de módulos. Administración reúne usuarios e historial legible del estudio.

- `src/app` y `src/hooks`: sesión, navegación y composición.
- `src/features`: pantallas, formularios y reglas de presentación de cada módulo.
- `src/components`: controles y estructura visual compartidos.
- `src/services`: cliente HTTP y rutas de FastAPI; ninguna conexión directa con MySQL.
- `src/types`: contratos tipados.
- `src/utils` y `src/styles`: formato de fechas de Lima, importes y estilos.
- `tests`: pruebas locales de servicios y renderizado con API simulada.
- `src-tauri`: aplicación e instalador Windows.

Los botones de acción tienen fondo o borde visible. Los importes se transmiten como cadenas decimales. El JWT permanece en memoria. La ocultación financiera en la pantalla complementa las autorizaciones que valida el servidor.

La bitácora permite registrar y editar fecha, descripción y fecha de alerta desde el caso. Editar conserva el responsable, el registro original y el estado Atendido. El backend valida el permiso de edición, registra la corrección en auditoría y actualiza los avisos cuando cambia el vencimiento.

Desde esta carpeta:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
pnpm tauri build --bundles nsis
```

La configuración de API se toma de `VITE_API_URL`; reinicia Vite al cambiarla. La compilación web no actualiza por sí sola el instalador. Consulta el README de la raíz para actualizar el esquema y desplegar el backend compatible.
