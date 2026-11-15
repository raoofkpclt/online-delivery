import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../../routes/AuthContext";
import { useCart } from "../../routes/client/ Cartcontext"; // path kept exactly as in your project
import { db } from "../../config/firbase/firebase";
import { getDeliveryFee } from "../../utils/delivery";
import { gramsLabel, ratePerKgOf } from "../../utils/weight";
import { placeOrder } from "../../service/orderService"; // ← adjust path if needed
import Navbar from "../../components/client/Navbar";
import Footer from "../../components/client/Footer";

const WHATSAPP_NUMBER = "918075888900";
const DISCOUNT = 0; // hook up coupons/offers later

type CartItem = {
  id: string; // productId
  code: string;
  name: string;
  price: number; // price of ONE unit (for weighed products: the price of the whole weight)
  quantity: number; // always 1 for weighed products
  grams?: number; // total weight, only for products sold per kg
  ratePerKg?: number; // the per-kg rate the customer saw
};

/** Stored at users/{uid}/addresses/{id} */
type Address = {
  id: string;
  name: string; // receiver name
  phone: string; // receiver phone
  line: string; // house / street / area
  landmark: string;
  city: string;
  pincode: string;
  isDefault: boolean;
};

type AddressForm = Omit<Address, "id" | "isDefault">;

const money = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatAddress = (a: Address) =>
  [a.line, a.landmark, a.city].filter(Boolean).join(", ") + " - " + a.pincode;

// text-base on phones stops iPhones zooming into the field; compact from sm up
const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 sm:py-2 sm:text-sm";

const GramsBadge = ({ grams }: { grams: number }) => (
  <span className="ml-2 inline-block rounded-full bg-emerald-50 px-2 py-0.5 align-middle text-xs font-semibold text-emerald-800">
    {gramsLabel(grams)}
  </span>
);

/** Only reachable when signed in (see RequireAuth in App.tsx). */
export default function Checkout() {
  const { profile } = useAuth();
  const cart = useCart() as any; // skips the type mismatch
  const rawItems: any[] = cart.items ?? cart.cart ?? [];

  // Accept the common field names so a different cart shape doesn't break checkout.
  const items: CartItem[] = rawItems.map((r) => {
    const id = r.productId ?? r.id ?? r.product?.id ?? "";
    const grams = r.grams ? Number(r.grams) : undefined;
    const price = Number(r.price ?? r.product?.price ?? 0);
    return {
      id,
      code: r.code ?? r.product?.code ?? "",
      name: r.name ?? r.product?.name ?? "",
      price,
      quantity: Number(r.quantity ?? r.qty ?? 1),
      grams,
      ratePerKg: grams ? ratePerKgOf({ price, grams, ratePerKg: r.ratePerKg }) : undefined,
    };
  });

  // Use whichever "empty the cart" function your context provides.
  const clearCart = () => {
    const fn = cart.clearCart ?? cart.clear ?? cart.emptyCart ?? cart.resetCart;
    if (typeof fn === "function") fn();
  };
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddr, setLoadingAddr] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [savingAddr, setSavingAddr] = useState(false);
  const [form, setForm] = useState<AddressForm>({
    name: "",
    phone: "",
    line: "",
    landmark: "",
    city: "",
    pincode: "",
  });
  const [formError, setFormError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  // Same rule as the Cart page (see utils/delivery.ts)
  const deliveryFee = items.length ? getDeliveryFee(subtotal) : 0;
  const total = Math.max(0, subtotal - DISCOUNT + deliveryFee);
  const selected = addresses.find((a) => a.id === selectedId) ?? null;

  /* ── Load saved addresses ── */
  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;

    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "users", profile.id, "addresses"))
        );
        if (cancelled) return;
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Address, "id">) }))
          .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
        setAddresses(list);
        setSelectedId(list[0]?.id ?? null);
        setShowForm(list.length === 0); // no address yet -> open the form
      } catch (e) {
        console.error(e);
        setShowForm(true);
      } finally {
        if (!cancelled) setLoadingAddr(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  /* Prefill name/phone from the profile when the form opens */
  const openForm = () => {
    setForm({
      name: profile?.name ?? "",
      phone: profile?.phone ?? "",
      line: "",
      landmark: "",
      city: "",
      pincode: "",
    });
    setFormError("");
    setShowForm(true);
  };

  useEffect(() => {
    if (showForm && !form.name && !form.phone && profile) {
      setForm((f) => ({ ...f, name: profile.name ?? "", phone: profile.phone ?? "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, profile]);

  const setField = (k: keyof AddressForm) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  /* ── Save a new address ── */
  const handleSaveAddress = async () => {
    if (!profile?.id || savingAddr) return;

    const phone = form.phone.replace(/\D/g, "");
    if (!form.name.trim() || !form.line.trim() || !form.city.trim()) {
      setFormError("Please fill in name, address line and city.");
      return;
    }
    if (phone.length < 10) {
      setFormError("Enter a valid 10-digit phone number.");
      return;
    }
    if (!/^\d{6}$/.test(form.pincode.trim())) {
      setFormError("Enter a valid 6-digit pincode.");
      return;
    }

    setSavingAddr(true);
    setFormError("");
    try {
      const data = {
        name: form.name.trim(),
        phone,
        line: form.line.trim(),
        landmark: form.landmark.trim(),
        city: form.city.trim(),
        pincode: form.pincode.trim(),
        isDefault: addresses.length === 0,
      };
      const ref = await addDoc(collection(db, "users", profile.id, "addresses"), {
        ...data,
        createdAt: serverTimestamp(),
      });
      const saved: Address = { id: ref.id, ...data };
      setAddresses((prev) => [...prev, saved]);
      setSelectedId(saved.id);
      setShowForm(false);
    } catch (e) {
      console.error(e);
      setFormError("Could not save the address. Please try again.");
    } finally {
      setSavingAddr(false);
    }
  };

  /* ── WhatsApp invoice text ── */
  const buildWhatsAppText = (orderNo: string, addr: Address, list: CartItem[]) => {
    const lines = list.map((i, idx) => {
      const head = `${idx + 1}. ${i.name}${i.grams ? ` (${gramsLabel(i.grams)})` : ""}\n   Code: ${i.code || "-"}`;
      const detail = i.grams
        ? `   Rate: ${money(i.ratePerKg ?? 0)}/kg\n   Weight: ${gramsLabel(i.grams)}\n   Amount: ${money(i.price * i.quantity)}`
        : `   Qty: ${i.quantity} x ${money(i.price)} = ${money(i.price * i.quantity)}`;
      return `${head}\n${detail}`;
    });
    return [
      `*NEW ORDER* #${orderNo}`,
      `Date: ${new Date().toLocaleString("en-IN")}`,
      "",
      `*Customer:* ${addr.name}`,
      `*Phone:* ${addr.phone}`,
      `*Address:* ${formatAddress(addr)}`,
      "",
      "*Items*",
      ...lines,
      "",
      `Subtotal: ${money(subtotal)}`,
      ...(DISCOUNT ? [`Discount: -${money(DISCOUNT)}`] : []),
      ...(deliveryFee ? [`Delivery: ${money(deliveryFee)}`] : []),
      `*Total: ${money(total)}*`,
      "Payment: Cash on delivery",
    ].join("\n");
  };

  /* ── Confirm order (saves order + reduces stock in one transaction) ── */
  const handleConfirm = async () => {
    if (!items.length || !selected || !profile?.id || submitting) return;
    setSubmitting(true);
    setError("");

    // Open the tab inside the click so mobile browsers don't block it.
    const waWindow = window.open("", "_blank");

    try {
      // Fill in product codes the cart doesn't have (never leave undefined).
      const resolved: CartItem[] = await Promise.all(
        items.map(async (i) => {
          let code = i.code ?? "";
          if (!code && i.id) {
            const snap = await getDoc(doc(db, "products", i.id));
            code = (snap.data()?.code as string | undefined) ?? "";
          }
          return { ...i, code };
        })
      );

      // Checks stock, reduces it, and saves the order together.
      // Throws a readable error if any item is out of stock.
      const { orderNo } = await placeOrder({
        userId: profile.id,
        customerName: selected.name,
        phone: selected.phone,
        address: formatAddress(selected),
        items: resolved.map((i) => ({
          productId: i.id,
          code: i.code,
          name: i.name,
          price: i.price, // for weighed products: price of the whole weight
          quantity: i.quantity, // 1 for weighed products
          // saved on the order so bills and the admin screens can show the weight
          ...(i.grams ? { grams: i.grams, ratePerKg: i.ratePerKg } : {}),
        })),
        discountAmount: DISCOUNT,
        deliveryFee,
      });

      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        buildWhatsAppText(orderNo, selected, resolved)
      )}`;
      if (waWindow) waWindow.location.href = url;
      else window.location.href = url;

      clearCart();
      navigate("/orders"); // change to your orders / thank-you route
    } catch (e) {
      waWindow?.close();
      console.error(e);
      setError(
        e instanceof Error && e.message
          ? e.message
          : "Could not place the order. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-10 sm:px-6 sm:py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Checkout</h1>

        {/* ── Delivery address ── */}
        <section className="mt-6 sm:mt-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Delivery address</h2>
            {!showForm && !loadingAddr && (
              <button
                onClick={openForm}
                className="-mr-2 px-2 py-2 text-sm font-medium text-slate-900 underline underline-offset-4 hover:text-slate-600"
              >
                Add new address
              </button>
            )}
          </div>

          {loadingAddr ? (
            <p className="mt-4 text-sm text-slate-500">Loading your addresses…</p>
          ) : (
            <>
              {addresses.length > 0 && (
                <div className="mt-3 space-y-3 sm:mt-4" role="radiogroup" aria-label="Delivery address">
                  {addresses.map((a) => (
                    <label
                      key={a.id}
                      className={`flex cursor-pointer gap-3 rounded-lg border p-3 sm:p-4 ${
                        selectedId === a.id
                          ? "border-slate-900 bg-slate-50"
                          : "border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name="address"
                        className="mt-1 h-4 w-4 shrink-0 accent-slate-900"
                        checked={selectedId === a.id}
                        onChange={() => setSelectedId(a.id)}
                      />
                      <div className="min-w-0 text-sm">
                        <p className="font-medium text-slate-900">
                          {a.name}
                          {a.isDefault && (
                            <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-normal text-slate-700">
                              Default
                            </span>
                          )}
                        </p>
                        <p className="text-slate-600">{a.phone}</p>
                        <p className="break-words text-slate-600">{formatAddress(a)}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {showForm && (
                <div className="mt-4 rounded-lg border border-slate-200 p-3 sm:p-4">
                  <h3 className="font-medium text-slate-900">
                    {addresses.length === 0 ? "Add your delivery address" : "New address"}
                  </h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input className={inputCls} placeholder="Full name" autoComplete="name" value={form.name} onChange={setField("name")} />
                    <input className={inputCls} placeholder="Phone number" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={setField("phone")} />
                    <input className={`${inputCls} sm:col-span-2`} placeholder="House no., street, area" autoComplete="address-line1" value={form.line} onChange={setField("line")} />
                    <input className={`${inputCls} sm:col-span-2`} placeholder="Landmark (optional)" value={form.landmark} onChange={setField("landmark")} />
                    <input className={inputCls} placeholder="City / town" autoComplete="address-level2" value={form.city} onChange={setField("city")} />
                    <input className={inputCls} placeholder="Pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={form.pincode} onChange={setField("pincode")} />
                  </div>

                  {formError && (
                    <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                      {formError}
                    </p>
                  )}

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-3">
                    <button
                      onClick={handleSaveAddress}
                      disabled={savingAddr}
                      className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700 active:bg-slate-700 disabled:opacity-50 sm:w-auto sm:py-2"
                    >
                      {savingAddr ? "Saving…" : "Save address"}
                    </button>
                    {addresses.length > 0 && (
                      <button
                        onClick={() => setShowForm(false)}
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-50 sm:w-auto sm:py-2"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Invoice ── */}
        <section className="mt-8 sm:mt-10">
          <h2 className="text-lg font-semibold text-slate-900">Invoice</h2>

          {items.length === 0 ? (
            <p className="mt-4 text-slate-600">Your cart is empty.</p>
          ) : (
            <>
              {/* phones: one card per item, then the totals */}
              <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 sm:hidden">
                <ul className="divide-y divide-slate-100">
                  {items.map((i) => (
                    <li key={i.id} className="flex items-start justify-between gap-3 px-3 py-3">
                      <div className="min-w-0 text-sm">
                        <p className="font-medium text-slate-900">
                          {i.name}
                          {i.grams && <GramsBadge grams={i.grams} />}
                        </p>
                        {i.code && <p className="text-xs text-slate-500">Code: {i.code}</p>}
                        <p className="mt-0.5 text-xs text-slate-600">
                          {i.grams
                            ? `${money(i.ratePerKg ?? 0)}/kg × ${gramsLabel(i.grams)}`
                            : `${money(i.price)} × ${i.quantity}`}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-slate-900">{money(i.price * i.quantity)}</p>
                    </li>
                  ))}
                </ul>
                <dl className="space-y-1.5 border-t border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  <div className="flex justify-between gap-3">
                    <dt>Subtotal</dt>
                    <dd>{money(subtotal)}</dd>
                  </div>
                  {DISCOUNT > 0 && (
                    <div className="flex justify-between gap-3">
                      <dt>Discount</dt>
                      <dd>-{money(DISCOUNT)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt>Delivery</dt>
                    <dd>{deliveryFee ? money(deliveryFee) : "Free"}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
                    <dt>Total (cash on delivery)</dt>
                    <dd>{money(total)}</dd>
                  </div>
                </dl>
              </div>

              {/* tablet and desktop: the full table */}
              <div className="mt-4 hidden overflow-x-auto rounded-lg border border-slate-200 sm:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Code</th>
                      <th className="px-4 py-3 text-right font-medium">Rate</th>
                      <th className="px-4 py-3 text-right font-medium">Weight / Qty</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((i) => (
                      <tr key={i.id}>
                        <td className="px-4 py-3 text-slate-900">
                          {i.name}
                          {i.grams && <GramsBadge grams={i.grams} />}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{i.code}</td>
                        <td className="px-4 py-3 text-right">
                          {i.grams ? `${money(i.ratePerKg ?? 0)}/kg` : money(i.price)}
                        </td>
                        <td className="px-4 py-3 text-right">{i.grams ? gramsLabel(i.grams) : i.quantity}</td>
                        <td className="px-4 py-3 text-right font-medium">{money(i.price * i.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50 text-slate-700">
                    <tr>
                      <td colSpan={4} className="px-4 pt-3 text-right">Subtotal</td>
                      <td className="px-4 pt-3 text-right">{money(subtotal)}</td>
                    </tr>
                    {DISCOUNT > 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 pt-1 text-right">Discount</td>
                        <td className="px-4 pt-1 text-right">-{money(DISCOUNT)}</td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={4} className="px-4 pt-1 text-right">Delivery</td>
                      <td className="px-4 pt-1 text-right">{deliveryFee ? money(deliveryFee) : "Free"}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right font-semibold text-slate-900">Total (cash on delivery)</td>
                      <td className="px-4 py-3 text-right text-base font-semibold text-slate-900">{money(total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </section>

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          onClick={handleConfirm}
          disabled={!items.length || !selected || submitting}
          className="mt-6 w-full rounded-lg bg-green-600 px-6 py-3.5 text-base font-medium text-white transition hover:bg-green-700 active:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-8 sm:py-3"
        >
          {submitting ? "Placing order…" : "Confirm order on WhatsApp"}
        </button>
        {!selected && !loadingAddr && (
          <p className="mt-2 text-center text-sm text-slate-500">Add a delivery address to continue.</p>
        )}
      </main>

      <Footer />
    </div>
  );
}