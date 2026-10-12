-- Revisar y aplicar una sola vez antes de desplegar el backend compatible.
-- Conserva registros, cuotas, abonos, vínculos y cuentas. Pausar escrituras.
-- MySQL confirma DDL automáticamente; no ejecutar al arrancar FastAPI.
-- Una base nueva usa 001_lexio_schema.sql y no necesita esta migración.
SHOW CREATE TABLE lexio_installments;

ALTER TABLE lexio_installments
    ADD COLUMN uncollectible_reason VARCHAR(500) NULL,
    ADD COLUMN uncollectible_at DATETIME NULL;

SHOW CREATE TABLE lexio_installments;
