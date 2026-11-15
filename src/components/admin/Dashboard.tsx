import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { getErrorMessage } from "../../service/authService";
import { createCrud } from "../../service/firestoreCrud";
import { getAllOrders } from "../../service/orderService";
import { getProducts } from "../../service/productService";
import { getAllUsers } from "../../service/userService";
import { getCoupons } from "../../service/couponService";
import { getOffers } from "../../service/offerService";
import type { Category, Coupon, Offer, Order, OrderStatus, Product, UserProfile } from "../../utils/types";
import { Icon } from "./Sidebar";

const categoryCrud = createCrud<Category>("categories");

/* ───────── helpers ───────── */
const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const compact = (n: number) =>
  n >= 10000000 ? `${(n / 10000000).toFixed(1)}Cr` : n >= 100000 ? `${(n / 100000).toFixed(1)}L` : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n));
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const shortDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const LOW_STOCK = 5;

const RANGES = [7, 30, 90] as const;

const statusStyle: Record<OrderStatus, string> = {
  Pending: "bg-slate-100 text-slate-700",
  Confirmed: "bg-sky-50 text-sky-700",
  "Out for delivery": "bg-amber-50 text-amber-700",
  Delivered: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-red-50 text-red-700",
};
const statusColor: Record<OrderStatus, string> = {
  Pending: "#94a3b8",
  Confirmed: "#0ea5e9",
  "Out for delivery": "#f59e0b",
  Delivered: "#10b981",
  Cancelled: "#f87171",
};
const STATUSES: OrderStatus[] = ["Pending", "Confirmed", "Out for delivery", "Delivered", "Cancelled"];

function niceMax(v: number) {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/* ───────── small UI pieces ───────── */
function Card({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 ${className}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, note, icon }: { label: string; value: string; note: ReactNode; icon: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 sm:h-9 sm:w-9">
          <Icon d={icon} className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
      </div>
      <p className="mt-2 break-words text-xl font-semibold tracking-tight text-slate-900 sm:mt-3 sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function Delta({ cur, prev, days, lowerIsBetter }: { cur: number; prev: number; days: number; lowerIsBetter?: boolean }) {
  if (prev === 0) return <>{cur > 0 ? `Nothing in the previous ${days} days to compare` : `No change over ${days} days`}</>;
  const pct = ((cur - prev) / prev) * 100;
  const good = lowerIsBetter ? pct <= 0 : pct >= 0;
  return (
    <>
      <span className={`font-medium ${good ? "text-emerald-700" : "text-red-600"}`}>
        {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
      </span>{" "}
      vs previous {days} days
    </>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 pb-8 pt-4 text-center text-sm text-slate-500 sm:px-5">{children}</p>;
}

/* ───────── charts (plain SVG, no library) ───────── */
type Point = { label: string; value: number; note: string };

function TrendChart({ series }: { series: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);

  // the chart is drawn at the real width of its box, so text stays readable on phones
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setW(Math.max(260, Math.floor(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = W < 420 ? 200 : 230, pl = W < 420 ? 38 : 46, pr = 6, pt = 10, pb = 26;
  const max = niceMax(Math.max(...series.map((s) => s.value), 0));
  const iw = W - pl - pr, ih = H - pt - pb;
  const bw = iw / series.length;
  const every = Math.ceil(series.length / Math.max(2, Math.floor(iw / 64)));
  const shown = hover !== null ? series[hover] : null;

  return (
    <div className="px-4 pb-4 sm:px-5 sm:pb-5">
      <p className="mb-2 min-h-5 text-sm text-slate-600">
        {shown ? (
          <>
            <span className="font-medium text-slate-900">{shown.label}</span> · {money(shown.value)} · {shown.note}
          </>
        ) : (
          "Tap or hover a day to see its sales"
        )}
      </p>
      <div ref={wrapRef} className="w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Daily sales">
          {[0, 1, 2, 3, 4].map((t) => {
            const y = pt + ih - (ih * t) / 4;
            return (
              <g key={t}>
                <line x1={pl} x2={W - pr} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                <text x={pl - 6} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                  {compact((max * t) / 4)}
                </text>
              </g>
            );
          })}
          {series.map((s, i) => {
            const h = (s.value / max) * ih;
            const x = pl + i * bw;
            return (
              <g
                key={i}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(i)} // touch screens: tap a day
              >
                <rect x={x} y={pt} width={bw} height={ih} fill="transparent" />
                <rect
                  x={x + bw * 0.15}
                  y={pt + ih - h}
                  width={Math.max(bw * 0.7, 1)}
                  height={h}
                  rx={Math.min(3, bw * 0.2)}
                  fill={hover === i ? "#047857" : "#10b981"}
                />
                {i % every === 0 && (
                  <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748b">
                    {s.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function Donut({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const r = 40, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-5 px-4 pb-5 sm:flex-row sm:px-5 sm:pb-6 xl:flex-col">
      <svg viewBox="0 0 100 100" className="h-36 w-36 shrink-0 sm:h-40 sm:w-40" role="img" aria-label="Orders by status">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        {total > 0 &&
          parts.map((p) => {
            const len = (p.value / total) * c;
            const el = (
              <circle
                key={p.label}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={p.color}
                strokeWidth="14"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-acc}
                transform="rotate(-90 50 50)"
              />
            );
            acc += len;
            return el;
          })}
        <text x="50" y="49" textAnchor="middle" fontSize="16" fontWeight="600" fill="#0f172a">
          {total}
        </text>
        <text x="50" y="62" textAnchor="middle" fontSize="7" fill="#64748b">
          orders
        </text>
      </svg>
      <ul className="w-full space-y-2 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-slate-700">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
              {p.label}
            </span>
            <span className="shrink-0 text-slate-500">
              {p.value}
              {total > 0 && <span className="ml-1 text-xs">({Math.round((p.value / total) * 100)}%)</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarList({ items, color = "bg-emerald-500" }: { items: { label: string; sub: string; value: number }[]; color?: string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-4 px-4 pb-5 sm:px-5">
      {items.map((i) => (
        <li key={i.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium text-slate-800">{i.label}</span>
            <span className="shrink-0 text-slate-600">{money(i.value)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{i.sub}</p>
        </li>
      ))}
    </ul>
  );
}

/* ───────── page ───────── */
export default function Dashboard() {
  const { admin } = useOutletContext<{ admin: UserProfile }>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);

  const load = useCallback(async () => {
    try {
      setError("");
      const [o, u, p, c, of, cat] = await Promise.all([
        getAllOrders(),
        getAllUsers(),
        getProducts(),
        getCoupons(),
        getOffers(),
        categoryCrud.list(),
      ]);
      setOrders(o);
      setUsers(u);
      setProducts(p);
      setCoupons(c);
      setOffers(of);
      setCategories(cat);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const d = useMemo(() => {
    const today = startOfDay(new Date());
    const end = addDays(today, 1);
    const start = addDays(today, -(days - 1));
    const prevStart = addDays(start, -days);
    const when = (o: { createdAt?: { toDate(): Date } }) => o.createdAt?.toDate();
    const within = (x: Date | undefined, a: Date, b: Date) => !!x && x >= a && x < b;

    const cur = orders.filter((o) => within(when(o), start, end));
    const prev = orders.filter((o) => within(when(o), prevStart, start));
    const live = (l: Order[]) => l.filter((o) => o.status !== "Cancelled");
    const curLive = live(cur);
    const prevLive = live(prev);

    const sum = (l: Order[]) => l.reduce((s, o) => s + o.total, 0);
    const revenue = sum(curLive);
    const prevRevenue = sum(prevLive);
    const aov = curLive.length ? revenue / curLive.length : 0;
    const prevAov = prevLive.length ? prevRevenue / prevLive.length : 0;
    const cashCollected = sum(cur.filter((o) => o.status === "Delivered"));
    const cancelled = cur.filter((o) => o.status === "Cancelled").length;
    const prevCancelled = prev.filter((o) => o.status === "Cancelled").length;
    const cancelRate = cur.length ? (cancelled / cur.length) * 100 : 0;
    const prevCancelRate = prev.length ? (prevCancelled / prev.length) * 100 : 0;

    // daily series
    const byDay = new Map<string, { sales: number; count: number }>();
    curLive.forEach((o) => {
      const k = dayKey(when(o)!);
      const e = byDay.get(k) ?? { sales: 0, count: 0 };
      e.sales += o.total;
      e.count += 1;
      byDay.set(k, e);
    });
    const series: Point[] = Array.from({ length: days }, (_, i) => {
      const day = addDays(start, i);
      const e = byDay.get(dayKey(day));
      return {
        label: shortDate(day),
        value: e?.sales ?? 0,
        note: `${e?.count ?? 0} ${e?.count === 1 ? "order" : "orders"}`,
      };
    });

    // today
    const todayOrders = orders.filter((o) => within(when(o), today, end));
    const todaySales = sum(live(todayOrders));

    // status mix
    const statusParts = STATUSES.map((s) => ({
      label: s,
      value: cur.filter((o) => o.status === s).length,
      color: statusColor[s],
    }));

    // top products + categories
    const productById = new Map(products.map((p) => [p.id, p]));
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    const prodMap = new Map<string, { name: string; qty: number; revenue: number }>();
    const catMap = new Map<string, { qty: number; revenue: number }>();
    curLive.forEach((o) =>
      o.items.forEach((i) => {
        const amount = i.price * i.quantity;
        const pe = prodMap.get(i.productId) ?? { name: i.name, qty: 0, revenue: 0 };
        pe.qty += i.quantity;
        pe.revenue += amount;
        prodMap.set(i.productId, pe);
        const cname = catName.get(productById.get(i.productId)?.categoryId ?? "") ?? "Other";
        const ce = catMap.get(cname) ?? { qty: 0, revenue: 0 };
        ce.qty += i.quantity;
        ce.revenue += amount;
        catMap.set(cname, ce);
      })
    );
    const topProducts = [...prodMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const topCategories = [...catMap.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);

    // coupons used
    const couponMap = new Map<string, { uses: number; discount: number }>();
    curLive.forEach((o) => {
      if (!o.couponCode) return;
      const e = couponMap.get(o.couponCode) ?? { uses: 0, discount: 0 };
      e.uses += 1;
      e.discount += o.discountAmount;
      couponMap.set(o.couponCode, e);
    });
    const couponUse = [...couponMap.entries()].sort((a, b) => b[1].uses - a[1].uses).slice(0, 5);
    const discountGiven = curLive.reduce((s, o) => s + o.discountAmount, 0);

    // customers
    const customers = users.filter((u) => !u.isAdmin);
    const newCustomers = customers.filter((u) => within(when(u), start, end)).length;
    const orderCountByUser = new Map<string, number>();
    orders.filter((o) => o.status !== "Cancelled").forEach((o) => orderCountByUser.set(o.userId, (orderCountByUser.get(o.userId) ?? 0) + 1));
    const repeatCustomers = [...orderCountByUser.values()].filter((n) => n >= 2).length;
    const recentCustomers = [...customers]
      .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
      .slice(0, 5);

    // queue + stock
    const active = products.filter((p) => p.isActive);
    const outOfStock = active.filter((p) => p.stock === 0);
    const lowStock = active.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK).sort((a, b) => a.stock - b.stock);
    const pending = orders.filter((o) => o.status === "Pending").length;
    const outForDelivery = orders.filter((o) => o.status === "Out for delivery").length;

    // promotions
    const now = Date.now();
    const runningCoupons = coupons.filter(
      (c) => c.isActive && c.startsAt.toMillis() <= now && c.endsAt.toMillis() >= now && !(c.usageLimit && c.usedCount >= c.usageLimit)
    );
    const runningOffers = offers.filter((o) => o.isActive && o.startsAt.toMillis() <= now && o.endsAt.toMillis() >= now);
    const soon = 3 * 86400000;
    const endingSoon = [
      ...runningCoupons.map((c) => ({ kind: "Coupon", name: c.code, ends: c.endsAt.toMillis() })),
      ...runningOffers.map((o) => ({ kind: "Offer", name: o.title, ends: o.endsAt.toMillis() })),
    ]
      .filter((x) => x.ends - now <= soon)
      .sort((a, b) => a.ends - b.ends);

    return {
      cur, revenue, prevRevenue, aov, prevAov, cashCollected, cancelRate, prevCancelRate,
      liveCount: curLive.length, prevLiveCount: prevLive.length,
      series, todayCount: todayOrders.length, todaySales, statusParts,
      topProducts, topCategories, couponUse, discountGiven,
      customerCount: customers.length, newCustomers, repeatCustomers, recentCustomers,
      outOfStock, lowStock, pending, outForDelivery,
      runningCoupons: runningCoupons.length, runningOffers: runningOffers.length, endingSoon,
    };
  }, [orders, users, products, coupons, offers, categories, days]);

  if (loading) {
    return (
      <div className="grid animate-pulse grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-200/70 sm:h-32" />
        ))}
      </div>
    );
  }

  const attention = [
    { label: "Pending orders", count: d.pending, note: "Waiting to be confirmed", to: "/admin/orders" },
    { label: "Out for delivery", count: d.outForDelivery, note: "On the road now", to: "/admin/orders" },
    { label: "Out of stock", count: d.outOfStock.length, note: "Hidden from buying", to: "/admin/products" },
    { label: "Low stock", count: d.lowStock.length, note: `${LOW_STOCK} or fewer left`, to: "/admin/products" },
  ];

  const placedAt = (o: Order) =>
    o.createdAt ? o.createdAt.toDate().toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Welcome back, {admin.name.split(" ")[0]}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Today: {d.todayCount} {d.todayCount === 1 ? "order" : "orders"} worth {money(d.todaySales)}.
          </p>
        </div>
        {/* phone: the range picker takes the full row, desktop: sits on the right */}
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div role="group" aria-label="Date range" className="flex flex-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 sm:flex-none">
            {RANGES.map((r) => (
              <button
                key={r}
                aria-pressed={days === r}
                onClick={() => setDays(r)}
                className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium sm:flex-none sm:py-1.5 ${days === r ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {r} days
              </button>
            ))}
          </div>
          <button onClick={load} className="shrink-0 rounded-xl bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 active:bg-slate-100 sm:px-3 sm:py-2">
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
          {error}
        </p>
      )}

      {/* needs attention: two across on phones */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {attention.map((a) => (
          <Link
            key={a.label}
            to={a.to}
            className={`min-w-0 rounded-2xl px-3.5 py-3 ring-1 transition hover:shadow-sm active:bg-slate-50 sm:px-5 sm:py-4 ${
              a.count > 0 ? "bg-amber-50/60 ring-amber-200" : "bg-white ring-slate-200"
            }`}
          >
            <p className="text-xs text-slate-600 sm:text-sm">{a.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${a.count > 0 ? "text-amber-800" : "text-slate-400"}`}>{a.count}</p>
            <p className="text-xs text-slate-500">{a.count > 0 ? a.note : "All clear"}</p>
          </Link>
        ))}
      </div>

      {/* stat cards: two across on phones */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
        <StatCard label="Total sales" value={money(d.revenue)} note={<Delta cur={d.revenue} prev={d.prevRevenue} days={days} />} icon="M4 20V10M10 20V4M16 20v-8M22 20H2" />
        <StatCard label="Orders" value={String(d.liveCount)} note={<Delta cur={d.liveCount} prev={d.prevLiveCount} days={days} />} icon="M6 7h12l1 13H5L6 7ZM9 7a3 3 0 0 1 6 0" />
        <StatCard label="Average order value" value={money(d.aov)} note={<Delta cur={d.aov} prev={d.prevAov} days={days} />} icon="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        <StatCard label="Cash collected" value={money(d.cashCollected)} note="From delivered orders in this period" icon="M1 3h15v13H1zM16 8h4l3 3v5h-7z" />
        <StatCard label="Cancellation rate" value={`${d.cancelRate.toFixed(1)}%`} note={<Delta cur={d.cancelRate} prev={d.prevCancelRate} days={days} lowerIsBetter />} icon="M18 6 6 18M6 6l12 12" />
        <StatCard label="Customers" value={String(d.customerCount)} note={`${d.newCustomers} new · ${d.repeatCustomers} ordered more than once`} icon="M16 20v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      </div>

      {/* trend + status */}
      <div className="grid gap-3 sm:gap-5 xl:grid-cols-3">
        <Card title={`Sales, last ${days} days`} className="xl:col-span-2">
          <TrendChart series={d.series} />
        </Card>
        <Card title="Orders by status">
          <Donut parts={d.statusParts} />
        </Card>
      </div>

      {/* products, categories, coupons */}
      <div className="grid gap-3 sm:gap-5 xl:grid-cols-3">
        <Card title="Top products" action={<Link to="/admin/products" className="py-1 text-sm font-medium text-emerald-700 hover:text-emerald-800">Manage</Link>}>
          {d.topProducts.length === 0 ? (
            <Empty>No sales in this period yet.</Empty>
          ) : (
            <BarList items={d.topProducts.map((p) => ({ label: p.name, sub: `${p.qty} sold`, value: p.revenue }))} />
          )}
        </Card>
        <Card title="Sales by category">
          {d.topCategories.length === 0 ? (
            <Empty>No sales in this period yet.</Empty>
          ) : (
            <BarList color="bg-sky-500" items={d.topCategories.map(([name, v]) => ({ label: name, sub: `${v.qty} items`, value: v.revenue }))} />
          )}
        </Card>
        <Card title="Coupons used">
          {d.couponUse.length === 0 ? (
            <Empty>No coupons were used in this period.</Empty>
          ) : (
            <>
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {d.couponUse.map(([code, v]) => (
                  <li key={code} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                    <span className="truncate font-medium text-slate-800">{code}</span>
                    <span className="shrink-0 text-right text-xs text-slate-500 sm:text-sm">
                      {v.uses} {v.uses === 1 ? "order" : "orders"} · {money(v.discount)} off
                    </span>
                  </li>
                ))}
              </ul>
              <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5">
                {money(d.discountGiven)} given in discounts this period
              </p>
            </>
          )}
        </Card>
      </div>

      {/* recent orders + low stock */}
      <div className="grid gap-3 sm:gap-5 xl:grid-cols-3">
        <Card title="Recent orders" className="xl:col-span-2" action={<Link to="/admin/orders" className="py-1 text-sm font-medium text-emerald-700 hover:text-emerald-800">View all</Link>}>
          {/* phone: each order is a small card, no sideways scrolling */}
          <ul className="divide-y divide-slate-100 border-t border-slate-100 sm:hidden">
            {orders.slice(0, 8).map((o) => (
              <li key={o.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-900">{o.orderNo}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[o.status]}`}>{o.status}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-slate-600">{o.customerName}</span>
                  <span className="shrink-0 font-medium text-slate-800">{money(o.total)}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{placedAt(o)}</p>
              </li>
            ))}
            {orders.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-500">No orders yet.</li>}
          </ul>

          {/* tablet and desktop: table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Placed</th>
                  <th className="px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.slice(0, 8).map((o) => (
                  <tr key={o.id}>
                    <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-900">{o.orderNo}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{o.customerName}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">{placedAt(o)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{money(o.total)}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[o.status]}`}>{o.status}</span>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-500">No orders yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Stock alerts" action={<Link to="/admin/products" className="py-1 text-sm font-medium text-emerald-700 hover:text-emerald-800">Manage</Link>}>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {[...d.outOfStock, ...d.lowStock].slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                <span className="truncate text-slate-700">{p.name}</span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${p.stock === 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                  {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                </span>
              </li>
            ))}
            {d.outOfStock.length + d.lowStock.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-slate-500 sm:px-5">All products are well stocked.</li>
            )}
          </ul>
        </Card>
      </div>

      {/* promotions + customers */}
      <div className="grid gap-3 sm:gap-5 xl:grid-cols-2">
        <Card title="Coupons and offers" action={<Link to="/admin/coupons" className="py-1 text-sm font-medium text-emerald-700 hover:text-emerald-800">Manage</Link>}>
          <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:px-5">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-2xl font-semibold text-slate-900">{d.runningCoupons}</p>
              <p className="text-xs text-slate-500">Coupons running</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-2xl font-semibold text-slate-900">{d.runningOffers}</p>
              <p className="text-xs text-slate-500">Offers running</p>
            </div>
          </div>
          <p className="border-t border-slate-100 px-4 pt-3 text-xs font-medium text-slate-500 sm:px-5">Ending in the next 3 days</p>
          <ul className="divide-y divide-slate-100 pb-2">
            {d.endingSoon.slice(0, 4).map((x) => {
              const left = Math.max(0, Math.ceil((x.ends - Date.now()) / 86400000));
              return (
                <li key={`${x.kind}-${x.name}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                  <span className="min-w-0 truncate text-slate-700">
                    <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{x.kind}</span>
                    {x.name}
                  </span>
                  <span className="shrink-0 text-xs text-amber-700">{left <= 1 ? "Ends soon" : `${left} days left`}</span>
                </li>
              );
            })}
            {d.endingSoon.length === 0 && <li className="px-4 py-4 text-sm text-slate-500 sm:px-5">Nothing is about to end.</li>}
          </ul>
        </Card>

        <Card title="Newest customers">
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {d.recentCustomers.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{u.name}</p>
                  <p className="truncate text-xs text-slate-500">{u.phone || u.email}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-500">
                  {u.createdAt ? `Joined ${shortDate(u.createdAt.toDate())}` : ""}
                </span>
              </li>
            ))}
            {d.recentCustomers.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-500 sm:px-5">No customers have signed up yet.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}