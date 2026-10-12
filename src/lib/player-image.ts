// Sleeper identifies team defenses with NFL abbreviations instead of numeric player IDs.
const logoAliases: Record<string, string> = {
  WAS: "wsh",
  LA: "lar",
  JAC: "jax",
  OAK: "lv",
  SD: "lac",
  STL: "lar",
};
export function playerImageUrl(playerId: string) {
  if (/^[A-Z]{2,3}$/.test(playerId)) {
    const team = logoAliases[playerId] ?? playerId.toLowerCase();
    return `https://a.espncdn.com/i/teamlogos/nfl/500/${team}.png`;
  }
  return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
}
