export function VerifiedBadge({ full = true }) {
  return (
    <span className="vbadge" title="Identity verified by Abar Khabo">
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor" /><path d="M7 12.5l3.3 3.3L17 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {full && "Verified"}
    </span>
  );
}

export function Rating({ value, count }) {
  if (value == null) return <span className="rating none">No ratings yet</span>;
  return (
    <span className="rating">
      <span className="star" aria-hidden="true">★</span> {value.toFixed(1)} <small>({count})</small>
    </span>
  );
}
