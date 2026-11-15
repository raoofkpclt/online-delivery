import { useCallback, useEffect, useMemo, useState } from "react";
import { getAllOrders, updateOrderStatus, ORDER_FLOW } from "../../service/orderService";
import type { Order, OrderStatus } from "../../utils/types";
import { gramsLabel, ratePerKgOf } from "../../utils/weight";
import { customerWaUrl, statusMessage, deliveredMessage } from "../../utils/ordermessages";
import { useConfirm } from "./ConfirmModal";

const STATUSES: OrderStatus[] = ["Pending", "Confirmed", "Out for delivery", "Delivered", "Cancelled"];

const STATUS_STYLE: Record<OrderStatus, string> = {
  Pending: "bg-amber-100 text-amber-900",
  Confirmed: "bg-sky-100 text-sky-800",
  "Out for delivery": "bg-violet-100 text-violet-800",
  Delivered: "bg-green-100 text-green-800",
  Cancelled: "bg-stone-200 text-stone-700",
};

/** The one forward step for each status, with the button wording. */
const NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  Pending: { to: "Confirmed", label: "Confirm order" },
  Confirmed: { to: "Out for delivery", label: "Send out for delivery" },
  "Out for delivery": { to: "Delivered", label: "Mark delivered" },
};

/** Content of the alert modal. Add actionLabel + onAction to show a second button (e.g. "Try again"). */
type AlertInfo = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const fmtDateTime = (o: Order) =>
  o.createdAt
    ? o.createdAt.toDate().toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "—";

/** Total weight of the order's weighed items, e.g. "1.75 kg" (empty when there are none). */
const orderWeight = (o: Order) => {
  const g = o.items.reduce((n, i) => n + (i.grams ? i.grams * i.quantity : 0), 0);
  return g > 0 ? gramsLabel(g) : "";
};

// text-base on phones stops iPhones zooming into the field, compact text from sm up
const inputCls =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900 sm:py-2 sm:text-sm " +
  "placeholder:text-stone-400 focus:border-[#2f6b3a] focus:outline-none focus:ring-2 focus:ring-[#2f6b3a]/25";
// buttons are taller on phones so they are easy to tap
const primaryBtn =
  "rounded-md bg-[#2f6b3a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#265730] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#2f6b3a]/40 sm:py-2";
const ghostBtn =
  "rounded-md border border-stone-300 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 active:bg-stone-100 disabled:opacity-60 sm:py-2";

/** Popup for errors. A bottom sheet on phones, a centred box from sm up. */
function AlertModal({ info, onClose }: { info: AlertInfo; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-title"
        aria-describedby="alert-message"
        className="w-full max-w-sm rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-xl sm:pb-5"
      >
        <div className="flex gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-base font-semibold text-red-700"
            aria-hidden="true"
          >
            !
          </span>
          <div className="min-w-0">
            <h2 id="alert-title" className="text-base font-semibold text-stone-900">
              {info.title}
            </h2>
            <p id="alert-message" className="mt-1 text-sm text-stone-600">
              {info.message}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button autoFocus={!info.actionLabel} onClick={onClose} className={ghostBtn + " w-full sm:w-auto"}>
            {info.actionLabel ? "Close" : "OK"}
          </button>
          {info.actionLabel && (
            <button
              autoFocus
              onClick={() => {
                onClose();
                info.onAction?.();
              }}
              className={primaryBtn + " w-full sm:w-auto"}
            >
              {info.actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const OrderManagement = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [statusFilter, setStatusFilter] = useState<"" | OrderStatus>("");
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [restoreStock, setRestoreStock] = useState(false);

  // popup for errors
  const [alertInfo, setAlertInfo] = useState<AlertInfo | null>(null);

  const { confirm, confirmElement } = useConfirm();

  /** silent = the automatic refresh: it never shows a popup, the list just keeps what it has */
  const load = useCallback(async (silent = false) => {
    try {
      setLoadFailed(false);
      setOrders(await getAllOrders());
    } catch (err) {
      console.error(err);
      if (silent) return;
      setLoadFailed(true);
      setAlertInfo({
        title: "Could not load orders",
        message: "Check your connection and try again.",
        actionLabel: "Try again",
        onAction: () => {
          setLoading(true);
          void load();
        },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // pick up new orders without a manual refresh
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, 60000);
    return () => clearInterval(t);
  }, [load]);

  const counts = useMemo(() => {
    const m = new Map<OrderStatus, number>();
    orders.forEach((o) => m.set(o.status, (m.get(o.status) ?? 0) + 1));
    return m;
  }, [orders]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.orderNo.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.phone.includes(q)
      );
    });
  }, [orders, statusFilter, search]);

  const selected = orders.find((o) => o.id === selectedId) ?? null;

  // popups: Esc closes the top one, and the page behind does not scroll
  const anyModal = !!selected || !!alertInfo;
  useEffect(() => {
    if (!anyModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (alertInfo) setAlertInfo(null);
      else if (!busyId) setSelectedId(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [anyModal, alertInfo, busyId]);

  function openOrder(o: Order) {
    setSelectedId(o.id);
    setCancelling(false);
    setRestoreStock(false);
  }

  /** Delivered: ask first, then open the customer's chat with the thank-you / feedback message. */
  async function sendThanks(o: Order) {
    const ok = await confirm({
      title: "Send thank-you message on WhatsApp?",
      message: `Order ${o.orderNo} is delivered. WhatsApp will open with a thank-you message for ${o.customerName}, asking for feedback and a rating, and telling them the bill is in the app.`,
      confirmLabel: "Send on WhatsApp",
      cancelLabel: "Not now",
    });
    if (!ok) return;
    window.open(customerWaUrl(o.phone, statusMessage(o)), "_blank");
  }

  /** Manual WhatsApp button in the order details. */
  function messageCustomer(o: Order) {
    if (o.status === "Delivered") deliveredMessage(o);
    else window.open(customerWaUrl(o.phone, statusMessage(o)), "_blank");
  }

  async function changeStatus(o: Order, next: OrderStatus) {
    setBusyId(o.id);
    let ok = false;
    try {
      await updateOrderStatus(o.id, next, { restoreStock: next === "Cancelled" && restoreStock });
      await load(true);
      setCancelling(false);
      ok = true;
    } catch (err) {
      console.error(err);
      setAlertInfo({
        title: "Could not update the order",
        message: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      });
      load(true); // the order may have changed elsewhere
    } finally {
      setBusyId(null);
    }
    // only a delivered order asks about WhatsApp; other status changes are silent
    if (ok && next === "Delivered") await sendThanks({ ...o, status: next });
  }

  const th = "px-4 py-3 font-medium";
  const showEmptyState = loading || visible.length === 0;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex items-end justify-between gap-3 sm:mb-5">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-stone-900 sm:text-2xl">Orders</h1>
          <p className="text-sm text-stone-500">All orders are cash on delivery. The list refreshes every minute.</p>
        </div>
        <button onClick={() => load()} className={ghostBtn + " shrink-0"}>
          Refresh
        </button>
      </header>

      {/* status chips double as filters: one scrolling row on phones, wrapped from sm */}
      <div className="-mx-3 mb-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:mb-4 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        {([["", "All"], ...STATUSES.map((s) => [s, s])] as [string, string][]).map(([value, label]) => {
          const n = value === "" ? orders.length : counts.get(value as OrderStatus) ?? 0;
          const on = statusFilter === value;
          return (
            <button
              key={label}
              onClick={() => setStatusFilter(value as "" | OrderStatus)}
              aria-pressed={on}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm sm:px-3 sm:py-1 ${
                on ? "border-[#2f6b3a] bg-[#2f6b3a] text-white" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
              }`}
            >
              {label} <span className={on ? "text-white/80" : "text-stone-500"}>{n}</span>
            </button>
          );
        })}
      </div>

      <input
        type="search"
        className={inputCls + " mb-4 sm:max-w-sm"}
        placeholder="Search by order number, customer or phone"
        aria-label="Search orders"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {showEmptyState ? (
        <div className="rounded-lg border border-stone-200 bg-white px-4 py-10 text-center text-sm text-stone-500">
          {loading ? (
            "Loading orders…"
          ) : loadFailed ? (
            <>
              Orders could not be loaded.{" "}
              <button
                className="font-medium text-[#2f6b3a] underline"
                onClick={() => {
                  setLoading(true);
                  void load();
                }}
              >
                Try again
              </button>
            </>
          ) : orders.length === 0 ? (
            "No orders yet. New orders appear here as customers place them."
          ) : (
            "No orders match these filters."
          )}
        </div>
      ) : (
        <>
          {/* phones and tablets: one card per order, no sideways scrolling */}
          <ul className="grid gap-3 sm:grid-cols-2 xl:hidden">
            {visible.map((o) => {
              const step = NEXT_STEP[o.status];
              const weight = orderWeight(o);
              return (
                <li key={o.id} className="min-w-0 rounded-xl border border-stone-200 bg-white p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button onClick={() => openOrder(o)} className="font-semibold text-stone-900 hover:underline">
                        {o.orderNo}
                      </button>
                      <p className="text-xs text-stone-500">{fmtDateTime(o)}</p>
                    </div>
                    <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${STATUS_STYLE[o.status]}`}>{o.status}</span>
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-medium text-stone-900">{o.customerName}</p>
                      <a href={`tel:${o.phone}`} className="text-xs text-[#2f6b3a] hover:underline">
                        {o.phone}
                      </a>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {o.items.length} {o.items.length === 1 ? "item" : "items"}
                        {weight && ` · ${weight} by weight`}
                      </p>
                    </div>
                    <p className="shrink-0 text-base font-semibold text-stone-900">{inr(o.total)}</p>
                  </div>

                  <div className={`mt-3 grid gap-2 ${step ? "grid-cols-[1fr_auto]" : "grid-cols-1"}`}>
                    {step && (
                      <button disabled={busyId === o.id} onClick={() => changeStatus(o, step.to)} className={primaryBtn}>
                        {busyId === o.id ? "Updating…" : step.label}
                      </button>
                    )}
                    <button onClick={() => openOrder(o)} className={ghostBtn}>
                      View
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* large screens: table */}
          <div className="hidden overflow-x-auto rounded-lg border border-stone-200 bg-white xl:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                <tr>
                  <th className={th}>Order</th>
                  <th className={th}>Customer</th>
                  <th className={th}>Items</th>
                  <th className={th}>Total</th>
                  <th className={th}>Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visible.map((o) => {
                  const step = NEXT_STEP[o.status];
                  const weight = orderWeight(o);
                  return (
                    <tr key={o.id} className="hover:bg-stone-50/60">
                      <td className="px-4 py-3">
                        <button onClick={() => openOrder(o)} className="font-medium text-stone-900 hover:underline">
                          {o.orderNo}
                        </button>
                        <div className="text-xs text-stone-500">{fmtDateTime(o)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-stone-900">{o.customerName}</div>
                        <div className="text-xs text-stone-500">{o.phone}</div>
                      </td>
                      <td className="px-4 py-3 text-stone-700">
                        {o.items.length} {o.items.length === 1 ? "item" : "items"}
                        {weight && <div className="text-xs text-stone-500">{weight} by weight</div>}
                      </td>
                      <td className="px-4 py-3 text-stone-700">{inr(o.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_STYLE[o.status]}`}>{o.status}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {step && (
                          <button
                            disabled={busyId === o.id}
                            onClick={() => changeStatus(o, step.to)}
                            className="mr-3 text-[#2f6b3a] hover:underline disabled:opacity-50"
                          >
                            {busyId === o.id ? "Updating…" : step.label}
                          </button>
                        )}
                        <button onClick={() => openOrder(o)} className="text-stone-700 hover:underline">
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* order details: full-width sheet on phones, centred box from sm up */}
      {selected && (
        <div
          id="order-overlay"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          onMouseDown={(e) => e.target === e.currentTarget && !busyId && setSelectedId(null)}
        >
          <style>{`@media print {
            body * { visibility: hidden; }
            #order-print, #order-print * { visibility: visible; }
            #order-overlay, #order-panel, #order-body { position: static !important; overflow: visible !important; max-height: none !important; }
            #order-print { position: absolute; inset: 0; padding: 16px; }
            .print-table { display: table !important; }
            .print-list { display: none !important; }
            .no-print { display: none !important; }
          }`}</style>

          <div
            id="order-panel"
            className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-h-[90dvh] sm:rounded-xl"
          >
            {/* title stays visible */}
            <div className="no-print flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 sm:px-6 sm:py-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-stone-900">Order {selected.orderNo}</h2>
                <p className="text-xs text-stone-500 sm:text-sm">Placed {fmtDateTime(selected)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded px-2 py-1 text-xs sm:text-sm ${STATUS_STYLE[selected.status]}`}>
                  {selected.status}
                </span>
                <button
                  onClick={() => setSelectedId(null)}
                  disabled={!!busyId}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-stone-500 hover:bg-stone-100 disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            </div>

            {/* only this part scrolls */}
            <div id="order-body" className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
              <div id="order-print">
                {/* shown on the printed slip only, the screen title is above */}
                <div className="mb-4 hidden print:block">
                  <h2 className="text-lg font-semibold text-stone-900">Order {selected.orderNo}</h2>
                  <p className="text-sm text-stone-500">
                    Placed {fmtDateTime(selected)} · {selected.status}
                  </p>
                </div>

                <div className="mb-4 rounded-lg border border-stone-200 p-3 text-sm">
                  <div className="font-medium text-stone-900">{selected.customerName}</div>
                  <a href={`tel:${selected.phone}`} className="inline-block py-1 text-[#2f6b3a] hover:underline">
                    {selected.phone}
                  </a>
                  <p className="mt-1 whitespace-pre-line break-words text-stone-700">{selected.address}</p>
                </div>

                {/* phone: each item as a small row */}
                <ul className="print-list divide-y divide-stone-100 border-y border-stone-100 sm:hidden">
                  {selected.items.map((i, idx) => (
                    <li key={`${i.productId}:${idx}`} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="text-stone-900">{i.name}</p>
                        <p className="text-xs text-stone-500">
                          {i.grams ? `${gramsLabel(i.grams)} at ${inr(ratePerKgOf(i))}/kg` : `${i.quantity} × ${inr(i.price)}`}
                        </p>
                      </div>
                      <p className="shrink-0 font-medium text-stone-900">{inr(i.price * i.quantity)}</p>
                    </li>
                  ))}
                </ul>

                {/* sm and up (and the printed slip): table */}
                <table className="print-table hidden w-full text-left text-sm sm:table">
                  <thead className="border-b border-stone-200 text-stone-600">
                    <tr>
                      <th className="py-2 font-medium">Item</th>
                      <th className="py-2 text-right font-medium">Rate</th>
                      <th className="py-2 text-right font-medium">Weight / Qty</th>
                      <th className="py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {selected.items.map((i, idx) => (
                      <tr key={`${i.productId}:${idx}`}>
                        <td className="py-2 text-stone-900">{i.name}</td>
                        <td className="py-2 text-right text-stone-700">
                          {i.grams ? `${inr(ratePerKgOf(i))}/kg` : inr(i.price)}
                        </td>
                        <td className="py-2 text-right text-stone-700">{i.grams ? gramsLabel(i.grams) : i.quantity}</td>
                        <td className="py-2 text-right text-stone-900">{inr(i.price * i.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <dl className="mt-3 space-y-1 border-t border-stone-200 pt-3 text-sm">
                  <div className="flex justify-between text-stone-700">
                    <dt>Subtotal</dt>
                    <dd>{inr(selected.subtotal)}</dd>
                  </div>
                  {selected.discountAmount > 0 && (
                    <div className="flex justify-between text-stone-700">
                      <dt>Discount{selected.couponCode ? ` (${selected.couponCode})` : ""}</dt>
                      <dd>− {inr(selected.discountAmount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between text-stone-700">
                    <dt>Delivery</dt>
                    <dd>{selected.deliveryFee > 0 ? inr(selected.deliveryFee) : "Free"}</dd>
                  </div>
                  <div className="flex justify-between text-base font-semibold text-stone-900">
                    <dt>Collect on delivery</dt>
                    <dd>{inr(selected.total)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* actions stay visible, so the admin never has to scroll to reach them */}
            <div className="no-print border-t border-stone-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
              {cancelling ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-medium text-red-900">Cancel order {selected.orderNo}?</p>
                  <p className="mt-1 text-sm text-red-800">
                    This can't be undone. The customer's order will show as cancelled.
                  </p>
                  <label className="mt-2 flex min-h-10 cursor-pointer items-center gap-2 text-sm text-stone-800">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[#2f6b3a] sm:h-4 sm:w-4"
                      checked={restoreStock}
                      onChange={(e) => setRestoreStock(e.target.checked)}
                    />
                    Return the items to stock
                  </label>
                  <p className="mt-1 text-xs text-stone-600">
                    Tick this only if stock was reduced when the order was placed. Items sold by weight are returned by
                    weight.
                  </p>
                  <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      disabled={busyId === selected.id}
                      onClick={() => setCancelling(false)}
                      className={ghostBtn + " w-full sm:w-auto"}
                    >
                      Keep order
                    </button>
                    <button
                      disabled={busyId === selected.id}
                      onClick={() => changeStatus(selected, "Cancelled")}
                      className="w-full rounded-md bg-red-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60 sm:w-auto sm:py-2"
                    >
                      {busyId === selected.id ? "Cancelling…" : "Cancel order"}
                    </button>
                  </div>
                </div>
              ) : (
                /* phone: main action on top, then print and WhatsApp. desktop: one row */
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <button onClick={() => window.print()} className={ghostBtn}>
                      Print slip
                    </button>
                    <button onClick={() => messageCustomer(selected)} className={ghostBtn}>
                      <span className="sm:hidden">WhatsApp</span>
                      <span className="hidden sm:inline">
                        {selected.status === "Delivered" ? "Send thank-you on WhatsApp" : "Message on WhatsApp"}
                      </span>
                    </button>
                  </div>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <button onClick={() => setSelectedId(null)} className={ghostBtn + " hidden sm:inline-block"}>
                      Close
                    </button>
                    {ORDER_FLOW[selected.status].includes("Cancelled") && (
                      <button
                        onClick={() => setCancelling(true)}
                        className="rounded-md border border-red-300 px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 active:bg-red-100 sm:py-2"
                      >
                        Cancel order
                      </button>
                    )}
                    {NEXT_STEP[selected.status] && (
                      <button
                        disabled={busyId === selected.id}
                        onClick={() => changeStatus(selected, NEXT_STEP[selected.status]!.to)}
                        className={primaryBtn}
                      >
                        {busyId === selected.id ? "Updating…" : NEXT_STEP[selected.status]!.label}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* errors */}
      {alertInfo && <AlertModal info={alertInfo} onClose={() => setAlertInfo(null)} />}

      {/* reusable confirm dialog (WhatsApp thank-you, and anything else using useConfirm) */}
      {confirmElement}
    </div>
  );
};

export default OrderManagement;