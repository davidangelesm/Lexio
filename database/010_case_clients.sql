-- Revisar y aplicar una sola vez antes de desplegar el backend compatible.
-- Permite vincular múltiples clientes a un mismo caso manteniendo aislamiento por tenant.
-- MySQL confirma DDL automáticamente; no ejecutar al arrancar FastAPI.
-- Una base nueva usa 001_lexio_schema.sql y no necesita esta migración.

CREATE TABLE lexio_case_clients (
	case_id INTEGER NOT NULL,
	client_id INTEGER NOT NULL,
	id INTEGER NOT NULL AUTO_INCREMENT,
	tenant_id INTEGER NOT NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	CONSTRAINT uq_case_client_tenant_id UNIQUE (tenant_id, id),
	CONSTRAINT uq_case_client_pair UNIQUE (tenant_id, case_id, client_id),
	FOREIGN KEY(tenant_id, case_id) REFERENCES lexio_cases (tenant_id, id),
	FOREIGN KEY(tenant_id, client_id) REFERENCES lexio_clients (tenant_id, id),
	FOREIGN KEY(tenant_id) REFERENCES lexio_tenants (tenant_id)
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_lexio_case_clients_tenant_id ON lexio_case_clients (tenant_id);

-- Migra los vínculos actuales de lexio_cases.client_id sin duplicar registros.
INSERT IGNORE INTO lexio_case_clients (case_id, client_id, tenant_id, created_at)
SELECT id, client_id, tenant_id, created_at FROM lexio_cases;

SHOW CREATE TABLE lexio_case_clients;

