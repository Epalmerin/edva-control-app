import RoleGuard from "@/components/RoleGuard";

export default function RecruitmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGuard allowedRoles={["ADMIN", "RH"]}>{children}</RoleGuard>;
}
