import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Footer from "../../components/client/Footer";
import Modal from "../../components/client/Modal";
import Navbar from "../../components/client/Navbar";
import OrderReviewModal from "../../components/client/Orderreviewmodal";
import ReceiptModal from "../../components/client/Receiptmodal ·"; // file name must match exactly
import StarRating from "../../components/client/Starrating";
import { useAuth } from "../../routes/AuthContext";
import { useCart } from "../../routes/client/ Cartcontext";
import { getErrorMessage } from "../../service/authService";
import { getActiveOffers } from "../../service/offerService";
import { getMyOrders } from "../../service/orderService";
import { getProduct } from "../../service/productService";
import { getMyReviews } from "../../service/reviewService";
import { getDeal } from "../../utils/pricing";
import { SUPPORT, mailtoHref, telHref, whatsappUrl } from "../../utils/support";
import type { Order, OrderStatus, Review } from "../../utils/types";
import { gramsLabel, packPrice, ratePerKgOf } from "../../utils/weight";

/* ───────── constants & helpers ───────── */
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const fmtDateTime = (o: Order) =>
  o.createdAt
    ? o.createdAt.toDate().toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "Just now";

const STEPS: OrderStatus[] = ["Pending", "Confirmed", "Out for delivery", "Delivered"];
const STEP_LABEL: Record<OrderStatus, string> = {
  Pending: "Placed",
  Confirmed: "Confirmed",
  "Out for delivery": "On the way",
  Delivered: "Delivered",
  Cancelled: "Cancelled",
};
const STATUS_NOTE: Record<OrderStatus, string> = {
  Pending: "We’ve received your order and will confirm it shortly.",
  Confirmed: "Your order is confirmed.",
  "Out for delivery": "Your order is on its way to you.",
  Delivered: "Your order was delivered.",
  Cancelled: "This order was cancelled.",
};
const STATUS_STYLE: Record<OrderStatus, string> = {
  Pending: "bg-slate-100 text-slate-700",
  Confirmed: "bg-sky-50 text-sky-700",
  "Out for delivery": "bg-amber-50 text-amber-700",
  Delivered: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-red-50 text-red-700",
};

type Filter = "all" | "active" | "delivered" | "cancelled";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "In progress" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];
const matchesFilter = (o: Order, f: Filter) =>
  f === "all" ||
  (f === "active" && o.status !== "Delivered" && o.status !== "Cancelled") ||
  (f === "delivered" && o.status === "Delivered") ||
  (f === "cancelled" && o.status === "Cancelled");

const ISSUES = ["Where is my order?", "Change or cancel my order", "Missing, wrong or damaged item", "Payment or bill question", "Something else"];

const FAQ = [
  { q: "How do I track my order?", a: "Each order shows its progress: Placed, Confirmed, On the way and Delivered. This page refreshes every minute, and you can open an order for the full details." },
  { q: "How do I pay?", a: "All orders are cash on delivery. Please keep the amount ready for the delivery person." },
  { q: "Can I cancel or change my order?", a: "Contact us as soon as you can. An order can be cancelled until it is out for delivery." },
  { q: "An item is missing, wrong or damaged", a: "Use Get help on the order and choose the issue. Tell us which item, and we’ll look into it." },
  { q: "How do I review an order?", a: "Once an order is delivered, tap Rate order. You can rate the order as a whole and each product in it, and edit your review later." },
  { q: "How do I get a bill receipt?", a: "Once an order is delivered, tap Receipt to view your bill. You can download it as a PDF from there." },
];

/** hides the scrollbar on a scrolling row */
const NO_BAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

// taller tap targets on phones, compact again from sm up
const btn = "rounded-lg px-3 py-2.5 text-center text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600/40 disabled:opacity-60 sm:py-2";
const btnPrimary = `${btn} bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-700`;
const btnGhost = `${btn} border border-slate-300 text-slate-700 hover:bg-slate-50 active:bg-slate-50`;

/** "Tomato · 750 g" for products bought by weight, "Rice × 2" for the rest. */
const itemSummary = (i: Order["items"][number]) => (i.grams ? `${i.name} · ${gramsLabel(i.grams)}` : `${i.name} × ${i.quantity}`);

/* ───────── small pieces ───────── */
function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[status]}`}>{status}</span>;
}

function Tracker({ status }: { status: OrderStatus }) {
  if (status === "Cancelled") return null;
  const current = STEPS.indexOf(status);
  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label="Order progress">
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === current ? "step" : undefined}>
          <div className={`h-1.5 rounded-full ${i <= current ? "bg-emerald-500" : "bg-slate-200"}`} />
          <p className={`mt-1.5 text-[11px] sm:text-xs ${i === current ? "font-semibold text-slate-900" : i < current ? "text-slate-600" : "text-slate-400"}`}>
            {STEP_LABEL[s]}
          </p>
        </li>
      ))}
    </ol>
  );
}

function HelpModal({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const [issue, setIssue] = useState(ISSUES[0]);
  const message = order
    ? `Hi Rahath, I need help with order ${order.orderNo} (${order.status}).\nIssue: ${issue}`
    : `Hi Rahath, I need help.\nIssue: ${issue}`;
  const row =
    "flex flex-col gap-0.5 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/40 active:bg-emerald-50/40 sm:flex-row sm:items-center sm:justify-between sm:gap-3";

  return (
    <Modal title={order ? `Help with ${order.orderNo}` : "Contact support"} onClose={onClose}>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">What do you need help with?</span>
        <select value={issue} onChange={(e) => setIssue(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/25 sm:py-2 sm:text-sm">
          {ISSUES.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
      </label>
      <div className="mt-4 space-y-2">
        <a href={whatsappUrl(message)} target="_blank" rel="noreferrer" className={row}>
          <span>Chat on WhatsApp</span>
          <span className="text-xs font-normal text-slate-500">Your order details are filled in</span>
        </a>
        <a href={telHref()} className={row}>
          <span>Call us</span>
          <span className="text-xs font-normal text-slate-500">{SUPPORT.phone}</span>
        </a>
        <a href={mailtoHref(order ? `Help with order ${order.orderNo}` : "Help", message)} className={row}>
          <span>Send an email</span>
          <span className="break-all text-xs font-normal text-slate-500">{SUPPORT.email}</span>
        </a>
      </div>
    </Modal>
  );
}

/** Home / My orders. Tablet and desktop only. */
function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 hidden text-sm text-slate-500 sm:block">
      <Link to="/" className="hover:text-slate-800">Home</Link>
      <span className="mx-2">/</span>
      <span className="text-slate-800">My orders</span>
    </nav>
  );
}

/* ───────── page ───────── */
export default function Orders() {
  const { user, profile } = useAuth();
  const { count, addItem } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  /* Back button (mobile only).
     Goes to the previous page. If the orders page was opened directly (no history inside the app),
     it goes to the home page instead so the button never leaves the site. */
  const goBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/");
  };

  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<Order | null>(null);
  const [receiptFor, setReceiptFor] = useState<Order | null>(null);
  const [helpFor, setHelpFor] = useState<Order | "general" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const userName = profile?.name ?? user?.displayName ?? "Customer";

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setError("");
      const [o, r] = await Promise.all([getMyOrders(user.uid), getMyReviews(user.uid)]);
      setOrders(o);
      setReviews(r);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60000);
    return () => clearInterval(t);
  }, [load]);

  const reviewsByOrder = useMemo(() => {
    const m = new Map<string, Review[]>();
    reviews.forEach((r) => m.set(r.orderId, [...(m.get(r.orderId) ?? []), r]));
    return m;
  }, [reviews]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: orders.length, active: 0, delivered: 0, cancelled: 0 };
    orders.forEach((o) => {
      (["active", "delivered", "cancelled"] as const).forEach((f) => {
        if (matchesFilter(o, f)) c[f] += 1;
      });
    });
    return c;
  }, [orders]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(
      (o) =>
        matchesFilter(o, filter) &&
        (!q || o.orderNo.toLowerCase().includes(q) || o.items.some((i) => i.name.toLowerCase().includes(q)))
    );
  }, [orders, filter, search]);

  const selected = orders.find((o) => o.id === selectedId) ?? null;

  async function reorder(o: Order) {
    setBusyId(o.id);
    setNotice(null);
    try {
      const [offers, products] = await Promise.all([
        getActiveOffers(),
        Promise.all(o.items.map((i) => getProduct(i.productId).catch(() => null))),
      ]);
      let added = 0;
      let missing = 0;
      o.items.forEach((item, idx) => {
        const p = products[idx];
        if (!p || !p.isActive || p.stock <= 0) {
          missing += 1;
          return;
        }
        const deal = getDeal(p, offers);
        const ok = item.grams
          ? // bought by weight: add the same weight again at today's per-kg rate
            addItem({ ...p, price: packPrice(deal.price, item.grams), grams: item.grams, ratePerKg: deal.price }, 1)
          : addItem({ ...p, price: deal.price }, item.quantity);
        if (ok) added += 1;
        else missing += 1;
      });
      setNotice({
        ok: added > 0,
        text:
          added === 0
            ? "None of these items are available right now."
            : `Added ${added} ${added === 1 ? "item" : "items"} to your cart at today’s prices.${missing ? ` ${missing} ${missing === 1 ? "item is" : "items are"} no longer available.` : ""}`,
      });
    } catch (e) {
      setNotice({ ok: false, text: getErrorMessage(e) });
    } finally {
      setBusyId(null);
    }
  }

  const reviewButton = (o: Order) => {
    const mine = reviewsByOrder.get(o.id) ?? [];
    return (
      <button onClick={() => setReviewing(o)} className={btnGhost}>
        {mine.length ? "Edit review" : "Rate order"}
      </button>
    );
  };

  const receiptButton = (o: Order) => (
    <button onClick={() => setReceiptFor(o)} className={btnGhost}>
      Receipt
    </button>
  );

  /* signed-out state */
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
        <Navbar cartCount={count} />
        <main className="mx-auto max-w-md px-4 py-16 text-center sm:py-20">
          <h1 className="text-2xl font-semibold text-slate-900">Sign in to see your orders</h1>
          <p className="mt-2 text-slate-600">Your order history and tracking live in your account.</p>
          <Link to="/login" className={`${btnPrimary} mt-6 inline-block px-6 py-3`}>
            Sign in
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    // extra bottom space on phones so the bottom tab bar never covers the footer
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <Navbar cartCount={count} />

      <main className="mx-auto max-w-4xl px-3 py-5 sm:px-6 sm:py-8">
        {/* back button: phones only (the breadcrumb covers larger screens) */}
        <div className="mb-3 sm:hidden">
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 active:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        <Breadcrumb />

        <div className="mb-5 flex items-start justify-between gap-3 sm:mb-6 sm:items-end">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">My orders</h1>
            <p className="text-sm text-slate-500">Track your orders and see your order history.</p>
          </div>
          <button onClick={() => setHelpFor("general")} className={`${btnGhost} shrink-0`}>
            Contact support
          </button>
        </div>

        {notice && (
          <div role="status" className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm ring-1 ${notice.ok ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-amber-50 text-amber-800 ring-amber-100"}`}>
            <span>{notice.text}</span>
            {notice.ok && (
              <Link to="/cart" className="py-1 font-semibold underline">
                Go to cart
              </Link>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
            {error} <button className="font-medium underline" onClick={load}>Retry</button>
          </p>
        )}

        {/* filters: one scrolling row on phones, wrapping row from sm up */}
        <div className={`-mx-3 mb-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 ${NO_BAR}`}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm sm:px-3 sm:py-1 ${filter === f.key ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {f.label} <span className={filter === f.key ? "text-white/80" : "text-slate-500"}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/25 sm:mb-5 sm:max-w-sm sm:py-2 sm:text-sm"
          placeholder="Search by order number or product"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* list */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-slate-200 sm:py-14">
            <p className="font-medium text-slate-900">{orders.length === 0 ? "You haven’t placed any orders yet" : "No orders match these filters"}</p>
            {orders.length === 0 && (
              <>
                <p className="mt-1 text-sm text-slate-500">When you do, you’ll be able to track it here.</p>
                <Link to="/shop" className={`${btnPrimary} mt-5 inline-block`}>
                  Start shopping
                </Link>
              </>
            )}
          </div>
        ) : (
          <ul className="space-y-3 sm:space-y-4">
            {visible.map((o) => {
              const mine = reviewsByOrder.get(o.id) ?? [];
              const overall = mine.find((r) => r.productId === null);
              const shown = o.items.slice(0, 3).map(itemSummary).join(", ");
              const more = o.items.length - 3;
              return (
                <li key={o.id}>
                  <article className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                    <div className="flex items-start justify-between gap-2 p-4 sm:p-5">
                      <div className="min-w-0">
                        <button onClick={() => setSelectedId(o.id)} className="break-all text-left font-semibold text-slate-900 hover:underline">
                          {o.orderNo}
                        </button>
                        <p className="text-sm text-slate-500">Placed {fmtDateTime(o)}</p>
                      </div>
                      <StatusBadge status={o.status} />
                    </div>

                    <div className="px-4 sm:px-5">
                      <p className="mb-3 text-sm text-slate-600">{STATUS_NOTE[o.status]}</p>
                      <Tracker status={o.status} />
                      <p className="mt-4 break-words text-sm text-slate-600">
                        {shown}
                        {more > 0 && <span className="text-slate-400"> +{more} more</span>}
                      </p>
                      {overall && (
                        <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                          Your rating <StarRating value={overall.rating} size="sm" />
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <p className="text-sm">
                        <span className="text-base font-semibold text-slate-900">{inr(o.total)}</span>
                        <span className="text-slate-500"> · Cash on delivery</span>
                      </p>
                      {/* phones: neat 2-column buttons; larger screens: one row */}
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                        <button onClick={() => setSelectedId(o.id)} className={btnGhost}>
                          Details
                        </button>
                        {o.status === "Delivered" && receiptButton(o)}
                        {o.status === "Delivered" && reviewButton(o)}
                        <button onClick={() => reorder(o)} disabled={busyId === o.id} className={btnGhost}>
                          {busyId === o.id ? "Adding…" : "Order again"}
                        </button>
                        <button onClick={() => setHelpFor(o)} className={btnGhost}>
                          Get help
                        </button>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}

        {/* help and support */}
        <section className="mt-10 sm:mt-12" aria-labelledby="help-heading">
          <h2 id="help-heading" className="text-xl font-semibold text-slate-900">
            Help and support
          </h2>
          <div className="mt-4 divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-4 py-4 sm:px-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-slate-900">
                  {f.q}
                  <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 8 5 5 5-5" />
                  </svg>
                </summary>
                <p className="mt-2 text-sm text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-emerald-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm text-emerald-900">Still need help? We’re happy to talk.</p>
            <button onClick={() => setHelpFor("general")} className={btnPrimary}>
              Contact support
            </button>
          </div>
        </section>
      </main>

      <Footer />

      {/* order details */}
      {selected && (
        <Modal title={`Order ${selected.orderNo}`} onClose={() => setSelectedId(null)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">Placed {fmtDateTime(selected)}</p>
            <StatusBadge status={selected.status} />
          </div>
          <p className="mt-3 text-sm text-slate-600">{STATUS_NOTE[selected.status]}</p>
          <div className="mt-3">
            <Tracker status={selected.status} />
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 p-3 text-sm sm:p-4">
            <p className="font-medium text-slate-900">Delivering to</p>
            <p className="mt-1 text-slate-700">{selected.customerName} · {selected.phone}</p>
            <p className="whitespace-pre-line break-words text-slate-600">{selected.address}</p>
          </div>

          <table className="mt-5 w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 pl-2 text-right font-medium">Weight / Qty</th>
                <th className="py-2 pl-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {selected.items.map((i, idx) => (
                <tr key={`${i.productId}:${idx}`}>
                  <td className="py-2 pr-1 align-top text-slate-900">
                    {i.name}
                    <span className="block text-xs text-slate-400 sm:inline sm:text-sm"><span className="hidden sm:inline"> · </span>{i.grams ? `${inr(ratePerKgOf(i))}/kg` : inr(i.price)}</span>
                  </td>
                  <td className="py-2 pl-2 text-right align-top text-slate-700">{i.grams ? gramsLabel(i.grams) : i.quantity}</td>
                  <td className="py-2 pl-2 text-right align-top text-slate-900">{inr(i.price * i.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between gap-3 text-slate-600"><dt>Subtotal</dt><dd>{inr(selected.subtotal)}</dd></div>
            {selected.discountAmount > 0 && (
              <div className="flex justify-between gap-3 text-emerald-700">
                <dt>Discount{selected.couponCode ? ` (${selected.couponCode})` : ""}</dt>
                <dd>− {inr(selected.discountAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 text-slate-600"><dt>Delivery</dt><dd>{selected.deliveryFee > 0 ? inr(selected.deliveryFee) : "Free"}</dd></div>
            <div className="flex justify-between gap-3 text-base font-semibold text-slate-900"><dt>Total, pay on delivery</dt><dd>{inr(selected.total)}</dd></div>
          </dl>

          {selected.status === "Delivered" && (
            <div className="mt-5 rounded-xl bg-slate-50 p-3 sm:p-4">
              <p className="text-sm font-medium text-slate-900">Your review</p>
              {(reviewsByOrder.get(selected.id) ?? []).length === 0 ? (
                <p className="mt-1 text-sm text-slate-500">You haven’t reviewed this order yet.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {[...(reviewsByOrder.get(selected.id) ?? [])]
                    .sort((a, b) => (a.productId === null ? -1 : b.productId === null ? 1 : 0))
                    .map((r) => (
                      <li key={r.id}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-700">{r.productId === null ? "Whole order" : r.productName}</span>
                          <StarRating value={r.rating} size="sm" />
                        </div>
                        {r.comment && <p className="text-slate-500">{r.comment}</p>}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            {selected.status === "Delivered" && receiptButton(selected)}
            {selected.status === "Delivered" && reviewButton(selected)}
            <button onClick={() => reorder(selected)} disabled={busyId === selected.id} className={btnGhost}>
              {busyId === selected.id ? "Adding…" : "Order again"}
            </button>
            <button onClick={() => setHelpFor(selected)} className={btnPrimary}>
              Get help
            </button>
          </div>
        </Modal>
      )}

      {reviewing && (
        <OrderReviewModal
          order={reviewing}
          existing={reviewsByOrder.get(reviewing.id) ?? []}
          userId={user.uid}
          userName={userName}
          onClose={() => setReviewing(null)}
          onSaved={load}
        />
      )}

      {helpFor && <HelpModal order={helpFor === "general" ? null : helpFor} onClose={() => setHelpFor(null)} />}

      {/* receipt: last so it opens on top of the details modal */}
      {receiptFor && <ReceiptModal order={receiptFor} onClose={() => setReceiptFor(null)} />}
    </div>
  );
}