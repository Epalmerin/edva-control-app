import RoleGuard from "@/components/RoleGuard";
import { APP_ROLES } from "@/lib/access-status";

export default function RHLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard allowedRoles={APP_ROLES}>{children}</RoleGuard>;
}
