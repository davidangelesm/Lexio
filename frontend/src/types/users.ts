export interface User {
  id: number;
  name: string;
  username?: string;
  role: "admin" | "staff";
  active: boolean;
  can_create_clients?: boolean;
  can_create_cases?: boolean;
}
export interface Access {
  id: number;
  user_id: number;
  user_name: string;
  level: string;
}
export interface Audit {
  id: number;
  created_at: string;
  user_id: number;
  user_name: string;
  action: string;
}
