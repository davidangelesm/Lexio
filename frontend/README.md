# Frontend de Lexio

Aplicación de escritorio con Tauri, React y TypeScript. La interfaz se comunica únicamente con FastAPI por HTTP(S).

## Estructura

- **src/app/**: composición de la aplicación y selección de páginas.
- **src/components/ui/**: componentes compartidos de presentación y formularios (Card, Badge, Empty, Field, Form y Modal).
- **src/components/layout/**: estructura visual de navegación, perfil y encabezado.
- **src/features/**: módulos de autenticación, panel, clientes, casos, alertas, administración y reportes. Cada módulo reúne sus páginas y, cuando corresponde, sus componentes, formularios, hooks y modelos.
- **src/hooks/**: coordinación general de sesión, navegación y carga de las páginas mediante useLexio.
- **src/services/**: cliente HTTP y operaciones de FastAPI por dominio. El servicio de archivos concentra la apertura en Tauri y en el navegador.
- **src/types/**: contratos de datos por dominio y entradas tipadas de los servicios en requests.ts.
- **src/utils/**: conversión de formularios, parámetros de consulta y formato de fechas e importes.
- **src/styles/**: estilos globales de Lexio y Tailwind.
- **tests/**: regresiones locales del cliente HTTP, servicios y renderizado de componentes.
- **src-tauri/**: contenedor e instalador para Windows.

## Criterios de mantenimiento

Las páginas componen vistas; los hooks conservan estado, efectos y acciones de coordinación; los servicios conocen rutas, métodos y contratos de la API. Los formularios convierten FormData y llaman al servicio correspondiente. Los componentes compartidos no conocen endpoints ni reglas de un módulo específico.

Para añadir una pantalla, ubícala en el módulo correspondiente de features. Extrae un componente a components/ui únicamente cuando sea reutilizable y ajeno al dominio. Mantén las llamadas fetch en services/http.ts y las rutas de negocio en su servicio. Evita crear capas, clases o interfaces que no tengan una responsabilidad concreta.

Las propiedades de las vistas usan selecciones tipadas del estado de sus hooks (imports de tipos, sin dependencia en ejecución). Esto mantiene contratos coherentes sin replicar manualmente los tipos de los setters y callbacks.

El JWT permanece en memoria. El backend valida permisos y tenant; el frontend no envía tenant_id para establecer identidad. La ocultación financiera en la interfaz complementa la autorización del servidor. Los importes se envían como cadenas decimales. Las fechas de presentación conservan la zona America/Lima.

## Ejecución y validación

Desde frontend:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
pnpm exec prettier --check src tests package.json
```

Las pruebas usan el ejecutor de Node y el TypeScript ya instalado: no agregan dependencias. El cargador de tests transpila TS/TSX y sustituye únicamente en el entorno de pruebas la configuración de Vite por un dominio ficticio. Todas las peticiones se simulan; pnpm test no accede a Railway, MySQL ni Drive. pnpm build ejecuta la comprobación estricta de TypeScript y genera dist.

La configuración de la API sigue en la variable VITE_API_URL. Consulta el README de la raíz para el despliegue y la generación del instalador. Compilar el frontend no actualiza el instalador existente.
