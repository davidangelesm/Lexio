-- Migración aditiva: agrega condición de moroso (is_delinquent) a los clientes.
ALTER TABLE lexio_clients
    ADD COLUMN is_delinquent TINYINT(1) NOT NULL DEFAULT 0 AFTER lead_source;

-- Actualiza clientes existentes que ya tengan algún caso concluido/retirado con cuotas incobrables.
UPDATE lexio_clients cl
SET cl.is_delinquent = 1
WHERE EXISTS (
    SELECT 1
    FROM lexio_cases c
    JOIN lexio_installments i
      ON i.tenant_id = c.tenant_id AND i.case_id = c.id
    LEFT JOIN lexio_case_clients cc
      ON cc.tenant_id = c.tenant_id AND cc.case_id = c.id
    WHERE c.tenant_id = cl.tenant_id
      AND (c.client_id = cl.id OR cc.client_id = cl.id)
      AND c.status IN ('concluido', 'retirado')
      AND i.uncollectible_reason IS NOT NULL
);

