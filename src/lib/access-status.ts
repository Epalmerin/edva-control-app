export type CurrentAccessStatus = {
  id: string;
  role: string | null;
  active: boolean;
};

// Existing page-specific guards and database policies keep their role boundaries.
export const APP_ROLES = ["ADMIN", "RH", "PROMOTOR", "SUPERVISOR", "SUPERVISOR_VILLARREAL"];
