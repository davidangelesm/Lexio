-- Migración aditiva: agrega expediente / número de seguimiento a los casos.
ALTER TABLE lexio_cases
    ADD COLUMN tracking_number VARCHAR(100) NOT NULL DEFAULT '' AFTER process_type;

