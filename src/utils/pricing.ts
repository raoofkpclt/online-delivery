import type { Offer, Product } from "./types";

export type Deal = {
  /** Price the customer pays per unit */
  price: number;
  /** Price before any offer */
  original: number;
  percentOff: number;
  /** e.g. "Buy 2 get 1 free" (does not change the unit price) */
  bundle?: string;
};

/**
 * Best price for a product from the offers running right now
 * (pass the result of getActiveOffers()). Use this same helper on the
 * Home, Shop and Cart pages so the customer sees one consistent price.
 */
export function getDeal(product: Product, offers: Offer[]): Deal {
  let price = product.price;
  let bundle: string | undefined;

  for (const o of offers) {
    if (
      o.offerType === "buy_x_get_y" &&
      o.targetProductIds.includes(product.id)
    ) {
      bundle = `Buy ${o.buyQty} get ${o.getQty} free`;
      continue;
    }
    const applies =
      (o.offerType === "product_discount" &&
        o.targetProductIds.includes(product.id)) ||
      (o.offerType === "category_discount" &&
        o.targetCategoryIds.includes(product.categoryId));
    if (!applies || !o.discountValue) continue;

    const discounted =
      o.discountType === "percent"
        ? product.price - (product.price * o.discountValue) / 100
        : product.price - o.discountValue;
    price = Math.min(price, Math.max(0, Math.round(discounted)));
  }

  const percentOff =
    price < product.price
      ? Math.round(((product.price - price) / product.price) * 100)
      : 0;
  return { price, original: product.price, percentOff, bundle };
}
