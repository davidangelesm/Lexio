# Catálogo de ramas en MySQL

Las ramas se leen de `lexio_legal_areas`; cada estudio tiene su propio catálogo.
Los casos guardan `area_id` y muestran el nombre actual de esa fila. Corregir una
rama con `UPDATE` cambia el nombre mostrado en sus casos y reportes, conservando
su ID y sus relaciones. No hay una lista fija de ramas en la aplicación.

## Migración de una base existente

Después de revisión humana, ejecutar
[`004_legal_areas.sql`](004_legal_areas.sql) una sola vez en la base correcta de
MySQL 8.0.16 o posterior, con las escrituras de la API pausadas. Está preparado
para el esquema que todavía contiene `lexio_cases.area` y no tiene el catálogo
ni `area_id`. La migración de asuntos de bitácora es independiente.

Revisar cada bloque y detenerse ante un error. Las consultas antes del último
`ALTER` deben devolver cero filas. El resultado final debe mostrar el mismo
número de casos y `casos_sin_rama = 0`. El script conserva los registros de todos
los estudios, crea sus once ramas iniciales y agrega cualquier nombre utilizado
en casos anteriores. Después relaciona los casos por ID dentro del mismo estudio.
Las mayúsculas y acentos se distinguen mediante `utf8mb4_bin` para conservar los
nombres existentes.

MySQL confirma el DDL automáticamente. Si el proceso se interrumpe, revisar
`SHOW CREATE TABLE lexio_legal_areas` y `SHOW CREATE TABLE lexio_cases` antes de
continuar; no repetir el archivo completo. Una vez verificado el resultado,
desplegar el backend compatible y reanudar las escrituras. La API no crea tablas
ni inserta ramas al arrancar. Este cambio de código no ejecutó la migración.

Para una base vacía, usar `001_lexio_schema.sql`, que ya incluye el catálogo.
Después de crear el estudio, insertar sus ramas siguiendo los ejemplos de abajo.
No ejecutar la migración `004` sobre ese esquema nuevo.

## Consultar, agregar y corregir ramas

Primero identificar el estudio real:

```sql
SELECT tenant_id, name FROM lexio_tenants ORDER BY tenant_id;
```

Seleccionar su `tenant_id` reemplazando `ID_REAL_DEL_ESTUDIO` por el número
obtenido. Los marcadores de estos ejemplos deben reemplazarse antes de ejecutar.

```sql
SET @lexio_tenant_id = ID_REAL_DEL_ESTUDIO;

SELECT id, name
FROM lexio_legal_areas
WHERE tenant_id = @lexio_tenant_id
ORDER BY name;

INSERT INTO lexio_legal_areas (tenant_id, name)
VALUES (@lexio_tenant_id, 'Nueva rama');
```

No es necesario proporcionar `created_at`. El nombre debe tener entre 1 y 80
caracteres y ser único para ese estudio. Elegir el ID real de la rama a corregir:

```sql
UPDATE lexio_legal_areas
SET name = 'Nombre corregido'
WHERE tenant_id = @lexio_tenant_id AND id = ID_REAL_DE_LA_RAMA;
```

Usar siempre el estudio y el ID en el `WHERE`. La relación impide eliminar una
rama usada por casos, incluidos los concluidos. Para corregir nombres, usar
`UPDATE` conservando el ID. El catálogo de otro estudio no cambia.

Tras modificar MySQL, usar Buscar en Casos o entrar nuevamente en una página
para cargar el catálogo antes de abrir un formulario. Abrir nuevamente un caso
también consulta el catálogo actualizado. Si ya se tiene un formulario abierto,
cerrarlo y volver a cargar los datos antes de abrirlo de nuevo.
