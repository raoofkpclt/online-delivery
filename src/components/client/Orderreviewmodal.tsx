import { useState } from "react";
import { saveReview } from "../../service/reviewService";
import type { Order, Review } from "../../utils/types";
import Modal from "./Modal";
import StarRating from "./Starrating";

type Entry = { rating: number; comment: string };
type Props = {
  order: Order;
  existing: Review[]; // this customer's reviews for this order
  userId: string;
  userName: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/25";

export default function OrderReviewModal({ order, existing, userId, userName, onClose, onSaved }: Props) {
  const find = (productId: string | null) => existing.find((r) => r.productId === productId);
  const start = (productId: string | null): Entry => ({ rating: find(productId)?.rating ?? 0, comment: find(productId)?.comment ?? "" });

  const [overall, setOverall] = useState<Entry>(start(null));
  const [items, setItems] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(order.items.map((i) => [i.productId, start(i.productId)]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const editing = existing.length > 0;
  const setItem = (id: string, patch: Partial<Entry>) => setItems((m) => ({ ...m, [id]: { ...m[id], ...patch } }));

  async function submit() {
    setError("");
    const entries: { productId: string | null; productName?: string; e: Entry }[] = [
      { productId: null, e: overall },
      ...order.items.map((i) => ({ productId: i.productId, productName: i.name, e: items[i.productId] })),
    ];

    if (entries.some(({ e }) => e.rating === 0 && e.comment.trim()))
      return setError("Choose a star rating for each review you wrote.");
    if (entries.every(({ e }) => e.rating === 0)) return setError("Choose at least one star rating.");

    const changed = entries.filter(({ productId, e }) => {
      if (e.rating === 0) return false;
      const prev = find(productId);
      return !prev || prev.rating !== e.rating || prev.comment !== e.comment.trim();
    });

    setSaving(true);
    try {
      await Promise.all(
        changed.map(({ productId, productName, e }) =>
          saveReview({ orderId: order.id, productId, productName, userId, userName, rating: e.rating, comment: e.comment })
        )
      );
      await onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError("Could not save your review. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? `Edit your review · ${order.orderNo}` : `Rate your order · ${order.orderNo}`} onClose={onClose} busy={saving}>
      <section className="rounded-xl bg-slate-50 p-4">
        <p className="font-medium text-slate-900">How was your order overall?</p>
        <p className="text-sm text-slate-500">Delivery, packing and the service you got.</p>
        <div className="mt-2">
          <StarRating size="lg" label="Overall rating" value={overall.rating} onChange={(rating) => setOverall({ ...overall, rating })} />
        </div>
        <textarea
          rows={2}
          maxLength={500}
          className={`${inputCls} mt-3`}
          placeholder="Tell us more (optional)"
          value={overall.comment}
          onChange={(e) => setOverall({ ...overall, comment: e.target.value })}
        />
      </section>

      <section className="mt-5">
        <p className="font-medium text-slate-900">Rate the products</p>
        <p className="text-sm text-slate-500">Optional. Your ratings help other customers choose.</p>
        <ul className="mt-3 divide-y divide-slate-100">
          {order.items.map((i) => (
            <li key={i.productId} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-800">{i.name}</span>
                <StarRating label={`Rating for ${i.name}`} value={items[i.productId].rating} onChange={(rating) => setItem(i.productId, { rating })} />
              </div>
              {items[i.productId].rating > 0 && (
                <input
                  className={`${inputCls} mt-2`}
                  maxLength={500}
                  placeholder="Add a comment (optional)"
                  value={items[i.productId].comment}
                  onChange={(e) => setItem(i.productId, { comment: e.target.value })}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          Cancel
        </button>
        <button onClick={submit} disabled={saving} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {saving ? "Saving…" : editing ? "Save changes" : "Submit review"}
        </button>
      </div>
    </Modal>
  );
}