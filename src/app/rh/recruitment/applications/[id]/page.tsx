import RecruitmentModule from "@/components/recruitment/RecruitmentModule";

export default async function RecruitmentApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RecruitmentModule view="application" applicationId={id} />;
}
