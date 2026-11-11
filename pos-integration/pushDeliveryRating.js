// ===================================================================
// Put this in your POS project (restaurantspos.vercel.app), next to pushDeliveryOrder.js.
// When a customer / the restaurant rates a delivery, call it to save the rating on the order.
// The rider app then shows each delivery partner's average rating (and counts) automatically.
//
// Needs:
//  1. pushDeliveryOrder() must return/save the Firestore order id (addDoc(...).id) in your POS order.
//  2. The POS must be signed in with a STAFF account. In the Firebase console create a Firestore
//     document  staff/<POS account UID>  (any field, e.g. role: "pos"). Same idea as the admins/ collection.
//  3. The order must already be "delivered" (the rules only allow ratings on delivered orders).
// ===================================================================

import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

export async function submitDeliveryRating(db, orderId, stars, note = "") {
  const rating = Math.round(Number(stars));
  if (!(rating >= 1 && rating <= 5)) throw new Error("Rating must be 1 to 5");
  return updateDoc(doc(db, "orders", orderId), {
    rating,                     // whole number 1-5
    ratingNote: note.slice(0, 300),
    ratedAt: serverTimestamp(),
  });
}

// Example:
//   await submitDeliveryRating(riderDb, order.deliveryOrderId, 5, "Fast and polite");
