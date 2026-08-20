import { redirect } from "next/navigation";
export default function LegacyLeagueSettings() {
  redirect("/league?tab=settings");
}
