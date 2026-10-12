-- Revisar y ejecutar una sola vez en MySQL 8.0.16 o posterior, antes de
-- desplegar la API que admite Retirado. Pausar las escrituras durante el cambio.
-- Conserva todos los registros y relaciones; MySQL confirma DDL automáticamente.
-- No usar reset_demo_schema.py ni ejecutar esta migración al arrancar FastAPI.
-- Para una base nueva, 001_lexio_schema.sql ya incluye este estado.

SHOW CREATE TABLE lexio_cases;

ALTER TABLE lexio_cases
    DROP CHECK ck_case_status,
    ADD CONSTRAINT ck_case_status CHECK (status IN ('activo', 'concluido', 'retirado'));

SHOW CREATE TABLE lexio_cases;
