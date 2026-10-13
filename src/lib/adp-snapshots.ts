import season2023 from "@/data/sleeper-adp-2023.json";
import season2024 from "@/data/sleeper-adp-2024.json";
import season2025 from "@/data/sleeper-adp-2025.json";
import season2026 from "@/data/sleeper-adp-2026.json";
import type { AdpSnapshot } from "./best-ball";
export const adpSnapshots: Record<string, AdpSnapshot> = {
  "2023": season2023,
  "2024": season2024,
  "2025": season2025,
  "2026": season2026,
};
