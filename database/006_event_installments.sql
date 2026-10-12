-- Revisar y ejecutar una sola vez en MySQL 8.0.16 o posterior, antes de
-- desplegar el backend compatible. Pausar las escrituras durante la migración.
-- Conserva cuotas, abonos, actuaciones y cuentas. MySQL confirma DDL
-- automáticamente: ante un error, revisar SHOW CREATE TABLE antes de continuar.
-- No ejecutar al arrancar FastAPI ni usar reset_demo_schema.py.
-- Una base nueva usa 001_lexio_schema.sql y no requiere este archivo.

SHOW CREATE TABLE lexio_installments;
SHOW CREATE TABLE lexio_entries;

ALTER TABLE lexio_installments
    MODIFY due_date DATE NULL,
    ADD COLUMN event_name VARCHAR(150) NULL,
    ADD COLUMN activated_at DATETIME NULL,
    ADD CONSTRAINT uq_installment_tenant_case_id UNIQUE (tenant_id, case_id, id),
    ADD CONSTRAINT ck_installment_trigger CHECK (
        (event_name IS NULL AND due_date IS NOT NULL AND activated_at IS NULL)
        OR (event_name IS NOT NULL AND LENGTH(TRIM(event_name)) > 0 AND (
            (activated_at IS NULL AND due_date IS NULL)
            OR (activated_at IS NOT NULL AND due_date IS NOT NULL)
        ))
    );

ALTER TABLE lexio_entries
    ADD COLUMN payment_installment_id INTEGER NULL,
    ADD CONSTRAINT uq_entry_payment_installment UNIQUE (tenant_id, payment_installment_id),
    ADD CONSTRAINT fk_entry_payment_installment
        FOREIGN KEY (tenant_id, case_id, payment_installment_id)
        REFERENCES lexio_installments (tenant_id, case_id, id) ON DELETE RESTRICT;

SHOW CREATE TABLE lexio_installments;
SHOW CREATE TABLE lexio_entries;
