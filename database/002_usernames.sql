-- Lexio: actualización de cuentas existentes a usuario y contraseña.
-- Ejecutar una sola vez en MySQL 8.0.16+, con la API detenida y respaldo previo.
-- No ejecutar 001_lexio_schema.sql sobre una base existente.
-- DDL MySQL hace COMMIT implícito; no se revierte con ROLLBACK.
-- Si la ejecución se interrumpe, revisar SHOW CREATE TABLE lexio_users
-- antes de continuar: no volver a ejecutar el archivo completo.
SET NAMES utf8mb4;

ALTER TABLE lexio_users ADD COLUMN username VARCHAR(50) NULL;

-- El ID global evita colisiones incluso entre estudios.
-- Conserva las contraseñas, IDs, tenants, roles, permisos y relaciones.
UPDATE lexio_users SET username = CONCAT('usuario.', id);

ALTER TABLE lexio_users
    MODIFY COLUMN username VARCHAR(50) NOT NULL,
    ADD CONSTRAINT uq_lexio_users_username UNIQUE (username),
    MODIFY COLUMN email VARCHAR(254) NULL;

-- email queda solo como referencia de las cuentas anteriores.
-- La API ya no lo lee ni escribe; las cuentas nuevas dejan NULL.
-- Consultar los nombres de acceso antes de volver a iniciar la API:
SELECT id, tenant_id, name, username FROM lexio_users ORDER BY id;

-- Opcional: asignar un nombre más cómodo al administrador, usando su ID real.
-- UPDATE lexio_users SET username = 'david' WHERE id = <ID_REAL> AND tenant_id = <TENANT_REAL>;
-- Usar 3 a 50 caracteres en minúsculas: letras ASCII, números, punto, guion
-- o guion bajo; comenzar con letra o número. Debe ser único globalmente.
