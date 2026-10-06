import { localDate } from "../../../utils/format";

export interface Plan {
  amount: string;
  percentage: string;
  condition: string;
  due_date: string;
  event_id: string;
  offset_days: number;
  day_basis: string;
}
export const newPlan = (): Plan => ({
  amount: "",
  percentage: "",
  condition: "fecha",
  due_date: localDate(),
  event_id: "",
  offset_days: 0,
  day_basis: "calendario",
});
