-- Solo consultas de diagnóstico; no cambia tablas ni datos.
-- Selecciona la base de Lexio en HeidiSQL.
SELECT VERSION() AS mysql_version, DATABASE() AS selected_database;

SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'lexio\_%'
ORDER BY TABLE_NAME;

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'lexio\_%'
  AND COLUMN_NAME = 'tenant_id'
ORDER BY TABLE_NAME;

-- Después del bootstrap: copia el tenant_id impreso en la consola.
-- Cambia NULL por ese número antes de consultar datos de negocio.
SET @tenant_id = NULL;

SELECT tenant_id, name, notice_days FROM lexio_tenants WHERE tenant_id = @tenant_id;
SELECT id, name, email, role, active FROM lexio_users WHERE tenant_id = @tenant_id;

SELECT area, COUNT(*) AS total,
       SUM(status = 'activo') AS activos,
       SUM(status = 'concluido') AS concluidos,
       SUM(status = 'suspendido') AS suspendidos
FROM lexio_cases WHERE tenant_id = @tenant_id GROUP BY area;

-- Cuota original, pagos vigentes aplicados y saldo; no duplica pagos.
SELECT i.id, i.service_id, i.number, i.amount,
       COALESCE(a.applied, 0) AS applied,
       i.amount - COALESCE(a.applied, 0) AS balance
FROM lexio_installments i
LEFT JOIN (
    SELECT a.tenant_id, a.installment_id, SUM(a.amount) AS applied
    FROM lexio_applications a
    INNER JOIN lexio_payments p
      ON p.tenant_id = a.tenant_id AND p.id = a.payment_id
    WHERE a.tenant_id = @tenant_id AND p.tenant_id = @tenant_id AND p.reversed_at IS NULL
    GROUP BY a.tenant_id, a.installment_id
) a ON a.tenant_id = i.tenant_id AND a.installment_id = i.id
WHERE i.tenant_id = @tenant_id
ORDER BY i.service_id, i.number;

-- Las tablas y consultas SQL de mantenimiento no sustituyen los permisos de la API.
