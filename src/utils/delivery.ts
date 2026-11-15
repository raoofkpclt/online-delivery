/**
 * Single place for delivery charges. Cart and Checkout both use this,
 * so the numbers always match.
 *
 * Current rule: orders below ₹150 pay ₹28 delivery, everything else is free.
 * Later, add a location argument here (e.g. getDeliveryFee(subtotal, pincode))
 * and nothing else needs to change.
 */
export const FREE_DELIVERY_MIN = 150; // subtotal at or above this = free delivery
export const DELIVERY_CHARGE = 28; // charged when subtotal is below the minimum

export const getDeliveryFee = (subtotal: number): number =>
  subtotal > 0 && subtotal < FREE_DELIVERY_MIN ? DELIVERY_CHARGE : 0;
