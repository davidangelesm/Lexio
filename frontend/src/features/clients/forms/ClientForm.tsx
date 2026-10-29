import {
  FileBadge2,
  Hash,
  Mail,
  MapPin,
  Megaphone,
  Phone,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Field, Form } from "../../../components/ui";
import { clientsService } from "../../../services/clients";
import type { Client } from "../../../types";
import type { ClientInput } from "../../../types/requests";
import { str } from "../../../utils/form";

export const LEAD_SOURCES = [
  "Sin atribución",
  "Instagram",
  "Facebook",
  "Tiktok",
  "Web",
  "Referido",
  "Volantes",
  "Otro",
] as const;

type Props = { item?: Client; saved: (client: Client) => Promise<void> | void };
export default function ClientForm({ item, saved }: Props) {
  return (
    <Form
      label={item ? "Guardar cambios" : "Registrar cliente"}
      submit={async (form) => {
        const data: ClientInput = {
          name: str(form, "name"),
          document_type: str(form, "document_type"),
          document_number: str(form, "document_number"),
          phone: str(form, "phone"),
          email: str(form, "email"),
          address: str(form, "address"),
          lead_source: str(form, "lead_source"),
        };
        await saved(
          item
            ? await clientsService.update(item.id, data)
            : await clientsService.create(data),
        );
      }}
    >
      <div className="full client-form-vertical">
        <div className="client-form-banner">
          <div className="client-form-banner-icon" aria-hidden="true">
            <Sparkles size={20} />
          </div>
          <div className="client-form-banner-text">
            <span className="client-form-eyebrow">Ficha personal</span>
            <h3>
              {item
                ? "Actualización de datos del titular"
                : "Registro de titular y contacto"}
            </h3>
          </div>
          {item && (
            <span className="client-code-pill">
              Código asignado: <strong>{item.code}</strong>
            </span>
          )}
        </div>

        <div className="client-form-stack">
          <Field label="Nombres y apellidos">
            <div className="client-input-shell">
              <UserRound size={16} className="client-input-icon" />
              <input
                name="name"
                required
                maxLength={180}
                placeholder="Ej. María Fernanda Torres Vega"
                defaultValue={item?.name}
              />
            </div>
          </Field>
          <Field label="Documento de identificación">
            <div className="client-input-shell">
              <FileBadge2 size={16} className="client-input-icon" />
              <select
                name="document_type"
                defaultValue={item?.document_type || "DNI"}
              >
                <option>DNI</option>
                <option>RUC</option>
                <option>CE</option>
              </select>
            </div>
          </Field>
          <Field label="Número de documento">
            <div className="client-input-shell">
              <Hash size={16} className="client-input-icon" />
              <input
                name="document_number"
                required
                maxLength={20}
                placeholder="8 dígitos para DNI / 11 para RUC"
                defaultValue={item?.document_number}
              />
            </div>
          </Field>
          <Field label="Celular">
            <div className="client-input-shell">
              <Phone size={16} className="client-input-icon" />
              <input
                name="phone"
                type="tel"
                maxLength={30}
                placeholder="Ej. 999 888 777"
                defaultValue={item?.phone}
              />
            </div>
          </Field>
          <Field label="Correo">
            <div className="client-input-shell">
              <Mail size={16} className="client-input-icon" />
              <input
                name="email"
                type="email"
                maxLength={254}
                placeholder="cliente@correo.com"
                defaultValue={item?.email}
              />
            </div>
          </Field>
          <Field label="Dirección">
            <div className="client-input-shell">
              <MapPin size={16} className="client-input-icon" />
              <input
                name="address"
                maxLength={250}
                placeholder="Av. / Calle / Distrito, Ciudad"
                defaultValue={item?.address}
              />
            </div>
          </Field>
          <Field label="Origen de captación">
            <div className="client-input-shell">
              <Megaphone size={16} className="client-input-icon" />
              <select
                name="lead_source"
                defaultValue={item?.lead_source || "Sin atribución"}
              >
                {LEAD_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>
          </Field>
        </div>
      </div>
    </Form>
  );
}
