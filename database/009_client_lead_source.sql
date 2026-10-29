-- Revisar y aplicar una sola vez antes de desplegar el backend compatible.
-- Agrega origen de captación en clientes (Instagram, Facebook, Tiktok, Web, Referido, Volantes, Otro).
-- MySQL confirma DDL automáticamente; no ejecutar al arrancar FastAPI.
-- Una base nueva usa 001_lexio_schema.sql y no necesita esta migración.
SHOW CREATE TABLE lexio_clients;

ALTER TABLE lexio_clients
    ADD COLUMN lead_source VARCHAR(30) NOT NULL DEFAULT 'Sin atribución' AFTER address;

SHOW CREATE TABLE lexio_clients;

