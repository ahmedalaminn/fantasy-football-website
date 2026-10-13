import { redirect } from "next/navigation";
export default async function BestBallPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const { season } = await searchParams;
  redirect(season ? `/drafts?season=${encodeURIComponent(season)}` : "/drafts");
}
