import type { Timestamp } from "firebase/firestore";

/* ───────── Users ───────── */
export type UserProfile = {
  id: string; // = Firebase Auth uid
  name: string;
  email: string;
  phone: string;
  isAdmin: boolean; // true only for admins
  status: "active" | "blocked";
  createdAt?: Timestamp;
};

/* ───────── Catalog ───────── */
export type Category = {
  id: string;
  name: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt?: Timestamp;
};

export type Product = {
  id: string;
  name: string;
  code: string;
  description: string;
  price: number;
  stock: number;
  unit?: string;
  categoryId: string;
  images: string[];
  isActive: boolean;
  createdAt?: Timestamp;
};

/* ───────── Orders ───────── */
export type OrderStatus =
  | "Pending"
  | "Confirmed"
  | "Out for delivery"
  | "Delivered"
  | "Cancelled";

export type OrderItem = {
  productId: string;
  name: string; // snapshot
  price: number; // snapshot
  quantity: number;
  grams?: number;
};

export type Order = {
  id: string;
  orderNo: string;
  userId: string;
  customerName: string;
  phone: string;
  address: string;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  total: number;
  couponCode: string | null;
  paymentMethod: "COD";
  status: OrderStatus;
  createdAt?: Timestamp;
};

/* ───────── Promotions ───────── */
export type Coupon = {
  id: string;
  code: string; // stored UPPERCASE
  description?: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  maxDiscount?: number;
  minOrderAmount?: number;
  startsAt: Timestamp;
  endsAt: Timestamp;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
  createdAt?: Timestamp;
};

export type Offer = {
  id: string;
  title: string;
  offerType:
    | "product_discount"
    | "category_discount"
    | "buy_x_get_y"
    | "free_delivery";
  discountType?: "percent" | "fixed";
  discountValue?: number;
  minOrderAmount?: number;
  buyQty?: number;
  getQty?: number;
  bannerUrl?: string;
  showOnHome: boolean;
  targetProductIds: string[];
  targetCategoryIds: string[];
  startsAt: Timestamp;
  endsAt: Timestamp;
  isActive: boolean;
  createdAt?: Timestamp;
};

export type Review = {
  id: string;
  orderId: string;
  productId: string | null; // null = whole order review
  productName?: string;
  userId: string;
  userName: string;
  rating: number; // 1–5
  comment: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};
