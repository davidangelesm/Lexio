-- Revisar y aplicar una sola vez antes de desplegar el backend compatible.
-- Agrega hora opcional asociada a la fecha de alerta/audiencia en actuaciones.
-- MySQL confirma DDL automáticamente; no ejecutar al arrancar FastAPI.
-- Una base nueva usa 001_lexio_schema.sql y no necesita esta migración.
SHOW CREATE TABLE lexio_entries;

ALTER TABLE lexio_entries
    ADD COLUMN alert_time VARCHAR(5) NULL AFTER alert_date,
    ADD CONSTRAINT ck_entry_alert_time CHECK (alert_time IS NULL OR alert_date IS NOT NULL);

SHOW CREATE TABLE lexio_entries;

