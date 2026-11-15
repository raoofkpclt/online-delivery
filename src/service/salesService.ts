import { Timestamp, where } from "firebase/firestore";
import { createCrud } from "./firestoreCrud";
import type { Order } from "../utils/types";

const crud = createCrud<Order>("orders");

export type SalesReport = {
  totalSales: number;
  orderCount: number;
  averageOrder: number;
  byDay: { date: string; sales: number; orders: number }[];
  topProducts: {
    productId: string;
    name: string;
    quantity: number;
    revenue: number;
  }[];
};

/** Admin: Sales Report. Cancelled orders are ignored. */
export async function getSalesReport(
  from: Date,
  to: Date,
): Promise<SalesReport> {
  const orders = (
    await crud.list(
      where("createdAt", ">=", Timestamp.fromDate(from)),
      where("createdAt", "<=", Timestamp.fromDate(to)),
    )
  ).filter((o) => o.status !== "Cancelled");

  const days = new Map<string, { sales: number; orders: number }>();
  const products = new Map<
    string,
    { productId: string; name: string; quantity: number; revenue: number }
  >();

  for (const o of orders) {
    const date = (o.createdAt?.toDate() ?? new Date())
      .toISOString()
      .slice(0, 10);
    const d = days.get(date) ?? { sales: 0, orders: 0 };
    d.sales += o.total;
    d.orders += 1;
    days.set(date, d);

    for (const i of o.items) {
      const p = products.get(i.productId) ?? {
        productId: i.productId,
        name: i.name,
        quantity: 0,
        revenue: 0,
      };
      p.quantity += i.quantity;
      p.revenue += i.price * i.quantity;
      products.set(i.productId, p);
    }
  }

  const totalSales = orders.reduce((s, o) => s + o.total, 0);

  return {
    totalSales,
    orderCount: orders.length,
    averageOrder: orders.length ? Math.round(totalSales / orders.length) : 0,
    byDay: [...days.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    topProducts: [...products.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
  };
}
