export interface User {
  id: number;
  name: string;
  email?: string;
  role: "admin" | "staff";
  active: boolean;
  can_create_clients?: boolean;
  can_create_cases?: boolean;
}
export interface Access {
  id: number;
  user_id: number;
  level: string;
}
export interface Audit {
  id: number;
  created_at: string;
  user_id: number;
  resource: string;
  resource_id: number;
  action: string;
  changes: string;
}
