import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import Navbar from "../../components/client/Navbar";
import Footer from "../../components/client/Footer";
import { inr } from "../../components/client/Productcard";
import { useCart } from "../../routes/client/ Cartcontext"; // path kept exactly as in your project
import { db } from "../../config/firbase/firebase";
import { FREE_DELIVERY_MIN, getDeliveryFee } from "../../utils/delivery";
import { gramsLabel, ratePerKgOf } from "../../utils/weight";
import { useConfirm } from "../../components/admin/ConfirmModal"; // ← adjust to where you saved ConfirmModal.tsx

/** Height of your fixed bottom navbar in px (h-16 = 64). Change this if your bottom navbar is taller or shorter.
 *  The checkout bar sits right above it, so both stay visible while scrolling. */
const BOTTOM_NAV_H = 0;

// bigger tap targets on phones (36px), compact again from the sm breakpoint
const stepBtn =
  "flex h-9 w-9 items-center justify-center rounded-lg text-lg text-slate-700 hover:bg-slate-100 active:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600/40 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent sm:h-8 sm:w-8";

function Stepper({
  qty,
  max,
  onChange,
  name,
}: {
  qty: number;
  max: number;
  onChange: (q: number) => void;
  name: string;
}) {
  return (
    <div className="inline-flex shrink-0 items-center rounded-xl ring-1 ring-slate-300">
      <button
        className={stepBtn}
        onClick={() => onChange(qty - 1)}
        disabled={qty <= 1}
        aria-label={`Decrease quantity of ${name}`}
      >
        −
      </button>
      <span className="w-8 text-center text-sm font-medium text-slate-900" aria-live="polite">
        {qty}
      </span>
      <button
        className={stepBtn}
        onClick={() => onChange(qty + 1)}
        disabled={qty >= max}
        aria-label={`Increase quantity of ${name}`}
      >
        +
      </button>
    </div>
  );
}

/** Stepper for products sold by weight: changes the grams, not a quantity. */
const WEIGHT_STEP = 50;

function WeightStepper({
  grams,
  max,
  onChange,
  name,
}: {
  grams: number;
  max: number; // most grams that can be bought
  onChange: (g: number) => void;
  name: string;
}) {
  return (
    <div className="inline-flex shrink-0 items-center rounded-xl ring-1 ring-slate-300">
      <button
        className={stepBtn}
        onClick={() => onChange(grams - WEIGHT_STEP)}
        disabled={grams <= WEIGHT_STEP}
        aria-label={`Less weight of ${name}`}
      >
        −
      </button>
      <span className="min-w-16 px-1 text-center text-sm font-medium text-slate-900" aria-live="polite">
        {gramsLabel(grams)}
      </span>
      <button
        className={stepBtn}
        onClick={() => onChange(grams + WEIGHT_STEP)}
        disabled={grams + WEIGHT_STEP > max}
        aria-label={`More weight of ${name}`}
      >
        +
      </button>
    </div>
  );
}

export default function Cart() {
  const navigate = useNavigate();
  const location = useLocation();
  const { confirm, confirmElement } = useConfirm();
  // Products sold per kg are ONE line holding the total grams (no quantity).
  const { items, count, subtotal, setQuantity, setWeight, removeItem, clear, syncStock } = useCart();

  /* Back button (mobile only).
     Goes to the previous page. If the cart was opened directly (no history inside the app),
     it goes to the shop instead so the button never leaves the site. */
  const goBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/shop");
  };

  /* Refresh stock from Firestore so the + button uses the real stock,
     not the number saved when the item was added.
     One product can now have several lines (250 g and 500 g), so ids are de-duplicated.
     The map holds the product's stock as saved in Firestore; the cart context turns it
     into "packs available" for each line. */
  const idsKey = Array.from(new Set(items.map((i) => i.productId))).sort().join(",");
  useEffect(() => {
    if (!idsKey) return;
    let alive = true;
    (async () => {
      const results = await Promise.allSettled(
        idsKey.split(",").map(async (id) => {
          const snap = await getDoc(doc(db, "products", id));
          const d = snap.data();
          // deleted or hidden products count as unavailable
          const stock = !snap.exists() || d?.isActive === false ? 0 : Number(d?.stock ?? 0);
          return [id, stock] as const;
        })
      );
      if (!alive) return;
      const map: Record<string, number> = {};
      results.forEach((r) => {
        if (r.status === "fulfilled") map[r.value[0]] = r.value[1];
      });
      syncStock(map);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  /* Totals: `count` and `subtotal` come straight from the cart context */
  // Same rule as Checkout (see utils/delivery.ts)
  const delivery = items.length === 0 ? 0 : getDeliveryFee(subtotal);
  const freeDelivery = items.length > 0 && delivery === 0;
  const total = subtotal + delivery;
  const toFree = freeDelivery ? 0 : FREE_DELIVERY_MIN - subtotal;
  const progress = Math.min(100, (subtotal / FREE_DELIVERY_MIN) * 100);

  // weighed products: stock is in kg, the cart line holds grams
  const tooMuch = (i: (typeof items)[number]) => (i.grams ? i.grams > i.stock * 1000 : i.quantity > i.stock);
  const problem = items.some((i) => i.stock <= 0 || tooMuch(i));

  const goCheckout = () => navigate("/checkout");

  const handleClear = async () => {
    const ok = await confirm({
      title: "Clear your cart?",
      message: "All items will be removed from your cart.",
      confirmLabel: "Clear cart",
      cancelLabel: "Keep items",
      tone: "danger",
    });
    if (ok) clear();
  };

  const summary = (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
      <h2 className="text-base font-semibold text-slate-900">Order summary</h2>

      {items.length > 0 && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-900">
            {freeDelivery ? "You have free delivery" : `Add ${inr(toFree)} more for free delivery`}
          </p>
          {!freeDelivery && (
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-100"
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress to free delivery"
            >
              <div
                className="h-full rounded-full bg-emerald-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      <dl className="mt-4 space-y-2.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-600">
            Subtotal ({count} {count === 1 ? "item" : "items"})
          </dt>
          <dd className="font-medium text-slate-900">{inr(subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-600">Delivery</dt>
          <dd className={`font-medium ${delivery === 0 ? "text-emerald-700" : "text-slate-900"}`}>
            {delivery === 0 ? "Free" : inr(delivery)}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-slate-200 pt-3 text-base">
          <dt className="font-semibold text-slate-900">Total</dt>
          <dd className="font-semibold text-slate-900">{inr(total)}</dd>
        </div>
      </dl>

      {problem && (
        <p role="alert" className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Some items are out of stock or above what we have. Update them to continue.
        </p>
      )}

      <button
        onClick={goCheckout}
        disabled={problem}
        className="mt-5 block w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/40 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
      >
        Proceed to checkout
      </button>
      <p className="mt-3 text-center text-xs text-slate-500">
        Cash on delivery available. You will be asked to log in at checkout.
      </p>
    </div>
  );

  const page = (
    // extra bottom space on phones so the checkout bar + bottom navbar never cover the footer
    <div className={`min-h-screen bg-slate-50 ${items.length > 0 ? "pb-28 lg:pb-0" : ""}`}>
      <Navbar cartCount={count} />

      <main className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
        {/* breadcrumb: hidden on mobile, visible from the sm breakpoint up */}
        <nav aria-label="Breadcrumb" className="hidden text-sm text-slate-500 sm:block">
          <Link to="/" className="hover:text-slate-800">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-800">Cart</span>
        </nav>

        {/* title row: small back button on phones only (the breadcrumb covers larger screens) */}
        <div className="flex items-center gap-2 sm:mt-2">
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 active:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 sm:hidden"
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
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Your cart
          </h1>
        </div>

        {items.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-white px-6 py-14 text-center ring-1 ring-slate-200 sm:mt-8 sm:py-16">
            <p className="text-base font-semibold text-slate-900">Your cart is empty</p>
            <p className="mt-1 text-sm text-slate-500">Add groceries and vegetables to get started.</p>
            <Link
              to="/shop"
              className="mt-6 inline-block rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid items-start gap-6 sm:mt-6 lg:grid-cols-[1fr_22rem] lg:gap-8">
            <section aria-label="Items in your cart">
              <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                {items.map((item) => {
                  const out = item.stock <= 0;
                  const g = item.grams; // total weight of this line, only for products sold per kg
                  const maxGrams = item.stock * 1000;
                  const over = !out && tooMuch(item);
                  const label = g ? `${item.name} (${gramsLabel(g)})` : item.name;
                  return (
                    <li key={item.productId} className="flex gap-3 p-3 sm:gap-4 sm:p-5">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-24 sm:w-24">
                        {item.image && (
                          <img
                            src={item.image}
                            alt=""
                            loading="lazy"
                            className={`h-full w-full object-cover ${out ? "opacity-50" : ""}`}
                          />
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2 sm:gap-3">
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 text-sm font-medium text-slate-900 sm:text-base">
                              {item.name}
                              {g && (
                                <span className="ml-2 inline-block rounded-full bg-emerald-50 px-2 py-0.5 align-middle text-xs font-semibold text-emerald-800">
                                  {gramsLabel(g)}
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-slate-500">
                              {g
                                ? `Rate: ${inr(ratePerKgOf(item))} per kg`
                                : `${inr(item.price)}${item.unit ? ` per ${item.unit}` : " each"}`}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-slate-900 sm:text-base">
                            {inr(item.price * item.quantity)}
                          </p>
                        </div>

                        {out && (
                          <p className="mt-1 text-xs font-medium text-red-600">
                            Out of stock. Remove it to continue.
                          </p>
                        )}
                        {over && (
                          <p className="mt-1 text-xs font-medium text-amber-700">
                            {g ? `Only ${gramsLabel(maxGrams)} available. ` : `Only ${item.stock} available. `}
                            <button
                              onClick={() => (g ? setWeight(item.productId, maxGrams) : setQuantity(item.productId, item.stock))}
                              className="py-1 underline underline-offset-2 hover:text-amber-900"
                            >
                              {g ? `Set to ${gramsLabel(maxGrams)}` : `Set to ${item.stock}`}
                            </button>
                          </p>
                        )}

                        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                          {out ? (
                            <span />
                          ) : g ? (
                            <WeightStepper
                              grams={g}
                              max={maxGrams}
                              onChange={(next) => setWeight(item.productId, next)}
                              name={item.name}
                            />
                          ) : (
                            <Stepper
                              qty={item.quantity}
                              max={item.stock}
                              onChange={(q) => setQuantity(item.productId, q)}
                              name={label}
                            />
                          )}
                          <button
                            onClick={() => removeItem(item.productId)}
                            className="-mr-2 px-2 py-2 text-sm font-medium text-slate-500 hover:text-red-600 active:text-red-600 focus:outline-none focus-visible:underline"
                          >
                            Remove<span className="sr-only"> {label}</span>
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 flex items-center justify-between text-sm sm:mt-4">
                <Link to="/shop" className="py-2 font-medium text-emerald-700 hover:text-emerald-800">
                  Continue shopping
                </Link>
                <button
                  onClick={handleClear}
                  className="py-2 font-medium text-slate-500 hover:text-red-600"
                >
                  Clear cart
                </button>
              </div>
            </section>

            <aside className="lg:sticky lg:top-24">{summary}</aside>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );

  return (
    <>
      {page}
      {/* "Clear cart" confirmation (bottom sheet on phones, centred box on larger screens) */}
      {confirmElement}
      {/* checkout bar: sits ON TOP of the bottom navbar (never covers it) and stays fixed while scrolling */}
      {items.length > 0 &&
        createPortal(
          <div
            className="fixed inset-x-0 z-40 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.06)] lg:hidden"
            style={{ bottom: `calc(${BOTTOM_NAV_H}px + env(safe-area-inset-bottom, 0px))` }}
          >
            <div className="mx-auto flex max-w-6xl items-center gap-4">
              <div>
                <p className="text-xs text-slate-500">Total</p>
                <p className="text-lg font-semibold text-slate-900">{inr(total)}</p>
              </div>
              <button
                onClick={goCheckout}
                disabled={problem}
                className="flex-1 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 active:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                Proceed to checkout
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}