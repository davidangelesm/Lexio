import { Plus } from "lucide-react";
import { Field, Form } from "../../../components/ui/index";
import { casesService } from "../../../services/cases";
import { str } from "../../../utils/form";
import { localDate } from "../../../utils/format";
import type { CaseWorkspaceState } from "../hooks/useCaseWorkspace";
import { newPlan } from "../models/installmentPlan";

type Props = Pick<
  CaseWorkspaceState,
  | "caseId"
  | "plans"
  | "percent"
  | "done"
  | "setPercent"
  | "updatePlan"
  | "events"
  | "setPlans"
>;
export default function ServiceForm({
  caseId,
  plans,
  percent,
  done,
  setPercent,
  updatePlan,
  events,
  setPlans,
}: Props) {
  return (
    <Form
      submit={async (f) => {
        await casesService.createService(caseId, {
          mode: str(f, "mode"),
          scope: str(f, "scope"),
          stage: str(f, "stage"),
          contract_date: str(f, "contract_date"),
          fee: str(f, "fee"),
          installments: plans.map((p) => ({
            amount: percent ? null : p.amount,
            percentage: percent ? p.percentage : null,
            condition: p.condition,
            due_date: p.condition === "fecha" ? p.due_date : null,
            event_id: p.condition === "fecha" ? null : Number(p.event_id),
            offset_days: p.offset_days,
            day_basis: p.day_basis,
          })),
        });
        await done();
      }}
    >
      <Field label="Modalidad">
        <select name="mode">
          {["etapa", "acto", "integral", "otro"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </Field>
      <Field label="Etapa / acto cubierto">
        <input name="stage" required />
      </Field>
      <div className="full">
        <Field label="Alcance contratado">
          <textarea name="scope" required />
        </Field>
      </div>
      <Field label="Fecha de contratación">
        <input
          type="date"
          name="contract_date"
          required
          defaultValue={localDate()}
        />
      </Field>
      <Field label="Honorarios S/">
        <input name="fee" type="number" min="0.01" step="0.01" required />
      </Field>
      <div className="full">
        <label className="text-sm">
          <input
            type="checkbox"
            checked={percent}
            onChange={(e) => setPercent(e.target.checked)}
          />{" "}
          Cuotas por porcentaje (suman 100%)
        </label>
        {plans.map((p, i) => (
          <div className="plan-row" key={i}>
            <Field label={`Cuota ${i + 1} · ${percent ? "%" : "S/"}`}>
              <input
                type="number"
                step={percent ? "0.0001" : "0.01"}
                min="0.01"
                required
                value={percent ? p.percentage : p.amount}
                onChange={(e) =>
                  updatePlan(
                    i,
                    percent
                      ? { percentage: e.target.value }
                      : { amount: e.target.value },
                  )
                }
              />
            </Field>
            <Field label="Condición">
              <select
                value={p.condition}
                onChange={(e) => updatePlan(i, { condition: e.target.value })}
              >
                {[
                  "fecha",
                  "programacion",
                  "realizacion",
                  "emision",
                  "notificacion",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            {p.condition === "fecha" ? (
              <Field label="Vencimiento">
                <input
                  type="date"
                  required
                  value={p.due_date}
                  onChange={(e) => updatePlan(i, { due_date: e.target.value })}
                />
              </Field>
            ) : (
              <>
                <Field label="Evento específico">
                  <select
                    required
                    value={p.event_id}
                    onChange={(e) =>
                      updatePlan(i, { event_id: e.target.value })
                    }
                  >
                    <option value="">Seleccionar evento</option>
                    {events.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.description}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Días antes (-) / después (+)">
                  <input
                    type="number"
                    value={p.offset_days}
                    onChange={(e) =>
                      updatePlan(i, {
                        offset_days: Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Regla de días">
                  <select
                    value={p.day_basis}
                    onChange={(e) =>
                      updatePlan(i, { day_basis: e.target.value })
                    }
                  >
                    <option value="calendario">Calendario</option>
                    <option value="lunes_viernes">Lunes a viernes</option>
                  </select>
                </Field>
              </>
            )}
            {plans.length > 1 && (
              <button
                type="button"
                className="link-button"
                onClick={() => setPlans(plans.filter((_, j) => i !== j))}
              >
                Quitar cuota
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() => setPlans([...plans, newPlan()])}
        >
          <Plus size={14} />
          Agregar cuota
        </button>
        <p className="muted text-xs mt-3">
          Debe existir una cuota inicial por fecha. El redondeo porcentual se
          ajusta en la última cuota.
        </p>
      </div>
    </Form>
  );
}
