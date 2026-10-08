"""Explicit, atomic demo data through 2026-10-15; never run at API startup."""

import argparse
import json
from datetime import date
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

import domain as d
import models as m
import schemas as s
from database import build_engine

MARKER = "DEMO-20261008"
LABEL = "[PRUEBA OCTUBRE]"
START = date(2026, 10, 7)


def seed_demo(db: Session, tenant_id: int, admin_id: int, finance: bool) -> dict[str, list[int]]:
    actor = db.scalar(select(m.User).where(
        m.User.tenant_id == tenant_id, m.User.id == admin_id,
        m.User.role == "admin", m.User.active.is_(True),
    ).with_for_update())
    if actor is None:
        raise ValueError("No se encontró el administrador activo del estudio indicado.")
    existing = db.scalar(select(m.Client.id).where(
        m.Client.tenant_id == tenant_id,
        m.Client.document_type == "CE",
        m.Client.document_number == f"{MARKER}-1",
    ))
    if existing:
        raise ValueError("Este lote de prueba ya existe. No se insertaron duplicados.")
    ids: dict[str, list[int]] = {
        "clients": [], "cases": [], "entries": [], "tasks": [],
        "events": [], "services": [], "installments": [], "payments": [],
    }

    def add(row: m.Entity, category: str) -> None:
        db.add(row)
        d.audit(db, actor, row, "crear dato prueba")
        ids[category].append(row.id)

    cases: list[m.Case] = []
    entries: list[m.Entry] = []
    for number, (name, area, subject) in enumerate([
        ("Cliente ficticio A", "Civil", "Cobro de obligación ficticia"),
        ("Cliente ficticio B", "Laboral", "Revisión de acuerdo ficticio"),
        ("Cliente ficticio C", "Familia", "Seguimiento de expediente ficticio"),
    ], 1):
        customer = m.Client(
            tenant_id=tenant_id, document_type="CE", document_number=f"{MARKER}-{number}",
            name=f"{LABEL} {name}", address="Datos ficticios para demostración",
        )
        add(customer, "clients")
        case = m.Case(
            tenant_id=tenant_id, client_id=customer.id, area=area,
            subject=f"{LABEL} {subject}", description="Caso ficticio. No corresponde a un proceso real.",
            initial_stage="Prueba", current_stage="Prueba", start_date=START,
            responsible_id=actor.id, reference=f"{MARKER}-{number}",
        )
        add(case, "cases")
        cases.append(case)
        db.add(m.Access(tenant_id=tenant_id, case_id=case.id, user_id=actor.id, level="edit"))
        entry = m.Entry(
            tenant_id=tenant_id, case_id=case.id, action_date=START,
            description=f"{LABEL} Apertura de expediente ficticio para demostración.",
            registered_by=actor.id,
        )
        add(entry, "entries")
        entries.append(entry)

    tasks = [
        (0, 7, "pendiente", "Tarea vencida: comprobar alerta urgente"),
        (0, 8, "pendiente", "Presentar escrito ficticio: vence hoy"),
        (1, 9, "pendiente", "Revisar acuerdo ficticio"),
        (1, 12, "pendiente", "Entregar observaciones ficticias"),
        (2, 13, "pendiente", "Preparar expediente ficticio"),
        (0, 14, "pendiente", "Revisar documentos ficticios"),
        (2, 15, "pendiente", "Presentar informe ficticio: avisos 5, 3 y 1"),
        (0, 8, "atendido", "Tarea ya atendida: no debe producir alertas"),
        (1, 12, "atendido", "Revisión ya completada: no debe producir alertas"),
        (2, 9, "cancelada", "Tarea cancelada: no debe producir alertas"),
    ]
    for case_index, day, status, description in tasks:
        data = s.TaskIn(description=f"{LABEL} {description}", responsible_id=actor.id,
                        due_date=date(2026, 10, day), status=status, entry_id=entries[case_index].id)
        add(m.Task(tenant_id=tenant_id, case_id=cases[case_index].id, **data.model_dump()), "tasks")
    for case_index, day in [(1, 12), (2, 15)]:
        add(m.Event(
            tenant_id=tenant_id, case_id=cases[case_index].id, entry_id=entries[case_index].id,
            description=f"{LABEL} Reunión ficticia programada", scheduled_date=date(2026, 10, day),
        ), "events")

    if finance:
        for case_index, fee, plan in [
            (0, "1200.00", [(8, "400.00", "400.00"), (12, "400.00", "200.00"), (15, "400.00", "0.00")]),
            (1, "900.00", [(9, "900.00", "900.00")]),
        ]:
            contract = s.ServiceIn(
                mode="etapa", scope=f"{LABEL} Servicio jurídico ficticio", stage="Prueba",
                contract_date=START, fee=Decimal(fee),
                installments=[s.InstallmentIn(amount=Decimal(amount), condition="fecha", due_date=date(2026, 10, day))
                              for day, amount, _ in plan],
            )
            amounts = d.amounts(contract.fee, contract.installments)
            service = m.Service(tenant_id=tenant_id, case_id=cases[case_index].id,
                                **contract.model_dump(exclude={"installments"}))
            add(service, "services")
            for number, (installment, amount, (_, _, applied)) in enumerate(zip(contract.installments, amounts, plan), 1):
                quota = m.Installment(tenant_id=tenant_id, service_id=service.id, number=number,
                                     amount=amount, **installment.model_dump(exclude={"amount", "percentage"}))
                add(quota, "installments")
                if Decimal(applied) > 0:
                    payment_data = s.PaymentIn(payment_date=date(2026, 10, 8), amount=Decimal(applied),
                                              method="Prueba", receipt=f"{LABEL} Sin comprobante real",
                                              observation=f"{LABEL} Abono ficticio. No hubo transferencia real.")
                    payment = m.Payment(tenant_id=tenant_id, service_id=service.id, registered_by=actor.id,
                                        **payment_data.model_dump(exclude={"applications"}))
                    add(payment, "payments")
                    d.apply_payment(db, actor, payment, [s.ApplyIn(installment_id=quota.id, amount=Decimal(applied))])
    db.add(m.Audit(tenant_id=tenant_id, user_id=actor.id, resource="lexio_tenants",
                   resource_id=tenant_id, action="cargar lote prueba",
                   changes=json.dumps({"marker": MARKER, "ids": ids, "finance": finance})))
    db.flush()
    return ids


def main() -> None:
    parser = argparse.ArgumentParser(description="Cargar datos ficticios hasta el 15 de octubre de 2026")
    parser.add_argument("--tenant-id", type=int, required=True)
    parser.add_argument("--admin-id", type=int, required=True)
    parser.add_argument("--include-finance", action="store_true")
    parser.add_argument("--apply", action="store_true", help="Sin esta opción solo muestra el plan")
    args = parser.parse_args()
    if not args.apply:
        print("Plan: 3 clientes, 3 casos, 3 actuaciones, 10 tareas y 2 eventos ficticios (7 al 15/10/2026).")
        if args.include_finance:
            print("Además: 2 servicios, 4 cuotas, 3 abonos. Honorarios 2100.00, abonos 1500.00, saldo 600.00.")
        return
    try:
        with Session(build_engine()) as db:
            ids = seed_demo(db, args.tenant_id, args.admin_id, args.include_finance)
            db.commit()
    except ValueError as error:
        raise SystemExit(str(error)) from None
    except SQLAlchemyError:
        raise SystemExit("No se pudo completar el lote; la transacción se revirtió. Revisa conexión y esquema.") from None
    manifest = Path(__file__).parent.parent / "database" / "demo_20261008_manifest.json"
    manifest.parent.mkdir(exist_ok=True)
    manifest.write_text(json.dumps({"marker": MARKER, "tenant_id": args.tenant_id, "ids": ids}, indent=2), encoding="utf-8")
    print(json.dumps({name: len(values) for name, values in ids.items()}))
    print("Lote insertado y auditado. Identificadores guardados en database/demo_20261008_manifest.json.")


if __name__ == "__main__":
    main()
