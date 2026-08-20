export default function Loading() {
  return (
    <div className="content-wrap">
      <div className="skeleton skeleton-title" />
      <div className="grid-main">
        <div className="stack">
          <div className="skeleton skeleton-hero" />
          <div className="skeleton skeleton-card" />
        </div>
        <div className="stack">
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
        </div>
      </div>
    </div>
  );
}
