import { redirect } from "next/navigation";
export default function LegacyScoringSettings() {
  redirect("/league?tab=scoring");
}
