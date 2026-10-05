-- Lexio: esquema inicial MySQL 8.0.16+ / InnoDB.

-- Selecciona en HeidiSQL la base de datos de Railway antes de ejecutar.

-- Esquema completo: crea las 15 tablas de Lexio desde cero, incluida clientes (lexio_clients).

-- Ejecutar una sola vez en la base vacía seleccionada. No requiere tablas anteriores.

-- DDL MySQL hace COMMIT implícito: no es reversible mediante ROLLBACK.

SET NAMES utf8mb4;

CREATE TABLE lexio_tenants (
	tenant_id INTEGER NOT NULL AUTO_INCREMENT, 
	name VARCHAR(150) NOT NULL, 
	notice_days VARCHAR(30) NOT NULL, 
	PRIMARY KEY (tenant_id)
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE lexio_clients (
	document_type VARCHAR(5) NOT NULL, 
	document_number VARCHAR(20) NOT NULL, 
	name VARCHAR(180) NOT NULL, 
	phone VARCHAR(30) NOT NULL, 
	email VARCHAR(254) NOT NULL, 
	address VARCHAR(250) NOT NULL, 
	id INTEGER NOT NULL AUTO_INCREMENT, 
	tenant_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (tenant_id, id), 
	UNIQUE (tenant_id, document_type, document_number), 
	FOREIGN KEY(tenant_id) REFERENCES lexio_tenants (tenant_id)
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_lexio_clients_tenant_id ON lexio_clients (tenant_id);

CREATE TABLE lexio_users (
	name VARCHAR(150) NOT NULL, 
	email VARCHAR(254) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	`role` VARCHAR(20) NOT NULL, 
	active BOOL NOT NULL, 
	can_create_clients BOOL NOT NULL, 
	can_create_cases BOOL NOT NULL, 
	id INTEGER NOT NULL AUTO_INCREMENT, 
	tenant_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (tenant_id, id), 
	UNIQUE (email), 
	FOREIGN KEY(tenant_id) REFERENCES lexio_tenants (tenant_id)
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_lexio_users_tenant_id ON lexio_users (tenant_id);

CREATE TABLE lexio_audit (
	user_id INTEGER NOT NULL, 
	resource VARCHAR(40) NOT NULL, 
	resource_id INTEGER NOT NULL, 
	action VARCHAR(40) NOT NULL, 
	changes TEXT NOT NULL, 
	id INTEGER NOT NULL AUTO_INCREMENT, 
	tenant_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (tenant_id, id), 
	FOREIGN KEY(tenant_id, user_id) REFERENCES lexio_users (tenant_id, id), 
	FOREIGN KEY(tenant_id) REFERENCES lexio_tenants (tenant_id)
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_lexio_audit_tenant_id ON lexio_audit (tenant_id);

CREATE TABLE lexio_cases (
	client_id INTEGER NOT NULL, 
	area VARCHAR(80) NOT NULL, 
	subject VARCHAR(150) NOT NULL, 
	description TEXT NOT NULL, 
	initial_stage VARCHAR(100) NOT NULL, 
	current_stage VARCHAR(100) NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	start_date DATE NOT NULL, 
	responsible_id INTEGER NOT NULL, 
	reference VARCHAR(120) NOT NULL, 
	id INTEGER NOT NULL AUTO_INCREMENT, 
	tenant_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (tenant_id, id), 
	FOREIGN KEY(tenant_id, client_id) REFERENCES lexio_clients (tenant_id, id), 
	FOREIGN KEY(tenant_id, responsible_id) REFERENCES lexio_users (tenant_id, id), 
	FOREIGN KEY(tenant_id) REFERENCES lexio_tenants (tenant_id)
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_lexio_cases_tenant_id ON lexio_cases (tenant_id);

CREATE TABLE lexio_access (
	case_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	level VARCHAR(10) NOT NULL, 
	id INTEGER NOT NULL AUTO_INCREMENT, 
	tenant_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (tenant_id, id), 
	UNIQUE (tenant_id, case_id, user_id), 
	FOREIGN KEY(tenant_id, case_id) REFERENCES lexio_cases (tenant_id, id), 
	FOREIGN KEY(tenant_id, user_id) REFERENCES lexio_users (tenant_id, id), 
	FOREIGN KEY(tenant_id) REFERENCES lexio_tenants (tenant_id)
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_lexio_access_tenant_id ON lexio_access (tenant_id);

CREATE TABLE lexio_entries (
	case_id INTEGER NOT NULL, 
	action_date DATE NOT NULL, 
	description TEXT NOT NULL, 
	registered_by INTEGER NOT NULL, 
	is_payment_event BOOL NOT NULL, 
	id INTEGER NOT NULL AUTO_INCREMENT, 
	tenant_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (tenant_id, id), 
	FOREIGN KEY(tenant_id, case_id) REFERENCES lexio_cases (tenant_id, id), 
	FOREIGN KEY(tenant_id, registered_by) REFERENCES lexio_users (tenant_id, id), 
	FOREIGN KEY(tenant_id) REFERENCES lexio_tenants (tenant_id)
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_lexio_entries_tenant_id ON lexio_entries (tenant_id);

CREATE TABLE lexio_files (
	client_id INTEGER NOT NULL, 
	case_id INTEGER, 
	title VARCHAR(180) NOT NULL, 
	url TEXT NOT NULL, 
	classification VARCHAR(20) NOT NULL, 
	registered_by INTEGER NOT NULL, 
	id INTEGER NOT NULL AUTO_INCREMENT, 
	tenant_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (tenant_id, id), 
	FOREIGN KEY(tenant_id, client_id) REFERENCES lexio_clients (tenant_id, id), 
	FOREIGN KEY(tenant_id, case_id) REFERENCES lexio_cases (tenant_id, id), 
	FOREIGN KEY(tenant_id, registered_by) REFERENCES lexio_users (tenant_id, id), 
	FOREIGN KEY(tenant_id) REFERENCES lexio_tenants (tenant_id)
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_lexio_files_tenant_id ON lexio_files (tenant_id);

CREATE TABLE lexio_notices (
	user_id INTEGER NOT NULL, 
	case_id INTEGER NOT NULL, 
	source_key VARCHAR(180) NOT NULL, 
	kind VARCHAR(20) NOT NULL, 
	target_date DATE NOT NULL, 
	notice_date DATE NOT NULL, 
	anticipation INTEGER NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	read_at DATETIME, 
	id INTEGER NOT NULL AUTO_INCREMENT, 
	tenant_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (tenant_id, id), 
	UNIQUE (tenant_id, user_id, source_key), 
	FOREIGN KEY(tenant_id, user_id) REFERENCES lexio_users (tenant_id, id), 
	FOREIGN KEY(tenant_id, case_id) REFERENCES lexio_cases (tenant_id, id), 
	FOREIGN KEY(tenant_id) REFERENCES lexio_tenants (tenant_id)
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_lexio_notices_tenant_id ON lexio_notices (tenant_id);

CREATE TABLE lexio_services (
	case_id INTEGER NOT NULL, 
	mode VARCHAR(30) NOT NULL, 
	scope TEXT NOT NULL, 
	stage VARCHAR(120) NOT NULL, 
	contract_date DATE NOT NULL, 
	fee NUMERIC(14, 2) NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	id INTEGER NOT NULL AUTO_INCREMENT, 
	tenant_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (tenant_id, id), 
	FOREIGN KEY(tenant_id, case_id) REFERENCES lexio_cases (tenant_id, id), 
	CONSTRAINT ck_service_fee CHECK (fee > 0), 
	FOREIGN KEY(tenant_id) REFERENCES lexio_tenants (tenant_id)
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_lexio_services_tenant_id ON lexio_services (tenant_id);

CREATE TABLE lexio_events (
	case_id INTEGER NOT NULL, 
	entry_id INTEGER, 
	description VARCHAR(250) NOT NULL, 
	scheduled_date DATE, 
	effective_date DATE, 
	effective_kind VARCHAR(30), 
	revision INTEGER NOT NULL, 
	reviewed_revision INTEGER NOT NULL, 
	id INTEGER NOT NULL AUTO_INCREMENT, 
	tenant_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (tenant_id, id), 
	FOREIGN KEY(tenant_id, case_id) REFERENCES lexio_cases (tenant_id, id), 
	FOREIGN KEY(tenant_id, entry_id) REFERENCES lexio_entries (tenant_id, id), 
	FOREIGN KEY(tenant_id) REFERENCES lexio_tenants (tenant_id)
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_lexio_events_tenant_id ON lexio_events (tenant_id);

CREATE TABLE lexio_payments (
	service_id INTEGER NOT NULL, 
	payment_date DATE NOT NULL, 
	amount NUMERIC(14, 2) NOT NULL, 
	method VARCHAR(50) NOT NULL, 
	receipt VARCHAR(250) NOT NULL, 
	observation TEXT NOT NULL, 
	registered_by INTEGER NOT NULL, 
	reversed_at DATETIME, 
	reversal_reason TEXT, 
	id INTEGER NOT NULL AUTO_INCREMENT, 
	tenant_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (tenant_id, id), 
	FOREIGN KEY(tenant_id, service_id) REFERENCES lexio_services (tenant_id, id), 
	FOREIGN KEY(tenant_id, registered_by) REFERENCES lexio_users (tenant_id, id), 
	CONSTRAINT ck_payment_amount CHECK (amount > 0), 
	FOREIGN KEY(tenant_id) REFERENCES lexio_tenants (tenant_id)
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_lexio_payments_tenant_id ON lexio_payments (tenant_id);

CREATE TABLE lexio_tasks (
	case_id INTEGER NOT NULL, 
	entry_id INTEGER, 
	description VARCHAR(250) NOT NULL, 
	responsible_id INTEGER NOT NULL, 
	due_date DATE NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	id INTEGER NOT NULL AUTO_INCREMENT, 
	tenant_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (tenant_id, id), 
	FOREIGN KEY(tenant_id, case_id) REFERENCES lexio_cases (tenant_id, id), 
	FOREIGN KEY(tenant_id, entry_id) REFERENCES lexio_entries (tenant_id, id), 
	FOREIGN KEY(tenant_id, responsible_id) REFERENCES lexio_users (tenant_id, id), 
	FOREIGN KEY(tenant_id) REFERENCES lexio_tenants (tenant_id)
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_lexio_tasks_tenant_id ON lexio_tasks (tenant_id);

CREATE TABLE lexio_installments (
	service_id INTEGER NOT NULL, 
	number INTEGER NOT NULL, 
	amount NUMERIC(14, 2) NOT NULL, 
	`condition` VARCHAR(30) NOT NULL, 
	event_id INTEGER, 
	offset_days INTEGER NOT NULL, 
	day_basis VARCHAR(20) NOT NULL, 
	due_date DATE, 
	confirmed_revision INTEGER, 
	id INTEGER NOT NULL AUTO_INCREMENT, 
	tenant_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (tenant_id, id), 
	FOREIGN KEY(tenant_id, service_id) REFERENCES lexio_services (tenant_id, id), 
	FOREIGN KEY(tenant_id, event_id) REFERENCES lexio_events (tenant_id, id), 
	CONSTRAINT ck_installment_amount CHECK (amount > 0), 
	FOREIGN KEY(tenant_id) REFERENCES lexio_tenants (tenant_id)
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_lexio_installments_tenant_id ON lexio_installments (tenant_id);

CREATE TABLE lexio_applications (
	payment_id INTEGER NOT NULL, 
	installment_id INTEGER NOT NULL, 
	amount NUMERIC(14, 2) NOT NULL, 
	id INTEGER NOT NULL AUTO_INCREMENT, 
	tenant_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (tenant_id, id), 
	UNIQUE (tenant_id, payment_id, installment_id), 
	FOREIGN KEY(tenant_id, payment_id) REFERENCES lexio_payments (tenant_id, id), 
	FOREIGN KEY(tenant_id, installment_id) REFERENCES lexio_installments (tenant_id, id), 
	CONSTRAINT ck_application_amount CHECK (amount > 0), 
	FOREIGN KEY(tenant_id) REFERENCES lexio_tenants (tenant_id)
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_lexio_applications_tenant_id ON lexio_applications (tenant_id);
