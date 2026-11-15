import { useState } from "react";
import Modal from "./Modal";
import {
  BUSINESS,
  downloadReceiptPdf,
  num,
  receiptDate,
} from "../../utils/ receipt";
import { gramsLabel, ratePerKgOf } from "../../utils/weight";
import type { Order } from "../../utils/types";

const Line = ({ l, r, bold }: { l: string; r: string; bold?: boolean }) => (
  <div className={`flex justify-between gap-3 ${bold ? "font-bold" : ""}`}>
    <span>{l}</span>
    <span className="shrink-0">{r}</span>
  </div>
);

const Rule = ({ double }: { double?: boolean }) => (
  <hr
    className={`my-2 border-0 border-t border-slate-400 ${double ? "border-double border-t-4" : "border-dashed"}`}
  />
);

/** Opens a bill receipt for a delivered order, with a Download PDF button. */
export default function ReceiptModal({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function download() {
    setBusy(true);
    setErr("");
    try {
      await downloadReceiptPdf(order);
    } catch (e) {
      console.error(e);
      setErr("Could not create the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Receipt ${order.orderNo}`} onClose={onClose}>
      <div className="mx-auto max-w-sm rounded-lg bg-white px-5 py-5 font-mono text-[13px] leading-relaxed text-slate-800 shadow-sm ring-1 ring-slate-200">
        <div className="text-center">
          <p className="text-base font-bold uppercase">{BUSINESS.name}</p>
          {BUSINESS.tagline && <p>{BUSINESS.tagline}</p>}
          {BUSINESS.address.map((a) => (
            <p key={a}>{a}</p>
          ))}
          <p>Ph: {BUSINESS.phone}</p>
          {BUSINESS.gstin && <p>GSTIN: {BUSINESS.gstin}</p>}
        </div>

        <Rule />
        <p className="text-center font-bold">BILL RECEIPT</p>
        <Rule />

        <Line l="Order No:" r={order.orderNo} />
        <Line l="Date:" r={receiptDate(order)} />
        <p className="mt-1">Customer: {order.customerName}</p>
        <p>Phone: {order.phone}</p>
        <p className="whitespace-pre-line">Address: {order.address}</p>

        <Rule />
        <Line l="Item (Weight/Qty x Rate)" r="Amount (₹)" bold />
        <Rule />
        {order.items.map((i, idx) => (
          <div key={`${i.productId}:${idx}`} className="mb-1">
            <p>{i.name}</p>
            {i.grams ? (
              // sold by weight: show how much was bought and the per-kg rate
              <Line
                l={`  ${gramsLabel(i.grams)} x ${num(ratePerKgOf(i))}/kg`}
                r={num(i.price * i.quantity)}
              />
            ) : (
              <Line
                l={`  ${i.quantity} x ${num(i.price)}`}
                r={num(i.price * i.quantity)}
              />
            )}
          </div>
        ))}
        <Rule />

        <Line l="Subtotal" r={num(order.subtotal)} />
        {order.discountAmount > 0 && (
          <Line
            l={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`}
            r={`-${num(order.discountAmount)}`}
          />
        )}
        <Line
          l="Delivery"
          r={order.deliveryFee > 0 ? num(order.deliveryFee) : "Free"}
        />
        <Rule double />
        <Line l="TOTAL (₹)" r={num(order.total)} bold />
        <Rule double />

        <p>Payment: Cash on delivery</p>
        <p>Status: Delivered</p>
        <p className="mt-4 text-center font-bold">
          Thank you for shopping with us!
        </p>
        <p className="text-center">Please visit again</p>
      </div>

      {err && (
        <p role="alert" className="mt-3 text-center text-sm text-red-600">
          {err}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
        >
          Close
        </button>
        <button
          onClick={download}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/40 disabled:opacity-60"
        >
          {busy ? "Preparing…" : "Download PDF"}
        </button>
      </div>
    </Modal>
  );
}
