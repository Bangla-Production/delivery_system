// Is a driving licence needed? Only for motorbike / scooter riders.
export const needsLicense = (r) => r?.vehicle === "motorbike";

// Fully verified = identity verified (+ licence verified when a licence is required)
export const isVerified = (r) =>
  r?.kycIdentity === "verified" && (r.kycLicense === "na" || r.kycLicense === "verified");

// Stats from a list of orders (already filtered to one rider)
export function riderStats(orders) {
  const done = orders.filter((o) => o.status === "delivered");
  const sum = (list) => list.reduce((s, o) => s + (Number(o.deliveryFee) || 0), 0);
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const today = done.filter((o) => ((o.deliveredAt || o.acceptedAt)?.seconds || 0) * 1000 >= startOfDay.getTime());
  const rated = done.filter((o) => typeof o.rating === "number" && o.rating >= 1);
  return {
    deliveries: done.length,
    earned: sum(done),
    todayDeliveries: today.length,
    todayEarned: sum(today),
    ratingCount: rated.length,
    rating: rated.length ? rated.reduce((s, o) => s + o.rating, 0) / rated.length : null,
  };
}
