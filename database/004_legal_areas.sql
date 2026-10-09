-- Lexio: catálogo de ramas editable directamente en MySQL 8.0.16+.
-- Ejecutar una sola vez sobre la base existente con lexio_cases.area.
-- lexio_legal_areas y lexio_cases.area_id aún no deben existir.
-- Revisar cada bloque y detenerse ante cualquier error; no usar ejecución forzada.
-- Pausar escrituras de la API hasta desplegar el backend compatible.
-- Conserva casos, clientes, cuentas, honorarios y relaciones de todos los estudios.
-- MySQL hace COMMIT implícito del DDL; no se revierte con ROLLBACK.
-- Si se interrumpe, revisar las tablas antes de continuar, sin repetir todo el archivo.

SET NAMES utf8mb4;

SET @lexio_cases_before = (SELECT COUNT(*) FROM lexio_cases);

-- Comprobar que no hay nombres vacíos antes de crear el catálogo.
-- Esta consulta debe devolver cero filas.
SELECT id, tenant_id, area
FROM lexio_cases
WHERE area IS NULL OR length(trim(area)) = 0;

CREATE TABLE lexio_legal_areas (
    name VARCHAR(80) COLLATE utf8mb4_bin NOT NULL,
    id INTEGER NOT NULL AUTO_INCREMENT,
    tenant_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uq_legal_area_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_legal_area_name UNIQUE (tenant_id, name),
    CONSTRAINT ck_legal_area_name CHECK (length(trim(name)) > 0),
    FOREIGN KEY (tenant_id) REFERENCES lexio_tenants (tenant_id)
) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_lexio_legal_areas_tenant_id ON lexio_legal_areas (tenant_id);

-- Las once ramas iniciales se insertan una vez por cada estudio existente.
-- La aplicación leerá la tabla; esta lista solo prepara el catálogo inicial.
INSERT INTO lexio_legal_areas (tenant_id, name)
SELECT t.tenant_id, initial.name
FROM lexio_tenants AS t
CROSS JOIN (
    SELECT _utf8mb4'Civil' COLLATE utf8mb4_bin AS name
    UNION ALL SELECT _utf8mb4'Penal'
    UNION ALL SELECT _utf8mb4'Laboral'
    UNION ALL SELECT _utf8mb4'Tributario'
    UNION ALL SELECT _utf8mb4'Derecho corporativo'
    UNION ALL SELECT _utf8mb4'Constitucional'
    UNION ALL SELECT _utf8mb4'Familia'
    UNION ALL SELECT _utf8mb4'Familia – Civil'
    UNION ALL SELECT _utf8mb4'Administrativo'
    UNION ALL SELECT _utf8mb4'Conciliación extrajudicial'
    UNION ALL SELECT _utf8mb4'Fiscalía'
) AS initial;

-- Conservar también ramas anteriores que no formen parte de esa lista.
-- utf8mb4_bin distingue mayúsculas y acentos; no fusiona nombres diferentes.
INSERT INTO lexio_legal_areas (tenant_id, name)
SELECT DISTINCT c.tenant_id, c.area COLLATE utf8mb4_bin
FROM lexio_cases AS c
WHERE NOT EXISTS (
    SELECT 1 FROM lexio_legal_areas AS a
    WHERE a.tenant_id = c.tenant_id
      AND a.name = c.area COLLATE utf8mb4_bin
);

ALTER TABLE lexio_cases ADD COLUMN area_id INTEGER NULL;

UPDATE lexio_cases AS c
JOIN lexio_legal_areas AS a
  ON a.tenant_id = c.tenant_id
 AND a.name = c.area COLLATE utf8mb4_bin
SET c.area_id = a.id;

-- Verificar antes del último ALTER: debe devolver cero filas.
SELECT c.id, c.tenant_id, c.area, c.area_id
FROM lexio_cases AS c
LEFT JOIN lexio_legal_areas AS a
  ON a.tenant_id = c.tenant_id AND a.id = c.area_id
WHERE a.id IS NULL OR a.name <> c.area COLLATE utf8mb4_bin;

-- Un solo ALTER cambia la relación y retira la copia anterior del nombre.
-- La FK exige que cada caso tenga una rama del mismo estudio.
ALTER TABLE lexio_cases
    MODIFY COLUMN area_id INTEGER NOT NULL,
    ADD CONSTRAINT fk_case_legal_area
        FOREIGN KEY (tenant_id, area_id)
        REFERENCES lexio_legal_areas (tenant_id, id) ON DELETE RESTRICT,
    DROP COLUMN area;

-- Comprobar mismo número de casos y ausencia de relaciones sin catálogo.
SELECT @lexio_cases_before AS casos_antes, COUNT(*) AS casos_despues
FROM lexio_cases;

SELECT COUNT(*) AS casos_sin_rama
FROM lexio_cases AS c
LEFT JOIN lexio_legal_areas AS a
  ON a.tenant_id = c.tenant_id AND a.id = c.area_id
WHERE a.id IS NULL;

SELECT tenant_id, id, name FROM lexio_legal_areas ORDER BY tenant_id, name;
