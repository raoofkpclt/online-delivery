import { Timestamp, limit, where } from "firebase/firestore";
import { AppError } from "./authService";
import { createCrud } from "./firestoreCrud";
import type { Coupon } from "../utils/types";

const crud = createCrud<Coupon>("coupons");

/* Admin: Coupons page */
export const getCoupons = () => crud.list();
export const addCoupon = (
  data: Omit<Coupon, "id" | "createdAt" | "usedCount">,
) =>
  crud.create({ ...data, code: data.code.trim().toUpperCase(), usedCount: 0 });
export const updateCoupon = crud.update;
export const deleteCoupon = crud.remove;
export const setCouponActive = (id: string, isActive: boolean) =>
  crud.update(id, { isActive });

/* Customer: Checkout coupon box */
export async function validateCoupon(code: string, subtotal: number) {
  const [coupon] = await crud.list(
    where("code", "==", code.trim().toUpperCase()),
    limit(1),
  );

  if (!coupon || !coupon.isActive) throw new AppError("Invalid coupon code.");

  const now = Timestamp.now().toMillis();
  if (now < coupon.startsAt.toMillis())
    throw new AppError("This coupon is not active yet.");
  if (now > coupon.endsAt.toMillis())
    throw new AppError("This coupon has expired.");
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
    throw new AppError("This coupon has reached its usage limit.");
  if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount)
    throw new AppError(
      `Minimum order for this coupon is ${coupon.minOrderAmount}.`,
    );

  let discount =
    coupon.discountType === "percent"
      ? (subtotal * coupon.discountValue) / 100
      : coupon.discountValue;
  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(Math.round(discount), subtotal);

  return { coupon, discount };
}
