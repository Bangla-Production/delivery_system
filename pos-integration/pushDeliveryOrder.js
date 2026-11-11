// ===================================================================
// Put this in your POS project (restaurantspos.vercel.app) -- NOT in this rider app.
// It creates a delivery order that riders see instantly in the rider portal.
// ===================================================================
//
// CASE A: POS and rider portal use the SAME Firebase project
//   -> just import your existing `db` and call pushDeliveryOrder(db, {...})
//
// CASE B: POS uses a DIFFERENT Firebase project
//   -> create a second app that points at the rider portal's project:
//
//   import { initializeApp } from "firebase/app";
//   import { getAuth } from "firebase/auth";
//   import { getFirestore } from "firebase/firestore";
//   const riderApp = initializeApp({ apiKey, authDomain, projectId, appId }, "rider");
//   export const riderDb = getFirestore(riderApp);
//   export const riderAuth = getAuth(riderApp);
//
//   The POS must be signed in on riderAuth (e.g. a dedicated "pos@yourdomain.com"
//   account created in the rider project) because the Firestore rules only let
//   signed-in non-rider accounts create orders.
//   Then call pushDeliveryOrder(riderDb, {...}).
// ===================================================================

import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export async function pushDeliveryOrder(db, o) {
  return addDoc(collection(db, "orders"), {
    source: "pos",
    posOrderId: o.posOrderId ?? null,        // your POS order id, handy for syncing status later
    restaurantName: o.restaurantName,
    pickupAddress: o.pickupAddress,
    pickupLat: o.pickupLat ?? null,           // optional, enables the distance filter
    pickupLng: o.pickupLng ?? null,
    dropAddress: o.dropAddress,
    customerPhone: o.customerPhone ?? "",
    total: Number(o.total),
    deliveryFee: Number(o.deliveryFee ?? 0),
    paymentMethod: o.paymentMethod ?? "COD",
    status: "new",                            // must be "new"
    riderId: null,
    createdAt: serverTimestamp(),
  });
}

// Example: call it when the cashier taps "Send for delivery"
// await pushDeliveryOrder(db, {
//   posOrderId: order.id,
//   restaurantName: "My Restaurant",
//   pickupAddress: "Shop 3, Salt Lake, Kolkata",
//   dropAddress: order.customerAddress,
//   customerPhone: order.customerPhone,
//   total: order.total,
//   deliveryFee: 30,
//   paymentMethod: "COD",
// });

// OPTIONAL: show the rider's status back inside the POS
// import { doc, onSnapshot } from "firebase/firestore";
// onSnapshot(doc(db, "orders", deliveryOrderId), (s) => {
//   const { status, riderName, riderPhone } = s.data();
//   // update your POS screen: accepted / picked / delivered
// });
