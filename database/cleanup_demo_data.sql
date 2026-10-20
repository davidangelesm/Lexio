-- Lexio: limpieza de datos de ejemplo del estudio de Admin (MySQL / InnoDB).
-- NO es una migracion ni debe ejecutarse al arrancar FastAPI.
-- En HeidiSQL, seleccionar la base correcta y ejecutar el archivo completo.
-- Antes de aplicar: guardar un respaldo y pausar el backend para evitar escrituras.
-- Requiere permisos CREATE ROUTINE, EXECUTE y ALTER ROUTINE.
-- Conserva Admin sin modificar su contrasena, su estudio y todas sus ramas.
-- Elimina TODOS los demas usuarios del estudio, incluido asistente1, y los
-- clientes, casos, accesos, actuaciones, cuotas, abonos, aplicaciones, avisos
-- e historial de auditoria del estudio. No modifica otros estudios.
-- No elimina tablas, desactiva claves foraneas ni reinicia los IDs.
-- Por defecto solo simula: CALL con 0 borra dentro de una transaccion
-- y revierte todo. Para aplicar, cambiar SOLO 0 por 1 al final (sin comillas).
-- El procedimiento se retira al terminar; ante un error, detiene la limpieza
-- y revierte los borrados automaticamente.

-- Permite reintentar si el procedimiento quedo creado tras una llamada fallida.
DROP PROCEDURE IF EXISTS lexio_cleanup_demo_data;

DELIMITER $$

CREATE PROCEDURE lexio_cleanup_demo_data(
    IN p_admin_username VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    IN p_apply TINYINT
)
BEGIN
    DECLARE v_admin_id INTEGER;
    DECLARE v_tenant_id INTEGER;
    DECLARE v_matches INTEGER;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    IF p_apply IS NULL OR p_apply NOT IN (0, 1) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Modo invalido: usar 0 para simular o 1 para aplicar.';
    END IF;

    SELECT COUNT(*), MIN(id), MIN(tenant_id)
    INTO v_matches, v_admin_id, v_tenant_id
    FROM lexio_users
    -- El parametro no debe heredar una intercalacion diferente de la base.
    WHERE LOWER(username) COLLATE utf8mb4_unicode_ci
        = LOWER(TRIM(p_admin_username)) COLLATE utf8mb4_unicode_ci
        AND `role` = 'admin' AND active = 1;

    IF v_matches <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se encontro un unico Admin activo. No se borro ningun dato.';
    END IF;

    SELECT DATABASE() AS base_de_datos, u.tenant_id, t.name AS estudio,
        u.id AS admin_id, u.username AS usuario_conservado,
        IF(p_apply = 1, 'APLICAR', 'SIMULAR Y REVERTIR') AS modo
    FROM lexio_users AS u
    JOIN lexio_tenants AS t ON t.tenant_id = u.tenant_id
    WHERE u.tenant_id = v_tenant_id AND u.id = v_admin_id;

    -- Cantidades que se eliminarian. Revisarlas primero con el modo 0.
    SELECT 'lexio_notices' AS tabla, COUNT(*) AS registros_a_eliminar
        FROM lexio_notices WHERE tenant_id = v_tenant_id
    UNION ALL SELECT 'lexio_applications', COUNT(*)
        FROM lexio_applications WHERE tenant_id = v_tenant_id
    UNION ALL SELECT 'lexio_entries', COUNT(*)
        FROM lexio_entries WHERE tenant_id = v_tenant_id
    UNION ALL SELECT 'lexio_payments', COUNT(*)
        FROM lexio_payments WHERE tenant_id = v_tenant_id
    UNION ALL SELECT 'lexio_installments', COUNT(*)
        FROM lexio_installments WHERE tenant_id = v_tenant_id
    UNION ALL SELECT 'lexio_access', COUNT(*)
        FROM lexio_access WHERE tenant_id = v_tenant_id
    UNION ALL SELECT 'lexio_cases', COUNT(*)
        FROM lexio_cases WHERE tenant_id = v_tenant_id
    UNION ALL SELECT 'lexio_clients', COUNT(*)
        FROM lexio_clients WHERE tenant_id = v_tenant_id
    UNION ALL SELECT 'lexio_audit', COUNT(*)
        FROM lexio_audit WHERE tenant_id = v_tenant_id
    UNION ALL SELECT 'lexio_users', COUNT(*)
        FROM lexio_users WHERE tenant_id = v_tenant_id AND id <> v_admin_id;

    -- Dependencias primero: las actuaciones pueden apuntar a cuotas por evento.
    DELETE FROM lexio_notices WHERE tenant_id = v_tenant_id;
    DELETE FROM lexio_applications WHERE tenant_id = v_tenant_id;
    DELETE FROM lexio_entries WHERE tenant_id = v_tenant_id;
    DELETE FROM lexio_payments WHERE tenant_id = v_tenant_id;
    DELETE FROM lexio_installments WHERE tenant_id = v_tenant_id;
    DELETE FROM lexio_access WHERE tenant_id = v_tenant_id;
    DELETE FROM lexio_cases WHERE tenant_id = v_tenant_id;
    DELETE FROM lexio_clients WHERE tenant_id = v_tenant_id;
    DELETE FROM lexio_audit WHERE tenant_id = v_tenant_id;
    DELETE FROM lexio_users WHERE tenant_id = v_tenant_id AND id <> v_admin_id;

    IF p_apply = 1 THEN
        COMMIT;
        SELECT 'Limpieza aplicada. Se conservaron Admin, su estudio y sus ramas.' AS resultado;
    ELSE
        ROLLBACK;
        SELECT 'Simulacion terminada. Todos los borrados fueron revertidos.' AS resultado;
    END IF;

    SELECT id, tenant_id, username, name, `role`, active
    FROM lexio_users WHERE tenant_id = v_tenant_id ORDER BY id;
    SELECT id, tenant_id, name
    FROM lexio_legal_areas WHERE tenant_id = v_tenant_id ORDER BY id;
END$$

DELIMITER ;

CALL lexio_cleanup_demo_data('admin', 0);
DROP PROCEDURE lexio_cleanup_demo_data;
