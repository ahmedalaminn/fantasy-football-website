export function DraftTradeIndicator({
  original,
  recipient,
}: {
  original?: string;
  recipient?: string;
}) {
  return (
    <span
      className="draft-trade-indicator"
      title={`Traded pick: ${original || "Original owner"} → ${recipient || "Drafting manager"}`}
      aria-label={`Pick traded from ${original || "original owner"} to ${recipient || "drafting manager"}`}
    >
      <span aria-hidden="true">→</span>
      <span className="draft-trade-name">
        {recipient || "Drafting manager"}
      </span>
    </span>
  );
}
