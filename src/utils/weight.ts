export const WEIGHTS = [100, 250, 500, 1000] as const;

// products whose unit is kg get weight options
export const isWeighed = (p: { unit?: string }) =>
  /^(kg|kgs|kilo|kilogram)s?$/i.test((p.unit ?? "").trim());

export const gramsLabel = (g: number) =>
  g >= 1000 ? `${+(g / 1000).toFixed(2)} kg` : `${g} g`;

// price for `grams` when the product is priced per kg
export const packPrice = (perKg: number, grams: number) =>
  Math.round(((perKg * grams) / 1000) * 100) / 100;

// per-kg rate of a cart or order line.
// Uses the saved ratePerKg if there is one, otherwise works it out from the pack price,
// so older orders without ratePerKg still display correctly.
export const ratePerKgOf = (i: {
  price: number;
  grams?: number;
  ratePerKg?: number;
}) =>
  i.ratePerKg ??
  (i.grams ? Math.round(((i.price * 1000) / i.grams) * 100) / 100 : i.price);
