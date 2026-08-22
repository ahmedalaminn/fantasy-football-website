export function sleeperPlayerUrl({
  id,
  name,
  position,
}: {
  id: string;
  name: string;
  position?: string | null;
}) {
  const teamDefense = position === "DEF" || /^[A-Z]{2,3}$/.test(id);
  if (teamDefense) {
    return `https://sleeper.com/nfl/players/${id.toLowerCase()}`;
  }
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `https://sleeper.com/nfl/players/${slug}-${encodeURIComponent(id)}`;
}

