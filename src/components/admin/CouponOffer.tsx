import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Timestamp } from "firebase/firestore";
import { createCrud } from "../../service/firestoreCrud";
import { getProducts } from "../../service/productService";
import { getCoupons, addCoupon, updateCoupon, deleteCoupon, setCouponActive } from "../../service/couponService";
import { getOffers, addOffer, updateOffer, deleteOffer } from "../../service/offerService";
import { AppError } from "../../service/authService";
import { UploadError } from "../../service/uploadService";
import { uploadOfferImage, deleteOfferImage } from "../../service/offerImage"; // 1600 × 600 check + S3 upload
import OfferBannerPicker from "./Offerbannerpicker"; // ← adjust if you saved it elsewhere
import type { Category, Coupon, Offer, Product } from "../../utils/types";

const categoryCrud = createCrud<Category>("categories");

/* ───────── helpers ───────── */
type OfferType = Offer["offerType"];
type Phase = "active" | "inactive" | "scheduled" | "expired";

const OFFER_TYPES: { value: OfferType; label: string }[] = [
  { value: "product_discount", label: "Discount on products" },
  { value: "category_discount", label: "Discount on categories" },
  { value: "buy_x_get_y", label: "Buy X get Y free" },
  { value: "free_delivery", label: "Free delivery" },
];

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const pad = (n: number) => String(n).padStart(2, "0");
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (s: string) => Timestamp.fromDate(new Date(`${s}T00:00:00`));
const endOfDay = (s: string) => Timestamp.fromDate(new Date(`${s}T23:59:59`));
const fmtDate = (t: Timestamp) =>
  t.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function getPhase(isActive: boolean, startsAt: Timestamp, endsAt: Timestamp): Phase {
  const now = Date.now();
  if (endsAt.toMillis() < now) return "expired";
  if (!isActive) return "inactive";
  if (startsAt.toMillis() > now) return "scheduled";
  return "active";
}

const PHASE_STYLE: Record<Phase, string> = {
  active: "bg-emerald-50 text-emerald-700",
  inactive: "bg-slate-100 text-slate-600",
  scheduled: "bg-sky-50 text-sky-700",
  expired: "bg-red-50 text-red-700",
};
const PHASE_LABEL: Record<Phase, string> = {
  active: "Active",
  inactive: "Inactive",
  scheduled: "Scheduled",
  expired: "Expired",
};

function describeCoupon(c: Coupon) {
  if (c.discountType === "percent")
    return `${c.discountValue}% off${c.maxDiscount ? `, up to ${inr(c.maxDiscount)}` : ""}`;
  return `${inr(c.discountValue)} off`;
}

function describeOffer(o: Offer) {
  const off =
    o.discountType === "percent" ? `${o.discountValue}% off` : `${inr(o.discountValue ?? 0)} off`;
  switch (o.offerType) {
    case "product_discount":
      return `${off} on ${o.targetProductIds.length} product${o.targetProductIds.length === 1 ? "" : "s"}`;
    case "category_discount":
      return `${off} on ${o.targetCategoryIds.length} categor${o.targetCategoryIds.length === 1 ? "y" : "ies"}`;
    case "buy_x_get_y":
      return `Buy ${o.buyQty} get ${o.getQty} free on ${o.targetProductIds.length} product${o.targetProductIds.length === 1 ? "" : "s"}`;
    case "free_delivery":
      return o.minOrderAmount ? `Free delivery above ${inr(o.minOrderAmount)}` : "Free delivery on all orders";
  }
}

// text-base on phones stops iOS from zooming into inputs
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 transition " +
  "focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15 disabled:opacity-60 sm:text-sm";
const primaryBtn =
  "rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60";
const ghostBtn =
  "rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60";
const dangerBtn =
  "rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 active:bg-red-800 disabled:opacity-60";
const rowBtn = "rounded-lg px-3 py-2.5 text-sm font-semibold ring-1 transition md:py-1.5 md:text-xs";
const editBtn = `${rowBtn} text-emerald-700 ring-emerald-200 hover:bg-emerald-50 active:bg-emerald-100`;
const deleteBtn = `${rowBtn} text-red-600 ring-red-200 hover:bg-red-50 active:bg-red-100`;

/* ───────── small shared pieces ───────── */

/** A bottom sheet on phones, a centred box from sm up. Esc closes it and the page behind does not scroll. */
function Modal({
  title,
  onClose,
  busy,
  narrow,
  children,
}: {
  title: string;
  onClose: () => void;
  busy?: boolean;
  narrow?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [busy, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/40 sm:p-4 ${
        narrow ? "sm:items-center" : "sm:items-start"
      }`}
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full max-h-[92dvh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-h-none sm:rounded-2xl sm:p-6 ${
          narrow ? "max-w-sm pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6" : "max-w-2xl sm:my-6"
        }`}
      >
        <h2 className="mb-4 text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function Toggle({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:opacity-50 ${
        on ? "bg-emerald-600" : "bg-slate-300"
      }`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function PhaseBadge({ phase }: { phase: Phase }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${PHASE_STYLE[phase]}`}>
      {PHASE_LABEL[phase]}
    </span>
  );
}

function Picker({ items, selected, onChange, placeholder }: { items: { id: string; label: string }[]; selected: string[]; onChange: (ids: string[]) => void; placeholder: string }) {
  const [q, setQ] = useState("");
  const shown = items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="rounded-xl border border-slate-200 p-2">
      <input className={inputCls} placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-2 max-h-48 overflow-y-auto">
        {shown.length === 0 && <p className="px-1 py-2 text-sm text-slate-500">Nothing found.</p>}
        {shown.map((i) => (
          <label key={i.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-slate-700 hover:bg-slate-50 active:bg-slate-100">
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 accent-emerald-600"
              checked={selected.includes(i.id)}
              onChange={() => onChange(selected.includes(i.id) ? selected.filter((x) => x !== i.id) : [...selected, i.id])}
            />
            <span className="min-w-0">{i.label}</span>
          </label>
        ))}
      </div>
      <p className="mt-1 px-1 text-xs text-slate-500">{selected.length} selected</p>
    </div>
  );
}

function DateRange({ start, end, setStart, setEnd }: { start: string; end: string; setStart: (v: string) => void; setEnd: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:gap-4">
      <Field label="Starts on">
        <input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
      </Field>
      <Field label="Ends on">
        <input type="date" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} />
      </Field>
    </div>
  );
}

/** Error text plus Cancel / Save. Sticks to the bottom of the sheet on phones so Save is always reachable. */
function FormFooter({ error, saving, onCancel, submitLabel }: { error: string; saving: boolean; onCancel: () => void; submitLabel: string }) {
  return (
    <>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="sticky bottom-0 -mx-5 -mb-5 mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:mb-0 sm:flex-row sm:justify-end sm:border-0 sm:p-0">
        <button type="button" disabled={saving} onClick={onCancel} className={`w-full sm:w-auto ${ghostBtn}`}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={`w-full sm:w-auto ${primaryBtn}`}>
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </>
  );
}

/** Label / value pair used inside the phone cards. */
function Detail({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-slate-700">{children}</dd>
    </div>
  );
}

/* ───────── coupon form ───────── */
function CouponForm({ editing, coupons, onClose, onSaved }: { editing: Coupon | null; coupons: Coupon[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const today = new Date();
  const in30 = new Date(Date.now() + 30 * 86400000);
  const [code, setCode] = useState(editing?.code ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [discountType, setDiscountType] = useState<Coupon["discountType"]>(editing?.discountType ?? "percent");
  const [discountValue, setDiscountValue] = useState(editing ? String(editing.discountValue) : "");
  const [maxDiscount, setMaxDiscount] = useState(editing?.maxDiscount ? String(editing.maxDiscount) : "");
  const [minOrder, setMinOrder] = useState(editing?.minOrderAmount ? String(editing.minOrderAmount) : "");
  const [usageLimit, setUsageLimit] = useState(editing?.usageLimit ? String(editing.usageLimit) : "");
  const [start, setStart] = useState(toDateInput(editing ? editing.startsAt.toDate() : today));
  const [end, setEnd] = useState(toDateInput(editing ? editing.endsAt.toDate() : in30));
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const clean = code.trim().toUpperCase();
    const value = Number(discountValue);
    if (!/^[A-Z0-9]{3,20}$/.test(clean)) return setError("Code must be 3–20 letters or numbers, with no spaces.");
    if (coupons.some((c) => c.id !== editing?.id && c.code === clean)) return setError(`The code ${clean} already exists.`);
    if (!(value > 0)) return setError("Enter a discount value greater than 0.");
    if (discountType === "percent" && value > 100) return setError("A percentage discount can't be more than 100.");
    if (!start || !end) return setError("Choose start and end dates.");
    if (end < start) return setError("The end date must be on or after the start date.");
    if (usageLimit && (!Number.isInteger(Number(usageLimit)) || Number(usageLimit) < 1))
      return setError("Usage limit must be a whole number, 1 or more.");
    if (editing && usageLimit && Number(usageLimit) < editing.usedCount)
      return setError(`This coupon has already been used ${editing.usedCount} times. Set the limit to at least that.`);

    const data = {
      code: clean,
      description: description.trim(),
      discountType,
      discountValue: value,
      maxDiscount: discountType === "percent" && maxDiscount ? Number(maxDiscount) : 0,
      minOrderAmount: minOrder ? Number(minOrder) : 0,
      usageLimit: usageLimit ? Number(usageLimit) : 0, // 0 = unlimited
      startsAt: startOfDay(start),
      endsAt: endOfDay(end),
      isActive,
    };

    setSaving(true);
    try {
      if (editing) await updateCoupon(editing.id, data);
      else await addCoupon(data); // service uppercases the code and sets usedCount to 0
      await onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError("Could not save the coupon. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? "Edit coupon" : "Add coupon"} onClose={onClose} busy={saving}>
      <form onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Coupon code" hint="Customers type this at checkout.">
            <input className={inputCls + " uppercase"} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="FRESH10" autoCapitalize="characters" />
          </Field>
          <Field label="Description">
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="10% off on your first order" />
          </Field>
          <Field label="Discount type">
            <select className={inputCls} value={discountType} onChange={(e) => setDiscountType(e.target.value as Coupon["discountType"])}>
              <option value="percent">Percentage (%)</option>
              <option value="fixed">Fixed amount (₹)</option>
            </select>
          </Field>
          <Field label={discountType === "percent" ? "Discount (%)" : "Discount (₹)"}>
            <input type="number" inputMode="decimal" min="0" step="any" className={inputCls} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
          </Field>
          {discountType === "percent" && (
            <Field label="Maximum discount (₹)" hint="Leave empty for no cap.">
              <input type="number" inputMode="numeric" min="0" className={inputCls} value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} />
            </Field>
          )}
          <Field label="Minimum order (₹)" hint="Leave empty for any order value.">
            <input type="number" inputMode="numeric" min="0" className={inputCls} value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
          </Field>
          <Field label="Usage limit" hint={editing ? `Used ${editing.usedCount} times so far. Empty means unlimited.` : "Total redemptions allowed. Empty means unlimited."}>
            <input type="number" inputMode="numeric" min="1" className={inputCls} value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} />
          </Field>
          <div className="hidden sm:block" />
          <DateRange start={start} end={end} setStart={setStart} setEnd={setEnd} />
          <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Coupon is active
          </label>
        </div>
        <FormFooter error={error} saving={saving} onCancel={onClose} submitLabel={editing ? "Save changes" : "Add coupon"} />
      </form>
    </Modal>
  );
}

/* ───────── offer form ───────── */
function OfferForm({ editing, products, categories, onClose, onSaved }: { editing: Offer | null; products: Product[]; categories: Category[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [offerType, setOfferType] = useState<OfferType>(editing?.offerType ?? "product_discount");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(editing?.discountType ?? "percent");
  const [discountValue, setDiscountValue] = useState(editing?.discountValue ? String(editing.discountValue) : "");
  const [buyQty, setBuyQty] = useState(editing?.buyQty ? String(editing.buyQty) : "");
  const [getQty, setGetQty] = useState(editing?.getQty ? String(editing.getQty) : "");
  const [minOrder, setMinOrder] = useState(editing?.minOrderAmount ? String(editing.minOrderAmount) : "");
  const [productIds, setProductIds] = useState<string[]>(editing?.targetProductIds ?? []);
  const [categoryIds, setCategoryIds] = useState<string[]>(editing?.targetCategoryIds ?? []);
  const [showOnHome, setShowOnHome] = useState(editing?.showOnHome ?? false);
  const [keepBanner, setKeepBanner] = useState(editing?.bannerUrl ?? ""); // the saved banner (cleared when removed)
  const [bannerFile, setBannerFile] = useState<File | null>(null); // a new 1600 × 600 image, not uploaded yet
  const [start, setStart] = useState(toDateInput(editing ? editing.startsAt.toDate() : new Date()));
  const [end, setEnd] = useState(toDateInput(editing ? editing.endsAt.toDate() : new Date(Date.now() + 30 * 86400000)));
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const usesDiscount = offerType === "product_discount" || offerType === "category_discount";
  const usesProducts = offerType === "product_discount" || offerType === "buy_x_get_y";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) return setError("Enter an offer title.");
    if (!start || !end) return setError("Choose start and end dates.");
    if (end < start) return setError("The end date must be on or after the start date.");

    let extra: Partial<Pick<Offer, "discountType" | "discountValue" | "buyQty" | "getQty" | "minOrderAmount">> = {};
    if (usesDiscount) {
      const v = Number(discountValue);
      if (!(v > 0)) return setError("Enter a discount value greater than 0.");
      if (discountType === "percent" && v > 100) return setError("A percentage discount can't be more than 100.");
      extra = { discountType, discountValue: v };
    }
    if (offerType === "buy_x_get_y") {
      const b = Number(buyQty), g = Number(getQty);
      if (!Number.isInteger(b) || b < 1 || !Number.isInteger(g) || g < 1)
        return setError("Buy and free quantities must be whole numbers, 1 or more.");
      extra = { buyQty: b, getQty: g };
    }
    if (offerType === "free_delivery") extra = { minOrderAmount: minOrder ? Number(minOrder) : 0 };
    if (usesProducts && productIds.length === 0) return setError("Select at least one product.");
    if (offerType === "category_discount" && categoryIds.length === 0) return setError("Select at least one category.");

    setSaving(true);
    let uploadedUrl = "";
    try {
      let bannerUrl = keepBanner;
      if (bannerFile) {
        uploadedUrl = await uploadOfferImage(bannerFile); // checks 1600 × 600, uploads to S3
        bannerUrl = uploadedUrl;
      }
      const data = {
        title: title.trim(),
        offerType,
        bannerUrl,
        showOnHome,
        targetProductIds: usesProducts ? productIds : [],
        targetCategoryIds: offerType === "category_discount" ? categoryIds : [],
        startsAt: startOfDay(start),
        endsAt: endOfDay(end),
        isActive,
        ...extra,
      };
      if (editing) await updateOffer(editing.id, data);
      else await addOffer(data);

      // the old banner is no longer used (replaced or removed)
      if (editing?.bannerUrl && editing.bannerUrl !== bannerUrl) await deleteOfferImage(editing.bannerUrl);

      await onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      if (uploadedUrl) await deleteOfferImage(uploadedUrl); // don't leave an unused upload behind
      setError(
        err instanceof AppError || err instanceof UploadError
          ? err.message
          : "Could not save the offer. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? "Edit offer" : "Add offer"} onClose={onClose} busy={saving}>
      <form onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Offer title" className="sm:col-span-2">
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Monsoon veggie sale" />
          </Field>
          <Field label="Offer type" hint={editing ? "The type can't be changed after the offer is created." : undefined} className="sm:col-span-2">
            <select className={inputCls} value={offerType} disabled={!!editing} onChange={(e) => setOfferType(e.target.value as OfferType)}>
              {OFFER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>

          {usesDiscount && (
            <>
              <Field label="Discount type">
                <select className={inputCls} value={discountType} onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}>
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed">Fixed amount (₹)</option>
                </select>
              </Field>
              <Field label={discountType === "percent" ? "Discount (%)" : "Discount (₹)"}>
                <input type="number" inputMode="decimal" min="0" step="any" className={inputCls} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
              </Field>
            </>
          )}

          {offerType === "buy_x_get_y" && (
            <>
              <Field label="Customer buys (quantity)">
                <input type="number" inputMode="numeric" min="1" className={inputCls} value={buyQty} onChange={(e) => setBuyQty(e.target.value)} />
              </Field>
              <Field label="Customer gets free (quantity)">
                <input type="number" inputMode="numeric" min="1" className={inputCls} value={getQty} onChange={(e) => setGetQty(e.target.value)} />
              </Field>
            </>
          )}

          {offerType === "free_delivery" && (
            <Field label="Minimum order (₹)" hint="Leave empty to give free delivery on every order." className="sm:col-span-2">
              <input type="number" inputMode="numeric" min="0" className={inputCls} value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
            </Field>
          )}

          {usesProducts && (
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Products in this offer</span>
              <Picker
                items={products.map((p) => ({ id: p.id, label: `${p.name}${p.code ? ` (${p.code})` : ""}` }))}
                selected={productIds}
                onChange={setProductIds}
                placeholder="Search products"
              />
            </div>
          )}

          {offerType === "category_discount" && (
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Categories in this offer</span>
              <Picker items={categories.map((c) => ({ id: c.id, label: c.name }))} selected={categoryIds} onChange={setCategoryIds} placeholder="Search categories" />
            </div>
          )}

          <DateRange start={start} end={end} setStart={setStart} setEnd={setEnd} />

          {/* banner: exactly 1600 × 600 px */}
          <div className="sm:col-span-2">
            <OfferBannerPicker
              currentUrl={keepBanner}
              file={bannerFile}
              onFile={setBannerFile}
              onRemoveCurrent={() => setKeepBanner("")}
              disabled={saving}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={showOnHome} onChange={(e) => setShowOnHome(e.target.checked)} />
            Show on the home page
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Offer is active
          </label>
        </div>
        <FormFooter error={error} saving={saving} onCancel={onClose} submitLabel={editing ? "Save changes" : "Add offer"} />
      </form>
    </Modal>
  );
}

/* ───────── page ───────── */
type Tab = "coupons" | "offers";
type Pending = { kind: "coupon"; item: Coupon } | { kind: "offer"; item: Offer } | null;

const CouponOffer = () => {
  const [tab, setTab] = useState<Tab>("coupons");
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<"" | Phase>("");

  const [couponForm, setCouponForm] = useState<{ item: Coupon | null } | null>(null);
  const [offerForm, setOfferForm] = useState<{ item: Offer | null } | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [deleting, setDeleting] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ title: string; message: string } | null>(null);

  const closeCouponForm = useCallback(() => setCouponForm(null), []);
  const closeOfferForm = useCallback(() => setOfferForm(null), []);
  const closePending = useCallback(() => setPending(null), []);
  const closeAlert = useCallback(() => setAlertInfo(null), []);

  const load = useCallback(async () => {
    try {
      setLoadError("");
      const [c, o, p, cat] = await Promise.all([getCoupons(), getOffers(), getProducts(), categoryCrud.list()]);
      setCoupons(c);
      setOffers(o);
      setProducts(p);
      setCategories(cat);
    } catch (err) {
      console.error(err);
      setLoadError("Could not load coupons and offers. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const q = search.trim().toLowerCase();

  const shownCoupons = useMemo(
    () =>
      coupons
        .filter((c) => (!q || c.code.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q)) &&
          (!phaseFilter || getPhase(c.isActive, c.startsAt, c.endsAt) === phaseFilter))
        .sort((a, b) => b.endsAt.toMillis() - a.endsAt.toMillis()),
    [coupons, q, phaseFilter]
  );

  const shownOffers = useMemo(
    () =>
      offers
        .filter((o) => (!q || o.title.toLowerCase().includes(q)) &&
          (!phaseFilter || getPhase(o.isActive, o.startsAt, o.endsAt) === phaseFilter))
        .sort((a, b) => b.endsAt.toMillis() - a.endsAt.toMillis()),
    [offers, q, phaseFilter]
  );

  async function toggleCoupon(c: Coupon) {
    const next = !c.isActive;
    setCoupons((l) => l.map((x) => (x.id === c.id ? { ...x, isActive: next } : x)));
    try {
      await setCouponActive(c.id, next);
    } catch (err) {
      console.error(err);
      setCoupons((l) => l.map((x) => (x.id === c.id ? { ...x, isActive: c.isActive } : x)));
      setAlertInfo({ title: "Could not update the coupon", message: "The change was not saved. Please try again." });
    }
  }

  async function toggleOffer(o: Offer) {
    const next = !o.isActive;
    setOffers((l) => l.map((x) => (x.id === o.id ? { ...x, isActive: next } : x)));
    try {
      await updateOffer(o.id, { isActive: next });
    } catch (err) {
      console.error(err);
      setOffers((l) => l.map((x) => (x.id === o.id ? { ...x, isActive: o.isActive } : x)));
      setAlertInfo({ title: "Could not update the offer", message: "The change was not saved. Please try again." });
    }
  }

  async function confirmDelete() {
    if (!pending) return;
    setDeleting(true);
    try {
      if (pending.kind === "coupon") {
        await deleteCoupon(pending.item.id);
      } else {
        await deleteOffer(pending.item.id);
        await deleteOfferImage(pending.item.bannerUrl); // removes the banner from S3 (never throws)
      }
      await load();
      setPending(null);
    } catch (err) {
      console.error(err);
      const kind = pending.kind;
      setPending(null);
      setAlertInfo({ title: `Could not delete the ${kind}`, message: "Please try again." });
    } finally {
      setDeleting(false);
    }
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "coupons", label: "Coupons", count: coupons.length },
    { key: "offers", label: "Offers", count: offers.length },
  ];

  const shownCount = tab === "coupons" ? shownCoupons.length : shownOffers.length;
  const hasAny = tab === "coupons" ? coupons.length > 0 : offers.length > 0;

  const emptyText =
    tab === "coupons"
      ? hasAny ? "No coupons match these filters." : "No coupons yet. Add one to give customers a checkout discount."
      : hasAny ? "No offers match these filters." : "No offers yet. Add one to discount products or categories automatically.";

  const th = "px-5 py-3 font-medium";
  const td = "px-5 py-3 text-slate-600";

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Coupons and offers</h2>
          <p className="mt-1 text-sm text-slate-500">
            Coupons are entered by customers at checkout. Offers apply automatically.
          </p>
        </div>
        <button
          className={`w-full sm:w-auto ${primaryBtn}`}
          onClick={() => (tab === "coupons" ? setCouponForm({ item: null }) : setOfferForm({ item: null }))}
        >
          {tab === "coupons" ? "Add coupon" : "Add offer"}
        </button>
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        {/* toolbar: tabs, search and status filter each take a full row on phones */}
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
          <div role="tablist" className="flex w-full gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => {
                  setTab(t.key);
                  setSearch("");
                  setPhaseFilter("");
                }}
                className={`flex-1 rounded-lg px-3.5 py-2 text-sm font-medium transition sm:flex-none sm:py-1.5 ${
                  tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
                <span className="ml-1.5 text-xs text-slate-400">{t.count}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <div className="relative w-full sm:w-64">
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === "coupons" ? "Search code or description" : "Search title"}
                aria-label={tab === "coupons" ? "Search coupons" : "Search offers"}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-base text-slate-900 placeholder:text-slate-400 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15 sm:h-10 sm:text-sm"
              />
            </div>
            <select
              aria-label="Filter by status"
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value as "" | Phase)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base text-slate-900 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15 sm:h-10 sm:w-40 sm:text-sm"
            >
              <option value="">Any status</option>
              {(Object.keys(PHASE_LABEL) as Phase[]).map((p) => (
                <option key={p} value={p}>{PHASE_LABEL[p]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* load error */}
        {loadError && (
          <p role="alert" className="border-t border-slate-100 px-5 py-6 text-center text-sm text-red-700">
            {loadError}{" "}
            <button
              className="font-medium underline"
              onClick={() => {
                setLoading(true);
                void load();
              }}
            >
              Retry
            </button>
          </p>
        )}

        {/* loading */}
        {loading && (
          <div className="animate-pulse space-y-3 border-t border-slate-100 p-3 sm:p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-slate-100 md:h-10" />
            ))}
          </div>
        )}

        {/* empty */}
        {!loading && !loadError && shownCount === 0 && (
          <p className="border-t border-slate-100 px-5 py-12 text-center text-sm text-slate-500">{emptyText}</p>
        )}

        {/* ───── coupons ───── */}
        {!loading && tab === "coupons" && shownCoupons.length > 0 && (
          <>
            {/* phones: one card per coupon */}
            <ul className="divide-y divide-slate-100 border-t border-slate-100 md:hidden">
              {shownCoupons.map((c) => {
                const phase = getPhase(c.isActive, c.startsAt, c.endsAt);
                return (
                  <li key={c.id} className="p-3.5">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold tracking-wide text-slate-900">{c.code}</p>
                        {c.description && <p className="truncate text-xs text-slate-500">{c.description}</p>}
                      </div>
                      <PhaseBadge phase={phase} />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <Detail label="Discount">{describeCoupon(c)}</Detail>
                      <Detail label="Minimum order">{c.minOrderAmount ? inr(c.minOrderAmount) : "None"}</Detail>
                      <Detail label="Valid" wide>{fmtDate(c.startsAt)} to {fmtDate(c.endsAt)}</Detail>
                      <Detail label="Used">{c.usedCount}{c.usageLimit ? ` of ${c.usageLimit}` : ""}</Detail>
                    </dl>
                    <div className="mt-3 flex items-center gap-2">
                      <Toggle on={c.isActive} label={`${c.code} is ${c.isActive ? "active" : "inactive"}`} onChange={() => toggleCoupon(c)} />
                      <span className="text-xs text-slate-500">{c.isActive ? "On" : "Off"}</span>
                      <div className="ml-auto flex gap-2">
                        <button onClick={() => setCouponForm({ item: c })} className={editBtn}>Edit</button>
                        <button onClick={() => setPending({ kind: "coupon", item: c })} className={deleteBtn}>Delete</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* tablet and desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-y border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className={th}>Code</th>
                    <th className={th}>Discount</th>
                    <th className={th}>Minimum order</th>
                    <th className={th}>Valid</th>
                    <th className={th}>Used</th>
                    <th className={th}>Status</th>
                    <th className={`${th} text-right`}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shownCoupons.map((c) => {
                    const phase = getPhase(c.isActive, c.startsAt, c.endsAt);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/60">
                        <td className="max-w-[14rem] px-5 py-3">
                          <p className="truncate font-medium text-slate-900">{c.code}</p>
                          {c.description && <p className="truncate text-xs text-slate-500">{c.description}</p>}
                        </td>
                        <td className={td}>{describeCoupon(c)}</td>
                        <td className={`${td} whitespace-nowrap`}>{c.minOrderAmount ? inr(c.minOrderAmount) : "None"}</td>
                        <td className={`${td} whitespace-nowrap`}>{fmtDate(c.startsAt)} to {fmtDate(c.endsAt)}</td>
                        <td className={`${td} whitespace-nowrap`}>{c.usedCount}{c.usageLimit ? ` of ${c.usageLimit}` : ""}</td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <div className="flex items-center gap-2">
                            <Toggle on={c.isActive} label={`${c.code} is ${c.isActive ? "active" : "inactive"}`} onChange={() => toggleCoupon(c)} />
                            <PhaseBadge phase={phase} />
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setCouponForm({ item: c })} className={editBtn}>Edit</button>
                            <button onClick={() => setPending({ kind: "coupon", item: c })} className={deleteBtn}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ───── offers ───── */}
        {!loading && tab === "offers" && shownOffers.length > 0 && (
          <>
            {/* phones: one card per offer */}
            <ul className="divide-y divide-slate-100 border-t border-slate-100 md:hidden">
              {shownOffers.map((o) => {
                const phase = getPhase(o.isActive, o.startsAt, o.endsAt);
                return (
                  <li key={o.id} className="p-3.5">
                    {o.bannerUrl && (
                      <img
                        src={o.bannerUrl}
                        alt=""
                        className="mb-3 aspect-[8/3] w-full rounded-xl object-cover"
                      />
                    )}
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{o.title}</p>
                        <p className="text-xs text-slate-500">{OFFER_TYPES.find((t) => t.value === o.offerType)?.label}</p>
                      </div>
                      <PhaseBadge phase={phase} />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <Detail label="Benefit" wide>{describeOffer(o)}</Detail>
                      <Detail label="Valid">{fmtDate(o.startsAt)} to {fmtDate(o.endsAt)}</Detail>
                      <Detail label="Home page">{o.showOnHome ? "Shown" : "Hidden"}</Detail>
                    </dl>
                    <div className="mt-3 flex items-center gap-2">
                      <Toggle on={o.isActive} label={`${o.title} is ${o.isActive ? "active" : "inactive"}`} onChange={() => toggleOffer(o)} />
                      <span className="text-xs text-slate-500">{o.isActive ? "On" : "Off"}</span>
                      <div className="ml-auto flex gap-2">
                        <button onClick={() => setOfferForm({ item: o })} className={editBtn}>Edit</button>
                        <button onClick={() => setPending({ kind: "offer", item: o })} className={deleteBtn}>Delete</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* tablet and desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-y border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className={th}>Offer</th>
                    <th className={th}>Type</th>
                    <th className={th}>Benefit</th>
                    <th className={th}>Valid</th>
                    <th className={th}>Home page</th>
                    <th className={th}>Status</th>
                    <th className={`${th} text-right`}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shownOffers.map((o) => {
                    const phase = getPhase(o.isActive, o.startsAt, o.endsAt);
                    return (
                      <tr key={o.id} className="hover:bg-slate-50/60">
                        <td className="max-w-[16rem] px-5 py-3">
                          <div className="flex items-center gap-3">
                            {o.bannerUrl ? (
                              <img src={o.bannerUrl} alt="" className="h-10 w-16 shrink-0 rounded-md object-cover" />
                            ) : (
                              <div className="h-10 w-16 shrink-0 rounded-md bg-slate-100" />
                            )}
                            <span className="truncate font-medium text-slate-900">{o.title}</span>
                          </div>
                        </td>
                        <td className={td}>{OFFER_TYPES.find((t) => t.value === o.offerType)?.label}</td>
                        <td className={td}>{describeOffer(o)}</td>
                        <td className={`${td} whitespace-nowrap`}>{fmtDate(o.startsAt)} to {fmtDate(o.endsAt)}</td>
                        <td className={td}>{o.showOnHome ? "Shown" : "Hidden"}</td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <div className="flex items-center gap-2">
                            <Toggle on={o.isActive} label={`${o.title} is ${o.isActive ? "active" : "inactive"}`} onChange={() => toggleOffer(o)} />
                            <PhaseBadge phase={phase} />
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setOfferForm({ item: o })} className={editBtn}>Edit</button>
                            <button onClick={() => setPending({ kind: "offer", item: o })} className={deleteBtn}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {couponForm && (
        <CouponForm editing={couponForm.item} coupons={coupons} onClose={closeCouponForm} onSaved={load} />
      )}
      {offerForm && (
        <OfferForm editing={offerForm.item} products={products} categories={categories} onClose={closeOfferForm} onSaved={load} />
      )}

      {/* delete confirmation */}
      {pending && (
        <Modal
          narrow
          busy={deleting}
          onClose={closePending}
          title={`Delete ${pending.kind === "coupon" ? `coupon ${pending.item.code}` : `offer “${pending.item.title}”`}?`}
        >
          <p className="text-sm text-slate-600">
            {pending.kind === "coupon" && pending.item.usedCount > 0
              ? `This coupon was used ${pending.item.usedCount} times. Deleting it can't be undone. To stop it working but keep the record, set it to inactive instead.`
              : "This can't be undone. To stop it working but keep it, set it to inactive instead."}
          </p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button disabled={deleting} onClick={closePending} className={`w-full sm:w-auto ${ghostBtn}`}>
              Keep it
            </button>
            <button disabled={deleting} onClick={confirmDelete} className={`w-full sm:w-auto ${dangerBtn}`}>
              {deleting ? "Deleting…" : pending.kind === "coupon" ? "Delete coupon" : "Delete offer"}
            </button>
          </div>
        </Modal>
      )}

      {/* errors */}
      {alertInfo && (
        <Modal narrow title={alertInfo.title} onClose={closeAlert}>
          <p className="text-sm text-slate-600">{alertInfo.message}</p>
          <div className="mt-5 flex sm:justify-end">
            <button autoFocus onClick={closeAlert} className={`w-full sm:w-auto ${ghostBtn}`}>
              OK
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CouponOffer;