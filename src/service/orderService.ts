import {
  collection,
  doc,
  getDoc,
  increment,
  orderBy,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../config/firbase/firebase";
import { AppError } from "./authService";
import { createCrud } from "./firestoreCrud";
import type { Order, OrderItem, OrderStatus } from "../utils/types";

const crud = createCrud<Order>("orders");

export type CreateOrderInput = {
  userId: string;
  customerName: string;
  phone: string;
  address: string;
  items: OrderItem[];
  discountAmount?: number;
  deliveryFee?: number;
  couponCode?: string | null;
};

const generateOrderNo = () => `RH-${Date.now().toString().slice(-7)}`;

/**
 * Old version: saves the order only, does NOT touch stock.
 * Use `placeOrder` below for real customer orders.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const subtotal = input.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountAmount = input.discountAmount ?? 0;
  const deliveryFee = input.deliveryFee ?? 0;

  const data: Omit<Order, "id" | "createdAt"> = {
    orderNo: generateOrderNo(),
    userId: input.userId,
    customerName: input.customerName,
    phone: input.phone,
    address: input.address,
    items: input.items,
    subtotal,
    discountAmount,
    deliveryFee,
    total: Math.max(0, subtotal - discountAmount + deliveryFee),
    couponCode: input.couponCode ?? null,
    paymentMethod: "COD",
    status: "Pending",
  };

  const id = await crud.create(data);
  return { id, ...data };
}

/**
 * Places an order. Stock is NOT reduced here, it is reduced when the admin
 * confirms the order (see updateOrderStatus).
 * It only checks the current stock so customers can't order what is already
 * out of stock. Products with no numeric `stock` field are untracked.
 */
export async function placeOrder(
  input: CreateOrderInput,
): Promise<{ id: string; orderNo: string }> {
  if (!input.items.length) throw new AppError("Your cart is empty.");

  // Same product twice in the cart? Add the quantities together.
  const needed = new Map<string, { qty: number; name: string }>();
  input.items.forEach((i) => {
    const prev = needed.get(i.productId);
    needed.set(i.productId, {
      qty: (prev?.qty ?? 0) + i.quantity,
      name: i.name,
    });
  });

  // Read-only stock check (no writes to products)
  await Promise.all(
    [...needed.entries()].map(async ([productId, { qty, name }]) => {
      const snap = await getDoc(doc(db, "products", productId));
      if (!snap.exists())
        throw new AppError(`"${name}" is no longer available.`);
      const stock = snap.data()?.stock;
      if (typeof stock === "number" && stock < qty) {
        throw new AppError(
          stock <= 0
            ? `"${name}" is out of stock.`
            : `Only ${stock} left of "${name}". Please reduce the quantity.`,
        );
      }
    }),
  );

  const subtotal = input.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountAmount = input.discountAmount ?? 0;
  const deliveryFee = input.deliveryFee ?? 0;

  const orderRef = doc(collection(db, "orders"));
  const orderNo = orderRef.id.slice(0, 6).toUpperCase();

  await setDoc(orderRef, {
    orderNo,
    userId: input.userId,
    customerName: input.customerName,
    phone: input.phone,
    address: input.address,
    items: input.items,
    subtotal,
    discountAmount,
    deliveryFee,
    total: Math.max(0, subtotal - discountAmount + deliveryFee),
    couponCode: input.couponCode ?? null,
    paymentMethod: "COD",
    status: "Pending",
    createdAt: serverTimestamp(),
  });

  return { id: orderRef.id, orderNo };
}

/* ───────── WhatsApp ───────── */

export function buildWhatsAppMessage(order: Order, currency = "₹") {
  const lines = order.items.map(
    (i, n) =>
      `${n + 1}. ${i.name} x ${i.quantity} = ${currency}${i.price * i.quantity}`,
  );

  return [
    `*New Order ${order.orderNo}*`,
    "",
    `Customer: ${order.customerName}`,
    `Phone: ${order.phone}`,
    `Address: ${order.address}`,
    "",
    "*Items*",
    ...lines,
    "",
    `Subtotal: ${currency}${order.subtotal}`,
    order.discountAmount > 0
      ? `Discount${order.couponCode ? ` (${order.couponCode})` : ""}: -${currency}${order.discountAmount}`
      : "",
    order.deliveryFee > 0 ? `Delivery: ${currency}${order.deliveryFee}` : "",
    `*Total: ${currency}${order.total}*`,
    `Payment: Cash on delivery`,
  ]
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n");
}

/** businessNumber: digits only with country code, e.g. 919876543210 */
export const getWhatsAppUrl = (order: Order, businessNumber: string) =>
  `https://wa.me/${businessNumber.replace(/\D/g, "")}?text=${encodeURIComponent(
    buildWhatsAppMessage(order),
  )}`;

/* ───────── Customer ───────── */
export async function getMyOrders(userId: string) {
  const orders = await crud.list(where("userId", "==", userId));
  // sorted here to avoid needing a Firestore composite index
  return orders.sort(
    (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0),
  );
}
export const getOrder = crud.get;

/* ───────── Admin: Order Management ───────── */

/** Which status an order may move to next. Delivered and Cancelled are final. */
export const ORDER_FLOW: Record<OrderStatus, OrderStatus[]> = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Out for delivery", "Cancelled"],
  "Out for delivery": ["Delivered", "Cancelled"],
  Delivered: [],
  Cancelled: [],
};

export const getAllOrders = () => crud.list(orderBy("createdAt", "desc"));

/**
 * Change an order's status (admin). Runs in a transaction.
 *  - Pending -> Confirmed: checks stock and REDUCES it. If any product has too
 *    little stock, the order stays Pending and an error is thrown.
 *  - Confirmed / Out for delivery -> Cancelled: stock is ADDED BACK
 *    (set { restoreStock: false } to skip).
 *  - Pending -> Cancelled: nothing to restore, stock was never reduced.
 * Products with no numeric `stock` field are ignored.
 */
export async function updateOrderStatus(
  id: string,
  next: OrderStatus,
  opts: { restoreStock?: boolean } = { restoreStock: true },
) {
  await runTransaction(db, async (tx) => {
    const orderRef = doc(db, "orders", id);
    const snap = await tx.get(orderRef);
    if (!snap.exists()) throw new AppError("This order no longer exists.");

    const order = snap.data() as Order;
    if (!ORDER_FLOW[order.status].includes(next))
      throw new AppError(
        `An order that is ${order.status} can't be changed to ${next}.`,
      );

    const deduct = order.status === "Pending" && next === "Confirmed";
    const restore =
      next === "Cancelled" &&
      order.status !== "Pending" &&
      opts.restoreStock !== false;

    // Merge duplicate products
    const qtyByProduct = new Map<string, { qty: number; name: string }>();
    order.items.forEach((it) => {
      const prev = qtyByProduct.get(it.productId);
      qtyByProduct.set(it.productId, {
        qty: (prev?.qty ?? 0) + it.quantity,
        name: it.name,
      });
    });

    // all reads first, then writes
    const products =
      deduct || restore
        ? await Promise.all(
            [...qtyByProduct.entries()].map(async ([productId, v]) => {
              const ref = doc(db, "products", productId);
              const p = await tx.get(ref);
              return { ref, snap: p, ...v };
            }),
          )
        : [];

    if (deduct) {
      products.forEach((p) => {
        const stock = p.snap.data()?.stock;
        if (p.snap.exists() && typeof stock === "number" && stock < p.qty) {
          throw new AppError(
            stock <= 0
              ? `Can't confirm: "${p.name}" is out of stock.`
              : `Can't confirm: only ${stock} left of "${p.name}" (order needs ${p.qty}).`,
          );
        }
      });
    }

    tx.update(orderRef, { status: next });

    products.forEach((p) => {
      if (!p.snap.exists() || typeof p.snap.data()?.stock !== "number") return;
      if (deduct) tx.update(p.ref, { stock: increment(-p.qty) });
      if (restore) tx.update(p.ref, { stock: increment(p.qty) });
    });
  });
}
