export type LeadSource =
  | ""
  | "Sin atribución"
  | "Instagram"
  | "Facebook"
  | "Tiktok"
  | "Web"
  | "Referido"
  | "Volantes"
  | "Otro";

export interface Client {
  id: number;
  code: string;
  document_type: string;
  document_number: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  lead_source?: string;
  is_delinquent?: boolean;
}
