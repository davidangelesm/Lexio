-- Lexio: asunto y tipo de asunto en la bitacora.
-- Ejecutar una sola vez en la base existente, antes del backend compatible.
-- Requiere que subject, subject_type y ck_entry_subject_type no existan.
-- Pausar escrituras de la aplicacion durante la ejecucion.
-- Conserva registros y descripciones. MySQL confirma el DDL automaticamente.

ALTER TABLE lexio_entries
    ADD COLUMN subject VARCHAR(150) NULL,
    ADD COLUMN subject_type VARCHAR(20) NOT NULL DEFAULT 'legal';

UPDATE lexio_entries
SET subject = COALESCE(
    NULLIF(LEFT(TRIM(description), 150), ''),
    'Actuación registrada'
)
WHERE subject IS NULL OR TRIM(subject) = '';

ALTER TABLE lexio_entries
    MODIFY COLUMN subject VARCHAR(150) NOT NULL,
    ADD CONSTRAINT ck_entry_subject_type
        CHECK (subject_type IN ('legal', 'otro'));

-- Comprobar las columnas despues de aplicar el cambio.
SHOW COLUMNS FROM lexio_entries;
